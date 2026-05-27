import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/telemetry';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY não configurada');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

// ============================================
// CRIAR ASSINATURA
// ============================================
export async function criarAssinaturaStripe(
  clinicaId: string,
  plano: string,
  email: string,
  nome: string
): Promise<{ clientSecret: string; subscriptionId: string }> {
  const supabase = await createSupabaseServerClient();

  // Buscar ou criar customer
  const { data: clinica } = await supabase
    .from('clinica')
    .select('stripe_customer_id')
    .eq('id', clinicaId)
    .single();

  let customerId = clinica?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: nome,
      metadata: { clinica_id: clinicaId },
    });
    customerId = customer.id;

    await supabase
      .from('clinica')
      .update({ stripe_customer_id: customerId })
      .eq('id', clinicaId);
  }

  // Criar subscription
  const priceId = getPriceIdPorPlano(plano);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  // Salvar no banco
  await supabase.from('assinatura').insert({
    clinica_id: clinicaId,
    stripe_id: subscription.id,
    plano,
    valor: getValorPlano(plano),
    status: 'ativa',
  });

  logger.info('Assinatura Stripe criada', { subscriptionId: subscription.id, clinicaId });

  const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

  return {
    clientSecret: paymentIntent.client_secret!,
    subscriptionId: subscription.id,
  };
}

// ============================================
// CANCELAR ASSINATURA
// ============================================
export async function cancelarAssinaturaStripe(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.cancel(subscriptionId);

  const supabase = await createSupabaseServerClient();
  await supabase
    .from('assinatura')
    .update({ status: 'cancelada' })
    .eq('stripe_id', subscriptionId);

  logger.info('Assinatura Stripe cancelada', { subscriptionId });
}

// ============================================
// WEBHOOK HANDLER
// ============================================
export async function handleStripeWebhook(payload: string, signature: string): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET não configurada');
  }

  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  const supabase = await createSupabaseServerClient();

  switch (event.type) {
    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        await supabase
          .from('assinatura')
          .update({
            status: 'ativa',
            proxima_cobranca: new Date(invoice.period_end * 1000).toISOString(),
          })
          .eq('stripe_id', invoice.subscription);
      }
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      if (failedInvoice.subscription) {
        await supabase
          .from('assinatura')
          .update({ status: 'vencida' })
          .eq('stripe_id', failedInvoice.subscription);
      }
      break;

    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from('assinatura')
        .update({ status: 'cancelada' })
        .eq('stripe_id', subscription.id);
      break;
  }

  logger.info('Webhook Stripe processado', { evento: event.type });
}

// ============================================
// HELPERS
// ============================================
function getPriceIdPorPlano(plano: string): string {
  const priceIds: Record<string, string> = {
    basico: process.env.STRIPE_PRICE_BASICO!,
    pro: process.env.STRIPE_PRICE_PRO!,
    empresarial: process.env.STRIPE_PRICE_EMPRESARIAL!,
  };

  return priceIds[plano] || priceIds.basico;
}

function getValorPlano(plano: string): number {
  const valores: Record<string, number> = {
    basico: 97.00,
    pro: 197.00,
    empresarial: 497.00,
  };

  return valores[plano] || 97.00;
}