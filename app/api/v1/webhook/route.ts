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
  console.log('=== WEBHOOK POST INICIADO ===');
  
  try {
    const body = await request.json();
    console.log('Body recebido:', JSON.stringify(body));
    
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    console.log('Mensagem extraída:', JSON.stringify(message));
    
    if (message?.text?.body) {
      const numeroCliente = message.from;
      const textoRecebido = message.text.body;
      
      console.log('Número cliente:', numeroCliente);
      console.log('Texto recebido:', textoRecebido);
      
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const token = process.env.WHATSAPP_TOKEN;
      
      console.log('PHONE_NUMBER_ID existe:', !!phoneNumberId);
      console.log('TOKEN existe:', !!token);
      
      if (!phoneNumberId || !token) {
        console.error('Variáveis de ambiente não configuradas');
        return new Response('Internal Server Error', { status: 500 });
      }

      const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
      console.log('URL da API:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numeroCliente,
          type: 'text',
          text: { body: `Você disse: ${textoRecebido}` }
        })
      });
      
      console.log('Meta API status:', response.status);
      const result = await response.json();
      console.log('Meta API response:', JSON.stringify(result));
      
      if (!response.ok) {
        console.error('Meta API erro:', result);
      }
    } else {
      console.log('Nenhuma mensagem de texto encontrada');
    }
  } catch (error) {
    console.error('ERRO NO WEBHOOK:', error);
  }
  
  console.log('=== WEBHOOK POST FINALIZADO ===');
  return new Response('OK', { status: 200 });
}