import { z } from 'zod';

// ============================================
// SCHEMAS BASE
// ============================================

export const uuidSchema = z.string().uuid();
export const telefoneSchema = z.string().regex(/^\d{10,13}$/, 'Telefone deve conter 10 a 13 dígitos');
export const cpfSchema = z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos').optional().nullable();
export const emailSchema = z.string().email('Email inválido').optional().nullable();
export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN deve conter 4 dígitos');

// ============================================
// SCHEMAS - WEBHOOK EVOLUTION API
// ============================================

export const evolutionMessageKeySchema = z.object({
  remoteJid: z.string(),
  fromMe: z.boolean(),
  id: z.string(),
});

export const evolutionMessageDataSchema = z.object({
  key: evolutionMessageKeySchema,
  message: z.object({
    conversation: z.string().optional(),
    extendedTextMessage: z.object({ text: z.string() }).optional(),
    imageMessage: z.object({ caption: z.string().optional() }).optional(),
    audioMessage: z.object({ seconds: z.number() }).optional(),
  }),
  messageType: z.string(),
  messageTimestamp: z.number(),
  owner: z.string(),
  source: z.string(),
});

export const evolutionWebhookPayloadSchema = z.object({
  event: z.string(),
  instance: z.string(),
  data: evolutionMessageDataSchema,
});

export type EvolutionWebhookPayload = z.infer<typeof evolutionWebhookPayloadSchema>;

// ============================================
// SCHEMAS - PROCESSAMENTO DE MENSAGEM
// ============================================

export const mensagemProcessadaSchema = z.object({
  messageId: z.string().min(1),
  telefone: telefoneSchema,
  conteudo: z.string().min(1).max(4000),
  tipo: z.enum(['texto', 'imagem', 'audio', 'documento', 'localizacao']),
  direcao: z.enum(['entrada', 'saida']),
  instanceId: z.string(),
});

export type MensagemProcessada = z.infer<typeof mensagemProcessadaSchema>;

// ============================================
// SCHEMAS - AGENDAMENTO
// ============================================

export const criarAgendamentoSchema = z.object({
  clinicaId: uuidSchema,
  unidadeId: uuidSchema.optional().nullable(),
  clienteId: uuidSchema,
  profissionalId: uuidSchema.optional().nullable(),
  servicoId: uuidSchema,
  dataHora: z.string(),
  duracaoMinutos: z.number().int().min(15).max(480).default(60),
  observacoes: z.string().max(500).optional().nullable(),
  origem: z.enum(['manual', 'whatsapp', 'site', 'app']).default('whatsapp'),
});

export type CriarAgendamentoInput = z.infer<typeof criarAgendamentoSchema>;

export const confirmarAgendamentoSchema = z.object({
  agendamentoId: uuidSchema,
  clienteId: uuidSchema,
  confirmado: z.boolean(),
});

export type ConfirmarAgendamentoInput = z.infer<typeof confirmarAgendamentoSchema>;

// ============================================
// SCHEMAS - CAIXA
// ============================================

export const criarTransacaoCaixaSchema = z.object({
  clinicaId: uuidSchema,
  unidadeId: uuidSchema.optional().nullable(),
  usuarioId: uuidSchema,
  agendamentoId: uuidSchema.optional().nullable(),
  tipo: z.enum(['entrada', 'saida', 'ajuste', 'fechamento']),
  categoria: z.enum(['servico', 'produto', 'pacote', 'despesa', 'salario', 'ajuste', 'outro']),
  valor: z.number().positive().max(999999.99),
  formaPagamento: z.enum(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia']).optional().nullable(),
  parcelas: z.number().int().min(1).max(12).default(1),
  descricao: z.string().max(500).optional().nullable(),
});

export type CriarTransacaoCaixaInput = z.infer<typeof criarTransacaoCaixaSchema>;

export const comandoCaixaSchema = z.object({
  clinicaId: uuidSchema,
  usuarioId: uuidSchema,
  comando: z.enum(['saque', 'ajuste', 'fechamento', 'relatorio']),
  valor: z.number().optional(),
  descricao: z.string().optional(),
});

export type ComandoCaixaInput = z.infer<typeof comandoCaixaSchema>;

export const validarPinSchema = z.object({
  clinicaId: uuidSchema,
  usuarioId: uuidSchema,
  pin: pinSchema,
  operacaoId: z.string(),
});

export type ValidarPinInput = z.infer<typeof validarPinSchema>;

// ============================================
// SCHEMAS - CLIENTE
// ============================================

export const criarClienteSchema = z.object({
  clinicaId: uuidSchema,
  unidadeId: uuidSchema.optional().nullable(),
  nome: z.string().min(2).max(100),
  telefone: telefoneSchema,
  email: emailSchema,
  dataNascimento: z.string().date().optional().nullable(),
  cpf: cpfSchema,
  endereco: z.record(z.unknown()).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export type CriarClienteInput = z.infer<typeof criarClienteSchema>;

// ============================================
// SCHEMAS - WEBHOOK PAGAR.ME
// ============================================

export const pagarmeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.unknown()),
  created_at: z.string().datetime(),
});

export type PagarmeWebhookPayload = z.infer<typeof pagarmeWebhookSchema>;

// ============================================
// SCHEMAS - CONFIGURAÇÃO AGENTE
// ============================================

export const agenteConfigSchema = z.object({
  clinicaId: uuidSchema,
  unidadeId: uuidSchema.optional().nullable(),
  nomeAgente: z.string().min(2).max(50).default('Assistente Virtual'),
  saudacao: z.string().max(500).default('Olá! Sou o assistente virtual da clínica. Como posso ajudar?'),
  horarioAtendimento: z.object({
    inicio: z.string().regex(/^\d{2}:\d{2}$/),
    fim: z.string().regex(/^\d{2}:\d{2}$/),
    dias: z.array(z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])),
  }).default({ inicio: '08:00', fim: '20:00', dias: ['seg', 'ter', 'qua', 'qui', 'sex'] }),
  servicosAutomaticos: z.boolean().default(true),
  confirmacaoAutomatica: z.boolean().default(true),
  tempoLembrete: z.number().int().min(5).max(1440).default(60),
  tomVoz: z.enum(['profissional', 'amigavel', 'formal']).default('profissional'),
  instrucoesPersonalizadas: z.string().max(2000).optional().nullable(),
});

export type AgenteConfigInput = z.infer<typeof agenteConfigSchema>;

// ============================================
// SCHEMAS - RESPOSTA API PADRÃO
// ============================================

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }).optional(),
    meta: z.object({
      timestamp: z.string().datetime(),
      requestId: z.string(),
    }).optional(),
  });

export const paginacaoSchema = z.object({
  pagina: z.number().int().min(1).default(1),
  limite: z.number().int().min(1).max(100).default(20),
});

export type PaginacaoInput = z.infer<typeof paginacaoSchema>;
