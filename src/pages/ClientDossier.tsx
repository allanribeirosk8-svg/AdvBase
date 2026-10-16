import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateDocument, buildOutputName } from '../lib/documentGenerator';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldAlert,
  Edit3,
  FileText,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
  X,
  Briefcase,
  Plus,
  Scale,
  Clock,
  FolderPlus,
  ArrowRight,
  Download,
  Loader2,
  Sparkles,
  Upload,
  CheckSquare,
  History,
  MessageCircle,
  DollarSign,
  Smartphone
} from 'lucide-react';

interface DocumentTemplate {
  id: string;
  title: string;
  storage_path: string;
}

export interface ClientDocument {
  id: string;
  tenant_id: string;
  client_id: string;
  case_id: string | null;
  doc_type: string;
  status: 'Pendente' | 'Recebido' | 'Validado';
  storage_path: string | null;
  file_name: string | null;
  created_at: string;
}

export type TimelineEventType =
  | 'Atendimento'
  | 'Nota de Atendimento'
  | 'WhatsApp'
  | 'Contato WhatsApp / Ligação'
  | 'Perícia / Audiência'
  | 'Nota Interna'
  | 'Marco Processual'
  | 'Andamento Relevante'
  | 'Documento Recebido'
  | 'Marco Financeiro';

export interface TimelineEventRecord {
  id: string;
  tenant_id: string;
  client_id: string;
  case_id: string | null;
  event_type: TimelineEventType;
  title: string;
  description: string | null;
  event_date: string;
  visible_to_client: boolean;
  created_by: string | null;
  created_at: string;
}

interface Client {
  id: string;
  tenant_id: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  mother_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  gov_passwords: string | null;
  portal_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  area: string;
  status: string;
  facts_summary: string | null;
  created_at: string;
  updated_at?: string;
}

