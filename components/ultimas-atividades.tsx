import { createSupabaseServerClient } from '@/lib/server/client';
import { Calendar } from 'lucide-react';

interface UltimasAtividadesProps {
  clinicaId: string;
}

export async function UltimasAtividades({ clinicaId }: UltimasAtividadesProps) {
  const supabase = await createSupabaseServerClient();

  const { data: agendamentos } = await supabase
    .from('agendamento')
    .select('id, data, hora_inicio, status, cliente:cliente_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">Últimas Atividades</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Agendamentos recentes
        </p>
      </div>

      <div className="divide-y divide-border">
        {agendamentos && agendamentos.length > 0 ? (
          agendamentos.map((ag) => {
            const clienteNome = (ag.cliente as unknown as { nome: string })?.nome ?? 'Cliente';
            const hora = ag.hora_inicio ? ag.hora_inicio.substring(0, 5) : '--:--';
            return (
              <div key={ag.id} className="p-4 flex items-start gap-4 hover:bg-accent/50 transition-colors">
                <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{clienteNome}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {ag.data} às {hora} — {ag.status}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma atividade recente</p>
          </div>
        )}
      </div>
    </div>
  );
}