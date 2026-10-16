import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  Clock,
  Wallet,
  CheckCircle2,
  Scale,
  Receipt,
  Loader2,
  AlertCircle,
  ExternalLink,
  Calendar,
  Filter
} from 'lucide-react';
import type {
  PayoutStatus,
  FinancialEntryType,
  FinancialEntryStatus
} from './CaseDetail';

interface FeeContractWithRelations {
  id: string;
  tenant_id: string;
  case_id: string;
  client_id: string;
  initial_fee_amount: number;
  success_fee_percent: number;
  initial_benefits_qty: number;
  estimated_case_value: number;
  payout_status: PayoutStatus;
  expected_payout_date: string | null;
  notes: string | null;
  created_at: string;
  cases?: {
    id: string;
    title: string;
    area: string;
  } | null;
  clients?: {
    id: string;
    full_name: string;
    cpf: string | null;
  } | null;
}

interface FinancialEntryWithRelations {
  id: string;
  tenant_id: string;
  case_id: string | null;
  client_id: string | null;
  entry_type: FinancialEntryType;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: FinancialEntryStatus;
  created_at: string;
  cases?: {
    id: string;
    title: string;
  } | null;
  clients?: {
    id: string;
    full_name: string;
  } | null;
}

export const FinancialDashboard: React.FC = () => {
  const [contracts, setContracts] = useState<FeeContractWithRelations[]>([]);
  const [entries, setEntries] = useState<FinancialEntryWithRelations[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Controle das Abas Principais
  const [activeTab, setActiveTab] = useState<'rpv_alvaras' | 'lancamentos'>('rpv_alvaras');

  // Filtro de Status na Aba de Lançamentos e Parcelas
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'Pendente' | 'Pago / Recebido'>('TODOS');

  // Estado de carregamento para baixa rápida
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Carrega contratos de honorários e lançamentos financeiros do tenant
  const fetchFinancialData = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const [contractsRes, entriesRes] = await Promise.all([
        supabase
          .from('fee_contracts')
          .select('*, cases(id, title, area), clients(id, full_name, cpf)')
          .order('expected_payout_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('financial_entries')
          .select('*, cases(id, title), clients(id, full_name)')
          .order('due_date', { ascending: true }),
      ]);

      if (contractsRes.error) {
        throw new Error(`Erro ao carregar contratos: ${contractsRes.error.message}`);
      }
      if (entriesRes.error) {
        throw new Error(`Erro ao carregar lançamentos: ${entriesRes.error.message}`);
      }

      setContracts((contractsRes.data as FeeContractWithRelations[]) || []);
      setEntries((entriesRes.data as FinancialEntryWithRelations[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao carregar painel financeiro.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Baixa rápida de lançamento ("Pago / Recebido")
  const handleQuickMarkPaid = async (entryId: string) => {
    setMarkingPaidId(entryId);
    const todayIso = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('financial_entries')
        .update({
          status: 'Pago / Recebido',
          paid_date: todayIso,
        })
        .eq('id', entryId);

      if (error) {
        setErrorMsg(`Não foi possível dar baixa no lançamento: ${error.message}`);
      } else {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === entryId
              ? { ...item, status: 'Pago / Recebido', paid_date: todayIso }
              : item
          )
        );
        setSuccessToast('Baixa registrada como Pago / Recebido!');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Formatadores
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Sem previsão';
    try {
      const [year, month, day] = dateStr.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // ===========================================================================
  // CÁLCULO DOS 4 CARDS EXECUTIVOS DO SÓCIO GESTOR
  // ===========================================================================
  const kpis = useMemo(() => {
    // 1. Previsão de Êxito (RPV / Alvarás Expedidos)
    // Soma de (estimated_case_value * success_fee_percent / 100) para contratos em
    // 'RPV / Precatório Expedido' ou 'Alvará Expedido'
    const predictedRpvAlvara = contracts
      .filter(
        (c) =>
          c.payout_status === 'RPV / Precatório Expedido' ||
          c.payout_status === 'Alvará Expedido'
      )
      .reduce((acc, c) => {
        const caseVal = Number(c.estimated_case_value) || 0;
        const pct = Number(c.success_fee_percent) || 0;
        return acc + caseVal * (pct / 100);
      }, 0);

    // 2. A Receber (Parcelas Pendentes de Honorários)
    const pendingFeeEntries = entries
      .filter(
        (e) =>
          (e.entry_type === 'Honorário Inicial / Parcela' ||
            e.entry_type === 'Honorário de Êxito (RPV/Alvará)') &&
          e.status === 'Pendente'
      )
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // 3. Custas a Reembolsar (Custa Adiantada ainda Pendente)
    const pendingCostsToReimburse = entries
      .filter(
        (e) =>
          e.entry_type === 'Custa Adiantada (Reembolsável)' && e.status === 'Pendente'
      )
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // 4. Recebido no Mês (Honorários com status 'Pago / Recebido' no mês corrente)
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const receivedCurrentMonth = entries
      .filter((e) => {
        const isFee =
          e.entry_type === 'Honorário Inicial / Parcela' ||
          e.entry_type === 'Honorário de Êxito (RPV/Alvará)';
        if (!isFee || e.status !== 'Pago / Recebido') return false;
        const refDate = (e.paid_date || e.due_date || '').substring(0, 7);
        return refDate === currentYearMonth;
      })
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    return {
      predictedRpvAlvara,
      pendingFeeEntries,
      pendingCostsToReimburse,
      receivedCurrentMonth,
    };
  }, [contracts, entries]);

  // Fila de RPVs, Precatórios, Alvarás e Liquidação
  const rpvQueueContracts = useMemo(() => {
    return contracts.filter(
      (c) =>
        c.payout_status === 'Cálculo / Liquidação' ||
        c.payout_status === 'RPV / Precatório Expedido' ||
        c.payout_status === 'Alvará Expedido'
    );
  }, [contracts]);

  // Lista filtrada de Lançamentos e Parcelas
  const filteredEntries = useMemo(() => {
    if (statusFilter === 'TODOS') return entries;
    return entries.filter((e) => e.status === statusFilter);
  }, [entries, statusFilter]);

  const getPayoutStatusBadge = (status: PayoutStatus) => {
    switch (status) {
      case 'Alvará Expedido':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RPV / Precatório Expedido':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Cálculo / Liquidação':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Recebido / Liquidado':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* CABEÇALHO DO PAINEL FINANCEIRO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Painel Financeiro & Funil de RPVs / Alvarás
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Visão executiva de honorários contratuais, previsões de êxito (Quota Litis) e reembolso de custas processuais.
            </p>
          </div>
        </div>
      </div>

      {/* ALERTA DE ERRO */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs font-semibold underline hover:text-red-900"
          >
            Fechar
          </button>
        </div>
      )}

      {/* =======================================================================
          4 CARDS EXECUTIVOS DO SÓCIO GESTOR
      ======================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Previsão de Êxito (RPV / Alvarás Expedidos) */}
        <div className="bg-gradient-to-br from-indigo-600 to-brand-700 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
              Previsão de Êxito (RPV / Alvarás)
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold font-mono tracking-tight block">
              {formatCurrency(kpis.predictedRpvAlvara)}
            </span>
            <span className="text-[11px] text-indigo-100 mt-1 block">
              Honorários em RPV / Precatório ou Alvará Expedido
            </span>
          </div>
        </div>

        {/* Card 2: A Receber (Parcelas Pendentes) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              A Receber (Parcelas Pendentes)
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight block">
              {formatCurrency(kpis.pendingFeeEntries)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Lançamentos de honorários aguardando baixa
            </span>
          </div>
        </div>

        {/* Card 3: Custas a Reembolsar */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Custas a Reembolsar
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-amber-900 font-mono tracking-tight block">
              {formatCurrency(kpis.pendingCostsToReimburse)}
            </span>
            <span className="text-[11px] text-amber-700 mt-1 block">
              Custas adiantadas pendentes de ressarcimento
            </span>
          </div>
        </div>

        {/* Card 4: Recebido no Mês */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Recebido no Mês
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-emerald-700 font-mono tracking-tight block">
              {formatCurrency(kpis.receivedCurrentMonth)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Honorários liquidados no mês corrente
            </span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          NAVEGAÇÃO DE ABAS DO PAINEL FINANCEIRO
      ======================================================================= */}
      <div className="border-b border-slate-200 flex gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('rpv_alvaras')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'rpv_alvaras'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          Fila de RPVs e Alvarás
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {rpvQueueContracts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lancamentos')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'lancamentos'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Lançamentos e Parcelas
          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {entries.length}
          </span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {loading ? (
        <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">
            Consolidando indicadores financeiros do escritório...
          </p>
        </div>
      ) : activeTab === 'rpv_alvaras' ? (
        /* ABA 1: FILA DE RPVs E ALVARÁS */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                Casos em Fase de Liquidação, RPV / Precatório ou Alvará
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento de levantamentos judiciais e previsão de entrada de honorários de êxito
              </p>
            </div>
          </div>

          {rpvQueueContracts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Scale className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Nenhum caso na fila de RPV / Alvará ou Liquidação
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Atualize o "Status de Recebimento" dentro da aba Financeiro e Honorários de qualquer caso para que ele apareça nesta fila.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Caso / Demanda</th>
                    <th className="px-6 py-4">Status de Recebimento</th>
                    <th className="px-6 py-4">Data Prevista</th>
                    <th className="px-6 py-4 text-right">Honorários do Escritório</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rpvQueueContracts.map((fc) => {
                    const officeFee =
                      (Number(fc.estimated_case_value) || 0) *
                      ((Number(fc.success_fee_percent) || 0) / 100);

                    return (
                      <tr key={fc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          {fc.clients ? (
                            <Link
                              to={`/clientes/${fc.clients.id}`}
                              className="font-bold text-slate-800 hover:text-brand-600 transition-colors block"
                            >
                              {fc.clients.full_name}
                            </Link>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                          {fc.clients?.cpf && (
                            <span className="text-xs font-mono text-slate-400 block">
                              {fc.clients.cpf}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <Link
                            to={`/casos/${fc.case_id}`}
                            className="font-semibold text-brand-700 hover:underline inline-flex items-center gap-1.5"
                          >
                            <span>{fc.cases?.title || 'Acessar Caso'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          {fc.cases?.area && (
                            <span className="text-xs text-slate-400 block">{fc.cases.area}</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getPayoutStatusBadge(
                              fc.payout_status
                            )}`}
                          >
                            {fc.payout_status}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(fc.expected_payout_date)}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-extrabold text-emerald-700 text-base block">
                            {formatCurrency(officeFee)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {fc.success_fee_percent}% sobre {formatCurrency(Number(fc.estimated_case_value))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ABA 2: LANÇAMENTOS E PARCELAS */
        <div className="space-y-4">
          {/* Barra de Filtro por Status */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Filter className="w-4 h-4 text-brand-600" />
              <span>Filtrar Lançamentos por Status:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(['TODOS', 'Pendente', 'Pago / Recebido'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    statusFilter === st
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st === 'TODOS' ? 'Todos os Lançamentos' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Lançamentos */}
          {filteredEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-3">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Receipt className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Nenhum lançamento encontrado para este filtro
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre parcelas ou custas dentro da aba financeira dos casos do escritório.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {filteredEntries.map((entry) => {
                const isPaid = entry.status === 'Pago / Recebido';
                const isCost = entry.entry_type === 'Custa Adiantada (Reembolsável)';
                const isBusy = markingPaidId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${
                            isCost
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : entry.entry_type === 'Honorário de Êxito (RPV/Alvará)'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}
                        >
                          {entry.entry_type}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{entry.description}</h4>

                      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                        {entry.clients && (
                          <span>
                            Cliente:{' '}
                            <Link
                              to={`/clientes/${entry.clients.id}`}
                              className="font-semibold text-slate-700 hover:text-brand-600"
                            >
                              {entry.clients.full_name}
                            </Link>
                          </span>
                        )}
                        {entry.cases && (
                          <span>
                            • Caso:{' '}
                            <Link
                              to={`/casos/${entry.cases.id}`}
                              className="font-semibold text-brand-600 hover:underline"
                            >
                              {entry.cases.title}
                            </Link>
                          </span>
                        )}
                        <span>• Vencimento: {formatDate(entry.due_date)}</span>
                        {entry.paid_date && (
                          <span className="text-emerald-600 font-semibold">
                            • Pago em: {formatDate(entry.paid_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-center">
                      <span className="text-base font-extrabold text-slate-900 font-mono">
                        {formatCurrency(Number(entry.amount))}
                      </span>

                      {!isPaid && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleQuickMarkPaid(entry.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Dar Baixa (Recebido)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
