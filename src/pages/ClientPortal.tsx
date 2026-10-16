import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ShieldCheck,
  Scale,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Building2,
  Hash,
  Bell,
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface PortalProcess {
  process_number: string | null;
  instance: string;
}

interface PortalCase {
  id: string;
  title: string;
  area: string;
  status: string;
  created_at: string;
  processes: PortalProcess[];
}

interface PortalDocument {
  id: string;
  doc_type: string;
  status: 'Pendente' | 'Recebido' | 'Validado' | string;
  file_name: string | null;
  created_at: string;
}

interface PortalMovement {
  id: string;
  date: string;
  description: string;
  process_number: string | null;
  instance: string;
}

interface PortalUpdate {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  created_at: string;
}

interface PortalDataPayload {
  requires_cpf_validation: boolean;
  client_first_name?: string;
  client_id?: string;
  tenant_id?: string;
  office_name?: string;
  client_name?: string;
  cases?: PortalCase[];
  documents?: PortalDocument[];
  movements?: PortalMovement[];
  updates?: PortalUpdate[];
}

const CASE_STEPS = [
  { step: 1, label: 'Em Análise / Documentação' },
  { step: 2, label: 'Administrativo / INSS' },
  { step: 3, label: 'Judicial' },
  { step: 4, label: 'Finalizado' },
];

function getStepIndexForStatus(status: string): number {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('finalizado') || normalized.includes('conclu')) return 4;
  if (normalized.includes('judicial')) return 3;
  if (normalized.includes('administrativo') || normalized.includes('inss')) return 2;
  return 1; // 'Em Análise' ou inicial
}

