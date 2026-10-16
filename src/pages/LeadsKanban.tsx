import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Kanban,
  Plus,
  Phone,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  X,
  AlertCircle,
  Loader2,
  MessageSquare,
  Trash2,
  ExternalLink,
  Sparkles,
  Clock
} from 'lucide-react';

export type LeadStage =
  | 'Novo Contato'
  | 'Em Triagem'
  | 'Aguardando Documentos'
  | 'Contrato Assinado';

export interface Lead {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  area: string | null;
  stage: LeadStage;
  notes: string | null;
  created_at: string;
}

const STAGES: {
  key: LeadStage;
  label: string;
  headerBg: string;
  badgeColor: string;
  dotColor: string;
}[] = [
  {
    key: 'Novo Contato',
    label: 'Novo Contato',
    headerBg: 'bg-slate-100/80 border-slate-200',
    badgeColor: 'bg-slate-200 text-slate-700',
    dotColor: 'bg-slate-500',
  },
  {
    key: 'Em Triagem',
    label: 'Em Triagem',
    headerBg: 'bg-amber-50/80 border-amber-200',
    badgeColor: 'bg-amber-100 text-amber-800',
    dotColor: 'bg-amber-500',
  },
  {
    key: 'Aguardando Documentos',
    label: 'Aguardando Documentos',
    headerBg: 'bg-sky-50/80 border-sky-200',
    badgeColor: 'bg-sky-100 text-sky-800',
    dotColor: 'bg-sky-500',
  },
  {
    key: 'Contrato Assinado',
    label: 'Contrato Assinado',
    headerBg: 'bg-emerald-50/80 border-emerald-200',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    dotColor: 'bg-emerald-500',
  },
];

