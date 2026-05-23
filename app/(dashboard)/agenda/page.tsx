'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Agendamento {
  id: string;
  data: string;
  hora_inicio: string;
  status: string;
  cliente: { nome: string } | null;
  profissional: { nome: string } | null;
  servico: { nome: string; cor: string; duracao_minutos: number } | null;
}

export default function AgendaPage() {
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [visualizacao, setVisualizacao] = useState<'dia' | 'semana'>('dia');

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const inicioSemana = startOfWeek(dataSelecionada, { weekStartsOn: 1 });
    return addDays(inicioSemana, i);
  });

  useEffect(() => {
    buscarAgendamentos();
  }, [dataSelecionada]);

  async function buscarAgendamentos() {
    setCarregando(true);
    try {
      const dataInicio = format(dataSelecionada, 'yyyy-MM-dd');
      const dataFim = format(addDays(dataSelecionada, 1), 'yyyy-MM-dd');

      const response = await fetch(`/api/v1/agendamentos?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      const data = await response.json();

      if (data.success) {
        setAgendamentos(data.data);
      }
    } catch (erro) {
      console.error('Erro ao buscar agendamentos:', erro);
    } finally {
      setCarregando(false);
    }
  }

  const statusMap = {
    PENDENTE: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    CONFIRMADO: { label: 'Confirmado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    CONCLUIDO: { label: 'Concluído', className: 'bg-green-50 text-green-700 border-green-200' },
    CANCELADO: { label: 'Cancelado', className: 'bg-red-50 text-red-700 border-red-200' },
    NAO_COMPARECEU: { label: 'Não veio', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos da clínica
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setVisualizacao('dia')}
              className={`px-3 py-2 text-sm font-medium ${
                visualizacao === 'dia' ? 'bg-primary text-primary-foreground' : 'bg-background'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setVisualizacao('semana')}
              className={`px-3 py-2 text-sm font-medium ${
                visualizacao === 'semana' ? 'bg-primary text-primary-foreground' : 'bg-background'
              }`}
            >
              Semana
            </button>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Navegação de Data */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDataSelecionada(addDays(dataSelecionada, -1))}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h2>
          <button
            onClick={() => setDataSelecionada(addDays(dataSelecionada, 1))}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Próximo dia"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={() => setDataSelecionada(new Date())}
          className="text-sm text-primary hover:underline"
        >
          Hoje
        </button>
      </div>

      {/* Calendário Semanal */}
      <div className="grid grid-cols-7 gap-2">
        {diasSemana.map((dia) => (
          <button
            key={dia.toISOString()}
            onClick={() => setDataSelecionada(dia)}
            className={`p-3 rounded-lg text-center transition-colors ${
              isSameDay(dia, dataSelecionada)
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border hover:bg-accent'
            }`}
          >
            <p className="text-xs font-medium uppercase">
              {format(dia, 'EEE', { locale: ptBR })}
            </p>
            <p className="text-lg font-bold mt-1">{format(dia, 'dd')}</p>
          </button>
        ))}
      </div>

      {/* Lista do Dia */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">
            {format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {agendamentos.length} agendamentos
          </p>
        </div>

        <div className="divide-y divide-border">
          {carregando ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : agendamentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum agendamento para este dia</p>
            </div>
          ) : (
            agendamentos.map((ag) => {
              const status = statusMap[ag.status as keyof typeof statusMap] || statusMap.PENDENTE;
              const hora = ag.hora_inicio ? ag.hora_inicio.slice(0, 5) : '--:--';

              return (
                <div key={ag.id} className="p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors">
                  <div className="text-sm font-medium w-16 text-center">
                    {hora}
                  </div>
                  <div
                    className="w-1 h-12 rounded-full"
                    style={{ backgroundColor: ag.servico?.cor || '#3b82f6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{ag.cliente?.nome ?? 'Cliente'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ScissorsIcon className="h-3 w-3" />
                        {ag.servico?.nome ?? 'Serviço'}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ag.profissional?.nome ?? 'Não atribuído'}
                      </span>
                      {ag.servico?.duracao_minutos && (
                        <span>{ag.servico.duracao_minutos}min</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}