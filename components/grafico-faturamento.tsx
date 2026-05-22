'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface GraficoFaturamentoProps {
  clinicaId: string;
}

interface DadoGrafico {
  dia: string;
  entrada: number;
  saida: number;
}

export function GraficoFaturamento({ clinicaId }: GraficoFaturamentoProps) {
  const [dados, setDados] = useState<DadoGrafico[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarDados() {
      const supabase = createSupabaseBrowserClient();

      // Últimos 7 dias
      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      const { data: transacoes } = await supabase
        .from('caixa')
        .select('created_at, tipo, valor')
        .eq('clinica_id', clinicaId)
        .gte('created_at', `${dias[0]}T00:00:00`)
        .lte('created_at', `${dias[6]}T23:59:59`);

      const dadosFormatados = dias.map((dia) => {
        const entrada = transacoes
          ?.filter((t) => t.tipo === 'entrada' && t.created_at.startsWith(dia))
          .reduce((acc, t) => acc + (t.valor || 0), 0) || 0;

        const saida = transacoes
          ?.filter((t) => t.tipo === 'saida' && t.created_at.startsWith(dia))
          .reduce((acc, t) => acc + (t.valor || 0), 0) || 0;

        return {
          dia: new Date(dia).toLocaleDateString('pt-BR', { weekday: 'short' }),
          entrada: Number(entrada.toFixed(2)),
          saida: Number(saida.toFixed(2)),
        };
      });

      setDados(dadosFormatados);
      setCarregando(false);
    }

    buscarDados();
  }, [clinicaId]);

  if (carregando) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-[400px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Faturamento Semanal</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Últimos 7 dias
        </p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="dia" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$ ${value}`}
            />
            <Tooltip
              formatter={(value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="entrada" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Entradas" />
            <Bar dataKey="saida" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Saídas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
