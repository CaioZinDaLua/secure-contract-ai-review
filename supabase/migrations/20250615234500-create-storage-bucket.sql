
-- Criar bucket para uploads de contratos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contract-uploads', 'contract-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários façam upload de seus próprios arquivos
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'contract-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários vejam seus próprios arquivos
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'contract-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que edge functions acessem os arquivos
CREATE POLICY "Service role can access all files" ON storage.objects
FOR ALL USING (
  bucket_id = 'contract-uploads' AND
  auth.role() = 'service_role'
);
