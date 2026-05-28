import { logger, withSpan } from '@/lib/telemetry';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const META_API_VERSION = 'v25.0';

export async function enviarMensagemWhatsApp(
  telefone: string,
  mensagem: string
): Promise<void> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WHATSAPP_TOKEN ou PHONE_NUMBER_ID não configurados');
  }

  return withSpan('meta.enviar_mensagem', async (span) => {
    span.setAttribute('telefone', telefone);
    span.setAttribute('mensagem.tamanho', mensagem.length);

    const url = https://graph.facebook.com///messages;

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefone,
      type: 'text',
      text: { body: mensagem },
    });

    console.log('Meta API Request:', { url, body, telefone, mensagemLength: mensagem.length });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': Bearer ,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Meta API Error:', JSON.stringify(error));
      throw new Error(Meta API error: );
    }

    const data = await response.json();

    logger.info('Mensagem enviada via Meta API', {
      messageId: data.messages?.[0]?.id,
      telefone,
    });
  });
}

export async function enviarTemplateWhatsApp(
  telefone: string,
  templateName: string,
  languageCode: string = 'pt_BR',
  parameters?: Array<{ type: string; parameter_name: string; text: string }>
): Promise<void> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WHATSAPP_TOKEN ou PHONE_NUMBER_ID não configurados');
  }

  const url = https://graph.facebook.com///messages;

  const body: Record<string, any> = {
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (parameters) {
    body.template = {
      ...body.template,
      components: [{
        type: 'body',
        parameters: parameters.map((p) => ({
          type: p.type,
          parameter_name: p.parameter_name,
          text: p.text,
        })),
      }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': Bearer ,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(Meta API template error: );
  }
}

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<<{
    id: string;
    changes: Array<<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<<{
          wa_id: string;
          profile: { name: string };
        }>;
        messages?: Array<<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'audio' | 'document' | 'location';
          text?: { body: string };
          image?: { caption?: string };
          audio?: {};
          document?: { caption?: string };
          location?: {};
        }>;
        statuses?: Array<<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}

export function extrairMensagemMeta(payload: MetaWebhookPayload): {
  messageId: string;
  telefone: string;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'audio' | 'documento' | 'localizacao';
  nome?: string;
} | null {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return null;

  const conteudo = message.text?.body || 
                   message.image?.caption || 
                   message.document?.caption ||
                   '[Áudio/Localização]';

  const tipo = message.type === 'text' ? 'texto' :
               message.type === 'image' ? 'imagem' :
               message.type === 'audio' ? 'audio' :
               message.type === 'document' ? 'documento' : 'localizacao';

  const contato = value?.contacts?.[0];

  return {
    messageId: message.id,
    telefone: message.from,
    conteudo,
    tipo,
    nome: contato?.profile?.name,
  };
}
