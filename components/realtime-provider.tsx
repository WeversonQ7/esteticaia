'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type RealtimeContextType = {
  atendimentosHoje: number;
  faturamentoHoje: number;
  ultimaAtualizacao: Date | null;
};

const RealtimeContext = createContext<RealtimeContextType>({
  atendimentosHoje: 0,
  faturamentoHoje: 0,
  ultimaAtualizacao: null,
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({
  children,
  clinicaId,
}: {
  children: React.ReactNode;
  clinicaId: string;
}) {
  const [metrics, setMetrics] = useState<RealtimeContextType>({
    atendimentosHoje: 0,
    faturamentoHoje: 0,
    ultimaAtualizacao: null,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Canal para agendamentos
    const agendamentosChannel = supabase
      .channel('agendamentos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamento',
          filter: `clinica_id=eq.${clinicaId}`,
        },
        () => {
          setMetrics((prev) => ({
            ...prev,
            atendimentosHoje: prev.atendimentosHoje + 1,
            ultimaAtualizacao: new Date(),
          }));
        }
      )
      .subscribe();

    // Canal para caixa
    const caixaChannel = supabase
      .channel('caixa-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'caixa',
          filter: `clinica_id=eq.${clinicaId}`,
        },
        (payload) => {
          const novoValor = payload.new?.valor || 0;
          setMetrics((prev) => ({
            ...prev,
            faturamentoHoje: prev.faturamentoHoje + novoValor,
            ultimaAtualizacao: new Date(),
          }));
        }
      )
      .subscribe();

    return () => {
      agendamentosChannel.unsubscribe();
      caixaChannel.unsubscribe();
    };
  }, [clinicaId]);

  return (
    <RealtimeContext.Provider value={metrics}>
      {children}
    </RealtimeContext.Provider>
  );
}
