'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Bot, User, Loader2 } from 'lucide-react';

type TomVoz = 'profissional' | 'amigavel' | 'formal';

interface MensagemPreview {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pensamento?: string;
}

interface ConfigState {
  nomeAgente: string;
  saudacao: string;
  tomVoz: TomVoz;
  servicosAutomaticos: boolean;
  confirmacaoAutomatica: boolean;
  tempoLembrete: number;
  instrucoesPersonalizadas: string;
}

export default function ConfiguracoesPage() {
  const [mensagens, setMensagens] = useState<MensagemPreview[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [config, setConfig] = useState<ConfigState>({
    nomeAgente: 'Assistente Virtual',
    saudacao: 'Olá! Sou o assistente virtual da clínica. Como posso ajudar?',
    tomVoz: 'profissional',
    servicosAutomaticos: true,
    confirmacaoAutomatica: true,
    tempoLembrete: 60,
    instrucoesPersonalizadas: '',
  });

  async function enviarMensagem() {
    if (!input.trim() || carregando) return;

    const userMsg: MensagemPreview = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
    };

    setMensagens((prev) => [...prev, userMsg]);
    setInput('');
    setCarregando(true);

    try {
      const response = await fetch('/api/v1/ia/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: input,
          config: {
            id: 'preview',
            clinicaId: 'preview',
            unidadeId: null,
            nomeAgente: config.nomeAgente,
            saudacao: config.saudacao,
            horarioAtendimento: { inicio: '08:00', fim: '20:00', dias: ['seg', 'ter', 'qua', 'qui', 'sex'] },
            servicosAutomaticos: config.servicosAutomaticos,
            confirmacaoAutomatica: config.confirmacaoAutomatica,
            tempoLembrete: config.tempoLembrete,
            tomVoz: config.tomVoz,
            instrucoesPersonalizadas: config.instrucoesPersonalizadas,
            evolutionInstance: null,
            status: 'ativo',
          },
        }),
      });

      const data = await response.json();

      const assistantMsg: MensagemPreview = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.data?.resposta || 'Sem resposta',
        pensamento: data.data?.pensamento,
      };

      setMensagens((prev) => [...prev, assistantMsg]);
    } catch (erro) {
      const errorMsg: MensagemPreview = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
      };
      setMensagens((prev) => [...prev, errorMsg]);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Personalize o comportamento do agente de IA
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Formulário */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Identidade do Agente</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="nomeAgente" className="block text-sm font-medium mb-1.5">
                  Nome do Agente
                </label>
                <input
                  id="nomeAgente"
                  type="text"
                  value={config.nomeAgente}
                  onChange={(e) => setConfig({ ...config, nomeAgente: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="saudacao" className="block text-sm font-medium mb-1.5">
                  Saudação Inicial
                </label>
                <textarea
                  id="saudacao"
                  value={config.saudacao}
                  onChange={(e) => setConfig({ ...config, saudacao: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div>
                <label htmlFor="tomVoz" className="block text-sm font-medium mb-1.5">
                  Tom de Voz
                </label>
                <select
                  id="tomVoz"
                  value={config.tomVoz}
                  onChange={(e) => setConfig({ ...config, tomVoz: e.target.value as TomVoz })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="profissional">Profissional</option>
                  <option value="amigavel">Amigável</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Comportamento</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Agendamento Automático</p>
                  <p className="text-xs text-muted-foreground">Permitir que a IA agende sem confirmação</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, servicosAutomaticos: !config.servicosAutomaticos })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.servicosAutomaticos ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.servicosAutomaticos ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Confirmação por WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Cliente deve confirmar com "CONFIRMO"</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, confirmacaoAutomatica: !config.confirmacaoAutomatica })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.confirmacaoAutomatica ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.confirmacaoAutomatica ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div>
                <label htmlFor="tempoLembrete" className="block text-sm font-medium mb-1.5">
                  Tempo do Lembrete (minutos antes)
                </label>
                <input
                  id="tempoLembrete"
                  type="number"
                  min={5}
                  max={1440}
                  value={config.tempoLembrete}
                  onChange={(e) => setConfig({ ...config, tempoLembrete: parseInt(e.target.value) })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col h-[600px]">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Preview do Agente (Groq)</p>
              <p className="text-xs text-muted-foreground">Teste como o agente responderá</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mensagens.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Envie uma mensagem para testar o agente</p>
                <p className="text-xs mt-1">Ex: "Quero agendar para terça às 14h"</p>
              </div>
            )}
            {mensagens.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary' : 'bg-primary/10'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                </div>
                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.pensamento && (
                    <details className="mt-2 text-xs opacity-70">
                      <summary className="cursor-pointer">Ver raciocínio</summary>
                      <p className="mt-1 whitespace-pre-wrap">{msg.pensamento}</p>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {carregando && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
                placeholder="Digite uma mensagem de teste..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={carregando}
              />
              <Button onClick={enviarMensagem} disabled={carregando || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}