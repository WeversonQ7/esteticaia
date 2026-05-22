import { NextRequest, NextResponse } from 'next/server';
import { pagarmeWebhookSchema } from '@/schemas';
import { createSupabaseServiceClient } from '@/lib/server/client';
import { logger } from '@/lib/telemetry';
import crypto from 'crypto';

const PAGARME_WEBHOOK_SECRET = process.env.PAGARME_WEBHOOK_SECRET;

function validarAssinaturaPagarme(payload: string, signature: string | null): boolean {
  if (!PAGARME_WEBHOOK_SECRET || !signature) return false;

  const hmac = crypto.createHmac('sha256', PAGARME_WEBHOOK_SECRET);
  hmac.update(payload);
  const expected = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const inicio = Date.now();

  try {
    const payload = await request.text();
    const signature = request.headers.get('x-pagarme-signature');

    if (!validarAssinaturaPagarme(payload, signature)) {
      logger.warn('Assinatura Pagar.me inválida');
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    const dados = JSON.parse(payload);
    const validado = pagarmeWebhookSchema.parse(dados);

    const supabase = createSupabaseServiceClient();

    // Idempotência - verificar se já processou
    const { data: existente } = await supabase
      .from('webhook_log')
      .select('id')
      .eq('provedor', 'pagarme')
      .eq('event_id', validado.id)
      .single();

    if (existente) {
      return NextResponse.json({ ok: true, idempotente: true }, { status: 200 });
    }

    // Salvar log
    await supabase.from('webhook_log').insert({
      provedor: 'pagarme',
      event_id: validado.id,
      event_type: validado.type,
      payload: validado.data,
    });

    // Processar evento
    switch (validado.type) {
      case 'subscription.paid':
        await processarPagamentoAssinatura(supabase, validado.data);
        break;
      case 'subscription.canceled':
        await processarCancelamento(supabase, validado.data);
        break;
      case 'subscription.overdue':
        await processarAtraso(supabase, validado.data);
        break;
    }

    logger.info('Webhook Pagar.me processado', {
      evento: validado.type,
      eventId: validado.id,
      latenciaMs: Date.now() - inicio,
    });

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (erro) {
    logger.error('Erro no webhook Pagar.me', erro as Error);
    return NextResponse.json({ ok: true }, { status: 200 }); // Sempre 200
  }
}

async function processarPagamentoAssinatura(supabase: ReturnType<typeof createSupabaseServiceClient>, data: unknown) {
  const payload = data as { subscription: { id: string; status: string }; current_cycle: { start_at: string; end_at: string } };

  await supabase
    .from('assinatura')
    .update({
      status: 'ativa',
      proxima_cobranca: payload.current_cycle.end_at,
    })
    .eq('pagarme_id', payload.subscription.id);
}

async function processarCancelamento(supabase: ReturnType<typeof createSupabaseServiceClient>, data: unknown) {
  const payload = data as { subscription: { id: string } };

  await supabase
    .from('assinatura')
    .update({ status: 'cancelada' })
    .eq('pagarme_id', payload.subscription.id);
}

async function processarAtraso(supabase: ReturnType<typeof createSupabaseServiceClient>, data: unknown) {
  const payload = data as { subscription: { id: string } };

  await supabase
    .from('assinatura')
    .update({ status: 'vencida' })
    .eq('pagarme_id', payload.subscription.id);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', servico: 'pagarme-webhook' });
}