export const ClientPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [cpfDigits, setCpfDigits] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<PortalDataPayload | null>(null);

  const handleValidateAndLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Link de acesso inválido.');
      return;
    }

    const cleanDigits = cpfDigits.replace(/\D/g, '');
    if (cleanDigits.length < 4) {
      setErrorMsg('Por favor, digite os 4 primeiros números do seu CPF.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.rpc('get_client_portal_data', {
        p_token: token,
        p_cpf_prefix: cleanDigits.substring(0, 4),
      });

      if (error) {
        setErrorMsg(error.message || 'Não foi possível validar o seu acesso.');
        setLoading(false);
        return;
      }

      const payload = data as PortalDataPayload;
      if (!payload || payload.requires_cpf_validation) {
        setErrorMsg(
          'Os 4 primeiros dígitos do CPF não conferem com o titular deste link. Verifique e tente novamente.'
        );
        setLoading(false);
        return;
      }

      setPortalData(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar ao Portal do Cliente.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // ===========================================================================
  // TELA 1: VALIDAÇÃO DE SEGURANÇA (4 PRIMEIROS DÍGITOS DO CPF)
  // ===========================================================================
  if (!portalData || portalData.requires_cpf_validation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Topo Institucional */}
          <div className="bg-gradient-to-r from-brand-700 to-indigo-700 p-6 text-white text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Portal de Acompanhamento do Cliente
            </h1>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Consulte o andamento do seu caso, documentos e comunicados do escritório em tempo real.
            </p>
          </div>

          {/* Formulário de Validação CPF */}
          <form onSubmit={handleValidateAndLoad} className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                <Lock className="w-3.5 h-3.5 text-brand-600" />
                Verificação Rápida de Segurança
              </span>
              <p className="text-xs text-slate-500 pt-1">
                Para proteger seus dados processuais, digite apenas os{' '}
                <strong className="text-slate-800">4 primeiros números do seu CPF</strong>:
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                required
                placeholder="0000"
                value={cpfDigits}
                onChange={(e) => setCpfDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full text-center text-3xl tracking-[0.5em] font-mono font-extrabold text-slate-900 py-4 px-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-brand-600 focus:bg-white focus:outline-none transition-all"
              />
              <span className="block text-center text-[11px] text-slate-400 mt-1.5">
                Exemplo: Se o seu CPF começa com 123.456..., digite <strong>1234</strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || cpfDigits.length < 4}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando Acesso...
                </>
              ) : (
                <>
                  <span>Acessar Meu Processo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-slate-400 mt-6 text-center">
          Ambiente criptografado • Acesso exclusivo ao titular
        </p>
      </div>
    );
  }

  // ===========================================================================
  // TELA 2: PAINEL DO CLIENTE (MOBILE-FIRST / SEMÁFORO PROCESSUAL)
  // ===========================================================================
  const cases = portalData.cases || [];
  const documents = portalData.documents || [];
  const updates = portalData.updates || [];
  const movements = portalData.movements || [];

  const pendingDocs = documents.filter((d) => d.status === 'Pendente');
  const receivedDocs = documents.filter((d) => d.status !== 'Pendente');

  return (
    <div className="min-h-screen bg-slate-100 pb-14">
      {/* CABEÇALHO DO ESCRITÓRIO E SAUDAÇÃO AO CLIENTE */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white pt-8 pb-12 px-4 sm:px-6 shadow-md">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{portalData.office_name || 'Escritório de Advocacia'}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online em Tempo Real
            </span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
              Área Exclusiva do Cliente
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
              Olá, {portalData.client_name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Acompanhe abaixo o andamento atualizado dos seus processos, documentos e avisos da nossa equipe.
            </p>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL (CARDS MOBILE-FIRST) */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 -mt-6 space-y-6">
        
        {/* =====================================================================
            1. SEUS CASOS (SEMÁFORO VISUAL DE PROGRESSO)
        ===================================================================== */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Scale className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Seus Casos & Semáforo Processual ({cases.length})
            </h2>
          </div>

          {cases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-xs">
              <p className="text-sm font-semibold text-slate-700">
                Seu caso está sendo preparado pela nossa equipe jurídica.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Assim que cadastrado, o progresso aparecerá aqui automaticamente.
              </p>
            </div>
          ) : (
            cases.map((c) => {
              const currentStep = getStepIndexForStatus(c.status);
              const progressPercent = (currentStep / CASE_STEPS.length) * 100;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-1.5">
                        {c.area}
                      </span>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                        {c.title}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                      {c.status}
                    </span>
                  </div>

                  {/* Barra de Progresso Visual (Semáforo de 4 Etapas) */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">
                        Etapa {currentStep} de {CASE_STEPS.length}
                      </span>
                      <span className="font-extrabold text-brand-600">
                        {Math.round(progressPercent)}% concluído
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {CASE_STEPS.map((st) => {
                        const isDone = st.step <= currentStep;
                        const isCurrent = st.step === currentStep;
                        return (
                          <div
                            key={st.step}
                            className={`p-2 rounded-xl border text-[11px] flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-brand-50 border-brand-300 text-brand-900 font-extrabold'
                                : isDone
                                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 font-semibold'
                                  : 'bg-slate-50 border-slate-100 text-slate-400'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isCurrent
                                  ? 'text-brand-600'
                                  : isDone
                                    ? 'text-emerald-600'
                                    : 'text-slate-300'
                              }`}
                            />
                            <span className="truncate">{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Números dos Processos Vinculados */}
                  {c.processes && c.processes.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Processos / Protocolos Vinculados
                      </span>
                      <div className="space-y-1.5">
                        {c.processes.map((proc, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                              <Hash className="w-3.5 h-3.5 text-slate-400" />
                              {proc.process_number || 'Em autuação'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                              {proc.instance}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* =====================================================================
            2. DOCUMENTOS PENDENTES E ENTREGUES (CHECKLIST DO CLIENTE)
        ===================================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Situação dos Seus Documentos
                </h2>
                <p className="text-xs text-slate-500">
                  Veja o que ainda falta enviar e o que já foi recebido pelo escritório
                </p>
              </div>
            </div>
          </div>

          {documents.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              Nenhum documento pendente solicitado até o momento.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Destaque Amarelo: Documentos Pendentes */}
              {pendingDocs.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Falta Entregar ({pendingDocs.length})</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Precisamos dos documentos abaixo para dar andamento ao seu caso:
                  </p>
                  <div className="space-y-2 pt-1">
                    {pendingDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2"
                      >
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {doc.doc_type}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Pendente
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Destaque Verde: Documentos Já Recebidos */}
              {receivedDocs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Documentos Já Entregues ({receivedDocs.length})
                  </span>
                  <div className="space-y-2">
                    {receivedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                            {doc.doc_type}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {doc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* =====================================================================
            3. ÚLTIMAS ATUALIZAÇÕES E COMUNICADOS DO ESCRITÓRIO
        ===================================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Últimas Atualizações do Escritório
              </h2>
              <p className="text-xs text-slate-500">
                Comunicados e andamentos importantes compartilhados pelo seu advogado
              </p>
            </div>
          </div>

          {updates.length === 0 && movements.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl text-center space-y-1">
              <Sparkles className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Nenhuma nova notificação no momento.
              </p>
              <p className="text-[11px] text-slate-400">
                Assim que houver novidades relevantes no seu processo, você verá aqui!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((up) => (
                <div
                  key={up.id}
                  className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                      {up.event_type}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDate(up.event_date || up.created_at)}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{up.title}</h4>
                  {up.description && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {up.description}
                    </p>
                  )}
                </div>
              ))}

              {movements.map((mov) => (
                <div
                  key={mov.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                      Andamento • {mov.instance}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDate(mov.date)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {mov.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
