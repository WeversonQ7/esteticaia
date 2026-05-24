// ============================================
// RESULT TYPE (Functional Error Handling)
// ============================================

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================
// ERROS DA APLICAÇÃO
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    public cause?: unknown,
    public statusCode: number = 500
  ) {
    super(code);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

export const ErrorCodes = {
  FALHA_PROCESSAMENTO: 'FALHA_PROCESSAMENTO',
  MENSAGEM_DUPLICADA: 'MENSAGEM_DUPLICADA',
  RATE_LIMIT_EXCEDIDO: 'RATE_LIMIT_EXCEDIDO',
  PIN_INVALIDO: 'PIN_INVALIDO',
  PIN_EXPIRADO: 'PIN_EXPIRADO',
  WEBHOOK_INVALIDO: 'WEBHOOK_INVALIDO',
  ASSINATURA_INVALIDA: 'ASSINATURA_INVALIDA',
  CLIENTE_NAO_ENCONTRADO: 'CLIENTE_NAO_ENCONTRADO',
  AGENDAMENTO_CONFLITO: 'AGENDAMENTO_CONFLITO',
  HORARIO_INDISPONIVEL: 'HORARIO_INDISPONIVEL',
  PERMISSAO_NEGADA: 'PERMISSAO_NEGADA',
} as const;

// ============================================
// TELEMETRY
// ============================================

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpan?: TraceContext;
}

export interface MetricLabels {
  [key: string]: string | number;
}

// ============================================
// DOMÍNIO - CLÍNICA
// ============================================

export interface Clinica {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: Record<string, unknown> | null;
  configuracoes: Record<string, unknown>;
  plano: 'trial' | 'basico' | 'pro' | 'empresarial';
  status: 'ativo' | 'inativo' | 'suspenso';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DOMÍNIO - CLIENTE
// ============================================

export interface Cliente {
  id: string;
  clinicaId: string;
  unidadeId: string | null;
  nome: string;
  telefone: string;
  email: string | null;
  dataNascimento: Date | null;
  cpf: string | null;
  endereco: Record<string, unknown> | null;
  anamnese: Record<string, unknown>;
  historico: string | null;
  tags: string[];
  whatsappId: string | null;
  status: 'ativo' | 'inativo' | 'bloqueado';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DOMÍNIO - AGENDAMENTO
// ============================================

export interface Agendamento {
  id: string;
  clinicaId: string;
  unidadeId: string | null;
  clienteId: string;
  profissionalId: string | null;
  servicoId: string;
  dataHora: Date;
  duracaoMinutos: number;
  status: 'pendente' | 'confirmado' | 'cancelado' | 'nao_compareceu' | 'concluido';
  confirmacaoWhatsapp: boolean;
  confirmacaoData: Date | null;
  observacoes: string | null;
  origem: 'manual' | 'whatsapp' | 'site' | 'app';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DOMÍNIO - CAIXA
// ============================================

export interface CaixaTransacao {
  id: string;
  clinicaId: string;
  unidadeId: string | null;
  usuarioId: string;
  agendamentoId: string | null;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'fechamento';
  categoria: 'servico' | 'produto' | 'pacote' | 'despesa' | 'salario' | 'ajuste' | 'outro';
  valor: number;
  formaPagamento: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | null;
  parcelas: number;
  descricao: string | null;
  comprovanteUrl: string | null;
  status: 'pendente' | 'confirmado' | 'estornado';
  estornadoEm: Date | null;
  createdAt: Date;
}

// ============================================
// DOMÍNIO - WHATSAPP/EVOLUTION
// ============================================

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { caption?: string };
      audioMessage?: { seconds: number };
    };
    messageType: string;
    messageTimestamp: number;
    owner: string;
    source: string;
  };
}

export interface MensagemProcessada {
  messageId: string;
  telefone: string;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'audio' | 'documento' | 'localizacao';
  direcao: 'entrada' | 'saida';
  instanceId: string;
}

// ============================================
// DOMÍNIO - IA/CLAUDE
// ============================================

export interface IntencaoIA {
  tipo: 'agendamento' | 'consulta' | 'caixa' | 'saudacao' | 'duvida' | 'outro';
  entidades: {
    data?: string;
    hora?: string;
    servico?: string;
    profissional?: string;
    valor?: number;
    tipoTransacao?: string;
  };
  confianca: number;
  respostaSugerida: string;
  acaoRequerida?: string;
}

export interface AgenteConfig {
  id: string;
  clinicaId: string;
  unidadeId: string | null;
  nomeAgente: string;
  saudacao: string;
  horarioAtendimento: {
    inicio: string;
    fim: string;
    dias: string[];
  };
  servicosAutomaticos: boolean;
  confirmacaoAutomatica: boolean;
  tempoLembrete: number;
  tomVoz: 'profissional' | 'amigavel' | 'formal';
  instrucoesPersonalizadas: string | null;
  evolutionInstance: string | null;
  status: 'ativo' | 'inativo';
}

// ============================================
// DOMÍNIO - ASSINATURA
// ============================================

export interface Assinatura {
  id: string;
  clinicaId: string;
  pagarmeId: string | null;
  stripeId: string | null;
  plano: string;
  valor: number;
  status: 'ativa' | 'cancelada' | 'suspensa' | 'vencida';
  proximaCobranca: Date | null;
  dadosPagamento: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}