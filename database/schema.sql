-- ============================================
-- ESTÉTICAIA - SCHEMA COMPLETO
-- Multi-clínica com tenant isolation via RLS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- TABELAS CORE
-- ============================================

CREATE TABLE clinica (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    cnpj TEXT UNIQUE,
    telefone TEXT,
    endereco JSONB,
    configuracoes JSONB DEFAULT '{}',
    plano TEXT DEFAULT 'trial' CHECK (plano IN ('trial', 'basico', 'pro', 'empresarial')),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    telefone TEXT,
    cargo TEXT DEFAULT 'recepcionista' CHECK (cargo IN ('admin', 'recepcionista', 'profissional', 'gerente')),
    pin_caixa TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    ultimo_acesso TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE unidade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    endereco JSONB,
    telefone TEXT,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidade(id),
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    data_nascimento DATE,
    cpf TEXT,
    endereco JSONB,
    anamnese JSONB DEFAULT '{}',
    historico TEXT,
    tags TEXT[],
    whatsapp_id TEXT,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinica_id, telefone)
);

CREATE TABLE servico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidade(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT,
    duracao_minutos INTEGER NOT NULL DEFAULT 60,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0,
    comissao_percentual DECIMAL(5,2) DEFAULT 0,
    cor TEXT DEFAULT '#3b82f6',
    requer_anamnese BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profissional (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidade(id),
    usuario_id UUID REFERENCES usuario(id),
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    especialidades UUID[],
    horario_trabalho JSONB DEFAULT '{"seg":"09:00-18:00","ter":"09:00-18:00","qua":"09:00-18:00","qui":"09:00-18:00","sex":"09:00-18:00","sab":"09:00-14:00"}',
    comissao_padrao DECIMAL(5,2) DEFAULT 30,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agendamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidade(id),
    cliente_id UUID NOT NULL REFERENCES cliente(id),
    profissional_id UUID REFERENCES profissional(id),
    servico_id UUID NOT NULL REFERENCES servico(id),
    data_hora TIMESTAMPTZ NOT NULL,
    duracao_minutos INTEGER NOT NULL DEFAULT 60,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'nao_compareceu', 'concluido')),
    confirmacao_whatsapp BOOLEAN DEFAULT false,
    confirmacao_data TIMESTAMPTZ,
    observacoes TEXT,
    origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'whatsapp', 'site', 'app')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE caixa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidade(id),
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    agendamento_id UUID REFERENCES agendamento(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'fechamento')),
    categoria TEXT NOT NULL CHECK (categoria IN ('servico', 'produto', 'pacote', 'despesa', 'salario', 'ajuste', 'outro')),
    valor DECIMAL(10,2) NOT NULL,
    forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia')),
    parcelas INTEGER DEFAULT 1,
    descricao TEXT,
    comprovante_url TEXT,
    status TEXT DEFAULT 'confirmado' CHECK (status IN ('pendente', 'confirmado', 'estornado')),
    estornado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agente_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    unidade_id UUID REFERENCES unidade(id),
    nome_agente TEXT DEFAULT 'Assistente Virtual',
    saudacao TEXT DEFAULT 'Olá! Sou o assistente virtual da clínica. Como posso ajudar?',
    horario_atendimento JSONB DEFAULT '{"inicio":"08:00","fim":"20:00","dias":["seg","ter","qua","qui","sex"]}',
    servicos_automaticos BOOLEAN DEFAULT true,
    confirmacao_automatica BOOLEAN DEFAULT true,
    tempo_lembrete INTEGER DEFAULT 60,
    tom_voz TEXT DEFAULT 'profissional' CHECK (tom_voz IN ('profissional', 'amigavel', 'formal')),
    instrucoes_personalizadas TEXT,
    webhook_url TEXT,
    evolution_instance TEXT,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinica_id, unidade_id)
);

CREATE TABLE conversa_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES cliente(id),
    message_id TEXT NOT NULL,
    telefone TEXT NOT NULL,
    direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
    conteudo TEXT NOT NULL,
    tipo_mensagem TEXT DEFAULT 'texto' CHECK (tipo_mensagem IN ('texto', 'imagem', 'audio', 'documento', 'localizacao')),
    processado BOOLEAN DEFAULT false,
    intencao_ia TEXT,
    confianca_ia DECIMAL(3,2),
    erro TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assinatura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinica(id) ON DELETE CASCADE,
    pagarme_id TEXT,
    stripe_id TEXT,
    plano TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'suspensa', 'vencida')),
    proxima_cobranca DATE,
    dados_pagamento JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provedor TEXT NOT NULL CHECK (provedor IN ('evolution', 'pagarme', 'stripe')),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processado BOOLEAN DEFAULT false,
    resultado TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provedor, event_id)
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX idx_agendamento_data ON agendamento(clinica_id, data_hora);
CREATE INDEX idx_agendamento_status ON agendamento(status);
CREATE INDEX idx_agendamento_cliente ON agendamento(cliente_id);
CREATE INDEX idx_caixa_data ON caixa(clinica_id, created_at);
CREATE INDEX idx_caixa_tipo ON caixa(tipo);
CREATE INDEX idx_cliente_telefone ON cliente(clinica_id, telefone);
CREATE INDEX idx_conversa_message_id ON conversa_log(message_id);
CREATE INDEX idx_conversa_telefone ON conversa_log(clinica_id, telefone, created_at DESC);
CREATE INDEX idx_webhook_idempotencia ON webhook_log(provedor, event_id);

