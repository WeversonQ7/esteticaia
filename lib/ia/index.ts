import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { withTrace } from '@/lib/telemetry';
import { RespostaIASchema, IntencaoClienteSchema } from '@/schemas/ia';
import { getRedis } from '@/lib/redis';
import type { TraceContext } from '@/types';
import type { MensagemEntrada } from '@/schemas/webhook';

const MODEL = 'claude-sonnet-4-5-20251022';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_horarios_disponiveis',
    description: 'Consulta horários disponíveis para agendamento em uma data específica',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        servico: { type: 'string', description: 'Nome do serviço desejado' },
        profissional: { type: 'string', description: 'Nome do profissional (opcional)' },
      },
      required: ['data'],
    },
  },
  {
    name: 'criar_agendamento',
    description: 'Cria um novo agendamento para o cliente',
    input_schema: {
      type: 'object',
      properties: {
        clienteNome: { type: 'string', description: 'Nome do cliente' },
        clienteTelefone: { type: 'string', description: 'Telefone do cliente' },
        servico: { type: 'string', description: 'Nome do serviço' },
        data: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        hora: { type: 'string', description: 'Hora no formato HH:mm' },
        profissional: { type: 'string', description: 'Nome do profissional' },
      },
      required: ['clienteNome', 'clienteTelefone', 'servico', 'data', 'hora'],
    },
  },
  {
    name: 'consultar_saldo_caixa',
    description: 'Consulta o saldo atual do caixa da clínica',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data específica (opcional, formato YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'registrar_transacao_caixa',
    description: 'Registra uma entrada ou saída no caixa',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['ENTRADA', 'SAIDA'], description: 'Tipo de transação' },
        valor: { type: 'number', description: 'Valor em reais' },
        descricao: { type: 'string', description: 'Descrição da transação' },
        categoria: { type: 'string', description: 'Categoria (SERVICO, PRODUTO, DESPESA_OPERACIONAL, etc)' },
        metodoPagamento: { type: 'string', enum: ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'], description: 'Método de pagamento' },
      },
      required: ['tipo', 'valor', 'descricao'],
    },
  },
  {
    name: 'consultar_preco_servico',
    description: 'Consulta o preço de um serviço específico',
    input_schema: {
      type: 'object',
      properties: {
        servico: { type: 'string', description: 'Nome do serviço' },
      },
      required: ['servico'],
    },
  },
];

const SYSTEM_PROMPT = `Você é a assistente virtual da clínica de estética. Seu nome é Luna.

REGRAS:
- Seja sempre cordial, profissional e objetiva
- Use emojis com moderação
- Confirme dados antes de executar ações
- Para agendamentos, sempre peça confirmação do cliente
- Para comandos de caixa sensíveis, informe que é necessário PIN
- Horário de funcionamento: Seg-Sex 9h às 19h, Sáb 9h às 14h
- Prazo de cancelamento: 24h antes

FLUXO DE CONFIRMAÇÃO:
Quando o cliente concordar com um horário, diga: "Perfeito! Para confirmar seu agendamento, por favor responda com a palavra CONFIRMO."

FLUXO DE CAIXA:
Para registrar transações ou fechar caixa, diga: "Para sua segurança, esta operação requer um PIN de 4 dígitos. Por favor, informe o PIN enviado separadamente."`;

export async function processarMensagemIA(
  mensagem: MensagemEntrada,
  clinicaId: string,
  ctx: TraceContext
): Promise<z.infer<typeof RespostaIASchema>> {
  return withTrace('ia.processar_mensagem', async (spanCtx) => {
    const span = spanCtx.span;
    span.setAttribute('clinica_id', clinicaId);
    span.setAttribute('remote_jid', mensagem.remoteJid);

    const historico = await buscarHistorico(mensagem.remoteJid, 10);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        ...historico,
        {
          role: 'user',
          content: `Cliente: ${mensagem.conteudo}
Telefone: ${mensagem.remoteJid}`,
        },
      ],
      tools: TOOLS,
    });

    span.setAttribute('input_tokens', response.usage.input_tokens);
    span.setAttribute('output_tokens', response.usage.output_tokens);

    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
      if (toolUse) {
        span.setAttribute('tool_name', toolUse.name);
        return await executarTool(toolUse, clinicaId, mensagem, ctx);
      }
    }

    const texto = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('');

    const resposta = RespostaIASchema.parse({
      tipo: 'OUTRO',
      mensagem: texto,
      acao: 'NENHUMA',
      requerConfirmacao: false,
    });

    await salvarHistorico(mensagem.remoteJid, mensagem.conteudo, resposta.mensagem);
    return resposta;
  }, ctx.span);
}

