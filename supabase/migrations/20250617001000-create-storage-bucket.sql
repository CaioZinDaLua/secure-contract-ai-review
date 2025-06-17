
-- Create the contract-uploads bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contract-uploads',
  'contract-uploads',
  false,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/mp4'
  ]
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for users to upload their own files
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'contract-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'contract-uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for service role to access all files
CREATE POLICY "Service role can access all files" ON storage.objects
FOR ALL USING (
  bucket_id = 'contract-uploads' AND 
  auth.role() = 'service_role'
);
