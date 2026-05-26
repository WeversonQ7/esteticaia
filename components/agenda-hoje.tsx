import { createSupabaseServerClient } from '@/lib/server/client';
import { Clock, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgendaHojeProps {
  clinicaId: string;
}

export async function AgendaHoje({ clinicaId }: AgendaHojeProps) {
  const supabase = await createSupabaseServerClient();
  const hoje = new Date().toISOString().split('T')[0];

  const { data: agendamentos } = await supabase
    .from('agendamento')
    .select(`
      id,
      data,
      hora_inicio,
      status,
      cliente:cliente_id (nome),
      servico:servico_id (nome)
    `)
    .eq('clinica_id', clinicaId)
    .eq('data', hoje)
    .order('hora_inicio', { ascending: true })
    .limit(10);

  const statusMap = {
    PENDENTE: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    CONFIRMADO: { label: 'Confirmado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    CONCLUIDO: { label: 'Concluído', className: 'bg-green-50 text-green-700 border-green-200' },
    CANCELADO: { label: 'Cancelado', className: 'bg-red-50 text-red-700 border-red-200' },
    NAO_COMPARECEU: { label: 'Não veio', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">Agenda de Hoje</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {agendamentos?.length || 0} atendimentos agendados
        </p>
      </div>

      <div className="divide-y divide-border">
        {agendamentos && agendamentos.length > 0 ? (
          agendamentos.map((ag) => {
            const status = statusMap[ag.status as keyof typeof statusMap] || statusMap.PENDENTE;
            const hora = ag.hora_inicio ? ag.hora_inicio.substring(0, 5) : '--:--';
            const clienteNome = (ag.cliente as unknown as { nome: string })?.nome ?? 'Cliente';
            const servicoNome = (ag.servico as unknown as { nome: string })?.nome ?? 'Serviço';

            return (
              <div key={ag.id} className="p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-12 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium text-sm">{clienteNome}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{hora}</span>
                        <span>•</span>
                        <span>{servicoNome}</span>
                      </div>
                    </div>
                  </div>
                  <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium border', status.className)}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum agendamento para hoje</p>
          </div>
        )}
      </div>
    </div>
  );
}