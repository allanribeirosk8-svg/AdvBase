-- =============================================================================
-- FASE 8 (ESTADO FINAL CONSOLIDADO): TIMELINE UNIFICADA E PORTAL DO CLIENTE
-- =============================================================================

-- 1. Token de acesso rápido do Portal na tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_token ON public.clients(portal_token);

-- 2. TABELA: public.timeline_events (Histórico e Eventos de Atendimento)
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  case_id           UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type        VARCHAR(50) NOT NULL DEFAULT 'Atendimento'
                    CHECK (event_type IN (
                      'Atendimento',
                      'Nota de Atendimento',
                      'WhatsApp',
                      'Contato WhatsApp / Ligação',
                      'Perícia / Audiência',
                      'Nota Interna',
                      'Marco Processual',
                      'Andamento Relevante',
                      'Documento Recebido',
                      'Marco Financeiro'
                    )),
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  event_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  visible_to_client BOOLEAN NOT NULL DEFAULT false,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_tenant_client ON public.timeline_events(tenant_id, client_id, event_date DESC);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select_same_tenant"
  ON public.timeline_events FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "timeline_insert_same_tenant"
  ON public.timeline_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "timeline_update_same_tenant"
  ON public.timeline_events FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "timeline_delete_same_tenant"
  ON public.timeline_events FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

-- 3. FUNÇÃO RPC SEGURA PARA O PORTAL DO CLIENTE
CREATE OR REPLACE FUNCTION public.get_client_portal_data(
  p_token UUID,
  p_cpf_prefix TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_tenant_name TEXT;
  v_cases JSONB;
  v_documents JSONB;
  v_movements JSONB;
  v_updates JSONB;
BEGIN
  SELECT id, tenant_id, full_name, cpf
  INTO v_client
  FROM public.clients
  WHERE portal_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de acesso inválido ou expirado.';
  END IF;

  IF v_client.cpf IS NOT NULL AND length(regexp_replace(v_client.cpf, '\D', '', 'g')) >= 4 THEN
    IF p_cpf_prefix IS NULL OR left(regexp_replace(v_client.cpf, '\D', '', 'g'), 4) <> left(regexp_replace(p_cpf_prefix, '\D', '', 'g'), 4) THEN
      RETURN jsonb_build_object(
        'requires_cpf_validation', true,
        'client_first_name', split_part(v_client.full_name, ' ', 1)
      );
    END IF;
  END IF;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = v_client.tenant_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'area', c.area,
    'status', c.status,
    'created_at', c.created_at,
    'processes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'process_number', lp.process_number,
        'instance', lp.instance
      ))
      FROM public.legal_processes lp
      WHERE lp.case_id = c.id
    ), '[]'::jsonb)
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_cases
  FROM public.cases c
  WHERE c.client_id = v_client.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'doc_type', d.doc_type,
    'status', d.status,
    'file_name', d.file_name,
    'created_at', d.created_at
  ) ORDER BY d.status ASC, d.created_at DESC), '[]'::jsonb)
  INTO v_documents
  FROM public.client_documents d
  WHERE d.client_id = v_client.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pm.id,
    'date', pm.date,
    'description', pm.description,
    'process_number', lp.process_number,
    'instance', lp.instance
  ) ORDER BY pm.date DESC), '[]'::jsonb)
  INTO v_movements
  FROM public.process_movements pm
  JOIN public.legal_processes lp ON lp.id = pm.process_id
  JOIN public.cases c ON c.id = lp.case_id
  WHERE c.client_id = v_client.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', te.id,
    'event_type', te.event_type,
    'title', te.title,
    'description', te.description,
    'event_date', te.event_date,
    'created_at', te.created_at
  ) ORDER BY te.event_date DESC), '[]'::jsonb)
  INTO v_updates
  FROM public.timeline_events te
  WHERE te.client_id = v_client.id AND te.visible_to_client = true;

  RETURN jsonb_build_object(
    'requires_cpf_validation', false,
    'client_id', v_client.id,
    'tenant_id', v_client.tenant_id,
    'office_name', COALESCE(v_tenant_name, 'Escritório de Advocacia'),
    'client_name', v_client.full_name,
    'cases', v_cases,
    'documents', v_documents,
    'movements', v_movements,
    'updates', v_updates
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_data(UUID, TEXT) TO anon, authenticated;