async function executarTool(
  toolUse: Anthropic.ToolUseBlock,
  clinicaId: string,
  mensagem: MensagemEntrada,
  ctx: TraceContext
): Promise<z.infer<typeof RespostaIASchema>> {
  const span = ctx.span;
  span.setAttribute('tool_executada', toolUse.name);

  const supabase = (await import('@/lib/supabase')).getSupabaseAdmin();

  switch (toolUse.name) {
    case 'consultar_horarios_disponiveis': {
      const { data, servico } = toolUse.input as { data: string; servico?: string };
      const { data: horarios } = await supabase.rpc('consultar_horarios_disponiveis', {
        p_clinica_id: clinicaId,
        p_data: data,
        p_servico: servico || null,
      });

      return RespostaIASchema.parse({
        tipo: 'CONSULTAR_HORARIOS',
        mensagem: horarios?.length
          ? `Horários disponíveis para ${formatarData(data)}:\n${horarios.map((h: { hora: string }) => `• ${h.hora}`).join('\n')}`
          : `Não há horários disponíveis para ${formatarData(data)}. Posso verificar outra data?`,
        dados: { horarios },
        acao: 'NENHUMA',
      });
    }

    case 'criar_agendamento': {
      const input = toolUse.input as {
        clienteNome: string;
        clienteTelefone: string;
        servico: string;
        data: string;
        hora: string;
        profissional?: string;
      };

      const agendamentoId = crypto.randomUUID();
      await getRedis().setex(
        `pending:agendamento:${agendamentoId}`,
        600,
        JSON.stringify({ ...input, clinicaId })
      );

      return RespostaIASchema.parse({
        tipo: 'AGENDAR',
        mensagem: `✅ Pré-agendamento registrado!\n\n📅 ${formatarData(input.data)} às ${input.hora}\n💆 ${input.servico}\n👤 ${input.profissional || 'Profissional disponível'}\n\nPara confirmar, responda: *CONFIRMO*\nVocê tem 10 minutos.`,
        dados: { agendamentoId, ...input },
        acao: 'CONFIRMAR',
        requerConfirmacao: true,
      });
    }

    case 'consultar_saldo_caixa': {
      const { data: saldo } = await supabase.rpc('consultar_saldo_caixa', {
        p_clinica_id: clinicaId,
        p_data: (toolUse.input as { data?: string }).data || null,
      });

      return RespostaIASchema.parse({
        tipo: 'CAIXA_SALDO',
        mensagem: `💰 Saldo do caixa: ${formatarMoeda(saldo || 0)}`,
        dados: { saldo },
        acao: 'NENHUMA',
      });
    }

    case 'registrar_transacao_caixa': {
      return RespostaIASchema.parse({
        tipo: 'CAIXA_REGISTRAR',
        mensagem: '🔒 Para registrar esta transação, é necessário um PIN de confirmação. Solicite ao administrador.',
        acao: 'CAIXA_PIN',
        requerConfirmacao: true,
      });
    }

    case 'consultar_preco_servico': {
      const { servico } = toolUse.input as { servico: string };
      const { data: precos } = await supabase
        .from('servicos')
        .select('nome, preco, duracao_minutos')
        .eq('clinica_id', clinicaId)
        .ilike('nome', `%${servico}%`)
        .limit(3);

      return RespostaIASchema.parse({
        tipo: 'CONSULTAR_PRECO',
        mensagem: precos?.length
          ? `Encontrei estes serviços:\n${precos.map((s: { nome: string; preco: number; duracao_minutos: number }) => `• ${s.nome}: ${formatarMoeda(s.preco)} (${s.duracao_minutos}min)`).join('\n')}`
          : `Não encontrei o serviço "${servico}". Posso verificar outro nome?`,
        dados: { precos },
        acao: 'NENHUMA',
      });
    }

    default:
      return RespostaIASchema.parse({
        tipo: 'OUTRO',
        mensagem: 'Desculpe, não consegui processar sua solicitação. Pode reformular?',
        acao: 'NENHUMA',
      });
  }
}

async function buscarHistorico(remoteJid: string, limite: number): Promise<Anthropic.MessageParam[]> {
  const redis = getRedis();
  const key = `historico:${remoteJid}`;
  const historico = await redis.lrange(key, 0, limite - 1);

  return historico.reverse().map((item) => JSON.parse(item) as Anthropic.MessageParam);
}

async function salvarHistorico(remoteJid: string, usuario: string, assistente: string): Promise<void> {
  const redis = getRedis();
  const key = `historico:${remoteJid}`;

  await redis.lpush(key, JSON.stringify({ role: 'user', content: usuario }));
  await redis.lpush(key, JSON.stringify({ role: 'assistant', content: assistente }));
  await redis.ltrim(key, 0, 49);
  await redis.expire(key, 86400);
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(data));
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
