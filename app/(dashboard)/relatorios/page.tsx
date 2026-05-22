'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState('semana');

  const metricas = [
    {
      titulo: 'Faturamento Total',
      valor: 'R$ 12.450,00',
      variacao: '+15%',
      positivo: true,
      icone: DollarSign,
    },
    {
      titulo: 'Atendimentos',
      valor: '87',
      variacao: '+8%',
      positivo: true,
      icone: Users,
    },
    {
      titulo: 'Ticket Médio',
      valor: 'R$ 143,10',
      variacao: '+5%',
      positivo: true,
      icone: TrendingUp,
    },
    {
      titulo: 'Taxa Comparecimento',
      valor: '92%',
      variacao: '-3%',
      positivo: false,
      icone: BarChart3,
    },
  ];

  const topServicos = [
    { nome: 'Limpeza de Pele', quantidade: 32, faturamento: 4480 },
    { nome: 'Botox', quantidade: 18, faturamento: 7200 },
    { nome: 'Peeling', quantidade: 15, faturamento: 2250 },
    { nome: 'Preenchimento', quantidade: 12, faturamento: 4800 },
    { nome: 'Drenagem', quantidade: 10, faturamento: 1500 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">
            Análise de desempenho da clínica
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="trimestre">Este Trimestre</option>
          </select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricas.map((metrica) => (
          <div key={metrica.titulo} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{metrica.titulo}</p>
                <p className="text-2xl font-bold tracking-tight">{metrica.valor}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <metrica.icone className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${metrica.positivo ? 'text-green-600' : 'text-red-600'}`}>
                {metrica.variacao}
              </span>
              <span className="text-sm text-muted-foreground ml-1">vs período anterior</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top Serviços */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Top Serviços</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Serviços mais realizados no período
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {topServicos.map((servico, index) => (
              <div key={servico.nome} className="flex items-center gap-4">
                <div className="w-8 text-center font-bold text-muted-foreground">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{servico.nome}</p>
                    <p className="text-sm font-medium">
                      R$ {servico.faturamento.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(servico.quantidade / topServicos[0].quantidade) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {servico.quantidade} atendimentos
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
