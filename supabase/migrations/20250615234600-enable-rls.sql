
-- Habilitar RLS em todas as tabelas principais se ainda não estiver habilitado
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para contracts
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts
FOR ALL USING (auth.uid() = user_id);

-- Políticas para analyses
DROP POLICY IF EXISTS "Users can view their own analyses" ON public.analyses;
CREATE POLICY "Users can view their own analyses" ON public.analyses
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.contracts c WHERE c.id = analyses.contract_id AND c.user_id = auth.uid()
));

-- Políticas para user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles
FOR ALL USING (auth.uid() = user_id);

-- Permitir que edge functions façam operações necessárias
DROP POLICY IF EXISTS "Service role can manage contracts" ON public.contracts;
CREATE POLICY "Service role can manage contracts" ON public.contracts
FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage analyses" ON public.analyses;
CREATE POLICY "Service role can manage analyses" ON public.analyses
FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
CREATE POLICY "Service role can manage profiles" ON public.user_profiles
FOR ALL USING (auth.role() = 'service_role');
