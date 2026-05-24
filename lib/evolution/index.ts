import { createSpan } from '@/lib/telemetry';

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

export async function enviarMensagemWhatsApp(
  instanceId: string,
  numero: string,
  mensagem: string
): Promise<void> {
  const { span, end } = createSpan('evolution.enviar_mensagem');

  try {
    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      throw new Error('Evolution API não configurada');
    }

    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_KEY,
      },
      body: JSON.stringify({
        number: numero.replace(/\D/g, ''),
        text: mensagem,
        options: {
          delay: 1200,
          presence: 'composing',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${error}`);
    }

    span.setAttribute('instance', instanceId);
    span.setAttribute('numero', numero);
    span.setAttribute('tamanho_mensagem', mensagem.length);
    span.setStatus({ code: 1 }); // SpanStatusCode.OK = 1
    end();
  } catch (erro) {
    span.setStatus({ code: 2, message: (erro as Error).message }); // SpanStatusCode.ERROR = 2
    span.recordException(erro as Error);
    end();
    throw erro;
  }
}

export async function enviarMensagemMedia(
  instanceId: string,
  numero: string,
  mediaUrl: string,
  caption?: string
): Promise<void> {
  const { span, end } = createSpan('evolution.enviar_media');

  try {
    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      throw new Error('Evolution API não configurada');
    }

    const response = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_KEY,
      },
      body: JSON.stringify({
        number: numero.replace(/\D/g, ''),
        mediatype: 'image',
        media: mediaUrl,
        caption: caption || '',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${error}`);
    }

    span.setStatus({ code: 1 }); // OK
    end();
  } catch (erro) {
    span.setStatus({ code: 2, message: (erro as Error).message }); // ERROR
    span.recordException(erro as Error);
    end();
    throw erro;
  }
}