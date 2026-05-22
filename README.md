# EstéticaIA - SaaS de Gestão para Clínicas de Estética

Sistema completo de gestão com agente de IA no WhatsApp (Meta API oficial).

## 🚀 Stack Tecnológico Simplificado

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router, Turbopack, React 19) |
| Linguagem | TypeScript strict + Zod |
| UI | Tailwind CSS + shadcn/ui |
| Banco/Auth | Supabase (PostgreSQL + RLS) |
| WhatsApp | **Meta Business API** (oficial) |
| IA | **Groq** (Llama 3.3 70B - mais rápido e barato) |
| Pagamentos | **Stripe** |
| Cache | Redis (Upstash - gratuito) |

## 📋 Variáveis de Ambiente (Simplificado)

```env
# SUPABASE (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# REDIS (Upstash - gratuito)
REDIS_URL=rediss://default:senha@host.upstash.io:6379

# META / WHATSAPP (oficial)
META_ACCESS_TOKEN=seu-token-meta
META_PHONE_NUMBER_ID=seu-phone-id
META_BUSINESS_ACCOUNT_ID=seu-business-id
META_WEBHOOK_VERIFY_TOKEN=token-verificacao

# GROQ (IA - gratuito até 1M tokens/dia)
GROQ_API_KEY=sua-chave-groq

# STRIPE (pagamentos)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# APP
NEXT_PUBLIC_APP_URL=https://esteticaia.vercel.app
APP_SECRET=seu-secret-jwt
```

## 🔑 Onde conseguir as chaves

### 1. Supabase (Banco de dados)
- [supabase.com](https://supabase.com) → Sign Up → New Project
- Project Settings → API → copie URL, anon key e service role key

### 2. Upstash Redis (Cache - GRÁTIS)
- [upstash.com](https://upstash.com) → Create Database → Redis
- Copie a URL `rediss://...` na aba "Details"

### 3. Meta Business / WhatsApp API (Oficial)
- [developers.facebook.com](https://developers.facebook.com) → Crie app
- WhatsApp → API Setup → copie Access Token e Phone Number ID
- Configure webhook: `https://seu-dominio.vercel.app/api/webhooks/meta`

### 4. Groq (IA - GRÁTIS)
- [console.groq.com](https://console.groq.com) → Sign Up → API Keys
- Crie uma chave (gratuito até 1M tokens/dia)

### 5. Stripe (Pagamentos)
- [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys
- Copie Secret Key e configure webhook

## 🚀 Deploy

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas chaves

# 3. Rodar localmente
npm run dev

# 4. Deploy na Vercel
vercel --prod
```

## 📁 Estrutura

```
esteticaia/
├── app/
│   ├── (dashboard)/          # Dashboard, Agenda, Caixa, Relatórios, Configurações
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── meta/          # Webhook oficial Meta WhatsApp
│   │   └── v1/                # APIs REST
│   └── login/                 # Página de login
├── components/                # Componentes React
├── lib/
│   ├── meta/whatsapp.ts      # Integração Meta API
│   ├── ia/groq.ts            # Integração Groq IA
│   ├── stripe/               # Integração Stripe
│   ├── redis/                # Cache e deduplicação
│   ├── supabase/             # Clientes Supabase
│   └── telemetry/            # Logs e métricas
├── workers/                   # Worker de processamento
├── database/schema.sql        # Schema Supabase
└── ...
```

## ✅ Features

- 🤖 Agente de IA no WhatsApp (Meta API oficial)
- 📅 Agendamento inteligente com confirmação automática
- 💰 Controle de caixa com PIN de segurança
- 📊 Dashboard em tempo real
- 📈 Relatórios semanais automáticos
- 💳 Pagamentos via Stripe
- 📤 Exportação CSV do caixa

## 💰 Custo estimado (produção)

| Serviço | Custo mensal |
|---------|-------------|
| Supabase (Free tier) | $0 |
| Upstash Redis (Free tier) | $0 |
| Groq (até 1M tokens/dia) | $0 |
| Meta WhatsApp (primeiras 1K conversas/mês) | $0 |
| Stripe (taxa por transação) | 2.9% + $0.30 |
| Vercel (Hobby) | $0 |
| **Total inicial** | **$0** |
