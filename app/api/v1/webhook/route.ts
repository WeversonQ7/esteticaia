import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === 'teste123') {
    return new Response(challenge, { status: 200 });
  } else {
    return new Response('Forbidden', { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message?.text?.body) {
      const numeroCliente = message.from;
      const textoRecebido = message.text.body;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      
      if (!phoneNumberId) {
        console.error('WHATSAPP_PHONE_NUMBER_ID não configurado');
        return new Response('Internal Server Error', { status: 500 });
      }

      const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numeroCliente,
          type: 'text',
          text: { body: `Você disse: ${textoRecebido}` }
        })
      });
      
      const result = await response.json();
      console.log('Meta API status:', response.status);
      console.log('Meta API response:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('Erro ao enviar:', error);
  }
  return new Response('OK', { status: 200 });
}