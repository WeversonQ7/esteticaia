'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RegistroPage() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    setSucesso('');

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      setCarregando(false);
      return;
    }

    console.log('=== INICIANDO CADASTRO ===');
    console.log('Email:', email);

    try {
      const supabase = createSupabaseBrowserClient();
      console.log('Supabase client OK');

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome },
        },
      });

      console.log('Resposta:', { data, error });

      if (error) throw error;

      setSucesso('Conta criada! Verifique seu email.');
      setTimeout(() => window.location.href = '/login', 3000);
    } catch (err: any) {
      console.error('ERRO:', err);
      setErro(err.message || 'Erro ao criar conta');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">EstéticaIA</h1>
          <p className="text-muted-foreground mt-1">Criar nova conta</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
          <form onSubmit={handleRegistro} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome completo</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Seu nome" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="seu@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirmar senha</label>
              <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required minLength={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
            </div>

            {erro && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>}
            {sucesso && <div className="rounded-md bg-green-100 p-3 text-sm text-green-800">{sucesso}</div>}

            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar conta
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem uma conta? <Link href="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}