import { createSupabaseServerClient } from '@/lib/server/client';
import { MetricCard } from '@/components/metric-card';
import { AgendaHoje } from '@/components/agenda-hoje';
import { GraficoFaturamento } from '@/components/grafico-faturamento';
import { UltimasAtividades } from '@/components/ultimas-atividades';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const clinicaId = session?.user.user_metadata.clinica_id;

  const hoje = new Date().toISOString().split('T')[0];
  const inicioDia = `${hoje}T00:00:00`;
  const fimDia = `${hoje}T23:59:59`;

  const { data: atendimentosHoje } = await supabase
    .from('agendamento')
    .select('id, status')
    .eq('clinica_id', clinicaId)
    .gte('data_hora', inicioDia)
    .lte('data_hora', fimDia);

  const { data: faturamentoHoje } = await supabase
    .from('caixa')
    .select('valor')
    .eq('clinica_id', clinicaId)
    .eq('tipo', 'entrada')
    .gte('created_at', inicioDia)
    .lte('created_at', fimDia);

  const { data: clientesNovos } = await supabase
    .from('cliente')
    .select('id')
    .eq('clinica_id', clinicaId)
    .gte('created_at', inicioDia)
    .lte('created_at', fimDia);

  const totalAtendimentos = atendimentosHoje?.length || 0;
  const atendimentosConcluidos = atendimentosHoje?.filter(a => a.status === 'concluido').length || 0;
  const totalFaturamento = faturamentoHoje?.reduce((acc, curr) => acc + (curr.valor || 0), 0) || 0;
  const totalClientesNovos = clientesNovos?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral da clínica em tempo real
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Atendimentos Hoje"
          value={totalAtendimentos}
          subtitle={`${atendimentosConcluidos} concluídos`}
          icon="calendar"
          trend={+12}
        />
        <MetricCard
          title="Faturamento"
          value={`R$ ${totalFaturamento.toFixed(2).replace('.', ',')}`}
          subtitle="Total do dia"
          icon="dollar-sign"
          trend={+8}
        />
        <MetricCard
          title="Clientes Novos"
          value={totalClientesNovos}
          subtitle="Hoje"
          icon="users"
          trend={+5}
        />
        <MetricCard
          title="Taxa Comparecimento"
          value={`${totalAtendimentos > 0 ? Math.round((atendimentosConcluidos / totalAtendimentos) * 100) : 0}%`}
          subtitle="Meta: 90%"
          icon="check-circle"
          trend={-2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <GraficoFaturamento clinicaId={clinicaId} />
        </div>
        <div className="lg:col-span-3">
          <AgendaHoje clinicaId={clinicaId} />
        </div>
      </div>

      <UltimasAtividades clinicaId={clinicaId} />
    </div>
  );
}
