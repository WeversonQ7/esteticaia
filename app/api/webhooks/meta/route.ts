import { NextRequest, NextResponse } from 'next/server';
import { isDuplicado, checkRateLimit } from '@/lib/redis/client';
import { logger, webhookLatencyHistogram } from '@/lib/telemetry';
import { createSupabaseServiceClient } from '@/lib/server/client';
import { extrairMensagemMeta, type MetaWebhookPayload } from '@/lib/meta/whatsapp';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('Webhook Meta verificado com sucesso');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verificação falhou' }, { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const inicio = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const payload = await request.json() as MetaWebhookPayload;
    const mensagem = extrairMensagemMeta(payload);

    if (!mensagem) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { messageId, telefone, conteudo, tipo } = mensagem;

    const duplicado = await isDuplicado(messageId);
    if (duplicado) {
      logger.info('Mensagem duplicada ignorada', { requestId, messageId });
      return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
    }

    const dentroDoLimite = await checkRateLimit(telefone);

    const supabase = createSupabaseServiceClient();
    const { error: queueError } = await supabase.rpc('enqueue_message', {
      queue_name: 'whatsapp-messages',
      payload: {
        requestId,
        messageId,
        telefone,
        conteudo: conteudo.substring(0, 4000),
        tipo,
        timestamp: new Date().toISOString(),
        rateLimited: !dentroDoLimite,
      },
    });

    if (queueError) {
      logger.error('Falha ao enfileirar mensagem', queueError, { requestId });
    }

    const latencia = Date.now() - inicio;
    webhookLatencyHistogram.record(latencia, { provedor: 'meta' });

    logger.info('Webhook Meta processado', { requestId, latenciaMs: latencia, messageId, telefone });

    return NextResponse.json({ ok: true, requestId }, { status: 200 });

  } catch (erro) {
    const latencia = Date.now() - inicio;
    webhookLatencyHistogram.record(latencia, { provedor: 'meta', erro: 'true' });
    logger.error('Erro no webhook Meta', erro as Error, { requestId });
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
