import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import type { TraceContext } from '@/types';

const tracer = trace.getTracer('esteticaia', '1.0.0');
const meter = metrics.getMeter('esteticaia', '1.0.0');

// Métricas
export const mensagensProcessadasCounter = meter.createCounter('mensagens.processadas', {
  description: 'Total de mensagens processadas',
});

export const mensagensFalhasCounter = meter.createCounter('mensagens.falhas', {
  description: 'Total de mensagens com falha',
});

export const agendamentosCriadosCounter = meter.createCounter('agendamentos.criados', {
  description: 'Total de agendamentos criados',
});

export const webhookLatencyHistogram = meter.createHistogram('webhook.latencia', {
  description: 'Latência de processamento de webhooks em ms',
  unit: 'ms',
});

// ============================================
// TRACING
// ============================================

export function createSpan(
  name: string,
  parentCtx?: TraceContext
): { span: ReturnType<typeof tracer.startSpan>; end: () => void } {
  const span = tracer.startSpan(name, {
    attributes: {
      'service.name': process.env.OTEL_SERVICE_NAME || 'esteticaia',
    },
  });

  if (parentCtx) {
    // Vincula ao span pai se fornecido
    span.setAttribute('parent.traceId', parentCtx.traceId);
  }

  return {
    span,
    end: () => {
      span.end();
    },
  };
}

export async function withSpan<T>(
  name: string,
  fn: (span: ReturnType<typeof tracer.startSpan>) => Promise<T>,
  parentCtx?: TraceContext
): Promise<T> {
  const { span, end } = createSpan(name, parentCtx);

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
    throw error;
  } finally {
    end();
  }
}

// ============================================
// LOGGER ESTRUTURADO
// ============================================

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  traceId?: string;
  spanId?: string;
  contexto?: Record<string, unknown>;
  erro?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export function log(
  level: LogEntry['level'],
  message: string,
  contexto?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    contexto,
  };

  // Adiciona trace context se disponível
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    entry.traceId = spanContext.traceId;
    entry.spanId = spanContext.spanId;
  }

  // Em produção, envie para collector OTEL ou serviço de logs
  // Por enquanto, console estruturado
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, erro?: Error, ctx?: Record<string, unknown>) => {
    const contexto = {
      ...ctx,
      erro: erro
        ? {
            message: erro.message,
            stack: erro.stack,
            code: (erro as { code?: string }).code,
          }
        : undefined,
    };
    log('error', msg, contexto);
  },
};
