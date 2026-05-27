import { NextRequest, NextResponse } from 'next/server';
import { extrairMensagemMeta, type MetaWebhookPayload } from '@/lib/meta/whatsapp';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

// Verificação do webhook pela Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// Receber mensagens
export async function POST(request: NextRequest) {
  try {
    const payload: MetaWebhookPayload = await request.json();
    const mensagem = extrairMensagemMeta(payload);

    if (!mensagem) {
      return NextResponse.json({ success: true });
    }

    console.log('Mensagem recebida:', mensagem);

    // Aqui vai a integração com a fila/IA
    // Por enquanto só loga

    return NextResponse.json({ success: true });
  } catch (erro) {
    console.error('Erro no webhook:', erro);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}