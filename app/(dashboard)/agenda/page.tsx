'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Agendamento {
  id: string;
  data: string;
  hora_inicio: string;
  status: string;
  cliente: { nome: string } | null;
  servico: { nome: string; cor: string; duracao_minutos: number } | null;
}

export default function AgendaPage() {
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState([] as Agendamento[]);
  const [carregando, setCarregando] = useState(true);
  const [visualizacao, setVisualizacao] = useState<'dia' | 'semana'>('dia');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [clienteNome, setClienteNome] = useState('');
  const [hora, setHora] = useState('09:00');
  const [servicoNome, setServicoNome] = useState('');

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
      if (data.success) setAgendamentos(data.data);
    } catch (erro) {
      console.error('Erro ao buscar agendamentos:', erro);
    } finally {
      setCarregando(false);
    }
  }

  async function criarAgendamento(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      let clinicaId = user?.user_metadata?.clinica_id;
      if (!clinicaId) {
        const { data: perfil } = await supabase
          .from('profiles').select('clinica_id').eq('id', user?.id).single();
        clinicaId = perfil?.clinica_id;
      }
      if (!clinicaId) {
        const { data: clinica } = await supabase
          .from('clinicas').select('id').limit(1).single();
        clinicaId = clinica?.id;
      }
      if (!clinicaId) {
        alert('Clínica não encontrada.');
        return;
      }

      let { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nome', clienteNome)
        .eq('clinica_id', clinicaId)
        .maybeSingle();

      if (!cliente) {
        const { data: novoCliente } = await supabase
          .from('clientes')
          .insert({ nome: clienteNome, clinica_id: clinicaId })
          .select('id')
          .single();
        cliente = novoCliente;
      }

      let { data: servico } = await supabase
        .from('servicos')
        .select('id, duracao_minutos')
        .ilike('nome', servicoNome)
        .eq('clinica_id', clinicaId)
        .maybeSingle();

      if (!servico) {
        const { data: novoServico } = await supabase
          .from('servicos')
          .insert({ nome: servicoNome, duracao_minutos: 60, clinica_id: clinicaId })
          .select('id, duracao_minutos')
          .single();
        servico = novoServico;
      }

      if (!cliente?.id || !servico?.id) {
        alert('Erro ao buscar cliente ou serviço.');
        return;
      }

      const dataHora = `${format(dataSelecionada, 'yyyy-MM-dd')}T${hora}:00`;

      const response = await fetch('/api/v1/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicaId,
          clienteId: cliente.id,
          servicoId: servico.id,
          dataHora,
          duracaoMinutos: servico.duracao_minutos || 60,
          observacoes: null,
          origem: 'manual',
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setModalAberto(false);
        setClienteNome('');
        setServicoNome('');
        setHora('09:00');
        buscarAgendamentos();
      } else {
        alert(result.error?.message || 'Erro ao criar agendamento.');
      }
    } catch (erro) {
      console.error('Erro:', erro);
      alert('Erro inesperado ao criar agendamento.');
    } finally {
      setSalvando(false);
    }
  }

  const statusMap: Record<string, { label: string; className: string }> = {
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
          <p className="text-muted-foreground">Gerencie os agendamentos da clínica</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setVisualizacao('dia')}
              className={`px-3 py-2 text-sm font-medium ${visualizacao === 'dia' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
              Dia
            </button>
            <button
              onClick={() => setVisualizacao('semana')}
              className={`px-3 py-2 text-sm font-medium ${visualizacao === 'semana' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
              Semana
            </button>
          </div>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDataSelecionada(addDays(dataSelecionada, -1))}
            className="p-2 rounded-md hover:bg-accent transition-colors">
            ← Anterior
          </button>
          <h2 className="text-lg font-semibold min-w-[220px] text-center">
            {format(dataSelecionada, 'dd/MM/yyyy')}
          </h2>
          <button
            onClick={() => setDataSelecionada(addDays(dataSelecionada, 1))}
            className="p-2 rounded-md hover:bg-accent transition-colors">
            Próximo →
          </button>
        </div>
        <button
          onClick={() => setDataSelecionada(new Date())}
          className="text-sm text-primary hover:underline">
          Hoje
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {diasSemana.map((dia) => (
          <button
            key={dia.toISOString()}
            onClick={() => setDataSelecionada(dia)}
            className={`p-3 rounded-lg text-center transition-colors ${
              isSameDay(dia, dataSelecionada)
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border hover:bg-accent'
            }`}>
            <p className="text-xs font-medium uppercase">{format(dia, 'EEE')}</p>
            <p className="text-lg font-bold mt-1">{format(dia, 'dd')}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">{format(dataSelecionada, 'dd/MM/yyyy')}</h3>
          <p className="text-sm text-muted-foreground">{agendamentos.length} agendamentos</p>
        </div>
        <div className="divide-y divide-border">
          {carregando ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : agendamentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum agendamento para este dia
            </div>
          ) : (
            agendamentos.map((ag) => {
              const status = statusMap[ag.status] || statusMap.PENDENTE;
              const horaAg = ag.hora_inicio ? ag.hora_inicio.substring(0, 5) : '--:--';
              return (
                <div key={ag.id} className="p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors">
                  <div className="text-sm font-medium w-14 text-center">{horaAg}</div>
                  <div className="w-1 h-12 rounded-full"
                    style={{ backgroundColor: ag.servico?.cor || '#7c3aed' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{ag.cliente?.nome ?? 'Cliente'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ag.servico?.nome ?? 'Serviço'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                <input type="text" value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)} required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do cliente" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hora *</label>
                <input type="time" value={hora}
                  onChange={(e) => setHora(e.target.value)} required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serviço *</label>
                <input type="text" value={servicoNome}
                  onChange={(e) => setServicoNome(e.target.value)} required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do serviço" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setModalAberto(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}