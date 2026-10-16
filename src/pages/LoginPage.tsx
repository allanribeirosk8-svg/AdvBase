import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Lock, Mail, User, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [signupType, setSignupType] = useState<'new_tenant' | 'existing_tenant'>('new_tenant');

  // Redireciona automaticamente se o usuário já estiver autenticado
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Form states
  const [fullName, setFullName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [documentCnpj, setDocumentCnpj] = useState('');
  const [existingTenantId, setExistingTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setErrorMessage('Configure as chaves do Supabase no arquivo .env antes de fazer login.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else {
      // Login bem-sucedido: redireciona para a página principal
      navigate('/', { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setErrorMessage('Configure as chaves do Supabase no arquivo .env antes de cadastrar.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Monta metadados passados para o Trigger do Supabase
    const metadata: Record<string, string> = {
      full_name: fullName,
    };

    if (signupType === 'new_tenant') {
      if (!tenantName.trim()) {
        setErrorMessage('Informe o nome da sua empresa / organização.');
        setLoading(false);
        return;
      }
      metadata.tenant_name = tenantName;
      metadata.document_cnpj = documentCnpj || '00.000.000/0001-00';
      metadata.role = 'owner';
    } else {
      if (!existingTenantId.trim()) {
        setErrorMessage('Informe o ID do Tenant ao qual deseja se vincular.');
        setLoading(false);
        return;
      }
      metadata.tenant_id = existingTenantId.trim();
      metadata.role = 'member';
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    if (data?.session) {
      navigate('/', { replace: true });
    } else {
      setSuccessMessage('Conta cadastrada com sucesso! Verifique a caixa de entrada do seu e-mail para confirmar seu cadastro.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        
        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl mb-3">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            {isSignUp ? 'Criar Nova Conta' : 'Acessar Plataforma'}
          </h1>
          <p className="text-sm text-slate-500 text-center mt-1">
            {isSignUp
              ? 'Cadastre sua empresa ou ingresse em uma organização'
              : 'Entre com as credenciais do seu tenant'}
          </p>
        </div>

        {/* Abas Alternadoras (Login / Cadastro) */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); resetForm(); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); resetForm(); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Banner de Aviso de Configuração do Supabase */}
        {!isConfigured && (
          <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Configuração do Supabase Pendente
            </div>
            <p>
              Adicione as credenciais reais no arquivo <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">.env</code> para autenticar usuários.
            </p>
          </div>
        )}

        {/* Mensagens de Retorno */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Formulário Principal */}
        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
          
          {/* Campos exclusivos do Cadastro */}
          {isSignUp && (
            <>
              {/* Seletor de Tipo de Cadastro */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                <span className="font-semibold text-slate-600 block">Tipo de Inscrição:</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="signupType"
                      checked={signupType === 'new_tenant'}
                      onChange={() => setSignupType('new_tenant')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    Nova Organização
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="signupType"
                      checked={signupType === 'existing_tenant'}
                      onChange={() => setSignupType('existing_tenant')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    Já tenho Tenant ID
                  </label>
                </div>
              </div>

              {signupType === 'new_tenant' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Nome da Organização / Empresa
                    </label>
                    <div className="relative">
                      <Building2 className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        placeholder="Ex: Acme Corp"
                        className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      CNPJ (Opcional)
                    </label>
                    <input
                      type="text"
                      value={documentCnpj}
                      onChange={(e) => setDocumentCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    ID da Organização (UUID)
                  </label>
                  <input
                    type="text"
                    required
                    value={existingTenantId}
                    onChange={(e) => setExistingTenantId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="João da Silva"
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {isSignUp && (
              <span className="text-[11px] text-slate-400 mt-1 block">Mínimo de 6 caracteres</span>
            )}
          </div>

          {/* Botão de Submissão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              'Processando...'
            ) : isSignUp ? (
              <>
                <span>Finalizar Cadastro</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Rodapé Alternador */}
        <div className="mt-6 text-center text-xs text-slate-500">
          {isSignUp ? (
            <p>
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(false); resetForm(); }}
                className="text-brand-600 hover:underline font-semibold"
              >
                Faça login
              </button>
            </p>
          ) : (
            <p>
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(true); resetForm(); }}
                className="text-brand-600 hover:underline font-semibold"
              >
                Cadastre sua empresa
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
