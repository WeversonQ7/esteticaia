import { criarContextoTrace, finalizarTrace } from '@/lib/telemetry';

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

export async function enviarMensagemWhatsApp(
  instanceId: string,
  numero: string,
  mensagem: string
): Promise<void> {
  const ctx = criarContextoTrace('evolution.enviar_mensagem');

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

    ctx.span.setAttribute('instance', instanceId);
    ctx.span.setAttribute('numero', numero);
    ctx.span.setAttribute('tamanho_mensagem', mensagem.length);
    finalizarTrace(ctx);
  } catch (erro) {
    finalizarTrace(ctx, erro as Error);
    throw erro;
  }
}

export async function enviarMensagemMedia(
  instanceId: string,
  numero: string,
  mediaUrl: string,
  caption?: string
): Promise<void> {
  const ctx = criarContextoTrace('evolution.enviar_media');

  try {
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

    finalizarTrace(ctx);
  } catch (erro) {
    finalizarTrace(ctx, erro as Error);
    throw erro;
  }
}
