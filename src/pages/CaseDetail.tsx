import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  User,
  Scale,
  FileText,
  Plus,
  Clock,
  Copy,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Briefcase,
  Hash,
  CalendarCheck,
  Flame,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Save,
  Loader2,
  Wallet
} from 'lucide-react';

interface ClientInfo {
  id: string;
  full_name: string;
  cpf: string | null;
  contact_phone: string | null;
}

interface CaseData {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  area: string;
  status: string;
  facts_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface LegalProcess {
  id: string;
  tenant_id: string;
  case_id: string;
  process_number: string | null;
  instance: string;
  created_at: string;
  updated_at?: string;
}

export interface TenantUser {
  id: string;
  full_name: string;
  role: string;
}

export interface CaseTask {
  id: string;
  tenant_id: string;
  case_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  is_fatal_deadline: boolean;
  status: string;
  created_at: string;
  assignee_name?: string;
}

export type PayoutStatus =
  | 'Em Andamento'
  | 'Cálculo / Liquidação'
  | 'RPV / Precatório Expedido'
  | 'Alvará Expedido'
  | 'Recebido / Liquidado';

export interface FeeContract {
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
  updated_at: string;
}

export type FinancialEntryType =
  | 'Honorário Inicial / Parcela'
  | 'Honorário de Êxito (RPV/Alvará)'
  | 'Custa Adiantada (Reembolsável)'
  | 'Despesa Operacional';

export type FinancialEntryStatus =
  | 'Pendente'
  | 'Pago / Recebido'
  | 'Atrasado'
  | 'Cancelado';

export interface FinancialEntry {
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
}

export const CaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [caseInfo, setCaseInfo] = useState<CaseData | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [processes, setProcesses] = useState<LegalProcess[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProcesses, setLoadingProcesses] = useState<boolean>(false);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal para Adicionar Processo
  const [isProcessModalOpen, setIsProcessModalOpen] = useState<boolean>(false);
  const [processFormData, setProcessFormData] = useState({
    process_number: '',
    instance: '1ª Instância / JEF',
  });
  const [processLoading, setProcessLoading] = useState<boolean>(false);
  const [processError, setProcessError] = useState<string | null>(null);

