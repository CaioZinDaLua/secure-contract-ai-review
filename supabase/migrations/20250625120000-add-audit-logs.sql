
-- Criar tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios logs
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT USING (auth.uid() = user_id);

-- Política para edge functions poderem inserir logs
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Adicionar políticas RLS mais restritivas às tabelas existentes
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own contracts" ON public.contracts;
CREATE POLICY "Users can insert their own contracts" ON public.contracts
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
CREATE POLICY "Users can update their own contracts" ON public.contracts
FOR UPDATE USING (auth.uid() = user_id);

-- Política mais restritiva para análises
DROP POLICY IF EXISTS "Users can view their own analyses" ON public.analyses;
CREATE POLICY "Users can view their own analyses" ON public.analyses
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.contracts c 
  WHERE c.id = analyses.contract_id 
  AND c.user_id = auth.uid()
));

-- Política para chat_history
DROP POLICY IF EXISTS "Users can view their own chat history" ON public.chat_history;
CREATE POLICY "Users can view their own chat history" ON public.chat_history
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chat history" ON public.chat_history;
CREATE POLICY "Users can insert their own chat history" ON public.chat_history
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Função para limpeza automática de logs antigos (manter apenas 90 dias)
CREATE OR REPLACE FUNCTION clean_old_audit_logs() RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs 
  WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para validação de dados
CREATE OR REPLACE FUNCTION validate_contract_data() RETURNS trigger AS $$
BEGIN
  -- Validar nome do arquivo
  IF NEW.file_name IS NULL OR LENGTH(TRIM(NEW.file_name)) = 0 THEN
    RAISE EXCEPTION 'Nome do arquivo é obrigatório';
  END IF;
  
  -- Validar caminho do arquivo
  IF NEW.file_path IS NULL OR LENGTH(TRIM(NEW.file_path)) = 0 THEN
    RAISE EXCEPTION 'Caminho do arquivo é obrigatório';
  END IF;
  
  -- Validar user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'ID do usuário é obrigatório';
  END IF;
  
  -- Sanitizar nome do arquivo
  NEW.file_name = TRIM(NEW.file_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de validação
DROP TRIGGER IF EXISTS validate_contract_data_trigger ON public.contracts;
CREATE TRIGGER validate_contract_data_trigger
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION validate_contract_data();
