import { z } from 'zod';

export const StatusAgendamentoSchema = z.enum([
  'PENDENTE',
  'CONFIRMADO',
  'CANCELADO',
  'CONCLUIDO',
  'NAO_COMPARECEU',
]);

export const AgendamentoSchema = z.object({
  id: z.string().uuid().optional(),
  clinicaId: z.string().uuid(),
  unidadeId: z.string().uuid().optional(),
  clienteId: z.string().uuid(),
  profissionalId: z.string().uuid(),
  servicoId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: StatusAgendamentoSchema.default('PENDENTE'),
  origem: z.enum(['WHATSAPP', 'MANUAL', 'ONLINE']).default('WHATSAPP'),
  valor: z.number().positive().optional(),
  observacoes: z.string().max(500).optional(),
  confirmadoEm: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const ConfirmacaoSchema = z.object({
  agendamentoId: z.string().uuid(),
  resposta: z.enum(['CONFIRMO', 'CANCELO', 'REAGENDAR']),
  mensagemId: z.string().min(1),
});

export type StatusAgendamento = z.infer<typeof StatusAgendamentoSchema>;
export type Agendamento = z.infer<typeof AgendamentoSchema>;
export type Confirmacao = z.infer<typeof ConfirmacaoSchema>;