  // Modal para Adicionar Tarefa / Prazo
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    due_date: '',
    is_fatal_deadline: false,
  });
  const [taskLoading, setTaskLoading] = useState<boolean>(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Feedback de cópia e toast
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Controle de Abas do Caso
  const [activeTab, setActiveTab] = useState<'operacional' | 'financeiro'>('operacional');

  // Estados Financeiros — Bloco 1: Contrato de Honorários (fee_contracts)
  const [feeContract, setFeeContract] = useState<FeeContract | null>(null);
  const [loadingContract, setLoadingContract] = useState<boolean>(false);
  const [savingContract, setSavingContract] = useState<boolean>(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractForm, setContractForm] = useState({
    initial_fee_amount: '0',
    success_fee_percent: '30',
    initial_benefits_qty: '0',
    estimated_case_value: '0',
    payout_status: 'Em Andamento' as PayoutStatus,
    expected_payout_date: '',
    notes: '',
  });

  // Estados Financeiros — Bloco 2: Lançamentos e Custas (financial_entries)
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [creatingEntry, setCreatingEntry] = useState<boolean>(false);
  const [entryModalError, setEntryModalError] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    entry_type: 'Honorário Inicial / Parcela' as FinancialEntryType,
    description: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
  });

  // 1. Carrega os dados do Caso e do Cliente
  const fetchCaseDetails = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: cData, error: cError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (cError || !cData) {
        setErrorMessage('Caso não encontrado ou sem permissão de acesso.');
        setLoading(false);
        return;
      }

      setCaseInfo(cData as CaseData);

      // Busca dados do cliente associado
      const { data: clData } = await supabase
        .from('clients')
        .select('id, full_name, cpf, contact_phone')
        .eq('id', cData.client_id)
        .single();

      if (clData) {
        setClientInfo(clData as ClientInfo);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar informações do caso.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Carrega os processos vinculados a este caso
  const fetchProcesses = async () => {
    if (!caseId) return;
    setLoadingProcesses(true);
    try {
      const { data, error } = await supabase
        .from('legal_processes')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar processos vinculados:', error.message);
      } else {
        setProcesses((data as LegalProcess[]) || []);
      }
    } catch (err) {
      console.error('Erro de conexão ao buscar processos:', err);
    } finally {
      setLoadingProcesses(false);
    }
  };

  // 3. Carrega os usuários do tenant (advogados/membros)
  const fetchTenantUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .order('full_name', { ascending: true });

      if (!error && data) {
        setTenantUsers(data as TenantUser[]);
        // Se ainda não selecionou responsável, define o usuário logado
        if (!taskFormData.assignee_id && user?.id) {
          setTaskFormData((prev) => ({ ...prev, assignee_id: user.id }));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar usuários do tenant:', err);
    }
  };

  // 4. Carrega as tarefas pendentes vinculadas a este caso específico
  const fetchTasks = async (usersList?: TenantUser[]) => {
    if (!caseId) return;
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('case_id', caseId)
        .neq('status', 'Concluída')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Erro ao buscar tarefas do caso:', error.message);
      } else {
        const uList = usersList || tenantUsers;
        const mapped = (data || []).map((t: any) => {
          const matchedUser = uList.find((u) => u.id === t.assignee_id);
          return {
            ...t,
            assignee_name: matchedUser ? matchedUser.full_name : 'Não atribuído',
          };
        });
        setTasks(mapped as CaseTask[]);
      }
    } catch (err) {
      console.error('Falha de rede ao consultar tarefas:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // 5. Carrega o Contrato de Honorários (fee_contracts) deste caso
  const fetchFeeContract = async () => {
    if (!caseId) return;
    setLoadingContract(true);
    try {
      const { data, error } = await supabase
        .from('fee_contracts')
        .select('*')
        .eq('case_id', caseId)
        .maybeSingle();

      if (!error && data) {
        const fc = data as FeeContract;
        setFeeContract(fc);
        setContractForm({
          initial_fee_amount: String(fc.initial_fee_amount ?? 0),
          success_fee_percent: String(fc.success_fee_percent ?? 30),
          initial_benefits_qty: String(fc.initial_benefits_qty ?? 0),
          estimated_case_value: String(fc.estimated_case_value ?? 0),
          payout_status: fc.payout_status || 'Em Andamento',
          expected_payout_date: fc.expected_payout_date || '',
          notes: fc.notes || '',
        });
      }
    } catch (err) {
      console.error('Erro ao carregar contrato de honorários:', err);
    } finally {
      setLoadingContract(false);
    }
  };

  // 6. Carrega os Lançamentos e Custas (financial_entries) deste caso
  const fetchFinancialEntries = async () => {
    if (!caseId) return;
    setLoadingEntries(true);
    try {
      const { data, error } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('case_id', caseId)
        .order('due_date', { ascending: true });

      if (!error && data) {
        setFinancialEntries((data as FinancialEntry[]) || []);
      }
    } catch (err) {
      console.error('Erro ao buscar lançamentos financeiros:', err);
    } finally {
      setLoadingEntries(false);
    }
  };

  // 7. Salvar ou Atualizar Contrato de Honorários (Upsert por case_id)
  const handleSaveFeeContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !caseInfo || !profile?.tenant_id) {
      setContractError('Sessão inválida ou caso não identificado.');
      return;
    }

    setSavingContract(true);
    setContractError(null);

    try {
      const payload = {
        tenant_id: profile.tenant_id,
        case_id: caseId,
        client_id: caseInfo.client_id,
        initial_fee_amount: Number(contractForm.initial_fee_amount) || 0,
        success_fee_percent: Number(contractForm.success_fee_percent) || 0,
        initial_benefits_qty: parseInt(contractForm.initial_benefits_qty, 10) || 0,
        estimated_case_value: Number(contractForm.estimated_case_value) || 0,
        payout_status: contractForm.payout_status,
        expected_payout_date: contractForm.expected_payout_date || null,
        notes: contractForm.notes.trim() || null,
      };

      const { data, error } = await supabase
        .from('fee_contracts')
        .upsert(payload, { onConflict: 'case_id' })
        .select()
        .single();

      if (error) {
        setContractError(`Erro ao salvar termos de honorários: ${error.message}`);
      } else if (data) {
        setFeeContract(data as FeeContract);
        setSuccessToast('Contrato de honorários salvo com sucesso!');
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar contrato.';
      setContractError(msg);
    } finally {
      setSavingContract(false);
    }
  };

  // 8. Criar Novo Lançamento Financeiro / Custa
  const handleCreateFinancialEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !caseInfo || !profile?.tenant_id) {
      setEntryModalError('Sessão inválida: Tenant não identificado.');
      return;
    }

    const numericAmount = Number(entryForm.amount.replace(',', '.'));
    if (!entryForm.description.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      setEntryModalError('Preencha uma descrição válida e um valor maior que zero.');
      return;
    }

    setCreatingEntry(true);
    setEntryModalError(null);

    try {
      const { data, error } = await supabase
        .from('financial_entries')
        .insert([
          {
            tenant_id: profile.tenant_id,
            case_id: caseId,
            client_id: caseInfo.client_id,
            entry_type: entryForm.entry_type,
            description: entryForm.description.trim(),
            amount: numericAmount,
            due_date: entryForm.due_date,
            status: 'Pendente',
          },
        ])
        .select()
        .single();

      if (error) {
        setEntryModalError(`Erro ao registrar lançamento: ${error.message}`);
        setCreatingEntry(false);
        return;
      }

      setFinancialEntries((prev) => [...prev, data as FinancialEntry]);
      setIsEntryModalOpen(false);
      setEntryForm({
        entry_type: 'Honorário Inicial / Parcela',
        description: '',
        amount: '',
        due_date: new Date().toISOString().split('T')[0],
      });
      setSuccessToast('Lançamento registrado com sucesso!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao salvar lançamento.';
      setEntryModalError(msg);
    } finally {
      setCreatingEntry(false);
    }
  };

  // 9. Marcar Lançamento como "Pago / Recebido"
  const handleMarkEntryPaid = async (entryId: string) => {
    setMarkingPaidId(entryId);
    const todayIso = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('financial_entries')
        .update({
          status: 'Pago / Recebido',
          paid_date: todayIso,
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) {
        alert(`Erro ao atualizar lançamento: ${error.message}`);
      } else if (data) {
        setFinancialEntries((prev) =>
          prev.map((item) => (item.id === entryId ? (data as FinancialEntry) : item))
        );
        setSuccessToast('Lançamento marcado como Pago / Recebido!');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Formatador de Moeda (R$)
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Cálculo automático em tempo real: Honorário de Êxito Previsto
  const estimatedCaseValNum = Number(contractForm.estimated_case_value) || 0;
  const successPercentNum = Number(contractForm.success_fee_percent) || 0;
  const predictedSuccessFee = estimatedCaseValNum * (successPercentNum / 100);

  // Cálculo do Total de Custas Adiantadas a Reembolsar
  const totalReimbursableCosts = financialEntries
    .filter(
      (entry) =>
        entry.entry_type === 'Custa Adiantada (Reembolsável)' && entry.status !== 'Cancelado'
    )
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const pendingReimbursableCosts = financialEntries
    .filter(
      (entry) =>
        entry.entry_type === 'Custa Adiantada (Reembolsável)' && entry.status === 'Pendente'
    )
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  useEffect(() => {
    fetchCaseDetails();
    fetchProcesses();
    fetchFeeContract();
    fetchFinancialEntries();
    fetchTenantUsers().then(() => {
      fetchTasks();
    });
  }, [caseId]);

  // Formatação de Datas
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      const [year, month, day] = dateString.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    try {
      const d = new Date(dateString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  // Status de urgência do prazo
  const getDeadlineStatus = (dueDateString: string | null) => {
    if (!dueDateString) return null;

    const now = new Date();
    const due = new Date(dueDateString);
    const diffMs = due.getTime() - now.getTime();
    const formatted = formatDateTime(dueDateString);

    if (diffMs < 0) {
      return {
        text: `VENCIDO (${formatted})`,
        badgeClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
      };
    } else if (diffMs <= 24 * 60 * 60 * 1000) {
      return {
        text: `VENCE HOJE (${formatted})`,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse',
      };
    }
    return {
      text: `Prazo: ${formatted}`,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  };

  // Copiar para área de transferência
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 5. Salvar Novo Processo Vinculado
  const handleCreateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) return;

    if (!profile?.tenant_id) {
      setProcessError('Erro de sessão: Tenant da organização não identificado.');
      return;
    }

    if (!processFormData.process_number.trim()) {
      setProcessError('Informe o número do processo ou identificador administrativo.');
      return;
    }

    setProcessLoading(true);
    setProcessError(null);

    try {
      const { data, error } = await supabase
        .from('legal_processes')
        .insert([
          {
            tenant_id: profile.tenant_id,
            case_id: caseId,
            process_number: processFormData.process_number.trim(),
            instance: processFormData.instance.trim(),
          },
        ])
        .select()
        .single();

      if (error) {
        setProcessError(`Erro ao cadastrar processo: ${error.message}`);
        setProcessLoading(false);
        return;
      }

      setProcesses((prev) => [data as LegalProcess, ...prev]);
      setIsProcessModalOpen(false);
      setProcessFormData({ process_number: '', instance: '1ª Instância / JEF' });
      setSuccessToast('Processo vinculado com sucesso!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha inesperada ao gravar processo.';
      setProcessError(msg);
    } finally {
      setProcessLoading(false);
    }
  };

  // 6. Salvar Nova Tarefa Vinculada ao Caso
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) return;

    if (!profile?.tenant_id) {
      setTaskError('Erro de sessão: Tenant da organização não identificado.');
      return;
    }

    if (!taskFormData.title.trim()) {
      setTaskError('O título da tarefa ou prazo é obrigatório.');
      return;
    }

    setTaskLoading(true);
    setTaskError(null);

    try {
      const payload: any = {
        tenant_id: profile.tenant_id,
        case_id: caseId, // Automaticamente vinculado ao caso!
        assignee_id: taskFormData.assignee_id || user?.id || null,
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim() || null,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        is_fatal_deadline: taskFormData.is_fatal_deadline,
        status: 'Pendente',
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([payload])
        .select()
        .single();

      if (error) {
        setTaskError(`Erro ao cadastrar tarefa: ${error.message}`);
        setTaskLoading(false);
        return;
      }

      const assignedUser = tenantUsers.find((u) => u.id === data.assignee_id);
      const newTaskWithAssignee = {
        ...(data as CaseTask),
        assignee_name: assignedUser ? assignedUser.full_name : 'Não atribuído',
      };

      setTasks((prev) => [newTaskWithAssignee, ...prev]);
      setIsTaskModalOpen(false);
      setTaskFormData({
        title: '',
        description: '',
        assignee_id: user?.id || '',
        due_date: '',
        is_fatal_deadline: false,
      });
      setSuccessToast('Prazo / Tarefa vinculado(a) com sucesso!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha inesperada ao gravar tarefa.';
      setTaskError(msg);
    } finally {
      setTaskLoading(false);
    }
  };

  // 7. Concluir Tarefa
  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Concluída' })
        .eq('id', taskId);

      if (error) {
        setTasks(previousTasks);
        console.error('Erro ao concluir tarefa:', error.message);
      } else {
        setSuccessToast('Tarefa concluída com sucesso!');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } catch (err) {
      setTasks(previousTasks);
      console.error('Falha de rede ao concluir tarefa:', err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Badges dinâmicos
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'em análise':
      case 'em analise':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'administrativo':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'judicial':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'finalizado':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelado':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getInstanceBadge = (instance: string) => {
    const inst = instance.toUpperCase();
    if (inst.includes('INSS')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (inst.includes('TRF')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (inst.includes('TRT')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (inst.includes('JEF')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const fatalCount = tasks.filter((t) => t.is_fatal_deadline).length;

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Abrindo painel do caso...</p>
      </div>
    );
  }

  if (errorMessage || !caseInfo) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Caso não localizado</h3>
        <p className="text-sm text-slate-500">{errorMessage || 'Registro não encontrado.'}</p>
        <button
          onClick={() => navigate('/clientes')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      
      {/* Toast de Notificação */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Navegação / Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {clientInfo ? (
            <Link
              to={`/clientes/${clientInfo.id}`}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-500 hover:text-brand-600 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao Dossiê de {clientInfo.full_name}
            </Link>
          ) : (
            <Link
              to="/clientes"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-500 hover:text-brand-600 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Clientes
            </Link>
          )}
        </div>
        <span className="font-mono text-slate-400">Caso ID: {caseInfo.id.substring(0, 8)}...</span>
      </div>

      {/* CABEÇALHO DO CASO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-slate-100">
          
          <div className="space-y-3 max-w-3xl">
            {/* Badges de Área e Status */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {caseInfo.area}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(caseInfo.status)}`}>
                {caseInfo.status}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Criado em {formatDate(caseInfo.created_at)}
              </span>
            </div>

            {/* Título Principal do Caso */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
              {caseInfo.title}
            </h1>
          </div>

          {/* Cartão Resumido do Cliente Vinculado */}
          {clientInfo && (
            <Link
              to={`/clientes/${clientInfo.id}`}
              className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl transition-all flex items-center gap-3.5 group flex-shrink-0"
              title="Acessar dossiê completo deste cliente"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cliente Titular
                </span>
                <span className="text-sm font-bold text-slate-800 group-hover:text-brand-600 transition-colors flex items-center gap-1">
                  {clientInfo.full_name}
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-600" />
                </span>
                <span className="text-xs font-mono text-slate-500 block">
                  {clientInfo.cpf || 'Sem CPF cadastrado'}
                </span>
              </div>
            </Link>
          )}

        </div>

        {/* Resumo dos Fatos & Pretensão do Cliente */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-brand-600" />
            Resumo dos Fatos e Fundamentação
          </h2>
          {caseInfo.facts_summary ? (
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {caseInfo.facts_summary}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Nenhum resumo dos fatos cadastrado para este caso.
            </p>
          )}
        </div>
      </div>

      {/* BARRA DE ABAS DO CASO */}
      <div className="border-b border-slate-200 flex gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('operacional')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'operacional'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          Prazos, Tarefas e Processos
          <span className="bg-brand-50 text-brand-700 border border-brand-100 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {tasks.length + processes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financeiro')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'financeiro'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Financeiro e Honorários
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {financialEntries.length}
          </span>
        </button>
      </div>

      {activeTab === 'operacional' ? (
        <div className="space-y-8">
      {/* SECÇÃO 1: PRAZOS E TAREFAS DO CASO (INTEGRAÇÃO FASE 4) */}
      <div className="space-y-4">
        
        {/* Barra de Título da Secção de Prazos e Tarefas */}
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">Prazos e Tarefas</h3>
                <span className="bg-brand-50 text-brand-700 border border-brand-100 text-xs font-bold px-2 py-0.5 rounded-full">
                  {tasks.length} pendente(s)
                </span>
                {fatalCount > 0 && (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Flame className="w-3 h-3 text-red-600" />
                    {fatalCount} fatal(is)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle de diligências, prazos preclusivos e atos processuais vinculados a esta demanda
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsTaskModalOpen(true);
              setTaskError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>

        {/* Listagem de Tarefas Pendentes do Caso */}
        {loadingTasks ? (
          <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium text-slate-500">Carregando prazos e tarefas do caso...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm space-y-3">
            <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <CalendarCheck className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-800">Nenhum prazo ou tarefa pendente</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-0.5">
                Todas as providências e prazos deste caso estão em dia ou concluídos.
              </p>
            </div>
            <button
              onClick={() => {
                setIsTaskModalOpen(true);
                setTaskError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Primeira Tarefa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {tasks.map((task) => {
              const deadline = getDeadlineStatus(task.due_date);
              const isFatal = task.is_fatal_deadline;
              const isCompleting = completingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`rounded-2xl p-5 transition-all shadow-sm flex flex-col md:flex-row md:items-start md:justify-between gap-4 relative overflow-hidden ${
                    isFatal
                      ? 'bg-gradient-to-r from-red-500/[0.04] via-white to-white border-2 border-red-500 shadow-red-100/50 hover:shadow-md'
                      : 'bg-white border border-slate-200 hover:border-brand-200 hover:shadow-sm'
                  }`}
                >
                  {/* Faixa decorativa Anti-Sinistro */}
                  {isFatal && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-red-400" />
                  )}

                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Linha de Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {isFatal ? (
                        <span className="px-2.5 py-0.5 rounded-full font-bold bg-red-600 text-white flex items-center gap-1 shadow-sm text-[11px] uppercase tracking-wider animate-pulse">
                          <Flame className="w-3.5 h-3.5" />
                          Prazo Fatal Processual
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                          {task.status}
                        </span>
                      )}

                      {deadline && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] border flex items-center gap-1 ${deadline.badgeClass}`}>
                          <Clock className="w-3 h-3" />
                          {deadline.text}
                        </span>
                      )}

                      <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        <User className="w-3 h-3 text-slate-400" />
                        Resp: {task.assignee_name}
                      </span>
                    </div>

                    {/* Título da Tarefa */}
                    <h4 className={`text-base font-bold leading-snug ${isFatal ? 'text-red-950 font-extrabold' : 'text-slate-900'}`}>
                      {task.title}
                    </h4>

                    {/* Descrição */}
                    {task.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Ação: Botão Concluir */}
                  <div className="flex items-center md:items-end justify-end flex-shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={isCompleting}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      title="Marcar como concluída"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isCompleting ? 'Salvando...' : 'Concluir'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECÇÃO 2: PROCESSOS VINCULADOS */}
      <div className="space-y-4 pt-2">
        
        {/* Barra de Título da Secção */}
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">Processos Vinculados</h3>
                <span className="bg-brand-50 text-brand-700 border border-brand-100 text-xs font-bold px-2 py-0.5 rounded-full">
                  {processes.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Numerações judiciais, procedimentos administrativos e instâncias vinculadas
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsProcessModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Processo</span>
          </button>
        </div>

        {/* Conteúdo: Lista ou Tabela de Processos */}
        {loadingProcesses ? (
          <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium text-slate-500">Carregando processos vinculados...</p>
          </div>
        ) : processes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Scale className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-800">Nenhum processo vinculado</h4>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                Este caso ainda não possui autos judiciais ou processos administrativos cadastrados.
              </p>
            </div>
            <button
              onClick={() => setIsProcessModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Primeiro Processo
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Número do Processo / Procedimento</th>
                    <th className="px-6 py-4">Instância / Órgão</th>
                    <th className="px-6 py-4">Data de Vinculação</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processes.map((proc) => (
                    <tr key={proc.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Número do Processo com Cópia Rápida */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-slate-400" />
                          <span className="font-mono font-bold text-slate-800 text-sm">
                            {proc.process_number || 'Sem numeração formal'}
                          </span>
                          {proc.process_number && (
                            <button
                              onClick={() => handleCopy(proc.process_number!, `proc_${proc.id}`)}
                              title="Copiar número do processo"
                              className="text-slate-400 hover:text-slate-600 p-1"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {copiedKey === `proc_${proc.id}` && (
                            <span className="text-emerald-600 text-xs font-semibold">Copiado!</span>
                          )}
                        </div>
                      </td>

                      {/* Instância / Órgão */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getInstanceBadge(proc.instance)}`}>
                          {proc.instance}
                        </span>
                      </td>

                      {/* Data de Registro */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(proc.created_at)}</span>
                        </div>
                      </td>

                      {/* Status / Ações */}
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          Ativo
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      </div>
      ) : (
        /* ABA: FINANCEIRO E HONORÁRIOS (FASE 7) */
        <div className="space-y-8">
          
          {/* ===================================================================
              BLOCO 1: CONTRATO DE HONORÁRIOS (fee_contracts)
          =================================================================== */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-50/50 via-white to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      Contrato de Honorários do Caso
                    </h3>
                    {feeContract && (
                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {feeContract.payout_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Defina os honorários contratuais, percentual de êxito (Quota Litis) e previsão de RPV/Alvará
                  </p>
                </div>
              </div>

              {/* CARD EM DESTAQUE: HONORÁRIO DE ÊXITO PREVISTO */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md flex items-center gap-3.5 min-w-[260px]">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 block">
                    Honorário de Êxito Previsto ({successPercentNum}%)
                  </span>
                  <span className="text-xl font-extrabold tracking-tight block">
                    {formatCurrency(predictedSuccessFee)}
                  </span>
                </div>
              </div>
            </div>

            {loadingContract ? (
              <div className="p-10 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Carregando termos de honorários...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveFeeContract} className="p-6 space-y-5">
                {contractError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{contractError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Honorários Iniciais (R$) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Honorários Iniciais / Contratação (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={contractForm.initial_fee_amount}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, initial_fee_amount: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  {/* Percentual de Êxito / Quota Litis (%) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Percentual de Êxito / Quota Litis (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={contractForm.success_fee_percent}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, success_fee_percent: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  {/* Quantidade de Benefícios Iniciais */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Qtd. Benefícios Iniciais (Salários)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      placeholder="Ex: 3"
                      value={contractForm.initial_benefits_qty}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, initial_benefits_qty: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  {/* Valor Estimado da Causa / Atrasados (R$) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Valor Estimado da Causa / Atrasados (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={contractForm.estimated_case_value}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, estimated_case_value: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  {/* Status de Recebimento (payout_status) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status de Recebimento (RPV / Alvará)
                    </label>
                    <select
                      value={contractForm.payout_status}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          payout_status: e.target.value as PayoutStatus,
                        })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="Em Andamento">Em Andamento</option>
                      <option value="Cálculo / Liquidação">Cálculo / Liquidação</option>
                      <option value="RPV / Precatório Expedido">RPV / Precatório Expedido</option>
                      <option value="Alvará Expedido">Alvará Expedido</option>
                      <option value="Recebido / Liquidado">Recebido / Liquidado</option>
                    </select>
                  </div>

                  {/* Previsão de Liberação (Data) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Previsão de Liberação (Data)
                    </label>
                    <input
                      type="date"
                      value={contractForm.expected_payout_date}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, expected_payout_date: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Observações do Contrato */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observações e Cláusulas Especiais de Honorários
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: 30% sobre o proveito econômico bruto + 3 primeiros benefícios previdenciários..."
                    value={contractForm.notes}
                    onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={savingContract}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {savingContract ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando Termos...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Salvar Contrato de Honorários
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ===================================================================
              BLOCO 2: LANÇAMENTOS E CUSTAS DO CASO (financial_entries)
          =================================================================== */}
          <div className="space-y-4">
            
            {/* Barra de Título + Botão Novo Lançamento */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-base">
                      Lançamentos e Custas do Caso
                    </h3>
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold px-2 py-0.5 rounded-full">
                      {financialEntries.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Controle de parcelas de honorários iniciais, recebimentos de RPV/Alvará e custas adiantadas reembolsáveis
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEntryModalError(null);
                  setIsEntryModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Lançamento</span>
              </button>
            </div>

            {/* ALERTA / RESUMO: TOTAL DE CUSTAS ADIANTADAS A REEMBOLSAR */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl flex-shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    Resumo de Custas Adiantadas (Reembolsáveis no Final do Processo)
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Valores adiantados pelo escritório ou cliente (perícias, cópias de prontuário, guias judiciais) a descontar/reembolsar na liquidação.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    Pendente de Reembolso
                  </span>
                  <span className="text-lg font-extrabold text-amber-900 font-mono">
                    {formatCurrency(pendingReimbursableCosts)}
                  </span>
                </div>
                <div className="h-8 w-px bg-amber-200" />
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    Total de Custas do Caso
                  </span>
                  <span className="text-sm font-bold text-amber-800 font-mono">
                    {formatCurrency(totalReimbursableCosts)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela / Lista de Lançamentos Financeiros */}
            {loadingEntries ? (
              <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Carregando lançamentos financeiros...</p>
              </div>
            ) : financialEntries.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm space-y-3">
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Receipt className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">
                    Nenhum lançamento financeiro registrado
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-0.5">
                    Registre parcelas de honorários iniciais, custas adiantadas reembolsáveis ou recebimentos de RPV/Alvará.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                {financialEntries.map((entry) => {
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
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm">{entry.description}</h4>

                        <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap">
                          <span>Vencimento: {formatDate(entry.due_date)}</span>
                          {entry.paid_date && (
                            <span className="text-emerald-600 font-medium">
                              Liquidado em: {formatDate(entry.paid_date)}
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
                            onClick={() => handleMarkEntryPaid(entry.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Pago / Recebido</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADICIONAR TAREFA / PRAZO */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Nova Tarefa / Prazo do Caso</h3>
                  <p className="text-xs text-slate-500">
                    Vincular ato ao caso: <span className="font-semibold text-slate-700">{caseInfo.title}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {taskError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{taskError}</span>
                </div>
              )}

              {/* Título da Tarefa */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título da Tarefa / Diligência <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Protocolar Contestação ou Petição de Juntada"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Responsável e Data/Hora de Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Responsável (Advogado / Membro)
                  </label>
                  <select
                    value={taskFormData.assignee_id}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assignee_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-sans"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Data e Hora de Vencimento
                  </label>
                  <input
                    type="datetime-local"
                    value={taskFormData.due_date}
                    onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* CHECKBOX VERMELHO: MOTOR ANTI-SINISTRO */}
              <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={taskFormData.is_fatal_deadline}
                    onChange={(e) => setTaskFormData({ ...taskFormData, is_fatal_deadline: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-red-300 accent-red-600"
                  />
                  <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-red-600" />
                    É um prazo fatal/processual? (Motor Anti-Sinistro)
                  </span>
                </label>
                <p className="text-[11px] text-red-700 pl-6.5 leading-relaxed">
                  Marque caso a perda deste prazo acarrete preclusão temporal ou risco de dano irreparável ao cliente.
                </p>
              </div>

              {/* Descrição Detalhada */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição e Orientações (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Instruções sobre o ato processual, teses a abordar, documentos anexos..."
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Ações */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={taskLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {taskLoading ? (
                    'Salvando...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Registrar Prazo / Tarefa
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: ADICIONAR PROCESSO */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Vincular Processo</h3>
                  <p className="text-xs text-slate-500">
                    Cadastre o número dos autos e o tribunal/órgão competente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProcessModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProcess} className="p-6 space-y-4">
              {processError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                  {processError}
                </div>
              )}

              {/* Número do Processo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número do Processo ou Benefício <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5001234-56.2024.4.03.6100 ou NB 123.456.789-0"
                  value={processFormData.process_number}
                  onChange={(e) => setProcessFormData({ ...processFormData, process_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Instância */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instância / Órgão Competente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: INSS, JEF, TRF1, TRF3, TRT2, 1ª Vara Cível"
                  list="instances-list"
                  value={processFormData.instance}
                  onChange={(e) => setProcessFormData({ ...processFormData, instance: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <datalist id="instances-list">
                  <option value="INSS - Administrativo" />
                  <option value="JEF (Juizado Especial Federal)" />
                  <option value="TRF1" />
                  <option value="TRF2" />
                  <option value="TRF3" />
                  <option value="TRF4" />
                  <option value="TRF5" />
                  <option value="TRF6" />
                  <option value="1ª Vara Cível" />
                  <option value="TRT (Justiça do Trabalho)" />
                  <option value="STJ" />
                  <option value="STF" />
                </datalist>
              </div>

              {/* Ações */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProcessModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processLoading ? (
                    'Salvando...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Vincular Processo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NOVO LANÇAMENTO FINANCEIRO / CUSTA DO CASO */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Novo Lançamento Financeiro</h3>
                  <p className="text-xs text-slate-500">
                    Vincular parcela, recebimento ou custa reembolsável ao caso
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEntryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFinancialEntry} className="p-6 space-y-4">
              {entryModalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{entryModalError}</span>
                </div>
              )}

              {/* Tipo de Lançamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Lançamento <span className="text-red-500">*</span>
                </label>
                <select
                  value={entryForm.entry_type}
                  onChange={(e) =>
                    setEntryForm({ ...entryForm, entry_type: e.target.value as FinancialEntryType })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Honorário Inicial / Parcela">Honorário Inicial / Parcela</option>
                  <option value="Honorário de Êxito (RPV/Alvará)">
                    Honorário de Êxito (RPV/Alvará)
                  </option>
                  <option value="Custa Adiantada (Reembolsável)">
                    Custa Adiantada (Reembolsável)
                  </option>
                  <option value="Despesa Operacional">Despesa Operacional</option>
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cópia de Prontuário Médico, 1ª Parcela Inicial..."
                  value={entryForm.description}
                  onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Valor (R$) e Data de Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 350.00"
                    value={entryForm.amount}
                    onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Vencimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={entryForm.due_date}
                    onChange={(e) => setEntryForm({ ...entryForm, due_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingEntry}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingEntry ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Registrar Lançamento
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
