'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, Plus, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Transacao {
  id: string;
  created_at: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'fechamento';
  categoria: string;
  valor: number;
  metodo_pagamento: string | null;
  descricao: string | null;
  status: string;
}

export default function CaixaPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    tipo: '',
    categoria: '',
  });

  const [form, setForm] = useState({
    tipo: 'entrada',
    categoria: 'servico',
    valor: '',
    descricao: '',
    metodo_pagamento: 'dinheiro',
  });

  useEffect(() => {
    buscarTransacoes();
  }, []);

  async function buscarTransacoes() {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtros.dataInicio) params.append('dataInicio', filtros.dataInicio);
      if (filtros.dataFim) params.append('dataFim', filtros.dataFim);
      if (filtros.tipo) params.append('tipo', filtros.tipo);
      if (filtros.categoria) params.append('categoria', filtros.categoria);

      const response = await fetch(`/api/v1/caixa?${params}`);
      const data = await response.json();
      if (data.success) setTransacoes(data.data);
    } catch (erro) {
      console.error('Erro ao buscar transações:', erro);
    } finally {
      setCarregando(false);
    }
  }

  async function criarTransacao(e: React.FormEvent) {
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

      const response = await fetch('/api/v1/caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicaId,
          usuarioId: user?.id,
          tipo: form.tipo,
          categoria: form.categoria,
          valor: parseFloat(form.valor),
          descricao: form.descricao || null,
          formaPagamento: form.metodo_pagamento,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setModalAberto(false);
        setForm({ tipo: 'entrada', categoria: 'servico', valor: '', descricao: '', metodo_pagamento: 'dinheiro' });
        buscarTransacoes();
      } else {
        alert(result.error?.message || 'Erro ao criar transação.');
      }
    } catch (erro) {
      console.error('Erro:', erro);
      alert('Erro inesperado.');
    } finally {
      setSalvando(false);
    }
  }

  const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + t.valor, 0);
  const totalSaidas = transacoes.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + t.valor, 0);
  const saldo = totalEntradas - totalSaidas;

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caixa</h1>
          <p className="text-muted-foreground">Controle de entradas e saídas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMostrarFiltros(!mostrarFiltros)}>
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-3">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-xl font-bold text-green-600">{fmt(totalEntradas)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-3">
              <ArrowDownCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Saídas</p>
              <p className="text-xl font-bold text-red-600">{fmt(totalSaidas)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <ArrowUpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(saldo)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      {mostrarFiltros && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Data Início</label>
              <input type="date" value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Data Fim</label>
              <input type="date" value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tipo</label>
              <select value={filtros.tipo}
                onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Categoria</label>
              <select value={filtros.categoria}
                onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Todas</option>
                <option value="servico">Serviço</option>
                <option value="produto">Produto</option>
                <option value="despesa">Despesa</option>
                <option value="salario">Salário</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={buscarTransacoes}>Aplicar Filtros</Button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Categoria</th>
                <th className="px-4 py-3 text-left font-medium">Descrição</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-left font-medium">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {carregando ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : transacoes.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma transação encontrada</td></tr>
              ) : (
                transacoes.map((t) => (
                  <tr key={t.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.tipo === 'entrada' ? 'bg-green-50 text-green-700' :
                        t.tipo === 'saida' ? 'bg-red-50 text-red-700' :
                        'bg-gray-50 text-gray-700'
                      }`}>
                        {t.tipo === 'entrada' ? 'Entrada' : t.tipo === 'saida' ? 'Saída' : 'Ajuste'}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize">{t.categoria}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{t.descricao || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(t.valor)}</td>
                    <td className="px-4 py-3 capitalize">{t.metodo_pagamento || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Nova Transação</h2>
              <button onClick={() => setModalAberto(false)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={criarTransacao} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoria *</label>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="servico">Serviço</option>
                  <option value="produto">Produto</option>
                  <option value="despesa">Despesa</option>
                  <option value="salario">Salário</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor *</label>
                <input type="number" step="0.01" min="0.01" value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })} required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Método de Pagamento</label>
                <select value={form.metodo_pagamento} onChange={(e) => setForm({ ...form, metodo_pagamento: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <input type="text" value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Descrição opcional" />
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
