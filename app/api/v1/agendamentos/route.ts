import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/server/client';
import { criarAgendamentoSchema, confirmarAgendamentoSchema } from '@/schemas';
import { logger } from '@/lib/telemetry';
import { AppError } from '@/types';

// ============================================
// LISTAR AGENDAMENTOS
// ============================================
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createSupabaseServerClient();

    // Verificar sessão
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clinicaId = session.user.user_metadata.clinica_id;
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const status = searchParams.get('status');
    const profissionalId = searchParams.get('profissionalId');

    let query = supabase
      .from('agendamento')
      .select(`
        *,
        cliente:cliente_id (id, nome, telefone),
        profissional:profissional_id (id, nome),
        servico:servico_id (id, nome, duracao_minutos, preco, cor)
      `)
      .eq('clinica_id', clinicaId)
      .order('data_hora', { ascending: true });

    if (dataInicio) query = query.gte('data_hora', dataInicio);
    if (dataFim) query = query.lte('data_hora', dataFim);
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

// ============================================
// CRIAR AGENDAMENTO
// ============================================
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const validado = criarAgendamentoSchema.parse(body);

    // Verificar conflitos
    const { data: conflitos } = await supabase
      .from('agendamento')
      .select('id')
      .eq('clinica_id', validado.clinicaId)
      .eq('status', 'confirmado')
      .eq('profissional_id', validado.profissionalId)
      .lte('data_hora', new Date(new Date(validado.dataHora).getTime() + validado.duracaoMinutos * 60000).toISOString())
      .gte('data_hora', new Date(new Date(validado.dataHora).getTime() - validado.duracaoMinutos * 60000).toISOString());

    if (conflitos && conflitos.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLITO_HORARIO', message: 'Horário indisponível para este profissional' } },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('agendamento')
      .insert({
        clinica_id: validado.clinicaId,
        unidade_id: validado.unidadeId,
        cliente_id: validado.clienteId,
        profissional_id: validado.profissionalId,
        servico_id: validado.servicoId,
        data_hora: validado.dataHora,
        duracao_minutos: validado.duracaoMinutos,
        observacoes: validado.observacoes,
        origem: validado.origem,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Agendamento criado', { agendamentoId: data.id, clinicaId: validado.clinicaId });

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