-- ============================================
-- RLS - ROW LEVEL SECURITY
-- ============================================

ALTER TABLE clinica ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissional ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE agente_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversa_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_clinica ON clinica
    USING (id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_usuario ON usuario
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_unidade ON unidade
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_cliente ON cliente
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_servico ON servico
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_profissional ON profissional
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_agendamento ON agendamento
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_caixa ON caixa
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_agente ON agente_config
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_conversa ON conversa_log
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

CREATE POLICY tenant_isolation_assinatura ON assinatura
    USING (clinica_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'clinica_id', ''));

-- ============================================
-- FUNÇÕES
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clinica_updated_at BEFORE UPDATE ON clinica
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuario_updated_at BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cliente_updated_at BEFORE UPDATE ON cliente
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agendamento_updated_at BEFORE UPDATE ON agendamento
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agente_config_updated_at BEFORE UPDATE ON agente_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assinatura_updated_at BEFORE UPDATE ON assinatura
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION gerar_relatorio_semanal(p_clinica_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_resultado JSONB;
    v_inicio_semana TIMESTAMPTZ;
    v_fim_semana TIMESTAMPTZ;
BEGIN
    v_inicio_semana := DATE_TRUNC('week', NOW() - INTERVAL '1 week');
    v_fim_semana := DATE_TRUNC('week', NOW());

    SELECT jsonb_build_object(
        'periodo', jsonb_build_object('inicio', v_inicio_semana, 'fim', v_fim_semana),
        'total_atendimentos', COUNT(*),
        'faturamento', COALESCE(SUM(CASE WHEN c.tipo = 'entrada' THEN c.valor ELSE 0 END), 0),
        'despesas', COALESCE(SUM(CASE WHEN c.tipo = 'saida' THEN c.valor ELSE 0 END), 0),
        'taxa_comparecimento', ROUND(
            COUNT(CASE WHEN a.status = 'concluido' THEN 1 END)::numeric / 
            NULLIF(COUNT(CASE WHEN a.status IN ('concluido', 'nao_compareceu', 'cancelado') THEN 1 END), 0) * 100, 
            2
        ),
        'top_servicos', (
            SELECT jsonb_agg(jsonb_build_object('servico', s.nome, 'quantidade', count, 'faturamento', total))
            FROM (
                SELECT s.nome, COUNT(*) as count, SUM(c.valor) as total
                FROM agendamento a
                JOIN servico s ON a.servico_id = s.id
                LEFT JOIN caixa c ON c.agendamento_id = a.id
                WHERE a.clinica_id = p_clinica_id
                AND a.data_hora >= v_inicio_semana
                AND a.data_hora < v_fim_semana
                GROUP BY s.nome
                ORDER BY count DESC
                LIMIT 3
            ) sub
        )
    )
    INTO v_resultado
    FROM agendamento a
    LEFT JOIN caixa c ON c.agendamento_id = a.id
    WHERE a.clinica_id = p_clinica_id
    AND a.data_hora >= v_inicio_semana
    AND a.data_hora < v_fim_semana;

    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CRON JOBS
-- ============================================

SELECT cron.schedule('cancelar-agendamentos-pendentes', '*/5 * * * *', $$
    UPDATE agendamento 
    SET status = 'cancelado'
    WHERE status = 'pendente'
    AND confirmacao_whatsapp = false
    AND created_at < NOW() - INTERVAL '10 minutes'
    AND origem = 'whatsapp'
$$);

SELECT cron.schedule('relatorio-semanal', '0 8 * * 1', $$
    INSERT INTO pg_mq_queue (queue_name, payload)
    SELECT 'relatorio-semanal', jsonb_build_object('clinica_id', id)
    FROM clinica WHERE status = 'ativo'
$$);

-- ============================================
-- DADOS INICIAIS
-- ============================================

INSERT INTO clinica (nome, slug, plano) VALUES 
    ('Clínica Modelo', 'clinica-modelo', 'trial');
