import { NextRequest, NextResponse } from 'next/server';
import { evolutionWebhookPayloadSchema } from '@/schemas';
import { isDuplicado, checkRateLimit } from '@/lib/redis/client';
import { logger, webhookLatencyHistogram } from '@/lib/telemetry';
import { createSupabaseServerClient } from '@/lib/server/client';

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

// ============================================
// VALIDAR ASSINATURA DO WEBHOOK
// ============================================
function validarAssinatura(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const expected = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ============================================
// HANDLER PRINCIPAL - RETORNA 200 EM <100ms
// ============================================
export async function POST(request: NextRequest): Promise<NextResponse> {
  const inicio = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const payload = await request.text();
    const signature = request.headers.get('x-webhook-signature');

    if (WEBHOOK_SECRET && !validarAssinatura(payload, signature)) {
      logger.warn('Assinatura de webhook inválida', { requestId });
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    const dados = JSON.parse(payload);
    const validado = evolutionWebhookPayloadSchema.safeParse(dados);

    if (!validado.success) {
      logger.warn('Payload de webhook inválido', { requestId, erro: validado.error });
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const { event, instance, data } = validado.data;
    const messageId = data.key.id;
    const telefone = data.key.remoteJid.replace(/@s\.whatsapp\.net|@g\.us/, '');

    if (data.key.fromMe) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const duplicado = await isDuplicado(messageId);
    if (duplicado) {
      logger.info('Mensagem duplicada ignorada', { requestId, messageId });
      return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
    }

    const dentroDoLimite = await checkRateLimit(instance);
    if (!dentroDoLimite) {
      logger.warn('Rate limit excedido', { requestId, instance });
    }

    const supabase = await createSupabaseServerClient();

    const { error: queueError } = await supabase
      .from('whatsapp_queue')
      .insert({
        queue_name: 'whatsapp-messages',
        payload: {
          requestId,
          event,
          instance,
          messageId,
          telefone,
          payload: dados,
          timestamp: new Date().toISOString(),
          rateLimited: !dentroDoLimite,
        },
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (queueError) {
      logger.error('Falha ao enfileirar mensagem', queueError, { requestId });
    }

    const latencia = Date.now() - inicio;
    webhookLatencyHistogram.record(latencia, { provedor: 'evolution' });

    logger.info('Webhook processado e enfileirado', {
      requestId,
      latenciaMs: latencia,
      messageId,
      instance,
    });

    return NextResponse.json({ ok: true, requestId }, { status: 200 });

  } catch (erro) {
    const latencia = Date.now() - inicio;
    webhookLatencyHistogram.record(latencia, { provedor: 'evolution', erro: 'true' });

    logger.error('Erro no webhook', erro as Error, { requestId, latenciaMs: latencia });

    return NextResponse.json({ ok: true, erro: 'processamento_deferred' }, { status: 200 });
  }
}

// ============================================
// HEALTH CHECK
// ============================================
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', servico: 'evolution-webhook' });
}