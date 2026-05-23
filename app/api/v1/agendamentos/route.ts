import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/server/client';
import { criarAgendamentoSchema } from '@/schemas';
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

    let clinicaId = perfil?.clinica_id;

    if (!clinicaId) {
      clinicaId = user.user_metadata?.clinica_id;
    }

    if (!clinicaId) {
      const { data: primeiraClinica } = await supabase
        .from('clinica')
        .select('id')
        .limit(1)
        .single();
      clinicaId = primeiraClinica?.id;
    }

    logger.info('Agendamentos GET', { clinicaId, userId: user.id });

    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const status = searchParams.get('status');
    const profissionalId = searchParams.get('profissionalId');

    let query = supabase
      .from('agendamento')
      .select('*')
      .order('data', { ascending: true });

    if (clinicaId) query = query.eq('clinica_id', clinicaId);
    if (dataInicio) query = query.gte('data', dataInicio);
    if (dataFim) query = query.lte('data', dataFim);
    if (status) query = query.eq('status', status);
    if (profissionalId) query = query.eq('profissional_id', profissionalId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });

  } catch (erro) {
    logger.error('Erro ao listar agendamentos', erro as Error);
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
    const validado = criarAgendamentoSchema.parse(body);

    const { data, error } = await supabase
      .from('agendamento')
      .insert({
        clinica_id: validado.clinicaId,
        unidade_id: validado.unidadeId,
        cliente_id: validado.clienteId,
        profissional_id: validado.profissionalId,
        servico_id: validado.servicoId,
        data: validado.dataHora,
        hora_inicio: validado.dataHora,
        duracao_minutos: validado.duracaoMinutos,
        observacoes: validado.observacoes,
        origem: validado.origem,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Agendamento criado', { agendamentoId: data.id });

    return NextResponse.json({ success: true, data }, { status: 201 });

  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDACAO', message: erro.errors[0].message } },
        { status: 400 }
      );
    }

    logger.error('Erro ao criar agendamento', erro as Error);
    return NextResponse.json(
      { success: false, error: { code: 'ERRO_CRIACAO', message: (erro as Error).message } },
      { status: 500 }
    );
  }
}