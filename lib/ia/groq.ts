import { z } from 'zod';
import { logger, withSpan } from '@/lib/telemetry';
import type { IntencaoIA, AgenteConfig } from '@/types';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY não configurada');
}

const respostaIASchema = z.object({
  intencao: z.enum(['agendamento', 'consulta', 'caixa', 'saudacao', 'duvida', 'outro']),
  entidades: z.object({
    data: z.string().optional(),
    hora: z.string().optional(),
    servico: z.string().optional(),
    profissional: z.string().optional(),
    valor: z.number().optional(),
    tipoTransacao: z.string().optional(),
  }).default({}),
  confianca: z.number().min(0).max(1),
  resposta: z.string(),
  acao: z.string().optional(),
});

function construirSystemPrompt(config: AgenteConfig): string {
  return `Você é ${config.nomeAgente}, assistente virtual de uma clínica de estética.

TOM DE VOZ: ${config.tomVoz}

HORÁRIO DE ATENDIMENTO: ${config.horarioAtendimento.inicio} às ${config.horarioAtendimento.fim}
DIAS: ${config.horarioAtendimento.dias.join(', ')}

CAPACIDADES:
- Agendar procedimentos estéticos
- Consultar agenda e disponibilidade
- Informar sobre serviços e preços
- Registrar transações de caixa (com confirmação)
- Enviar lembretes de agendamento

REGRAS:
- Seja ${config.tomVoz === 'amigavel' ? 'simpática e acolhedora' : config.tomVoz === 'formal' ? 'formal e educada' : 'profissional e objetiva'}
- Sempre confirme dados antes de agendar
- Para valores, use formato R$ 0,00
- Horários devem estar no formato HH:MM
- Datas: aceite "amanhã", "próxima semana", etc. e converta para YYYY-MM-DD
- Se não souber algo, ofereça transferir para atendente humano
- NUNCA invente preços ou serviços não cadastrados

${config.instrucoesPersonalizadas || ''}

Responda APENAS em JSON com este formato exato:
{
  "intencao": "agendamento|consulta|caixa|saudacao|duvida|outro",
  "entidades": { "data": "", "hora": "", "servico": "", "profissional": "", "valor": 0, "tipoTransacao": "" },
  "confianca": 0.0,
  "resposta": "texto para enviar ao cliente",
  "acao": "acao_requerida_opcional"
}`;
}

export async function processarMensagemComIA(
  mensagem: string,
  config: AgenteConfig,
  contextoConversa: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<IntencaoIA> {
  return withSpan('ia.processar_mensagem', async (span) => {
    span.setAttribute('mensagem.tamanho', mensagem.length);
    span.setAttribute('agente.nome', config.nomeAgente);

    try {
      const messages = [
        { role: 'system', content: construirSystemPrompt(config) },
        ...contextoConversa.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: mensagem },
      ];

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {
          intencao: 'outro',
          entidades: {},
          confianca: 0.5,
          resposta: content,
        };
      }

      const validado = respostaIASchema.parse(parsed);

      span.setAttribute('ia.intencao', validado.intencao);
      span.setAttribute('ia.confianca', validado.confianca);

      logger.info('Mensagem processada pela IA (Groq)', {
        intencao: validado.intencao,
        confianca: validado.confianca,
      });

      return {
        tipo: validado.intencao,
        entidades: validado.entidades,
        confianca: validado.confianca,
        respostaSugerida: validado.resposta,
        acaoRequerida: validado.acao,
      };
    } catch (erro) {
      logger.error('Falha ao processar mensagem com Groq', erro as Error);
      span.recordException(erro as Error);
      throw erro;
    }
  });
}

export async function gerarPreviewResposta(
  mensagem: string,
  config: AgenteConfig
): Promise<{ resposta: string; pensamento: string }> {
  return withSpan('ia.preview', async (span) => {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `${construirSystemPrompt(config)}\n\nIMPORTANTE: Mostre seu raciocínio passo a passo antes da resposta final, separado por \"---PENSAMENTO---\" e \"---RESPOSTA---\".`,
          },
          { role: 'user', content: mensagem },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    const texto = data.choices[0]?.message?.content || '';

    const partes = texto.split('---RESPOSTA---');
    const pensamento = partes[0]?.replace('---PENSAMENTO---', '').trim() || '';
    const resposta = partes[1]?.trim() || texto;

    span.setAttribute('preview.tamanho_resposta', resposta.length);

    return { resposta, pensamento };
  });
}
