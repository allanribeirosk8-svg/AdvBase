import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  CalendarCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Scale,
  User,
  Calendar,
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface CaseOption {
  id: string;
  title: string;
  client_name?: string;
}

interface TaskWithCase {
  id: string;
  tenant_id: string;
  case_id: string | null;
  assignee_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  is_fatal_deadline: boolean;
  status: string;
  created_at: string;
  cases?: {
    id: string;
    title: string;
    client_id: string;
    clients?: {
      id: string;
      full_name: string;
    } | null;
  } | null;
}

export const MyTasks: React.FC = () => {
  const { user, profile } = useAuth();

  const [tasks, setTasks] = useState<TaskWithCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'my_tasks' | 'all_tasks'>('my_tasks');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modal para Criar Nova Tarefa
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [availableCases, setAvailableCases] = useState<CaseOption[]>([]);
  const [modalFormData, setModalFormData] = useState({
    title: '',
    description: '',
    case_id: '',
    due_date: '',
    is_fatal_deadline: false,
  });
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // 1. Carrega as tarefas não concluídas
  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('tasks')
        .select(`
          id,
          tenant_id,
          case_id,
          assignee_id,
          title,
          description,
          due_date,
          is_fatal_deadline,
          status,
          created_at,
          cases (
            id,
            title,
            client_id,
            clients (
              id,
              full_name
            )
          )
        `)
        .neq('status', 'Concluída')
        .order('due_date', { ascending: true, nullsFirst: false });

      // Se filtro "Minhas Tarefas", restringe pelo assignee_id do usuário logado
      if (filterMode === 'my_tasks') {
        query = query.eq('assignee_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar tarefas:', error.message);
      } else {
        const normalized = (data || []).map((t: any) => ({
          ...t,
          cases: Array.isArray(t.cases) ? t.cases[0] : t.cases,
        }));
        setTasks(normalized as TaskWithCase[]);
      }
    } catch (err) {
      console.error('Falha ao consultar tarefas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user?.id, filterMode]);

  // Carrega lista de casos disponíveis para vincular à tarefa
  const loadAvailableCases = async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          title,
          clients (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted: CaseOption[] = data.map((c: any) => {
          const clientObj = Array.isArray(c.clients) ? c.clients[0] : c.clients;
          return {
            id: c.id,
            title: c.title,
            client_name: clientObj?.full_name,
          };
        });
        setAvailableCases(formatted);
      }
    } catch (err) {
      console.error('Erro ao carregar casos:', err);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setModalError(null);
    loadAvailableCases();
  };

  // 2. Marcar Tarefa como Concluída
  const handleCompleteTask = async (taskId: string) => {
    setActionLoadingId(taskId);

    // Otimista: remove da lista ativa
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
      setActionLoadingId(null);
    }
  };

  // 3. Cadastrar Nova Tarefa
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !user) {
      setModalError('Sessão inválida: não foi possível identificar o usuário ou tenant.');
      return;
    }
    if (!modalFormData.title.trim()) {
      setModalError('O título da tarefa é obrigatório.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const payload: any = {
        tenant_id: profile.tenant_id,
        assignee_id: user.id, // Atribuído ao próprio advogado criador por padrão
        title: modalFormData.title.trim(),
        description: modalFormData.description.trim() || null,
        due_date: modalFormData.due_date ? new Date(modalFormData.due_date).toISOString() : null,
        is_fatal_deadline: modalFormData.is_fatal_deadline,
        status: 'Pendente',
        case_id: modalFormData.case_id || null,
      };

      const { error } = await supabase.from('tasks').insert([payload]);

      if (error) {
        setModalError(`Erro ao salvar tarefa: ${error.message}`);
        setModalLoading(false);
        return;
      }

      setIsModalOpen(false);
      setModalFormData({
        title: '',
        description: '',
        case_id: '',
        due_date: '',
        is_fatal_deadline: false,
      });
      setSuccessToast('Nova tarefa registrada com sucesso!');
      setTimeout(() => setSuccessToast(null), 3000);
      fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha inesperada ao cadastrar tarefa.';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  // Análise de Urgência de Prazos
  const getDeadlineStatus = (dueDateString: string | null) => {
    if (!dueDateString) return null;

    const now = new Date();
    const due = new Date(dueDateString);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Formatação de data e hora
    const day = String(due.getDate()).padStart(2, '0');
    const month = String(due.getMonth() + 1).padStart(2, '0');
    const year = due.getFullYear();
    const hours = String(due.getHours()).padStart(2, '0');
    const minutes = String(due.getMinutes()).padStart(2, '0');
    const formatted = `${day}/${month}/${year} às ${hours}:${minutes}`;

    if (diffMs < 0) {
      return {
        text: `VENCIDO (${formatted})`,
        isOverdue: true,
        badgeClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
      };
    } else if (diffHours <= 24) {
      return {
        text: `VENCE HOJE (${formatted})`,
        isDueToday: true,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold animate-pulse',
      };
    } else if (diffHours <= 48) {
      return {
        text: `Vence Amanhã (${formatted})`,
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',
      };
    }
    return {
      text: `Prazo: ${formatted}`,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  };

  // Contagem de Prazos Fatais
  const fatalDeadlinesCount = useMemo(() => {
    return tasks.filter((t) => t.is_fatal_deadline).length;
  }, [tasks]);

  // Filtro de Busca
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase().trim();

    return tasks.filter((t) => {
      const titleMatch = t.title.toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q) || false;
      const caseTitle = t.cases?.title.toLowerCase() || '';
      const clientName = t.cases?.clients?.full_name.toLowerCase() || '';

      return titleMatch || descMatch || caseTitle.includes(q) || clientName.includes(q);
    });
  }, [tasks, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Toast de Notificação */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* CABEÇALHO DA CENTRAL DE PRODUTIVIDADE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Minhas Tarefas e Prazos</h1>
                <span className="bg-brand-50 text-brand-700 border border-brand-100 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {tasks.length} {tasks.length === 1 ? 'pendência' : 'pendências'}
                </span>
                {fatalDeadlinesCount > 0 && (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                    <Flame className="w-3.5 h-3.5 text-red-600" />
                    {fatalDeadlinesCount} fatal(is)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Painel diário com motor anti-sinistro para controle rigoroso de prazos e diligências
              </p>
            </div>
          </div>
        </div>

        {/* Ações de Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchTasks}
            title="Atualizar tarefas"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* ALERTA CRÍTICO SE HOUVER PRAZOS FATAIS */}
      {fatalDeadlinesCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-red-500/10 via-red-50 to-red-50/5 border-l-4 border-l-red-600 border border-red-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm animate-bounce">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                Atenção ao Motor Anti-Sinistro: {fatalDeadlinesCount} Prazo(s) Fatal(is) Pendente(s)
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                Prazos preclusivos judiciais exigem protocolo prioritário para evitar preclusão ou sinistro.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE CONTROLE: TABS E PESQUISA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Alternador de Filtro */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilterMode('my_tasks')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'my_tasks'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Atribuídas a Mim
          </button>
          <button
            onClick={() => setFilterMode('all_tasks')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterMode === 'all_tasks'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todas do Escritório
          </button>
        </div>

        {/* Campo de Busca */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por título, cliente ou caso..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* LISTAGEM DE TAREFAS */}
      <div className="space-y-4">
        {loading && tasks.length === 0 ? (
          <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Carregando tarefas e prazos...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          /* ESTADO VAZIO: ZERO TASKS */
          <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {searchQuery ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa pendente!'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                {searchQuery
                  ? `Nenhum resultado corresponde a "${searchQuery}".`
                  : 'Parabéns! Todas as tarefas e prazos foram concluídos com sucesso.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar Nova Tarefa
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTasks.map((task) => {
              const deadline = getDeadlineStatus(task.due_date);
              const isFatal = task.is_fatal_deadline;
              const isActionLoading = actionLoadingId === task.id;
              const caseObj = task.cases;
              const clientObj = caseObj?.clients;

              return (
                <div
                  key={task.id}
                  className={`rounded-2xl p-6 transition-all shadow-sm flex flex-col md:flex-row md:items-start md:justify-between gap-5 relative overflow-hidden ${
                    isFatal
                      ? 'bg-gradient-to-r from-red-500/[0.04] via-white to-white border-2 border-red-500 shadow-red-100/50 hover:shadow-red-200/50 hover:shadow-md'
                      : 'bg-white border border-slate-200 hover:border-brand-200 hover:shadow-md'
                  }`}
                >
                  {/* FAIXA DECORATIVA ANTI-SINISTRO */}
                  {isFatal && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 to-red-400" />
                  )}

                  <div className="space-y-3 flex-1 min-w-0">
                    
                    {/* Linha de Badges: Fatal Alert, Status, Prazo */}
                    <div className="flex items-center gap-2.5 flex-wrap text-xs">
                      
                      {/* DESTAQUE VISUAL: MOTOR ANTI-SINISTRO */}
                      {isFatal ? (
                        <span className="px-2.5 py-1 rounded-full font-bold bg-red-600 text-white flex items-center gap-1.5 shadow-sm text-[11px] uppercase tracking-wider animate-pulse">
                          <Flame className="w-3.5 h-3.5" />
                          Prazo Fatal Inegociável
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                          {task.status}
                        </span>
                      )}

                      {/* Prazo Limite */}
                      {deadline && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] border flex items-center gap-1 ${deadline.badgeClass}`}>
                          <Clock className="w-3 h-3" />
                          {deadline.text}
                        </span>
                      )}

                      {/* Caso e Cliente Vinculados */}
                      {caseObj && (
                        <Link
                          to={`/casos/${caseObj.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline bg-brand-50 border border-brand-100 px-2.5 py-0.5 rounded-full text-[11px] truncate max-w-[260px]"
                          title="Acessar o caso"
                        >
                          <Scale className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{caseObj.title}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      )}

                      {clientObj && (
                        <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {clientObj.full_name}
                        </span>
                      )}
                    </div>

                    {/* Título da Tarefa */}
                    <h3 className={`text-base font-bold leading-snug ${isFatal ? 'text-red-950 font-extrabold' : 'text-slate-900'}`}>
                      {task.title}
                    </h3>

                    {/* Descrição */}
                    {task.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {task.description}
                      </p>
                    )}

                  </div>

                  {/* Ação: Botão Concluir */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 flex-shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={isActionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      title="Marcar esta tarefa como concluída"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isActionLoading ? 'Salvando...' : 'Concluir Tarefa'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: CRIAR NOVA TAREFA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Nova Tarefa ou Prazo</h3>
                  <p className="text-xs text-slate-500">
                    Cadastre uma pendência jurídica ou administrativa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Título da Tarefa */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título da Tarefa / Prazo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Protocolar Recurso Inominado ou Solicitar Documento"
                  value={modalFormData.title}
                  onChange={(e) => setModalFormData({ ...modalFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Caso Vinculado (Opcional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Caso Vinculado (Opcional)
                </label>
                <select
                  value={modalFormData.case_id}
                  onChange={(e) => setModalFormData({ ...modalFormData, case_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-sans"
                >
                  <option value="">Nenhum (Tarefa Administrativa Geral)</option>
                  {availableCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} {c.client_name ? `(${c.client_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data e Hora do Prazo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Data e Horário Limite (Prazo)
                </label>
                <input
                  type="datetime-local"
                  value={modalFormData.due_date}
                  onChange={(e) => setModalFormData({ ...modalFormData, due_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* CHECKBOX MOTOR ANTI-SINISTRO */}
              <div className="p-3.5 bg-red-50/50 border border-red-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={modalFormData.is_fatal_deadline}
                    onChange={(e) => setModalFormData({ ...modalFormData, is_fatal_deadline: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-red-300"
                  />
                  <span className="text-xs font-bold text-red-900 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-red-600" />
                    Prazo Fatal / Risco Preclusivo (Motor Anti-Sinistro)
                  </span>
                </label>
                <p className="text-[11px] text-red-700 pl-6">
                  Marque esta opção se a perda deste prazo acarretar preclusão ou prejuízo irreparável para o cliente. O cartão terá destaque visual de emergência.
                </p>
              </div>

              {/* Descrição Detalhada */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Orientações e Detalhes da Tarefa
                </label>
                <textarea
                  rows={3}
                  placeholder="Instruções sobre a peça processual, documentos anexos, cálculos ou contatos necessários..."
                  value={modalFormData.description}
                  onChange={(e) => setModalFormData({ ...modalFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Ações */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {modalLoading ? (
                    'Salvando...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Registrar Tarefa
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
