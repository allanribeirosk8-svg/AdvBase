import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { saveAs } from 'file-saver';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Download,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Calendar,
  Sparkles,
  FileType
} from 'lucide-react';

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  title: string;
  storage_path: string;
  created_at: string;
  updated_at?: string;
}

export const TemplatesList: React.FC = () => {
  const { profile } = useAuth();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modal de Upload de Modelo
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Carrega os Modelos de Documentos do Tenant
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar modelos de documentos:', error.message);
      } else {
        setTemplates((data as DocumentTemplate[]) || []);
      }
    } catch (err) {
      console.error('Falha de rede ao consultar modelos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [profile?.tenant_id]);

  // 2. Manipula seleção do arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida extensão (.docx)
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setModalError('Formato inválido. Por favor, envie apenas arquivos Word no formato .docx.');
      setSelectedFile(null);
      return;
    }

    setModalError(null);
    setSelectedFile(file);

    // Sugere o título baseado no nome do arquivo sem a extensão
    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      // Formata em Title Case
      const formattedTitle = baseName
        .split(' ')
        .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');
      setTitle(formattedTitle);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSelectedFile(null);
    setTitle('');
    setModalError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
    setTitle('');
    setModalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 3. Upload do arquivo para o Supabase Storage e Gravação na tabela
  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.tenant_id) {
      setModalError('Erro de sessão: Tenant da organização não identificado.');
      return;
    }

    if (!selectedFile) {
      setModalError('Selecione um arquivo .docx para continuar.');
      return;
    }

    if (!title.trim()) {
      setModalError('Informe um título descritivo para o modelo.');
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      // Higieniza o nome do arquivo para evitar caracteres especiais
      const sanitizedFileName = selectedFile.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      // Convenção de rota de armazenamento: <tenant_id>/<timestamp>_<nome_arquivo>
      // Garante conformidade com o RLS da política: (storage.foldername(name))[1] = tenant_id
      const storagePath = `${profile.tenant_id}/${Date.now()}_${sanitizedFileName}`;

      // 1. Upload para o Supabase Storage no bucket 'templates'
      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(storagePath, selectedFile, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Falha no upload do arquivo: ${uploadError.message}`);
      }

      // 2. Gravação do registro na tabela document_templates
      const { data: dbData, error: dbError } = await supabase
        .from('document_templates')
        .insert([
          {
            tenant_id: profile.tenant_id,
            title: title.trim(),
            storage_path: storagePath,
          },
        ])
        .select()
        .single();

      if (dbError) {
        // Tenta reverter o arquivo no storage se a inserção falhar
        await supabase.storage.from('templates').remove([storagePath]);
        throw new Error(`Falha ao registrar modelo no banco de dados: ${dbError.message}`);
      }

      // Adiciona o novo modelo à listagem
      if (dbData) {
        setTemplates((prev) => [dbData as DocumentTemplate, ...prev]);
      }

      handleCloseModal();
      setSuccessToast('Modelo de documento (.docx) adicionado com sucesso!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha inesperada no upload do modelo.';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  // 4. Download do Modelo .docx
  const handleDownloadTemplate = async (template: DocumentTemplate) => {
    setDownloadingId(template.id);
    try {
      const { data, error } = await supabase.storage
        .from('templates')
        .download(template.storage_path);

      if (error || !data) {
        throw new Error(error?.message || 'Arquivo não encontrado no repositório.');
      }

      // Dispara o download no navegador usando file-saver
      const downloadName = `${template.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      saveAs(data, downloadName);

      setSuccessToast(`Download de "${template.title}" concluído.`);
      setTimeout(() => setSuccessToast(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao baixar o modelo.';
      alert(`Erro no download: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // 5. Excluir Modelo
  const handleDeleteTemplate = async (template: DocumentTemplate) => {
    if (!window.confirm(`Tem certeza que deseja excluir o modelo "${template.title}"?`)) {
      return;
    }

    setDeletingId(template.id);
    const previousTemplates = [...templates];
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));

    try {
      // 1. Remove da tabela
      const { error: dbError } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', template.id);

      if (dbError) {
        setTemplates(previousTemplates);
        alert(`Erro ao excluir modelo do banco: ${dbError.message}`);
        return;
      }

      // 2. Remove do storage (operação assíncrona tolerante a falhas)
      await supabase.storage.from('templates').remove([template.storage_path]);

      setSuccessToast('Modelo excluído com sucesso!');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      setTemplates(previousTemplates);
      console.error('Erro ao deletar modelo:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Filtro de Busca
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.storage_path.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Modelos de Documentos</h1>
                <span className="bg-brand-50 text-brand-700 border border-brand-100 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {templates.length} {templates.length === 1 ? 'modelo' : 'modelos'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Repositório de matrizes e minutas em formato .docx com tags de autopreenchimento (Document Assembly)
              </p>
            </div>
          </div>
        </div>

        {/* Ações de Topo */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTemplates}
            title="Atualizar lista de modelos"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Modelo</span>
          </button>
        </div>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar modelos por título ou nome do arquivo..."
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

      {/* LISTAGEM DE MODELOS (CARDS INTERATIVOS) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
        {loading && templates.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Carregando modelos do repositório...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          /* ESTADO VAZIO */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-brand-100">
              <FileUp className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {searchQuery ? 'Nenhum modelo localizado' : 'Nenhum modelo cadastrado'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                {searchQuery
                  ? `Não encontramos nenhum modelo correspondente ao termo "${searchQuery}".`
                  : 'Faça o upload do seu primeiro arquivo Word (.docx) contendo as variáveis entre chaves como {nome_cliente}, {cpf_cliente}, etc.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Primeiro Modelo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const isDownloading = downloadingId === template.id;
              const isDeleting = deletingId === template.id;
              const fileNameOnly = template.storage_path.split('/').pop() || template.storage_path;

              return (
                <div
                  key={template.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                        <FileType className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        DOCX
                      </span>
                    </div>

                    {/* Título do Modelo */}
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                        {template.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono truncate mt-1" title={fileNameOnly}>
                        {fileNameOnly}
                      </p>
                    </div>

                    {/* Informações adicionais */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Cadastrado em {formatDate(template.created_at)}</span>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleDownloadTemplate(template)}
                      disabled={isDownloading || isDeleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                      title="Baixar modelo original .docx"
                    >
                      <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                      <span>{isDownloading ? 'Baixando...' : 'Download'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={isDownloading || isDeleting}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Excluir este modelo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: NOVO MODELO (UPLOAD .DOCX) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Topo do Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Novo Modelo de Documento</h3>
                  <p className="text-xs text-slate-500">
                    Faça o upload do arquivo Word (.docx) matriz
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadTemplate} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Upload do Arquivo .docx */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Arquivo Matriz (.docx) <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-brand-500 bg-brand-50/30'
                      : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {selectedFile ? (
                    <div className="space-y-1">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate max-w-xs mx-auto">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto">
                        <FileUp className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-medium text-slate-700">
                        Clique aqui para selecionar o arquivo <span className="font-bold text-brand-600">.docx</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Formatos aceitos: Microsoft Word (.docx)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Título do Modelo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título do Modelo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Contrato de Honorários Previdenciário ou Procuração Ad Judicia"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              {/* Dica de Document Assembly */}
              <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl flex items-start gap-2.5 text-xs text-brand-900">
                <Sparkles className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold">Como utilizar variáveis no modelo:</span>
                  <p className="text-[11px] text-brand-700 leading-relaxed">
                    No seu arquivo Word, insira placeholders como <code className="bg-brand-100 text-brand-800 px-1 py-0.5 rounded font-mono">{'{nome_cliente}'}</code>, <code className="bg-brand-100 text-brand-800 px-1 py-0.5 rounded font-mono">{'{cpf}'}</code>, <code className="bg-brand-100 text-brand-800 px-1 py-0.5 rounded font-mono">{'{processo}'}</code> para que o motor preencha automaticamente.
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !selectedFile}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {modalLoading ? (
                    'Enviando...'
                  ) : (
                    <>
                      <FileUp className="w-4 h-4" />
                      Salvar Modelo
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
