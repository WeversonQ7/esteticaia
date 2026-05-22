import { z } from 'zod';

export const WebhookEvolutionSchema = z.object({
  event: z.enum(['messages.upsert', 'messages.update', 'connection.update']),
  instance: z.string().min(1).max(100),
  data: z.object({
    key: z.object({
      remoteJid: z.string().min(1),
      fromMe: z.boolean(),
      id: z.string().min(1),
    }),
    message: z.object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({
        text: z.string(),
      }).optional(),
    }).optional(),
    messageTimestamp: z.number().int().positive(),
    pushName: z.string().optional(),
    status: z.enum(['PENDING', 'SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED']).optional(),
  }),
  destination: z.string().url().optional(),
  date_time: z.string().datetime().optional(),
  sender: z.string().min(1).optional(),
  server_url: z.string().url().optional(),
  apikey: z.string().optional(),
});

export const WebhookPagarmeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'subscription.created',
    'subscription.paid',
    'subscription.canceled',
    'subscription.overdue',
    'charge.paid',
    'charge.refunded',
    'charge.failed',
  ]),
  created_at: z.string().datetime(),
  data: z.record(z.unknown()),
});

export const MensagemEntradaSchema = z.object({
  messageId: z.string().min(1),
  instanceId: z.string().min(1),
  remoteJid: z.string().min(1),
  conteudo: z.string().min(1).max(4000),
  timestamp: z.number().int().positive(),
  pushName: z.string().optional(),
  fromMe: z.boolean(),
});

export type WebhookEvolution = z.infer<typeof WebhookEvolutionSchema>;
export type WebhookPagarme = z.infer<typeof WebhookPagarmeSchema>;
export type MensagemEntrada = z.infer<typeof MensagemEntradaSchema>;
