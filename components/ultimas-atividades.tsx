import { createSupabaseServerClient } from '@/lib/server/client';
import { MessageSquare } from 'lucide-react';

interface UltimasAtividadesProps {
  clinicaId: string;
}

export async function UltimasAtividades({ clinicaId }: UltimasAtividadesProps) {
  const supabase = await createSupabaseServerClient();

  // Buscar últimas conversas
  const { data: conversas } = await supabase
    .from('conversa_log')
    .select('telefone, conteudo, created_at, direcao')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(5);

  const atividades = conversas?.map((c) => ({
    tipo: 'whatsapp' as const,
    titulo: `Mensagem ${c.direcao === 'entrada' ? 'recebida' : 'enviada'}`,
    descricao: c.conteudo.substring(0, 60) + (c.conteudo.length > 60 ? '...' : ''),
    tempo: new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    icone: MessageSquare,
  })) || [];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">Últimas Atividades</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Conversas e interações recentes
        </p>
      </div>

      <div className="divide-y divide-border">
        {atividades.length > 0 ? (
          atividades.map((atividade, i) => (
            <div key={i} className="p-4 flex items-start gap-4 hover:bg-accent/50 transition-colors">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <atividade.icone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{atividade.titulo}</p>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {atividade.descricao}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {atividade.tempo}
              </span>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma atividade recente</p>
          </div>
        )}
      </div>
    </div>
  );
}
