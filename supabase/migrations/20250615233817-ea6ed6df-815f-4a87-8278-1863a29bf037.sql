
-- ========= MODIFICAÇÃO DA TABELA DE PERFIS =========
-- Adiciona uma coluna para diferenciar planos FREE de PRO
ALTER TABLE public.user_profiles
ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'free';

-- ========= CRIAÇÃO DE NOVAS TABELAS =========

-- Tabela para armazenar o histórico da conversa com a IA
CREATE TABLE public.chat_history (
    id BIGSERIAL PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_message TEXT,
    ai_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para versionamento do conteúdo do contrato
CREATE TABLE public.contract_versions (
    id BIGSERIAL PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content_text TEXT NOT NULL, -- Armazena o texto completo do contrato para cada versão
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id, version_number) -- Garante que não haja versões duplicadas
);

-- ========= HABILITAÇÃO E CRIAÇÃO DE NOVAS POLÍTICAS DE SEGURANÇA (RLS) =========

-- Habilita RLS nas novas tabelas
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários só podem acessar o histórico e versões de seus próprios contratos.
CREATE POLICY "Allow individual access to own chat_history" ON public.chat_history FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Allow individual access to own contract_versions" ON public.contract_versions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.contracts c WHERE c.id = contract_versions.contract_id AND c.user_id = auth.uid()
    ));

-- Permite que a Edge Function insira novas versões (será usado internamente)
CREATE POLICY "Allow service role to insert versions" ON public.contract_versions FOR INSERT
    WITH CHECK (true); -- A lógica de permissão será feita na função
