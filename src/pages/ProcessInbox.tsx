import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Inbox,
  CheckCircle2,
  Search,
  RefreshCw,
  Scale,
  Calendar,
  Hash,
  Sparkles,
  User,
  ExternalLink,
  Plus,
  X,
  Copy,
  CheckCheck,
  AlertCircle,
  CalendarCheck,
  Flame
} from 'lucide-react';

interface MovementWithProcess {
  id: string;
  tenant_id: string;
  process_id: string;
  date: string;
  description: string;
  is_read: boolean;
  created_at: string;
  legal_processes?: {
    id: string;
    process_number: string | null;
    instance: string;
    case_id: string;
    cases?: {
      id: string;
      title: string;
      client_id: string;
      clients?: {
        id: string;
        full_name: string;
      } | null;
    } | null;
  } | null;
}

interface ProcessOption {
  id: string;
  process_number: string | null;
  instance: string;
  case_title?: string;
  client_name?: string;
}

interface TenantUser {
  id: string;
  full_name: string;
  role: string;
}

export const ProcessInbox: React.FC = () => {
  const { user, profile } = useAuth();

  const [movements, setMovements] = useState<MovementWithProcess[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Usuários do tenant para atribuição de prazos
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);

  // Modal para criar/simular andamento
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [availableProcesses, setAvailableProcesses] = useState<ProcessOption[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState<boolean>(false);
  const [modalFormData, setModalFormData] = useState({
    process_id: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal para Gerar Prazo (Motor Anti-Sinistro)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [selectedMovementForTask, setSelectedMovementForTask] = useState<MovementWithProcess | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    title: 'Analisar Publicação',
    description: '',
    assignee_id: '',
    due_date: '',
    is_fatal_deadline: true,
  });
  const [taskLoading, setTaskLoading] = useState<boolean>(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // 1. Carrega os andamentos não lidos (is_read = false)
  const fetchMovements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('process_movements')
        .select(`
          id,
          tenant_id,
          process_id,
          date,
          description,
          is_read,
          created_at,
          legal_processes (
            id,
            process_number,
            instance,
            case_id,
            cases (
              id,
              title,
              client_id,
              clients (
                id,
                full_name
              )
            )
          )
        `)
        .eq('is_read', false)
        .order('date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar andamentos:', error.message);
      } else {
        // Normaliza o retorno do PostgREST
        const normalized = (data || []).map((item: any) => ({
          ...item,
          legal_processes: Array.isArray(item.legal_processes)
            ? item.legal_processes[0]
            : item.legal_processes,
        }));
        setMovements(normalized as MovementWithProcess[]);
      }
    } catch (err) {
      console.error('Falha de rede ao consultar publicações:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega lista de usuários do tenant para atribuir a tarefa/prazo
  const fetchTenantUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .order('full_name', { ascending: true });

      if (!error && data) {
        setTenantUsers(data as TenantUser[]);
      }
    } catch (err) {
      console.error('Erro ao buscar usuários do escritório:', err);
    }
  };

  useEffect(() => {
    fetchMovements();
    fetchTenantUsers();
  }, [profile?.tenant_id]);

  // Carrega lista de processos para o modal de cadastro de andamento
  const loadAvailableProcesses = async () => {
    setLoadingProcesses(true);
    try {
      const { data, error } = await supabase
        .from('legal_processes')
        .select(`
          id,
          process_number,
          instance,
          cases (
            title,
            clients (
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted: ProcessOption[] = data.map((p: any) => {
          const caseObj = Array.isArray(p.cases) ? p.cases[0] : p.cases;
          const clientObj = caseObj && (Array.isArray(caseObj.clients) ? caseObj.clients[0] : caseObj.clients);
          return {
            id: p.id,
            process_number: p.process_number,
            instance: p.instance,
            case_title: caseObj?.title,
            client_name: clientObj?.full_name,
          };
        });
        setAvailableProcesses(formatted);
        if (formatted.length > 0 && !modalFormData.process_id) {
          setModalFormData((prev) => ({ ...prev, process_id: formatted[0].id }));
        }
      }
    } catch (err) {
      console.error('Erro ao listar processos disponíveis:', err);
    } finally {
      setLoadingProcesses(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setModalError(null);
    loadAvailableProcesses();
  };

  // 2. Marcar Andamento como Lido (Ciente)
  const handleMarkAsRead = async (movementId: string) => {
    setActionLoadingId(movementId);

    // Otimista: remove temporariamente da lista
    const previousMovements = [...movements];
    setMovements((prev) => prev.filter((m) => m.id !== movementId));

    try {
      const { error } = await supabase
        .from('process_movements')
        .update({ is_read: true })
        .eq('id', movementId);

      if (error) {
        // Reverte se der erro
        setMovements(previousMovements);
        console.error('Erro ao marcar andamento como lido:', error.message);
      } else {
        setSuccessToast('Andamento marcado como lido (Ciente)!');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } catch (err) {
      setMovements(previousMovements);
      console.error('Falha de rede ao atualizar andamento:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Marcar todos como lidos
  const handleMarkAllAsRead = async () => {
    if (movements.length === 0) return;
    if (!window.confirm('Tem certeza que deseja marcar todos os andamentos da caixa como lidos?')) return;

    const ids = movements.map((m) => m.id);
    const previousMovements = [...movements];
    setMovements([]);

    try {
      const { error } = await supabase
        .from('process_movements')
        .update({ is_read: true })
        .in('id', ids);

      if (error) {
        setMovements(previousMovements);
        console.error('Erro ao marcar todos como lidos:', error.message);
      } else {
        setSuccessToast('Todos os andamentos foram marcados como lidos!');
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err) {
      setMovements(previousMovements);
    }
  };

  // 3. Salvar Novo Andamento Manual pelo Modal
  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) {
      setModalError('Erro de sessão: Tenant da organização não identificado.');
      return;
    }
    if (!modalFormData.process_id) {
      setModalError('Selecione um processo vinculado.');
      return;
    }
    if (!modalFormData.description.trim()) {
      setModalError('Preencha a descrição do andamento.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const { error } = await supabase
        .from('process_movements')
        .insert([
          {
            tenant_id: profile.tenant_id,
            process_id: modalFormData.process_id,
            date: modalFormData.date,
            description: modalFormData.description.trim(),
            is_read: false,
          },
        ]);

      if (error) {
        setModalError(`Erro ao cadastrar andamento: ${error.message}`);
        setModalLoading(false);
        return;
      }

      setIsModalOpen(false);
      setModalFormData({
        process_id: availableProcesses[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      setSuccessToast('Novo andamento registrado na Caixa de Entrada!');
      setTimeout(() => setSuccessToast(null), 3500);
      fetchMovements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar andamento.';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  // 4. Abrir Modal de Gerar Prazo com dados pré-preenchidos (Fluxo Anti-Sinistro)
  const handleOpenGenerateDeadlineModal = (movement: MovementWithProcess) => {
    setSelectedMovementForTask(movement);
    setTaskFormData({
      title: 'Analisar Publicação',
      description: movement.description || '',
      assignee_id: user?.id || (tenantUsers.length > 0 ? tenantUsers[0].id : ''),
      due_date: '',
      is_fatal_deadline: true, // Motor Anti-Sinistro: default true para publicações e prazos judiciais
    });
    setTaskError(null);
    setIsTaskModalOpen(true);
  };

  // 5. Salvar Prazo/Tarefa e Marcar Andamento como Lido (is_read = true)
  const handleCreateTaskFromInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovementForTask) return;

    if (!profile?.tenant_id) {
      setTaskError('Erro de sessão: Tenant da organização não identificado.');
      return;
    }

    if (!taskFormData.title.trim()) {
      setTaskError('Informe o título do prazo ou tarefa.');
      return;
    }

    setTaskLoading(true);
    setTaskError(null);

    try {
      const caseId = selectedMovementForTask.legal_processes?.case_id || null;

      const payload: any = {
        tenant_id: profile.tenant_id,
        case_id: caseId,
        assignee_id: taskFormData.assignee_id || user?.id || null,
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim() || null,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        is_fatal_deadline: taskFormData.is_fatal_deadline,
        status: 'Pendente',
      };

      // 1. Grava na tabela tasks
      const { error: taskErrorResponse } = await supabase
        .from('tasks')
        .insert([payload]);

      if (taskErrorResponse) {
        setTaskError(`Erro ao cadastrar prazo/tarefa: ${taskErrorResponse.message}`);
        setTaskLoading(false);
        return;
      }

      // 2. Atualiza o andamento correspondente na tabela process_movements como is_read = true
      const { error: moveError } = await supabase
        .from('process_movements')
        .update({ is_read: true })
        .eq('id', selectedMovementForTask.id);

      if (moveError) {
        console.error('Aviso: Prazo criado, mas falha ao marcar andamento como lido:', moveError.message);
      }

      // 3. Remove imediatamente da Caixa de Entrada
      setMovements((prev) => prev.filter((m) => m.id !== selectedMovementForTask.id));
      setIsTaskModalOpen(false);
      setSelectedMovementForTask(null);
      setSuccessToast('Prazo gerado com sucesso! Publicação arquivada da Caixa de Entrada.');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar criação de prazo.';
      setTaskError(msg);
    } finally {
      setTaskLoading(false);
    }
  };

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

  // Copiar número do processo
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtro de Busca
  const filteredMovements = useMemo(() => {
    if (!searchQuery.trim()) return movements;
    const q = searchQuery.toLowerCase().trim();

    return movements.filter((m) => {
      const descMatch = m.description.toLowerCase().includes(q);
      const procNumber = m.legal_processes?.process_number?.toLowerCase() || '';
      const procMatch = procNumber.includes(q);
      const instanceMatch = m.legal_processes?.instance.toLowerCase().includes(q);
      const caseTitle = m.legal_processes?.cases?.title.toLowerCase() || '';
      const clientName = m.legal_processes?.cases?.clients?.full_name.toLowerCase() || '';

      return descMatch || procMatch || instanceMatch || caseTitle.includes(q) || clientName.includes(q);
    });
  }, [movements, searchQuery]);

  const getInstanceBadge = (instance?: string) => {
    if (!instance) return 'bg-slate-100 text-slate-700 border-slate-200';
    const inst = instance.toUpperCase();
    if (inst.includes('INSS')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (inst.includes('TRF')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (inst.includes('TRT')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (inst.includes('JEF')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Caixa de Publicações</h1>
                <span className="bg-brand-50 text-brand-700 border border-brand-100 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {movements.length} {movements.length === 1 ? 'não lida' : 'não lidas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Central unificada de andamentos, intimações e notas de expediente pendentes de ciência
              </p>
            </div>
          </div>
        </div>

        {/* Ações de Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {movements.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm"
              title="Marcar todos os andamentos desta lista como lidos"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Marcar Todos como Lidos</span>
            </button>
          )}

          <button
            onClick={fetchMovements}
            title="Atualizar lista de publicações"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Andamento</span>
          </button>
        </div>
      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por número do processo, cliente, caso ou teor do andamento..."
            className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* LISTA DE ANDAMENTOS (ESTILO INBOX DE E-MAIL) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {loading && movements.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Consultando publicações pendentes...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          /* ESTADO VAZIO: ZERO INBOX CELEBRATION */
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {searchQuery ? 'Nenhuma publicação localizada' : 'Tudo em dia por aqui!'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                {searchQuery
                  ? `Não encontramos andamentos não lidos com o termo "${searchQuery}".`
                  : 'Nenhum andamento ou publicação pendente de leitura. Todos os prazos e notas foram despachados.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Registrar Andamento Manual
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMovements.map((movement) => {
              const proc = movement.legal_processes;
              const caseObj = proc?.cases;
              const clientObj = caseObj?.clients;
              const isLoadingThis = actionLoadingId === movement.id;

              return (
                <div
                  key={movement.id}
                  className="p-5 sm:p-6 hover:bg-slate-50/70 transition-all flex flex-col md:flex-row md:items-start md:justify-between gap-5 group"
                >
                  {/* Linha Lateral & Conteúdo Principal */}
                  <div className="space-y-3 flex-1 min-w-0">
                    
                    {/* Metadados Superiores (Processo, Instância, Cliente, Caso) */}
                    <div className="flex items-center gap-2.5 flex-wrap text-xs">
                      {/* Ponto indicador de não lido */}
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse flex-shrink-0" title="Não lido" />

                      {/* Instância */}
                      {proc?.instance && (
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${getInstanceBadge(proc.instance)}`}>
                          {proc.instance}
                        </span>
                      )}

                      {/* Número do Processo */}
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md">
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span>{proc?.process_number || 'Sem número formal'}</span>
                        {proc?.process_number && (
                          <button
                            onClick={() => handleCopy(proc.process_number!, `inbox_${movement.id}`)}
                            title="Copiar número do processo"
                            className="text-slate-400 hover:text-slate-700 ml-1"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        {copiedKey === `inbox_${movement.id}` && (
                          <span className="text-emerald-600 text-[10px] ml-1">Copiado!</span>
                        )}
                      </div>

                      <span className="text-slate-300">•</span>

                      {/* Cliente e Caso */}
                      {clientObj && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium truncate max-w-[220px]">
                          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{clientObj.full_name}</span>
                        </span>
                      )}

                      {caseObj && (
                        <>
                          <span className="text-slate-300">•</span>
                          <Link
                            to={`/casos/${caseObj.id}`}
                            className="text-brand-600 hover:underline flex items-center gap-1 font-medium truncate max-w-[200px]"
                            title="Abrir painel deste caso"
                          >
                            <Scale className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{caseObj.title}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </>
                      )}
                    </div>

                    {/* Descrição do Andamento / Teor da Publicação */}
                    <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {movement.description}
                    </div>

                    {/* Data do Andamento */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Data do evento: <strong>{formatDate(movement.date)}</strong></span>
                    </div>

                  </div>

                  {/* Ações: Gerar Prazo & Marcar como Lido */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2.5 flex-shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => handleOpenGenerateDeadlineModal(movement)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 whitespace-nowrap"
                      title="Gerar prazo/tarefa judicial e dar baixa automática nesta publicação"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      <span>Gerar Prazo</span>
                    </button>

                    <button
                      onClick={() => handleMarkAsRead(movement.id)}
                      disabled={isLoadingThis}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 whitespace-nowrap"
                      title="Confirmar ciência e remover da caixa de entrada sem gerar prazo"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isLoadingThis ? 'Salvando...' : 'Marcar como Lido'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL: REGISTRAR NOVO ANDAMENTO (SIMULAÇÃO / MANUAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Registrar Andamento / Publicação</h3>
                  <p className="text-xs text-slate-500">
                    Vincule um novo evento processual para despachar na Caixa de Entrada
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

            <form onSubmit={handleCreateMovement} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Seleção do Processo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Processo Vinculado <span className="text-red-500">*</span>
                </label>
                {loadingProcesses ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    Carregando processos do escritório...
                  </div>
                ) : availableProcesses.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    Nenhum processo cadastrado ainda. Cadastre primeiro um processo na página de um Caso.
                  </div>
                ) : (
                  <select
                    required
                    value={modalFormData.process_id}
                    onChange={(e) => setModalFormData({ ...modalFormData, process_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-sans"
                  >
                    {availableProcesses.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.process_number || 'Sem número'} ({p.instance}) {p.client_name ? `- ${p.client_name}` : ''} {p.case_title ? `[${p.case_title}]` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Data do Andamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Data da Publicação / Movimentação <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={modalFormData.date}
                  onChange={(e) => setModalFormData({ ...modalFormData, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Descrição do Andamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teor da Publicação / Descrição do Andamento <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ex: Publicado despacho: Intime-se a parte autora para se manifestar sobre os cálculos apresentados pelo réu no prazo legal de 15 dias..."
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
                  disabled={modalLoading || availableProcesses.length === 0}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {modalLoading ? (
                    'Salvando...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Registrar na Caixa
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: GERAR PRAZO A PARTIR DA PUBLICAÇÃO (FLUXO ANTI-SINISTRO) */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Gerar Prazo / Diligência</h3>
                  <p className="text-xs text-slate-500">
                    Fluxo Anti-Sinistro: vincula o ato à pauta e arquiva a publicação
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

            {/* Contexto do Processo Vinculado */}
            {selectedMovementForTask && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-xs flex-wrap">
                {selectedMovementForTask.legal_processes?.process_number && (
                  <span className="font-mono font-bold text-slate-700 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                    <Hash className="w-3 h-3 text-slate-400" />
                    {selectedMovementForTask.legal_processes.process_number}
                  </span>
                )}
                {selectedMovementForTask.legal_processes?.cases?.clients?.full_name && (
                  <span className="text-slate-600 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {selectedMovementForTask.legal_processes.cases.clients.full_name}
                  </span>
                )}
                {selectedMovementForTask.legal_processes?.cases?.title && (
                  <span className="text-brand-600 flex items-center gap-1 font-medium">
                    <Scale className="w-3 h-3 text-brand-400" />
                    {selectedMovementForTask.legal_processes.cases.title}
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleCreateTaskFromInbox} className="p-6 space-y-4">
              {taskError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{taskError}</span>
                </div>
              )}

              {/* Título da Tarefa / Diligência */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título da Tarefa / Diligência <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Analisar Publicação ou Apresentar Réplica à Contestação"
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
                    {tenantUsers.length === 0 && user && (
                      <option value={user.id}>{user.email} (Você)</option>
                    )}
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
              <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-1">
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
                  Marque para destacar com borda vermelha e prioridade máxima no Painel Diário do Advogado.
                </p>
              </div>

              {/* Descrição Detalhada / Teor do Andamento Pré-Preenchido */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição / Teor da Publicação (Pré-preenchido)
                </label>
                <textarea
                  rows={4}
                  placeholder="Teor da publicação ou orientações processuais..."
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Explicação do Fluxo Anti-Sinistro */}
              <div className="p-3 bg-brand-50/70 border border-brand-100 rounded-xl flex items-start gap-2.5 text-xs text-brand-900">
                <Sparkles className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Fluxo Anti-Sinistro:</strong> Ao gravar o prazo, esta publicação será automaticamente marcada como lida (<span className="font-semibold text-brand-700">Ciente</span>) e arquivada da sua Caixa de Entrada.
                </span>
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
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {taskLoading ? (
                    'Gravando Prazo...'
                  ) : (
                    <>
                      <CalendarCheck className="w-4 h-4" />
                      Gerar Prazo & Concluir Leitura
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
