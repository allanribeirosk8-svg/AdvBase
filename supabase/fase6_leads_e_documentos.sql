-- Fase 6 - Passo 1: Kanban de Leads e Checklist/Cofre de Documentos

-- Funcao helper para obter o tenant_id do usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 1. Tabela: public.leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  area VARCHAR(100),
  stage VARCHAR(50) NOT NULL DEFAULT 'Novo Contato'
    CHECK (stage IN ('Novo Contato', 'Em Triagem', 'Aguardando Documentos', 'Contrato Assinado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON public.leads(tenant_id, stage);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_leads_select" ON public.leads;
CREATE POLICY "tenant_leads_select" ON public.leads
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_leads_insert" ON public.leads;
CREATE POLICY "tenant_leads_insert" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_leads_update" ON public.leads;
CREATE POLICY "tenant_leads_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_leads_delete" ON public.leads;
CREATE POLICY "tenant_leads_delete" ON public.leads
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_tenant_id());


-- 2. Tabela: public.client_documents
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  doc_type VARCHAR(120) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Recebido', 'Validado')),
  storage_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_docs_tenant_client ON public.client_documents(tenant_id, client_id);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_client_docs_select" ON public.client_documents;
CREATE POLICY "tenant_client_docs_select" ON public.client_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_client_docs_insert" ON public.client_documents;
CREATE POLICY "tenant_client_docs_insert" ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_client_docs_update" ON public.client_documents;
CREATE POLICY "tenant_client_docs_update" ON public.client_documents
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_client_docs_delete" ON public.client_documents;
CREATE POLICY "tenant_client_docs_delete" ON public.client_documents
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_tenant_id());


-- 3. Storage Bucket: client_files + Policies por pasta {tenant_id}/{client_id}/{arquivo}
INSERT INTO storage.buckets (id, name, public)
VALUES ('client_files', 'client_files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "client_files_select_tenant" ON storage.objects;
CREATE POLICY "client_files_select_tenant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client_files'
    AND (storage.foldername(name))[1] = public.get_current_tenant_id()::text
  );

DROP POLICY IF EXISTS "client_files_insert_tenant" ON storage.objects;
CREATE POLICY "client_files_insert_tenant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client_files'
    AND (storage.foldername(name))[1] = public.get_current_tenant_id()::text
  );

DROP POLICY IF EXISTS "client_files_update_tenant" ON storage.objects;
CREATE POLICY "client_files_update_tenant" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client_files'
    AND (storage.foldername(name))[1] = public.get_current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'client_files'
    AND (storage.foldername(name))[1] = public.get_current_tenant_id()::text
  );

DROP POLICY IF EXISTS "client_files_delete_tenant" ON storage.objects;
CREATE POLICY "client_files_delete_tenant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client_files'
    AND (storage.foldername(name))[1] = public.get_current_tenant_id()::text
  );