export const ClientDossier: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Controle das Abas (Tabs)
  const [activeTab, setActiveTab] = useState<'dados_pessoais' | 'casos' | 'documentos' | 'timeline'>('dados_pessoais');

  // Visibilidade de senhas confidenciais
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estado do Modal de Edição de Dados do Cliente
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<Partial<Client>>({});
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Estados dos Casos
  const [cases, setCases] = useState<Case[]>([]);
  const [loadingCases, setLoadingCases] = useState<boolean>(false);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [newCaseData, setNewCaseData] = useState({
    title: '',
    area: 'Previdenciário',
    status: 'Em Análise',
    facts_summary: '',
  });
  const [newCaseLoading, setNewCaseLoading] = useState<boolean>(false);
  const [newCaseError, setNewCaseError] = useState<string | null>(null);

  // Estados do Modal "Gerar Documento" (Document Assembly)
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [docTemplates, setDocTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingDocTemplates, setLoadingDocTemplates] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [generatingDoc, setGeneratingDoc] = useState<boolean>(false);
  const [docModalError, setDocModalError] = useState<string | null>(null);

  // Estados da Aba "Documentos e Checklists" (Cofre do Cliente)
  const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [generatingChecklist, setGeneratingChecklist] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Estados da Aba "Linha do Tempo (360º)" (Timeline Unificada)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventRecord[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);
  const [creatingTimelineEvent, setCreatingTimelineEvent] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineForm, setTimelineForm] = useState({
    event_type: 'Nota de Atendimento' as TimelineEventType,
    title: '',
    description: '',
    visible_to_client: false,
  });

  // Estados do Modal de Compartilhamento do Portal do Cliente
  const [isPortalModalOpen, setIsPortalModalOpen] = useState<boolean>(false);
  const [portalLinkCopied, setPortalLinkCopied] = useState<boolean>(false);

  // 1. Carrega os dados específicos do cliente pelo ID
  const fetchClientDetails = async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        setErrorMessage(`Não foi possível carregar o cliente: ${error.message}`);
      } else if (!data) {
        setErrorMessage('Cliente não encontrado ou você não tem permissão para acessá-lo.');
      } else {
        setClient(data as Client);
        setEditFormData(data as Client);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao consultar cliente.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Carrega os casos vinculados a este cliente
  const fetchClientCases = async () => {
    if (!id) return;
    setLoadingCases(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar casos do cliente:', error.message);
      } else {
        setCases((data as Case[]) || []);
      }
    } catch (err) {
      console.error('Falha de rede ao consultar casos:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  // 3. Carrega o Checklist / Cofre de Documentos do cliente
  const fetchClientDocuments = async () => {
    if (!id) return;
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar documentos do cliente:', error.message);
      } else {
        setClientDocuments((data as ClientDocument[]) || []);
      }
    } catch (err) {
      console.error('Falha ao consultar documentos:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // 4. Gerar Checklist em Lote (Previdenciário ou Trabalhista)
  const handleGenerateChecklist = async (type: 'previdenciario' | 'trabalhista') => {
    if (!id || !profile?.tenant_id) {
      setDocsError('Sessão inválida: Tenant ou Cliente não identificado.');
      return;
    }

    const items =
      type === 'previdenciario'
        ? [
            'RG / CPF',
            'Comprovante de Residência',
            'CNIS Completo',
            'Carteiras de Trabalho (CTPS)',
            'PPP / Laudos Médicos',
          ]
        : [
            'RG / CPF',
            'CTPS',
            'Termo de Rescisão (TRCT)',
            'Extrato Analítico do FGTS',
            'Holerites / Folhas de Ponto',
          ];

    setGeneratingChecklist(type);
    setDocsError(null);

    try {
      const rowsToInsert = items.map((docType) => ({
        tenant_id: profile.tenant_id,
        client_id: id,
        doc_type: docType,
        status: 'Pendente',
      }));

      const { data, error } = await supabase
        .from('client_documents')
        .insert(rowsToInsert)
        .select();

      if (error) {
        setDocsError(`Erro ao gerar checklist: ${error.message}`);
      } else if (data) {
        setClientDocuments((prev) => [...prev, ...(data as ClientDocument[])]);
        setSuccessToast(
          type === 'previdenciario'
            ? 'Checklist Previdenciário gerado com sucesso!'
            : 'Checklist Trabalhista gerado com sucesso!'
        );
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar checklist.';
      setDocsError(msg);
    } finally {
      setGeneratingChecklist(null);
    }
  };

  // 5. Upload de Arquivo para item Pendente -> Muda status para 'Recebido'
  const handleUploadClientDocument = async (
    docItem: ClientDocument,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !id || !profile?.tenant_id) return;

    setUploadingDocId(docItem.id);
    setDocsError(null);

    try {
      // Higieniza o nome do arquivo mantendo a extensão
      const safeFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const storagePath = `${profile.tenant_id}/${id}/${Date.now()}_${safeFileName}`;

      // 5.1 Faz upload para o bucket `client_files`
      const { error: uploadError } = await supabase.storage
        .from('client_files')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        throw new Error(`Falha no upload para o Storage: ${uploadError.message}`);
      }

      // 5.2 Atualiza storage_path, file_name e muda status automaticamente para 'Recebido'
      const { data: updatedRow, error: updateError } = await supabase
        .from('client_documents')
        .update({
          storage_path: storagePath,
          file_name: file.name,
          status: 'Recebido',
        })
        .eq('id', docItem.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Erro ao atualizar registro do documento: ${updateError.message}`);
      }

      setClientDocuments((prev) =>
        prev.map((d) => (d.id === docItem.id ? (updatedRow as ClientDocument) : d))
      );
      setSuccessToast(`Arquivo "${docItem.doc_type}" recebido e arquivado no cofre!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo.';
      setDocsError(msg);
    } finally {
      setUploadingDocId(null);
      e.target.value = '';
    }
  };

  // 6. Visualizar / Baixar Documento Recebido via Signed URL (abre em nova guia)
  const handleViewOrDownloadDocument = async (docItem: ClientDocument) => {
    if (!docItem.storage_path) {
      setDocsError('Este item não possui caminho de arquivo vinculado no Storage.');
      return;
    }

    setOpeningDocId(docItem.id);
    setDocsError(null);

    try {
      const { data, error } = await supabase.storage
        .from('client_files')
        .createSignedUrl(docItem.storage_path, 3600); // URL assinada válida por 1 hora

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Não foi possível gerar o link seguro do documento.');
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao abrir documento.';
      setDocsError(msg);
    } finally {
      setOpeningDocId(null);
    }
  };

  // Estados e Handler do Gerador de Mensagem de Cobrança de Documentos (WhatsApp)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [whatsappMessage, setWhatsappMessage] = useState<string>('');
  const [whatsappCopied, setWhatsappCopied] = useState<boolean>(false);

  const handleOpenWhatsAppChargeModal = () => {
    if (!client) return;

    const pendingDocs = clientDocuments.filter((d) => d.status === 'Pendente');
    if (pendingDocs.length === 0) {
      setDocsError(
        'Não há documentos com status "Pendente" para cobrar. Gere um checklist acima ou verifique os itens já recebidos.'
      );
      return;
    }

    setDocsError(null);
    const bulletList = pendingDocs.map((d) => `- ${d.doc_type}`).join('\n');
    const message = `Olá, ${client.full_name}! Tudo bem? Para darmos andamento ao seu caso no escritório, ainda precisamos dos seguintes documentos:\n${bulletList}\n\nVocê pode nos enviar foto ou PDF por aqui mesmo!`;

    setWhatsappMessage(message);
    setWhatsappCopied(false);
    setIsWhatsAppModalOpen(true);
  };

  const handleCopyWhatsAppMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setWhatsappCopied(true);
    setTimeout(() => setWhatsappCopied(false), 2500);
  };

  // 7. Carrega os Eventos de Atendimento da Timeline (timeline_events)
  const fetchTimelineEvents = async () => {
    if (!id) return;
    setLoadingTimeline(true);
    try {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('client_id', id)
        .order('event_date', { ascending: false });

      if (!error && data) {
        setTimelineEvents((data as TimelineEventRecord[]) || []);
      }
    } catch (err) {
      console.error('Erro ao buscar linha do tempo:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // 8. Registrar Novo Evento / Atendimento na Timeline
  const handleCreateTimelineEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !profile?.tenant_id) {
      setTimelineError('Sessão inválida: Tenant ou Cliente não identificado.');
      return;
    }

    if (!timelineForm.title.trim()) {
      setTimelineError('Informe um título para o registro de atendimento/evento.');
      return;
    }

    setCreatingTimelineEvent(true);
    setTimelineError(null);

    try {
      const { data, error } = await supabase
        .from('timeline_events')
        .insert([
          {
            tenant_id: profile.tenant_id,
            client_id: id,
            event_type: timelineForm.event_type,
            title: timelineForm.title.trim(),
            description: timelineForm.description.trim() || null,
            visible_to_client: timelineForm.visible_to_client,
            created_by: user?.id || null,
            event_date: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        setTimelineError(`Erro ao salvar evento na linha do tempo: ${error.message}`);
      } else if (data) {
        setTimelineEvents((prev) => [data as TimelineEventRecord, ...prev]);
        setTimelineForm({
          event_type: 'Nota de Atendimento',
          title: '',
          description: '',
          visible_to_client: false,
        });
        setSuccessToast(
          timelineForm.visible_to_client
            ? 'Evento registrado e publicado no Portal do Cliente!'
            : 'Evento interno registrado na Linha do Tempo!'
        );
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar registro.';
      setTimelineError(msg);
    } finally {
      setCreatingTimelineEvent(false);
    }
  };

  // 9. Combina e ordena cronologicamente (do mais recente para o mais antigo):
  //    - timeline_events
  //    - cases (casos criados)
  //    - client_documents onde status !== 'Pendente' (documentos recebidos)
  const unifiedTimeline = React.useMemo(() => {
    const items: {
      id: string;
      source: 'event' | 'case' | 'document';
      category: string;
      title: string;
      description: string | null;
      date: string;
      visibleToClient: boolean;
      caseId?: string;
    }[] = [];

    // A) Eventos da tabela timeline_events
    timelineEvents.forEach((ev) => {
      items.push({
        id: `ev_${ev.id}`,
        source: 'event',
        category: ev.event_type,
        title: ev.title,
        description: ev.description,
        date: ev.event_date || ev.created_at,
        visibleToClient: Boolean(ev.visible_to_client),
        caseId: ev.case_id || undefined,
      });
    });

    // B) Casos criados (cases)
    cases.forEach((c) => {
      items.push({
        id: `case_${c.id}`,
        source: 'case',
        category: `Caso Criado • ${c.area}`,
        title: c.title,
        description: c.facts_summary || `Status atual: ${c.status}`,
        date: c.created_at,
        visibleToClient: true,
        caseId: c.id,
      });
    });

    // C) Documentos recebidos (client_documents onde status != 'Pendente')
    clientDocuments
      .filter((d) => d.status !== 'Pendente')
      .forEach((d) => {
        items.push({
          id: `doc_${d.id}`,
          source: 'document',
          category: 'Documento Recebido',
          title: `${d.doc_type} (${d.status})`,
          description: d.file_name
            ? `Arquivo arquivado no cofre: ${d.file_name}`
            : 'Documento validado no checklist do cliente.',
          date: d.created_at,
          visibleToClient: true,
        });
      });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timelineEvents, cases, clientDocuments]);

  useEffect(() => {
    fetchClientDetails();
    fetchClientCases();
    fetchClientDocuments();
    fetchTimelineEvents();
  }, [id]);

  // Cálculo da Idade
  const age = React.useMemo(() => {
    if (!client?.birth_date) return null;
    const today = new Date();
    const birthDate = new Date(client.birth_date);
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return isNaN(calculatedAge) || calculatedAge < 0 ? null : calculatedAge;
  }, [client?.birth_date]);

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

  // Copiar para a área de transferência
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Salvar Edição do Perfil do Cliente
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const { data, error } = await supabase
        .from('clients')
        .update({
          full_name: editFormData.full_name?.trim(),
          cpf: editFormData.cpf?.trim() || null,
          rg: editFormData.rg?.trim() || null,
          birth_date: editFormData.birth_date || null,
          mother_name: editFormData.mother_name?.trim() || null,
          contact_phone: editFormData.contact_phone?.trim() || null,
          contact_email: editFormData.contact_email?.trim() || null,
          gov_passwords: editFormData.gov_passwords?.trim() || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_clients_tenant_cpf')) {
          setEditError('Já existe outro cliente com este CPF cadastrado na sua organização.');
        } else {
          setEditError(`Erro ao atualizar: ${error.message}`);
        }
        setEditLoading(false);
        return;
      }

      setClient(data as Client);
      setIsEditModalOpen(false);
      setSuccessToast('Dados do cliente atualizados com sucesso!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar edições.';
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  // 3. Submeter Novo Caso (Garantindo client_id e tenant_id)
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!profile?.tenant_id) {
      setNewCaseError('Erro de sessão: Tenant da organização não identificado.');
      return;
    }

    if (!newCaseData.title.trim()) {
      setNewCaseError('O título do caso é obrigatório.');
      return;
    }

    setNewCaseLoading(true);
    setNewCaseError(null);

    try {
      const { data, error } = await supabase
        .from('cases')
        .insert([
          {
            tenant_id: profile.tenant_id,
            client_id: id,
            title: newCaseData.title.trim(),
            area: newCaseData.area,
            status: newCaseData.status,
            facts_summary: newCaseData.facts_summary.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) {
        setNewCaseError(`Erro ao criar caso: ${error.message}`);
        setNewCaseLoading(false);
        return;
      }

      // Adiciona o novo caso à lista e limpa formulário
      setCases((prev) => [data as Case, ...prev]);
      setIsNewCaseModalOpen(false);
      setNewCaseData({
        title: '',
        area: 'Previdenciário',
        status: 'Em Análise',
        facts_summary: '',
      });
      setSuccessToast('Novo caso criado com sucesso!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao salvar caso.';
      setNewCaseError(msg);
    } finally {
      setNewCaseLoading(false);
    }
  };

  // ── Gerar Documento (Document Assembly) ─────────────────────────────────────

  // Abre o modal e carrega a lista de templates do tenant
  const handleOpenDocModal = async () => {
    setIsDocModalOpen(true);
    setDocModalError(null);
    setSelectedTemplateId('');
    setLoadingDocTemplates(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, title, storage_path')
        .order('title', { ascending: true });

      if (error) throw new Error(error.message);
      const list = (data as DocumentTemplate[]) || [];
      setDocTemplates(list);
      if (list.length > 0) setSelectedTemplateId(list[0].id);
    } catch (err) {
      setDocModalError('Falha ao carregar modelos. Verifique se o bucket templates está configurado.');
    } finally {
      setLoadingDocTemplates(false);
    }
  };

  // Chama o motor de geração e força o download do .docx preenchido
  const handleGenerateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !selectedTemplateId) return;

    const template = docTemplates.find((t) => t.id === selectedTemplateId);
    if (!template) {
      setDocModalError('Modelo não encontrado. Por favor, selecione novamente.');
      return;
    }

    setGeneratingDoc(true);
    setDocModalError(null);

    // ── Mapeamento de dados do cliente para variáveis do template ─────────────
    // As chaves aqui devem corresponder exactamente às {tags} usadas no .docx
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const todayShort = today.toLocaleDateString('pt-BR');

    const data: Record<string, string> = {
      // Identidade do Cliente
      nome_cliente:       client.full_name,
      nome:               client.full_name,
      cpf:                client.cpf || '',
      cpf_cliente:        client.cpf || '',
      rg:                 client.rg || '',
      rg_cliente:         client.rg || '',
      data_nascimento:    client.birth_date ? formatDate(client.birth_date) : '',
      nome_mae:           client.mother_name || '',
      // Contato
      telefone:           client.contact_phone || '',
      email:              client.contact_email || '',
      // Datas de referência
      data_hoje:          todayShort,
      data_extenso:       todayFormatted,
      // Metadados úteis
      id_cliente:         client.id,
    };

    const outputName = buildOutputName(template.title, client.full_name, todayShort);

    const result = await generateDocument(template.storage_path, data, outputName);

    if (result.success) {
      setIsDocModalOpen(false);
      setSuccessToast(`Documento "${template.title}" gerado e baixado com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } else {
      setDocModalError(`Erro na geração: ${result.error}`);
    }

    setGeneratingDoc(false);
  };

  // Cores dinâmicas para Status dos Casos
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

  // Cores dinâmicas para Área Jurídica
  const getAreaBadge = (area: string) => {
    switch (area.toLowerCase()) {
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

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Abrindo dossiê do cliente...</p>
      </div>
    );
  }

  if (errorMessage || !client) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Dossiê não localizado</h3>
        <p className="text-sm text-slate-500">{errorMessage || 'Registro não encontrado.'}</p>
        <button
          onClick={() => navigate('/clientes')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista de Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Toast de Notificação */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Navegação / Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/clientes"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </Link>
        <span className="text-xs text-slate-400 font-mono">ID: {client.id}</span>
      </div>

      {/* CABEÇALHO DO DOSSIÊ (HEADER) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          
          {/* Identidade Principal */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-2xl shadow-sm flex-shrink-0">
              {client.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{client.full_name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Cliente Ativo
                </span>
              </div>

              {/* Informações Resumidas do Header */}
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-400 font-sans">CPF:</span>
                  <span className="font-semibold text-slate-700">{client.cpf || 'Não informado'}</span>
                  {client.cpf && (
                    <button
                      onClick={() => handleCopy(client.cpf!, 'cpf_head')}
                      title="Copiar CPF"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  {copiedKey === 'cpf_head' && <span className="text-emerald-600 text-[10px]">Copiado!</span>}
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{age !== null ? `${age} anos` : 'Idade não informada'}</span>
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1.5">
                  <span>Cadastrado em {formatDate(client.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contacto Rápido & Ações */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {client.contact_phone && (
              <a
                href={`https://wa.me/55${client.contact_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                WhatsApp
                <ExternalLink className="w-3 h-3 text-emerald-500" />
              </a>
            )}

            {client.contact_email && (
              <a
                href={`mailto:${client.contact_email}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                E-mail
              </a>
            )}

            <button
              onClick={() => {
                setPortalLinkCopied(false);
                setIsPortalModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98]"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Link do Portal do Cliente
            </button>

            <button
              onClick={handleOpenDocModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Gerar Documento
            </button>

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all shadow-sm active:scale-[0.98]"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar Dados
            </button>
          </div>

        </div>
      </div>

      {/* NAVEGAÇÃO POR SEPARADORES (TABS) */}
      <div className="border-b border-slate-200 flex gap-8">
        <button
          onClick={() => setActiveTab('dados_pessoais')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'dados_pessoais'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          Dados Pessoais
        </button>

        {/* Separador: Casos */}
        <button
          onClick={() => setActiveTab('casos')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'casos'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Casos
          <span className="bg-brand-50 text-brand-700 border border-brand-100 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {cases.length}
          </span>
        </button>

        {/* Separador: Documentos e Checklists */}
        <button
          onClick={() => setActiveTab('documentos')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'documentos'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Documentos e Checklists
          <span className="bg-brand-50 text-brand-700 border border-brand-100 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {clientDocuments.length}
          </span>
        </button>

        {/* Separador: Linha do Tempo (360º) */}
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'timeline'
              ? 'text-brand-600 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Linha do Tempo (360º)
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {unifiedTimeline.length}
          </span>
        </button>
      </div>

      {/* CONTEÚDO DOS SEPARADORES */}
      {activeTab === 'dados_pessoais' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna 1 & 2: Identificação e Filiação */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Bloco 1: Identificação Civil */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                <FileText className="w-4 h-4 text-brand-600" />
                Documentação e Identificação Civil
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase block">Nome Completo</span>
                  <span className="font-semibold text-slate-800">{client.full_name}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase block">CPF</span>
                  <span className="font-mono text-slate-800">{client.cpf || 'Não cadastrado'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase block">RG</span>
                  <span className="font-mono text-slate-800">{client.rg || 'Não cadastrado'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase block">Data de Nascimento</span>
                  <span className="text-slate-800">
                    {formatDate(client.birth_date)} {age !== null && `(${age} anos)`}
                  </span>
                </div>

                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase block">Filiação (Nome da Mãe)</span>
                  <span className="text-slate-800">{client.mother_name || 'Não informada'}</span>
                </div>
              </div>
            </div>

            {/* Bloco 2: Acessos Governamentais (Dado Sensível) */}
            <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm space-y-3 bg-gradient-to-br from-white to-amber-50/20">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Credenciais e Portais Governamentais
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Confidencial
                  </span>
                  <button
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="p-1 text-slate-500 hover:text-slate-800 transition-colors"
                    title={showPasswords ? 'Ocultar senhas' : 'Ver senhas'}
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {client.gov_passwords ? (
                <div className="relative">
                  <pre
                    className={`p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap select-all transition-all ${
                      !showPasswords ? 'blur-sm select-none' : ''
                    }`}
                  >
                    {client.gov_passwords}
                  </pre>
                  {!showPasswords && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-xl backdrop-blur-[2px]">
                      <button
                        onClick={() => setShowPasswords(true)}
                        className="px-3 py-1.5 bg-white text-slate-800 font-semibold text-xs rounded-lg shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Clique para Revelar Acessos
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Nenhuma credencial ou anotação governamental registrada para este cliente.
                </p>
              )}
            </div>

          </div>

          {/* Coluna 3: Informações de Contato & Auditoria */}
          <div className="space-y-6">
            
            {/* Bloco de Contatos */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Phone className="w-4 h-4 text-brand-600" />
                Canais de Comunicação
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase block">Telefone Principal</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {client.contact_phone || 'Não informado'}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase block">E-mail</span>
                  <p className="text-slate-800 break-all mt-0.5">
                    {client.contact_email || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadados e Auditoria */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 text-xs text-slate-500">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Auditoria do Registro
              </h4>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>Criado em:</span>
                <span className="font-medium text-slate-700">{formatDate(client.created_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>Última modificação:</span>
                <span className="font-medium text-slate-700">{formatDate(client.updated_at)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tenant ID:</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[140px]" title={client.tenant_id}>
                  {client.tenant_id}
                </span>
              </div>
            </div>

          </div>

        </div>
      ) : activeTab === 'casos' ? (
        /* SEPARADOR: CASOS (MOTOR DE CASOS E PROCESSOS) */
        <div className="space-y-6">
          
          {/* Barra de Ações do Separador de Casos */}
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Scale className="w-5 h-5 text-brand-600" />
                Casos e Demandas do Cliente
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerencie os processos judiciais, administrativos e requerimentos deste cliente
              </p>
            </div>

            <button
              onClick={() => setIsNewCaseModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Caso</span>
            </button>
          </div>

          {/* Listagem de Casos em Cartões Interativos (Cards) */}
          {loadingCases ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-medium text-slate-500">Carregando casos do cliente...</p>
            </div>
          ) : cases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
                <FolderPlus className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Nenhum caso cadastrado ainda</h4>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Este cliente ainda não possui nenhuma demanda jurídica ou administrativa cadastrada no escritório.
                </p>
              </div>
              <button
                onClick={() => setIsNewCaseModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Caso
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/casos/${c.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-brand-300 transition-all space-y-4 flex flex-col justify-between cursor-pointer group"
                >
                  <div className="space-y-3">
                    {/* Tags de Área e Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getAreaBadge(c.area)}`}>
                        {c.area}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </div>

                    {/* Título do Caso */}
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors leading-snug">
                      {c.title}
                    </h4>

                    {/* Resumo dos Fatos */}
                    {c.facts_summary ? (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {c.facts_summary}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Sem resumo dos fatos cadastrado.
                      </p>
                    )}
                  </div>

                  {/* Rodapé do Cartão */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      Criado em {formatDate(c.created_at)}
                    </span>
                    <span className="font-semibold text-brand-600 group-hover:underline flex items-center gap-1">
                      Acessar Processos
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      ) : activeTab === 'documentos' ? (
        /* SEPARADOR: DOCUMENTOS E CHECKLISTS (COFRE DO CLIENTE) */
        <div className="space-y-6">
          {/* Barra Superior com Botões de Ação Rápida para Checklists */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-600" />
                Cofre de Documentos & Checklists Automáticos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gere listas de documentos obrigatórios em 1 clique e armazene os arquivos do cliente com segurança.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                disabled={generatingChecklist !== null}
                onClick={() => handleGenerateChecklist('previdenciario')}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {generatingChecklist === 'previdenciario' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Gerar Checklist Previdenciário
              </button>

              <button
                type="button"
                disabled={generatingChecklist !== null}
                onClick={() => handleGenerateChecklist('trabalhista')}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {generatingChecklist === 'trabalhista' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Gerar Checklist Trabalhista
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsAppChargeModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98]"
              >
                <Phone className="w-3.5 h-3.5" />
                Cobrar Pendentes no WhatsApp
              </button>
            </div>
          </div>

          {/* Alerta de Erro na Aba de Documentos */}
          {docsError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{docsError}</span>
              </div>
              <button
                onClick={() => setDocsError(null)}
                className="font-semibold underline hover:text-red-900"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Lista de Documentos do Cliente */}
          {loadingDocs ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-500">Carregando cofre de documentos...</p>
            </div>
          ) : clientDocuments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Nenhum documento no checklist</h4>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Clique em "Gerar Checklist Previdenciário" ou "Gerar Checklist Trabalhista" acima para criar automaticamente a relação de documentos deste cliente.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {clientDocuments.map((docItem) => {
                const isPending = docItem.status === 'Pendente';
                const isUploading = uploadingDocId === docItem.id;
                const isOpening = openingDocId === docItem.id;

                return (
                  <div
                    key={docItem.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                          isPending
                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}
                      >
                        {isPending ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-slate-800 text-sm">{docItem.doc_type}</h4>

                          {/* Badge Visual de Status (Amarelo para Pendente, Verde para Recebido) */}
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                              isPending
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {docItem.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                          <span>Solicitado em {formatDate(docItem.created_at)}</span>
                          {docItem.file_name && (
                            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Arquivo: {docItem.file_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botão de Ação conforme o Status */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isPending ? (
                        <label
                          className={`inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer ${
                            isUploading ? 'opacity-60 pointer-events-none' : ''
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              Enviar Arquivo
                            </>
                          )}
                          <input
                            type="file"
                            accept=".pdf,image/*,.doc,.docx"
                            disabled={isUploading}
                            onChange={(e) => handleUploadClientDocument(docItem, e)}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          disabled={isOpening}
                          onClick={() => handleViewOrDownloadDocument(docItem)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                        >
                          {isOpening ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Gerando Link...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5" />
                              Visualizar / Baixar
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SEPARADOR: LINHA DO TEMPO (360º) — TIMELINE UNIFICADA */
        <div className="space-y-6">
          
          {/* FORMULÁRIO RÁPIDO: REGISTRAR EVENTO / ATENDIMENTO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 via-white to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Registrar Evento / Atendimento
                  </h3>
                  <p className="text-xs text-slate-500">
                    Adicione notas de atendimento, contatos no WhatsApp, andamentos ou marcos financeiros no histórico do cliente
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateTimelineEvent} className="p-6 space-y-4">
              {timelineError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{timelineError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tipo de Evento */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Evento *
                  </label>
                  <select
                    value={timelineForm.event_type}
                    onChange={(e) =>
                      setTimelineForm({
                        ...timelineForm,
                        event_type: e.target.value as TimelineEventType,
                      })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="Nota de Atendimento">Nota de Atendimento</option>
                    <option value="Contato WhatsApp / Ligação">Contato WhatsApp / Ligação</option>
                    <option value="Andamento Relevante">Andamento Relevante</option>
                    <option value="Marco Financeiro">Marco Financeiro</option>
                  </select>
                </div>

                {/* Título do Evento */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Título Resumido do Registro *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Reunião presencial sobre documentação do INSS / Aviso de Perícia Médica"
                    value={timelineForm.title}
                    onChange={(e) => setTimelineForm({ ...timelineForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Descrição Detalhada */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição / Detalhes do Atendimento
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva o que foi conversado, orientações repassadas ao cliente ou detalhes do andamento..."
                  value={timelineForm.description}
                  onChange={(e) =>
                    setTimelineForm({ ...timelineForm, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Checkbox Visível no Portal do Cliente + Botão Salvar */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <label className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={timelineForm.visible_to_client}
                    onChange={(e) =>
                      setTimelineForm({ ...timelineForm, visible_to_client: e.target.checked })
                    }
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      Visível no Portal do Cliente
                    </span>
                    <span className="text-[11px] text-emerald-700 block mt-0.5">
                      Se marcado, o cliente verá esta atualização em tempo real no celular dele pelo link do Portal.
                    </span>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={creatingTimelineEvent}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 self-end sm:self-center"
                >
                  {creatingTimelineEvent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Registrar na Linha do Tempo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* LINHA DO TEMPO VERTICAL UNIFICADA (360º) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Histórico Cronológico Unificado (360º)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Combinação automática de Atendimentos, Casos Abertos e Documentos Recebidos (do mais recente ao mais antigo)
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {unifiedTimeline.length} evento(s)
              </span>
            </div>

            {loadingTimeline ? (
              <div className="p-10 text-center space-y-2">
                <Loader2 className="w-7 h-7 text-brand-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Montando linha do tempo 360º do cliente...</p>
              </div>
            ) : unifiedTimeline.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <History className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Nenhum evento registrado ainda</p>
                <p className="text-xs text-slate-400">
                  Registre o primeiro atendimento no formulário acima.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 before:absolute before:top-2 before:bottom-2 before:left-2.5 sm:before:left-3.5 before:w-0.5 before:bg-slate-200 space-y-6">
                {unifiedTimeline.map((item) => {
                  // Define ícone e cores distintas conforme a origem e categoria
                  let IconComponent = FileText;
                  let dotStyle = 'bg-slate-100 text-slate-600 border-slate-300';
                  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';

                  if (item.source === 'case') {
                    IconComponent = Scale;
                    dotStyle = 'bg-purple-100 text-purple-700 border-purple-300';
                    badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                  } else if (item.source === 'document') {
                    IconComponent = CheckCircle2;
                    dotStyle = 'bg-emerald-100 text-emerald-700 border-emerald-300';
                    badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else {
                    // Eventos da tabela timeline_events
                    if (
                      item.category === 'Contato WhatsApp / Ligação' ||
                      item.category === 'WhatsApp'
                    ) {
                      IconComponent = MessageCircle;
                      dotStyle = 'bg-sky-100 text-sky-700 border-sky-300';
                      badgeStyle = 'bg-sky-50 text-sky-700 border-sky-200';
                    } else if (item.category === 'Marco Financeiro') {
                      IconComponent = DollarSign;
                      dotStyle = 'bg-amber-100 text-amber-700 border-amber-300';
                      badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                    } else if (
                      item.category === 'Andamento Relevante' ||
                      item.category === 'Marco Processual'
                    ) {
                      IconComponent = Scale;
                      dotStyle = 'bg-indigo-100 text-indigo-700 border-indigo-300';
                      badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                    } else {
                      IconComponent = FileText;
                      dotStyle = 'bg-brand-50 text-brand-700 border-brand-300';
                      badgeStyle = 'bg-brand-50 text-brand-700 border-brand-200';
                    }
                  }

                  return (
                    <div key={item.id} className="relative group">
                      {/* Marcador Circular na Linha Vertical */}
                      <div
                        className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center shadow-xs ${dotStyle}`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>

                      {/* Cartão do Evento */}
                      <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 transition-all shadow-2xs hover:shadow-sm space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${badgeStyle}`}
                            >
                              {item.category}
                            </span>

                            {item.visibleToClient ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Smartphone className="w-3 h-3" />
                                Visível ao Cliente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200/80 text-slate-600">
                                <EyeOff className="w-3 h-3" />
                                Interno do Escritório
                              </span>
                            )}
                          </div>

                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(item.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                          {item.caseId && (
                            <Link
                              to={`/casos/${item.caseId}`}
                              className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1"
                            >
                              Ver Caso
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {item.description}
                          </p>
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

      {/* MODAL: NOVO CASO */}
      {isNewCaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Novo Caso Jurídico</h3>
                  <p className="text-xs text-slate-500">
                    Vincular demanda ao cliente: <span className="font-medium text-slate-700">{client.full_name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewCaseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="p-6 space-y-4">
              {newCaseError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                  {newCaseError}
                </div>
              )}

              {/* Título do Caso */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título da Causa / Demanda <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aposentadoria Especial - Vigilante Armado"
                  value={newCaseData.title}
                  onChange={(e) => setNewCaseData({ ...newCaseData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Área e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Área do Direito
                  </label>
                  <select
                    value={newCaseData.area}
                    onChange={(e) => setNewCaseData({ ...newCaseData, area: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                  >
                    <option value="Previdenciário">Previdenciário</option>
                    <option value="Trabalhista">Trabalhista</option>
                    <option value="Cível">Cível</option>
                    <option value="Tributário">Tributário</option>
                    <option value="Família">Família</option>
                    <option value="Empresarial">Empresarial</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Inicial
                  </label>
                  <select
                    value={newCaseData.status}
                    onChange={(e) => setNewCaseData({ ...newCaseData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                  >
                    <option value="Em Análise">Em Análise</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Judicial">Judicial</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Resumo dos Fatos */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resumo dos Fatos & Pretensão do Cliente
                </label>
                <textarea
                  rows={4}
                  placeholder="Descreva a situação fática, datas relevantes, pretensão jurídica e histórico inicial da demanda..."
                  value={newCaseData.facts_summary}
                  onChange={(e) => setNewCaseData({ ...newCaseData, facts_summary: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Ações */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewCaseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newCaseLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {newCaseLoading ? (
                    'Salvando...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Criar Caso
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE DADOS DO CLIENTE */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Editar Dossiê do Cliente</h3>
                <p className="text-xs text-slate-500">Atualize as informações cadastrais</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.full_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={editFormData.cpf || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, cpf: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">RG</label>
                  <input
                    type="text"
                    value={editFormData.rg || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, rg: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={editFormData.birth_date || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Mãe</label>
                  <input
                    type="text"
                    value={editFormData.mother_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, mother_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={editFormData.contact_phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editFormData.contact_email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Acessos Governamentais (Gov.br / Senhas)
                  </label>
                  <textarea
                    rows={3}
                    value={editFormData.gov_passwords || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, gov_passwords: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {editLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GERAR DOCUMENTO (DOCUMENT ASSEMBLY 1-CLIQUE) */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header do Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-brand-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Gerar Documento (1 Clique)</h3>
                  <p className="text-xs text-slate-500">Preenchimento automático com dados do cliente</p>
                </div>
              </div>
              <button
                onClick={() => setIsDocModalOpen(false)}
                disabled={generatingDoc}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateDocument} className="p-6 space-y-5">
              {docModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{docModalError}</span>
                </div>
              )}

              {/* Seleção de Modelo (Dropdown) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Selecione o Modelo (.docx) *
                </label>

                {loadingDocTemplates ? (
                  <div className="flex items-center gap-2.5 px-3.5 py-3 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                    <span>Carregando modelos do repositório...</span>
                  </div>
                ) : docTemplates.length === 0 ? (
                  <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl text-xs text-amber-800 space-y-2">
                    <p className="font-semibold">Nenhum modelo cadastrado na sua organização.</p>
                    <p className="text-amber-700">
                      Envie primeiro um ficheiro Word (.docx) na central de modelos para poder gerar documentos com 1 clique.
                    </p>
                    <Link
                      to="/modelos"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline pt-1"
                    >
                      Ir para Gestão de Modelos
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <select
                    required
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={generatingDoc}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {docTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Resumo das Variáveis que serão injetadas */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Variáveis Preenchidas Automaticamente
                  </span>
                  <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    docxtemplater
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="font-mono text-[10px] text-slate-400 block">{'{nome_cliente}'}</span>
                    <span className="font-semibold text-slate-700 truncate block">{client.full_name}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="font-mono text-[10px] text-slate-400 block">{'{cpf}'}</span>
                    <span className="font-semibold text-slate-700 truncate block">{client.cpf || '—'}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="font-mono text-[10px] text-slate-400 block">{'{rg}'}</span>
                    <span className="font-semibold text-slate-700 truncate block">{client.rg || '—'}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="font-mono text-[10px] text-slate-400 block">{'{data_hoje}'}</span>
                    <span className="font-semibold text-slate-700 truncate block">
                      {new Date().toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações do Modal */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  disabled={generatingDoc}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={generatingDoc || loadingDocTemplates || docTemplates.length === 0 || !selectedTemplateId}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50"
                >
                  {generatingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando Word...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Gerar e Baixar .docx
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GERADOR DE MENSAGEM DE COBRANÇA DE DOCUMENTOS (WHATSAPP) */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header do Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Cobrar Documentos Pendentes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mensagem pronta com os itens pendentes de {client.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Texto da Mensagem (editável)
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {clientDocuments.filter((d) => d.status === 'Pendente').length} pendente(s)
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  className="w-full px-3.5 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                />
              </div>

              {!client.contact_phone && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Este cliente ainda não possui telefone cadastrado no dossiê. Você pode copiar o texto abaixo ou cadastrar o telefone em "Editar Dados".
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyWhatsAppMessage}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  {whatsappCopied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copiar Mensagem</span>
                    </>
                  )}
                </button>

                {client.contact_phone ? (
                  <a
                    href={`https://wa.me/55${client.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      whatsappMessage
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsWhatsAppModalOpen(false)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Enviar pelo WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsWhatsAppModalOpen(false)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Abrir WhatsApp Web</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Link do Portal do Cliente (Compartilhamento) */}
      {isPortalModalOpen && client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-sky-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Link do Portal do Cliente</h3>
                  <p className="text-xs text-slate-500">
                    Acesso público protegido pelos 4 primeiros dígitos do CPF
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPortalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const portalUrl = `${window.location.origin}/portal/${client.portal_token || ''}`;
              const cleanPhone = (client.contact_phone || '').replace(/\D/g, '');
              const firstName = client.full_name.split(' ')[0];
              const inviteMessage =
                `Olá, ${firstName}! Tudo bem?\n\n` +
                `Preparamos um link exclusivo para você acompanhar o andamento do seu processo e a situação dos seus documentos em tempo real pelo celular:\n\n` +
                `🔗 ${portalUrl}\n\n` +
                `🔒 Para sua segurança, basta digitar os *4 primeiros dígitos do seu CPF* ao abrir o link.`;

              return (
                <>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        URL Exclusiva do Cliente
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={portalUrl}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(portalUrl);
                              setPortalLinkCopied(true);
                              setTimeout(() => setPortalLinkCopied(false), 2500);
                            } catch (err) {
                              console.error('Erro ao copiar link do portal:', err);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                        >
                          {portalLinkCopied ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-emerald-700">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
                      <span className="font-bold text-slate-800 block">
                        Prévia do convite para WhatsApp:
                      </span>
                      <p className="whitespace-pre-line text-slate-600 leading-relaxed font-mono text-[11px]">
                        {inviteMessage}
                      </p>
                    </div>

                    {!client.cpf && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                        <strong>Atenção:</strong> Este cliente ainda não possui CPF cadastrado no dossiê. Cadastre o CPF para que ele consiga validar os 4 primeiros dígitos no Portal.
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Testar Portal</span>
                    </a>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPortalModalOpen(false)}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Fechar
                      </button>

                      <a
                        href={
                          cleanPhone.length >= 10
                            ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}?text=${encodeURIComponent(inviteMessage)}`
                            : `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setIsPortalModalOpen(false)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Enviar pelo WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};

