import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/server/client';
import { gerarPreviewResposta } from '@/lib/ia/groq';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { mensagem, config } = body;

    if (!mensagem || !config) {
      return NextResponse.json(
        { error: 'Mensagem e config são obrigatórios' },
        { status: 400 }
      );
    }

    const resultado = await gerarPreviewResposta(mensagem, config);

    return NextResponse.json({ success: true, data: resultado });

  } catch (erro) {
    return NextResponse.json(
      { success: false, error: { message: (erro as Error).message } },
      { status: 500 }
    );
  }
}