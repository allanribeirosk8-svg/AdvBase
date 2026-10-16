import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

export const ClientFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    cpf: '',
    rg: '',
    birth_date: '',
    mother_name: '',
    contact_phone: '',
    contact_email: '',
    gov_passwords: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!profile?.tenant_id) {
      setErrorMessage('Erro: Organização (tenant) não identificada na sessão.');
      return;
    }

    if (!formData.full_name.trim()) {
      setErrorMessage('O Nome Completo do cliente é obrigatório.');
      return;
    }

    setLoading(true);

    try {
      // Injeta o tenant_id do usuário logado
      const { data, error } = await supabase
        .from('clients')
        .insert([
          {
            tenant_id: profile.tenant_id,
            full_name: formData.full_name.trim(),
            cpf: formData.cpf.trim() || null,
            rg: formData.rg.trim() || null,
            birth_date: formData.birth_date || null,
            mother_name: formData.mother_name.trim() || null,
            contact_phone: formData.contact_phone.trim() || null,
            contact_email: formData.contact_email.trim() || null,
            gov_passwords: formData.gov_passwords.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_clients_tenant_cpf')) {
          setErrorMessage('Já existe um cliente cadastrado com este CPF nesta organização.');
        } else {
          setErrorMessage(`Erro ao cadastrar cliente: ${error.message}`);
        }
        setLoading(false);
        return;
      }

      // Redireciona diretamente para o Dossiê do cliente recém-criado
      navigate(`/clientes/${data.id}`, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao salvar o cliente.';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* Navegação e Título */}
      <div className="flex items-center justify-between">
        <Link
          to="/clientes"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista de Clientes
        </Link>
        <span className="text-xs text-slate-400 font-mono">
          Tenant: {profile?.tenant_id?.substring(0, 8)}...
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Cabeçalho do Formulário */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-xl font-bold text-slate-800">Novo Cadastro de Cliente</h1>
          <p className="text-xs text-slate-500 mt-1">
            Preencha os dados do cliente para adicioná-lo à carteira isolada da sua organização.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {errorMessage && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {errorMessage}
            </div>
          )}

          {/* Seção 1: Identificação Civil */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" />
              Identificação Civil
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Ex: Maria das Graças Silva"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  RG
                </label>
                <input
                  type="text"
                  name="rg"
                  value={formData.rg}
                  onChange={handleChange}
                  placeholder="00.000.000-0"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nome da Mãe
                </label>
                <input
                  type="text"
                  name="mother_name"
                  value={formData.mother_name}
                  onChange={handleChange}
                  placeholder="Nome completo da mãe"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Comunicação */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-600" />
              Canais de Contato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  E-mail
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  placeholder="cliente@email.com"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Acessos aos Portais Governamentais */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Acessos a Portais Governamentais (Gov.br / Senhas)
              </h2>
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Confidencial
              </span>
            </div>
            <textarea
              name="gov_passwords"
              rows={3}
              value={formData.gov_passwords}
              onChange={handleChange}
              placeholder="Ex: Gov.br Login: 000.000.000-00 | Senha: ... | Nível: Prata / Ouro"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/clientes')}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                'Salvando cliente...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Concluir Cadastro
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
