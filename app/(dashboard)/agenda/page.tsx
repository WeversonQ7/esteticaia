'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, Clock, User, X } from 'lucide-react';
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
  const [agendamentos, setAgendamentos] = useState<<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [visualizacao, setVisualizacao] = useState<'dia' | 'semana'>('dia');
  const [modalAberto, setModalAberto] = useState(false);

  // Estado do formulário
  const [clienteNome, setClienteNome] = useState('');
  const [hora, setHora] = useState('09:00');
  const [servico, setServico] = useState('');
  const [profissional, setProfissional] = useState('');

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

  async function criarAgendamento(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/v1/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: format(dataSelecionada, 'yyyy-MM-dd'),
          hora_inicio: hora,
          cliente_nome: clienteNome,
          servico_nome: servico,
          profissional_nome: profissional,
        }),
      });

      if (response.ok) {
        setModalAberto(false);
        setClienteNome('');
        setServico('');
        setProfissional('');
        buscarAgendamentos();
      } else {
        alert('Erro ao criar agendamento');
      }
    } catch (erro) {
      console.error('Erro:', erro);
      alert('Erro ao criar agendamento');
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
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* ... resto do código permanece igual ... */}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Novo Agendamento</h2>
              <button onClick={() => setModalAberto(false)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={criarAgendamento} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hora</label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serviço</label>
                <input
                  type="text"
                  value={servico}
                  onChange={(e) => setServico(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do serviço"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Profissional</label>
                <input
                  type="text"
                  value={profissional}
                  onChange={(e) => setProfissional(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do profissional"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setModalAberto(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ... resto do código ... */}
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