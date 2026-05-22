import { z } from 'zod';

export const TipoTransacaoSchema = z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']);

export const TransacaoCaixaSchema = z.object({
  id: z.string().uuid().optional(),
  clinicaId: z.string().uuid(),
  unidadeId: z.string().uuid().optional(),
  tipo: TipoTransacaoSchema,
  valor: z.number().positive().max(100000),
  descricao: z.string().min(1).max(200),
  categoria: z.enum([
    'SERVICO',
    'PRODUTO',
    'DESPESA_OPERACIONAL',
    'SALARIO',
    'AJUSTE',
    'OUTRO',
  ]),
  profissionalId: z.string().uuid().optional(),
  agendamentoId: z.string().uuid().optional(),
  metodoPagamento: z.enum(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO']),
  comprovanteUrl: z.string().url().optional(),
  observacoes: z.string().max(500).optional(),
  createdAt: z.string().datetime().optional(),
  createdBy: z.string().uuid(),
});

export const FiltroCaixaSchema = z.object({
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  tipo: TipoTransacaoSchema.optional(),
  categoria: z.string().optional(),
  profissionalId: z.string().uuid().optional(),
  metodoPagamento: z.string().optional(),
  minValor: z.number().optional(),
  maxValor: z.number().optional(),
});

export type TipoTransacao = z.infer<typeof TipoTransacaoSchema>;
export type TransacaoCaixa = z.infer<typeof TransacaoCaixaSchema>;
export type FiltroCaixa = z.infer<typeof FiltroCaixaSchema>;
