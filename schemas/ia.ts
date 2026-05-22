import { z } from 'zod';

export const IntencaoClienteSchema = z.enum([
  'AGENDAR',
  'CONFIRMAR_AGENDAMENTO',
  'CANCELAR_AGENDAMENTO',
  'CONSULTAR_PRECO',
  'CONSULTAR_HORARIOS',
  'CAIXA_SALDO',
  'CAIXA_REGISTRAR',
  'CAIXA_FECHAR',
  'RELATORIO',
  'SAUDACAO',
  'OUTRO',
]);

export const AgendamentoExtracaoSchema = z.object({
  intencao: z.literal('AGENDAR'),
  servico: z.string().min(1).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  profissional: z.string().optional(),
  nomeCliente: z.string().optional(),
  telefone: z.string().optional(),
  confianca: z.number().min(0).max(1),
});

export const RespostaIASchema = z.object({
  tipo: IntencaoClienteSchema,
  mensagem: z.string().min(1).max(2000),
  dados: z.record(z.unknown()).optional(),
  acao: z.enum(['AGENDAR', 'CONFIRMAR', 'CAIXA_PIN', 'CONSULTAR', 'NENHUMA']).optional(),
  requerConfirmacao: z.boolean().default(false),
});

export type IntencaoCliente = z.infer<typeof IntencaoClienteSchema>;
export type AgendamentoExtracao = z.infer<typeof AgendamentoExtracaoSchema>;
export type RespostaIA = z.infer<typeof RespostaIASchema>;
