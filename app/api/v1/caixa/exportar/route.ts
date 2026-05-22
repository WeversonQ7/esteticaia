import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/server/client';
import { logger } from '@/lib/telemetry';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const clinicaId = session.user.user_metadata.clinica_id;
    const dataInicio = searchParams.get('dataInicio') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dataFim = searchParams.get('dataFim') || new Date().toISOString();
    const tipo = searchParams.get('tipo');
    const categoria = searchParams.get('categoria');

    let query = supabase
      .from('caixa')
      .select(`
        id,
        created_at,
        tipo,
        categoria,
        valor,
        forma_pagamento,
        parcelas,
        descricao,
        status,
        usuario:usuario_id (nome),
        agendamento:agendamento_id (data_hora)
      `)
      .eq('clinica_id', clinicaId)
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim)
      .order('created_at', { ascending: true });

    if (tipo) query = query.eq('tipo', tipo);
    if (categoria) query = query.eq('categoria', categoria);

    const { data, error } = await query;

    if (error) throw error;

    // Gerar CSV
    const headers = ['Data', 'Tipo', 'Categoria', 'Valor', 'Forma Pagamento', 'Parcelas', 'Descrição', 'Status', 'Usuário'];
    const rows = data.map((row: Record<string, unknown>) => [
      new Date(row.created_at as string).toLocaleString('pt-BR'),
      row.tipo,
      row.categoria,
      (row.valor as number).toFixed(2).replace('.', ','),
      row.forma_pagamento || '-',
      row.parcelas,
      `"${(row.descricao || '').replace(/"/g, '""')}"`,
      row.status,
      (row.usuario as { nome: string } | null)?.nome || '-',
    ]);

    const csv = [headers.join(';'), ...rows.map((r: string[]) => r.join(';'))].join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM para Excel

    logger.info('CSV exportado', { registros: data.length, clinicaId });

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="caixa_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (erro) {
    logger.error('Erro ao exportar CSV', erro as Error);
    return NextResponse.json(
      { success: false, error: { code: 'ERRO_EXPORTACAO', message: (erro as Error).message } },
      { status: 500 }
    );
  }
}
