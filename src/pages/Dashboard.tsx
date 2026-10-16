import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  Inbox,
  Flame,
  Calendar,
  ArrowRight,
  Kanban,
  Phone,
  Clock,
  RefreshCw,
  Building2,
  ShieldCheck,
  Database,
  AlertTriangle,
  Scale,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DashboardMetrics {
  activeClientsCount: number;
  ongoingCasesCount: number;
  unreadMovementsCount: number;
  pendingFatalTasksCount: number;
}

interface UrgentTaskItem {
  id: string;
  title: string;
  due_date: string | null;
  is_fatal_deadline: boolean;
  status: string;
  case_id: string | null;
  cases?: {
    id: string;
    title: string;
    clients?: {
      id: string;
      full_name: string;
    } | null;
  } | null;
}

interface RecentLeadItem {
  id: string;
  name: string;
  phone: string | null;
  area: string | null;
  stage: string;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeClientsCount: 0,
    ongoingCasesCount: 0,
    unreadMovementsCount: 0,
    pendingFatalTasksCount: 0,
  });
  const [urgentTasks, setUrgentTasks] = useState<UrgentTaskItem[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLeadItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [
        clientsRes,
        casesRes,
        movementsRes,
        fatalTasksRes,
        topTasksRes,
        topLeadsRes,
      ] = await Promise.all([
        // 1. Total de Clientes Ativos
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true }),

        // 2. Casos em Andamento (status != 'Finalizado')
        supabase
          .from('cases')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'Finalizado'),

        // 3. Publicações Não Lidas (is_read = false)
        supabase
          .from('process_movements')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false),

        // 4. Prazos Fatais Pendentes (is_fatal_deadline = true AND status != 'Concluída')
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_fatal_deadline', true)
          .neq('status', 'Concluída'),

        // 5. Top 5 Próximos Prazos e Tarefas mais urgentes
        supabase
          .from('tasks')
          .select(`
            id,
            title,
            due_date,
            is_fatal_deadline,
            status,
            case_id,
            cases (
              id,
              title,
              clients (
                id,
                full_name
              )
            )
          `)
          .neq('status', 'Concluída')
          .order('is_fatal_deadline', { ascending: false })
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(5),

        // 6. Top 5 Últimos Leads no Atendimento
        supabase
          .from('leads')
          .select('id, name, phone, area, stage, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setMetrics({
        activeClientsCount: clientsRes.count ?? 0,
        ongoingCasesCount: casesRes.count ?? 0,
        unreadMovementsCount: movementsRes.count ?? 0,
        pendingFatalTasksCount: fatalTasksRes.count ?? 0,
      });

      if (topTasksRes.data) {
        const normalizedTasks: UrgentTaskItem[] = (topTasksRes.data as unknown[]).map((raw) => {
          const item = raw as Record<string, unknown>;
          const rawCase = Array.isArray(item.cases) ? item.cases[0] : item.cases;
          let normalizedCase: UrgentTaskItem['cases'] = null;
          if (rawCase && typeof rawCase === 'object') {
            const cObj = rawCase as Record<string, unknown>;
            const rawClient = Array.isArray(cObj.clients) ? cObj.clients[0] : cObj.clients;
            normalizedCase = {
              id: String(cObj.id || ''),
              title: String(cObj.title || ''),
              clients:
                rawClient && typeof rawClient === 'object'
                  ? {
                      id: String((rawClient as Record<string, unknown>).id || ''),
                      full_name: String((rawClient as Record<string, unknown>).full_name || ''),
                    }
                  : null,
            };
          }
          return {
            id: String(item.id || ''),
            title: String(item.title || ''),
            due_date: item.due_date ? String(item.due_date) : null,
            is_fatal_deadline: Boolean(item.is_fatal_deadline),
            status: String(item.status || 'Pendente'),
            case_id: item.case_id ? String(item.case_id) : null,
            cases: normalizedCase,
          };
        });
        setUrgentTasks(normalizedTasks);
      }

      if (topLeadsRes.data) {
        setRecentLeads(topLeadsRes.data as RecentLeadItem[]);
      }
    } catch (err) {
      console.error('Erro ao carregar indicadores do Dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sem data definida';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'Novo Contato':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Em Triagem':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Aguardando Documentos':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Contrato Assinado':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
            Visão Geral Executiva
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
            Painel de Controle do Escritório
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Acompanhe os indicadores operacionais, prazos fatais e novos leads em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
          <Link
            to="/financeiro"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Painel Financeiro</span>
          </Link>
        </div>
      </div>

      {/* 4 Cards Executivos de Gestão */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Clientes Ativos */}
        <Link
          to="/clientes"
          className="group bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-brand-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total de Clientes Ativos
            </span>
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '...' : metrics.activeClientsCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Dossiês cadastrados</span>
              <span className="inline-flex items-center gap-1 font-semibold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                Ver clientes <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 2: Casos em Andamento */}
        <Link
          to="/clientes"
          className="group bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Casos em Andamento
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '...' : metrics.ongoingCasesCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Status diferente de Finalizado</span>
              <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                Acessar <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 3: Publicações Não Lidas */}
        <Link
          to="/publicacoes"
          className="group bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Publicações Não Lidas
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {loading ? '...' : metrics.unreadMovementsCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Andamentos aguardando triagem</span>
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 group-hover:translate-x-0.5 transition-transform">
                Abrir Inbox <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 4: Prazos Fatais Pendentes */}
        <Link
          to="/tarefas"
          className={`group p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
            metrics.pendingFatalTasksCount > 0
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
              : 'bg-white border-slate-200/90 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Prazos Fatais Pendentes
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
                metrics.pendingFatalTasksCount > 0
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div
              className={`text-3xl font-extrabold tracking-tight ${
                metrics.pendingFatalTasksCount > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {loading ? '...' : metrics.pendingFatalTasksCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Motor Anti-Sinistro</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold group-hover:translate-x-0.5 transition-transform ${
                  metrics.pendingFatalTasksCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                Ver prazos <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Duas Listas Rápidas Lado a Lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista 1: Próximos Prazos e Tarefas (Top 5 mais urgentes) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Próximos Prazos e Tarefas</h3>
                <p className="text-xs text-slate-500">Top 5 pendências mais urgentes do escritório</p>
              </div>
            </div>
            <Link
              to="/tarefas"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Carregando prazos urgentes...
              </div>
            ) : urgentTasks.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Nenhum prazo pendente!</p>
                <p className="text-xs text-slate-500">
                  Todas as tarefas e prazos processuais estão em dia.
                </p>
              </div>
            ) : (
              urgentTasks.map((task) => (
                <div
                  key={task.id}
                  className="px-6 py-3.5 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.is_fatal_deadline && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                          <Flame className="w-3 h-3" />
                          Prazo Fatal
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {task.title}
                      </span>
                    </div>

                    {task.cases ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                        <Scale className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <Link
                          to={`/casos/${task.cases.id}`}
                          className="hover:text-brand-600 hover:underline truncate"
                        >
                          {task.cases.title}
                        </Link>
                        {task.cases.clients && (
                          <>
                            <span>•</span>
                            <Link
                              to={`/clientes/${task.cases.clients.id}`}
                              className="hover:text-brand-600 hover:underline truncate"
                            >
                              {task.cases.clients.full_name}
                            </Link>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 block">Tarefa geral do escritório</span>
                    )}
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                        task.is_fatal_deadline
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.due_date)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 text-right">
            <Link
              to="/tarefas"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Gerenciar agenda de prazos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Lista 2: Últimos Leads no Atendimento (Top 5 leads recentes) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Kanban className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Últimos Leads no Atendimento</h3>
                <p className="text-xs text-slate-500">Top 5 oportunidades recentes no funil de captação</p>
              </div>
            </div>
            <Link
              to="/atendimento"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              <span>Abrir Kanban</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Carregando últimos leads...
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Kanban className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Nenhum lead em triagem</p>
                <p className="text-xs text-slate-500">
                  Cadastre novos potenciais clientes no quadro Kanban de Atendimento.
                </p>
              </div>
            ) : (
              recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="px-6 py-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {lead.name}
                      </span>
                      {lead.area && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {lead.area}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {lead.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {lead.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">Sem telefone</span>
                      )}
                      <span>•</span>
                      <span>{formatDate(lead.created_at)}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border shrink-0 ${getStageBadge(
                      lead.stage
                    )}`}
                  >
                    {lead.stage}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 text-right">
            <Link
              to="/atendimento"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Ir para o Funil de Captação</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Rodapé de Governança e Isolamento Multi-Tenant (RLS) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-500 block">ID da Organização (Tenant)</span>
              <p className="text-xs font-mono text-slate-800 truncate">
                {profile?.tenant_id || 'Carregando...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Nível de Permissão</span>
              <p className="text-sm font-bold text-slate-800 capitalize">
                {profile?.role || 'Membro'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Segurança Multi-Tenant (RLS)</span>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span>
                Políticas Ativas & Isoladas
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