export const LeadsKanban: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado de carregamento individual por cartão (mover coluna ou converter)
  const [actionLeadId, setActionLeadId] = useState<string | null>(null);

  // Modal de Novo Lead
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [creatingLead, setCreatingLead] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    area: 'Previdenciário',
    stage: 'Novo Contato' as LeadStage,
    notes: '',
  });

  // 1. Buscar Leads do Tenant
  const fetchLeads = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMsg(`Erro ao carregar funil de atendimento: ${error.message}`);
      } else {
        setLeads((data as Lead[]) || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao buscar leads.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // 2. Criar Novo Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) {
      setModalError('Sessão inválida: Tenant não identificado.');
      return;
    }
    if (!formData.name.trim()) {
      setModalError('O nome do potencial cliente é obrigatório.');
      return;
    }

    setCreatingLead(true);
    setModalError(null);

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([
          {
            tenant_id: profile.tenant_id,
            name: formData.name.trim(),
            phone: formData.phone.trim() || null,
            area: formData.area,
            stage: formData.stage,
            notes: formData.notes.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) {
        setModalError(`Não foi possível cadastrar o lead: ${error.message}`);
        setCreatingLead(false);
        return;
      }

      setLeads((prev) => [data as Lead, ...prev]);
      setIsModalOpen(false);
      setFormData({
        name: '',
        phone: '',
        area: 'Previdenciário',
        stage: 'Novo Contato',
        notes: '',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao salvar lead.';
      setModalError(msg);
    } finally {
      setCreatingLead(false);
    }
  };

  // 3. Avançar ou Retroceder Lead de Coluna
  const handleMoveStage = async (lead: Lead, direction: 'prev' | 'next') => {
    const currentIndex = STAGES.findIndex((s) => s.key === lead.stage);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= STAGES.length) return;

    const newStage = STAGES[targetIndex].key;
    setActionLeadId(lead.id);

    // Atualização otimista na UI
    const previousLeads = [...leads];
    setLeads((prev) =>
      prev.map((item) => (item.id === lead.id ? { ...item, stage: newStage } : item))
    );

    try {
      const { error } = await supabase
        .from('leads')
        .update({ stage: newStage })
        .eq('id', lead.id);

      if (error) {
        setLeads(previousLeads);
        alert(`Erro ao mover lead: ${error.message}`);
      }
    } catch {
      setLeads(previousLeads);
    } finally {
      setActionLeadId(null);
    }
  };

  // 4. Excluir Lead
  const handleDeleteLead = async (lead: Lead) => {
    if (!window.confirm(`Deseja remover "${lead.name}" do funil de atendimento?`)) return;

    setActionLeadId(lead.id);
    try {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) {
        alert(`Erro ao remover lead: ${error.message}`);
      } else {
        setLeads((prev) => prev.filter((item) => item.id !== lead.id));
      }
    } finally {
      setActionLeadId(null);
    }
  };

  // 5. Fluxo de Conversão: Converter Lead em Cliente e Redirecionar para o Dossiê
  const handleConvertToClient = async (lead: Lead) => {
    if (!profile?.tenant_id) {
      alert('Erro: Tenant não identificado na sessão atual.');
      return;
    }

    setActionLeadId(lead.id);
    setErrorMsg(null);

    try {
      // Passo A: Insere novo cliente na tabela `clients` aproveitando Nome e Telefone do Lead
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert([
          {
            tenant_id: profile.tenant_id,
            full_name: lead.name.trim(),
            contact_phone: lead.phone ? lead.phone.trim() : null,
          },
        ])
        .select('id')
        .single();

      if (insertError || !newClient) {
        throw new Error(insertError?.message || 'Falha ao criar registro de cliente.');
      }

      // Passo B: Remove o Lead convertido do quadro Kanban
      await supabase.from('leads').delete().eq('id', lead.id);

      // Passo C: Redireciona diretamente para o Dossiê do novo cliente
      navigate(`/clientes/${newClient.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao converter lead em cliente.';
      setErrorMsg(`Falha na conversão de "${lead.name}": ${msg}`);
      setActionLeadId(null);
    }
  };

  // Cores de badge por Área Jurídica
  const getAreaBadgeStyle = (area: string | null) => {
    switch ((area || '').toLowerCase()) {
      case 'previdenciário':
      case 'previdenciario':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'trabalhista':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cível':
      case 'civel':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'tributário':
      case 'tributario':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* CABEÇALHO DO FUNIL DE CAPTAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
            <Kanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Funil de Captação & Triagem (Kanban)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie potenciais clientes desde o primeiro contato até a assinatura do contrato e conversão em dossiê.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setModalError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* ALERTA DE ERRO GLOBAL */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
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

      {/* QUADRO KANBAN (4 COLUNAS LADO A LADO) */}
      {loading ? (
        <div className="min-h-[420px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Carregando quadro de atendimento...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {STAGES.map((stageObj, stageIdx) => {
            const columnLeads = leads.filter((l) => l.stage === stageObj.key);

            return (
              <div
                key={stageObj.key}
                className="bg-slate-100/70 rounded-2xl border border-slate-200/90 flex flex-col min-h-[540px] max-h-[calc(100vh-220px)]"
              >
                {/* Cabeçalho da Coluna */}
                <div
                  className={`p-3.5 rounded-t-2xl border-b flex items-center justify-between ${stageObj.headerBg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stageObj.dotColor}`} />
                    <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      {stageObj.label}
                    </h2>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-full ${stageObj.badgeColor}`}
                  >
                    {columnLeads.length}
                  </span>
                </div>

                {/* Lista de Cartões da Coluna */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  {columnLeads.length === 0 ? (
                    <div className="h-44 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                      <p className="text-xs font-medium text-slate-400">
                        Nenhum lead em "{stageObj.label}"
                      </p>
                    </div>
                  ) : (
                    columnLeads.map((lead) => {
                      const isBusy = actionLeadId === lead.id;
                      const canMovePrev = stageIdx > 0;
                      const canMoveNext = stageIdx < STAGES.length - 1;
                      const cleanPhone = (lead.phone || '').replace(/\D/g, '');

                      return (
                        <div
                          key={lead.id}
                          className={`bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all space-y-3 relative ${
                            isBusy ? 'opacity-60 pointer-events-none' : ''
                          }`}
                        >
                          {/* Topo do Cartão: Área + Botão Excluir */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border ${getAreaBadgeStyle(
                                lead.area
                              )}`}
                            >
                              {lead.area || 'Geral'}
                            </span>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              <button
                                onClick={() => handleDeleteLead(lead)}
                                title="Excluir Lead"
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Nome do Lead */}
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug">
                              {lead.name}
                            </h3>

                            {/* Telefone / WhatsApp */}
                            {lead.phone ? (
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-xs text-slate-600 flex items-center gap-1 font-mono">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {lead.phone}
                                </span>
                                {cleanPhone.length >= 10 && (
                                  <a
                                    href={`https://wa.me/55${cleanPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                  >
                                    WhatsApp
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-1">Sem telefone informado</p>
                            )}
                          </div>

                          {/* Observações (Notes) */}
                          {lead.notes && (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 flex items-start gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <p className="line-clamp-3 leading-relaxed">{lead.notes}</p>
                            </div>
                          )}

                          {/* Controles de Etapa (Retroceder / Avançar Coluna) */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={!canMovePrev || isBusy}
                              onClick={() => handleMoveStage(lead, 'prev')}
                              title="Retroceder etapa"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Anterior
                            </button>

                            <button
                              type="button"
                              disabled={!canMoveNext || isBusy}
                              onClick={() => handleMoveStage(lead, 'next')}
                              title="Avançar etapa"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                            >
                              Avançar
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Botão de Destaque: Converter em Cliente */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConvertToClient(lead)}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                              lead.stage === 'Contrato Assinado'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                                : 'bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white border border-brand-200'
                            }`}
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Converter em Cliente
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO RÁPIDO: NOVO LEAD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Novo Lead</h3>
                  <p className="text-xs text-slate-500">Adicionar potencial cliente à triagem</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Aparecida dos Santos"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Área Jurídica
                  </label>
                  <select
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="Previdenciário">Previdenciário</option>
                    <option value="Trabalhista">Trabalhista</option>
                    <option value="Cível">Cível</option>
                    <option value="Tributário">Tributário</option>
                    <option value="Família">Família</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Coluna Inicial
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) =>
                    setFormData({ ...formData, stage: e.target.value as LeadStage })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  {STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações da Triagem
                </label>
                <textarea
                  rows={3}
                  placeholder="Resumo do relato inicial, benefício pretendido, empresa onde trabalhou..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingLead}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingLead ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Cadastrar Lead'
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
