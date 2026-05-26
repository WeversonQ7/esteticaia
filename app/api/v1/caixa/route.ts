import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/server/client';
import { criarTransacaoCaixaSchema } from '@/schemas';
import { logger } from '@/lib/telemetry';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('clinica_id')
      .eq('id', user.id)
      .single();

    let clinicaId = perfil?.clinica_id ?? user.user_metadata?.clinica_id;

    if (!clinicaId) {
      const { data: primeiraClinica } = await supabase
        .from('clinicas')
        .select('id')
        .limit(1)
        .single();
      clinicaId = primeiraClinica?.id;
    }

    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const tipo = searchParams.get('tipo');
    const categoria = searchParams.get('categoria');

    let query = supabase
      .from('caixa')
      .select('*')
      .order('created_at', { ascending: false });

    if (clinicaId) query = query.eq('clinica_id', clinicaId);
    if (dataInicio) query = query.gte('created_at', dataInicio);
    if (dataFim) query = query.lte('created_at', dataFim);
    if (tipo) query = query.eq('tipo', tipo);
    if (categoria) query = query.eq('categoria', categoria);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });

  } catch (erro) {
    logger.error('Erro ao listar caixa', erro as Error);
    return NextResponse.json(
      { success: false, error: { code: 'ERRO_LISTAGEM', message: (erro as Error).message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const validado = criarTransacaoCaixaSchema.parse(body);

    const { data, error } = await supabase
      .from('caixa')
      .insert({
        clinica_id: validado.clinicaId,
        usuario_id: validado.usuarioId,
        agendamento_id: validado.agendamentoId ?? null,
        tipo: validado.tipo,
        categoria: validado.categoria,
        valor: validado.valor,
        descricao: validado.descricao ?? null,
        metodo_pagamento: validado.formaPagamento ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });

  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDACAO', message: erro.errors[0].message } },
        { status: 400 }
      );
    }

    logger.error('Erro ao criar transação', erro as Error);
    return NextResponse.json(
      { success: false, error: { code: 'ERRO_CRIACAO', message: (erro as Error).message } },
      { status: 500 }
    );
  }
}
