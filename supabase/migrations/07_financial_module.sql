-- =============================================================================
-- FASE 7 — PASSO 1: MÓDULO FINANCEIRO ESPECIALIZADO
-- =============================================================================

-- 1. TABELA: public.fee_contracts (Regras de Honorários do Caso)
CREATE TABLE IF NOT EXISTS public.fee_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id               UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  initial_fee_amount    NUMERIC(12, 2) DEFAULT 0, -- Honorários iniciais / contratação
  success_fee_percent   NUMERIC(5, 2) DEFAULT 30.00, -- Ex: 30% de Quota Litis (êxito)
  initial_benefits_qty  INTEGER DEFAULT 0, -- Ex: 3 primeiros benefícios (comum no Previdenciário)
  estimated_case_value  NUMERIC(12, 2) DEFAULT 0, -- Valor estimado da causa / condenação / atrasados
  payout_status         VARCHAR(50) NOT NULL DEFAULT 'Em Andamento'
                        CHECK (payout_status IN (
                          'Em Andamento',
                          'Cálculo / Liquidação',
                          'RPV / Precatório Expedido',
                          'Alvará Expedido',
                          'Recebido / Liquidado'
                        )),
  expected_payout_date  DATE, -- Previsão de liberação do RPV/Alvará
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id) -- 1 contrato principal de honorários por Caso
);

CREATE INDEX IF NOT EXISTS idx_fee_contracts_tenant_id ON public.fee_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_contracts_case_id ON public.fee_contracts(case_id);
CREATE INDEX IF NOT EXISTS idx_fee_contracts_payout_status ON public.fee_contracts(tenant_id, payout_status);

ALTER TABLE public.fee_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fee_contracts_select_same_tenant" ON public.fee_contracts;
CREATE POLICY "fee_contracts_select_same_tenant"
  ON public.fee_contracts FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "fee_contracts_insert_same_tenant" ON public.fee_contracts;
CREATE POLICY "fee_contracts_insert_same_tenant"
  ON public.fee_contracts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "fee_contracts_update_same_tenant" ON public.fee_contracts;
CREATE POLICY "fee_contracts_update_same_tenant"
  ON public.fee_contracts FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "fee_contracts_delete_same_tenant" ON public.fee_contracts;
CREATE POLICY "fee_contracts_delete_same_tenant"
  ON public.fee_contracts FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_tenant_id());


-- 2. TABELA: public.financial_entries (Parcelas, Recebimentos e Custas Reembolsáveis)
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  entry_type      VARCHAR(40) NOT NULL
                  CHECK (entry_type IN (
                    'Honorário Inicial / Parcela',
                    'Honorário de Êxito (RPV/Alvará)',
                    'Custa Adiantada (Reembolsável)',
                    'Despesa Operacional'
                  )),
  description     VARCHAR(255) NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL,
  due_date        DATE NOT NULL,
  paid_date       DATE,
  status          VARCHAR(30) NOT NULL DEFAULT 'Pendente'
                  CHECK (status IN ('Pendente', 'Pago / Recebido', 'Atrasado', 'Cancelado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_tenant_id ON public.financial_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_case_id ON public.financial_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status_due ON public.financial_entries(tenant_id, status, due_date);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_entries_select_same_tenant" ON public.financial_entries;
CREATE POLICY "fin_entries_select_same_tenant"
  ON public.financial_entries FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "fin_entries_insert_same_tenant" ON public.financial_entries;
CREATE POLICY "fin_entries_insert_same_tenant"
  ON public.financial_entries FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "fin_entries_update_same_tenant" ON public.financial_entries;
CREATE POLICY "fin_entries_update_same_tenant"
  ON public.financial_entries FOR UPDATE TO authenticated
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "fin_entries_delete_same_tenant" ON public.financial_entries;
CREATE POLICY "fin_entries_delete_same_tenant"
  ON public.financial_entries FOR DELETE TO authenticated
  USING (tenant_id = public.get_current_tenant_id());
