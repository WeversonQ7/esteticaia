import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/server/client';
import { criarTransacaoCaixaSchema, validarPinSchema } from '@/schemas';
import { salvarEstadoPendente, obterEstadoPendente, removerEstadoPendente } from '@/lib/redis/client';
import { logger } from '@/lib/telemetry';
import bcrypt from 'bcryptjs';

// ============================================
// LISTAR TRANSAÇÕES
// ============================================
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clinicaId = session.user.user_metadata.clinica_id;
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const tipo = searchParams.get('tipo');
    const categoria = searchParams.get('categoria');

    let query = supabase
      .from('caixa')
      .select(`
        *,
        usuario:usuario_id (id, nome),
        agendamento:agendamento_id (id, data_hora)
      `)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false });

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

// ============================================
// CRIAR TRANSAÇÃO (REQUER PIN PARA OPERAÇÕES SENSÍVEIS)
// ============================================
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const validado = criarTransacaoCaixaSchema.parse(body);

    // Operações sensíveis exigem PIN
    const operacoesSensiveis = ['saida', 'ajuste', 'fechamento'];
    const requerPin = operacoesSensiveis.includes(validado.tipo);

    if (requerPin) {
      // Verificar se já tem PIN pendente
      const estadoPendente = await obterEstadoPendente(validado.usuarioId);

      if (!estadoPendente) {
        // Primeira etapa: solicitar PIN
        const operacaoId = crypto.randomUUID();
        await salvarEstadoPendente(validado.usuarioId, {
          comando: 'criar_transacao',
          dados: validado,
          timestamp: Date.now(),
        });

        return NextResponse.json({
          success: false,
          requerPin: true,
          operacaoId,
          message: 'Esta operação requer confirmação por PIN. Digite seu PIN de 4 dígitos.',
        }, { status: 403 });
      }

      // PIN já foi enviado, validar
      const pinValidado = validarPinSchema.safeParse(body);
      if (!pinValidado.success || !body.pin) {
        return NextResponse.json({
          success: false,
          requerPin: true,
          message: 'PIN inválido. Digite os 4 dígitos do seu PIN.',
        }, { status: 403 });
      }

      // Validar PIN contra hash no banco
      const { data: usuario } = await supabase
        .from('usuario')
        .select('pin_caixa')
        .eq('id', validado.usuarioId)
        .single();

      if (!usuario?.pin_caixa) {
        return NextResponse.json({
          success: false,
          error: { code: 'PIN_NAO_CONFIGURADO', message: 'PIN não configurado. Configure seu PIN nas configurações.' },
        }, { status: 400 });
      }

      const pinValido = await bcrypt.compare(body.pin, usuario.pin_caixa);
      if (!pinValido) {
        return NextResponse.json({
          success: false,
          requerPin: true,
          message: 'PIN incorreto. Tente novamente.',
        }, { status: 403 });
      }

      // PIN válido, limpar estado pendente
      await removerEstadoPendente(validado.usuarioId);
    }

    // Criar transação
    const { data, error } = await supabase
      .from('caixa')
      .insert({
        clinica_id: validado.clinicaId,
        unidade_id: validado.unidadeId,
        usuario_id: validado.usuarioId,
        agendamento_id: validado.agendamentoId,
        tipo: validado.tipo,
        categoria: validado.categoria,
        valor: validado.valor,
        forma_pagamento: validado.formaPagamento,
        parcelas: validado.parcelas,
        descricao: validado.descricao,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Transação de caixa criada', {
      transacaoId: data.id,
      tipo: validado.tipo,
      valor: validado.valor,
      clinicaId: validado.clinicaId,
    });

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
