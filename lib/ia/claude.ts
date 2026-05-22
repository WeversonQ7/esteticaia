import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logger, withSpan } from '@/lib/telemetry';
import type { IntencaoIA, AgenteConfig } from '@/types';

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY não configurada');
}

const anthropic = new Anthropic({ apiKey });

// Schema de resposta estruturada da IA
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

// ============================================
// SYSTEM PROMPT DINÂMICO
// ============================================

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

Responda em JSON com formato:
{
  "intencao": "agendamento|consulta|caixa|saudacao|duvida|outro",
  "entidades": { "data": "", "hora": "", "servico": "", "profissional": "", "valor": 0, "tipoTransacao": "" },
  "confianca": 0.0,
  "resposta": "texto para enviar ao cliente",
  "acao": "acao_requerida_opcional"
}`;
}

// ============================================
// PROCESSAR MENSAGEM
// ============================================

export async function processarMensagemComIA(
  mensagem: string,
  config: AgenteConfig,
  contextoConversa: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<IntencaoIA> {
  return withSpan('ia.processar_mensagem', async (span) => {
    span.setAttribute('mensagem.tamanho', mensagem.length);
    span.setAttribute('agente.nome', config.nomeAgente);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: construirSystemPrompt(config),
        messages: [
          ...contextoConversa.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: mensagem },
        ],
        tools: [
          {
            name: 'consultar_agenda',
            description: 'Consulta disponibilidade de horários',
            input_schema: {
              type: 'object',
              properties: {
                data: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
                servico: { type: 'string' },
                profissional: { type: 'string' },
              },
              required: ['data'],
            },
          },
          {
            name: 'criar_agendamento',
            description: 'Cria um novo agendamento',
            input_schema: {
              type: 'object',
              properties: {
                clienteId: { type: 'string' },
                servicoId: { type: 'string' },
                profissionalId: { type: 'string' },
                dataHora: { type: 'string', description: 'ISO 8601' },
              },
              required: ['clienteId', 'servicoId', 'dataHora'],
            },
          },
          {
            name: 'consultar_caixa',
            description: 'Consulta saldo e transações do caixa',
            input_schema: {
              type: 'object',
              properties: {
                data: { type: 'string' },
                tipo: { type: 'string', enum: ['entrada', 'saida', 'todos'] },
              },
            },
          },
        ],
      });

      // Extrai resposta textual
      const content = response.content[0];
      let respostaTexto = '';

      if (content.type === 'text') {
        respostaTexto = content.text;
      }

      // Tenta parsear JSON
      let parsed;
      try {
        const jsonMatch = respostaTexto.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = {
            intencao: 'outro',
            entidades: {},
            confianca: 0.5,
            resposta: respostaTexto,
          };
        }
      } catch {
        parsed = {
          intencao: 'outro',
          entidades: {},
          confianca: 0.5,
          resposta: respostaTexto,
        };
      }

      const validado = respostaIASchema.parse(parsed);

      span.setAttribute('ia.intencao', validado.intencao);
      span.setAttribute('ia.confianca', validado.confianca);

      logger.info('Mensagem processada pela IA', {
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
      logger.error('Falha ao processar mensagem com IA', erro as Error);
      span.recordException(erro as Error);
      throw erro;
    }
  });
}

// ============================================
// GERAR RESPOSTA SIMPLES (preview do agente)
// ============================================

export async function gerarPreviewResposta(
  mensagem: string,
  config: AgenteConfig
): Promise<{ resposta: string; pensamento: string }> {
  return withSpan('ia.preview', async (span) => {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: `${construirSystemPrompt(config)}\n\nIMPORTANTE: Mostre seu raciocínio passo a passo antes da resposta final, separado por \"---PENSAMENTO---\" e \"---RESPOSTA---\".`,
      messages: [{ role: 'user', content: mensagem }],
    });

    const content = response.content[0];
    const texto = content.type === 'text' ? content.text : '';

    const partes = texto.split('---RESPOSTA---');
    const pensamento = partes[0]?.replace('---PENSAMENTO---', '').trim() || '';
    const resposta = partes[1]?.trim() || texto;

    span.setAttribute('preview.tamanho_resposta', resposta.length);

    return { resposta, pensamento };
  });
}
