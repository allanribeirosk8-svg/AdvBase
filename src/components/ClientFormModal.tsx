import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, User, ShieldAlert, Phone, Mail, Calendar, CheckCircle2 } from 'lucide-react';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: () => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
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

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!profile?.tenant_id) {
      setErrorMessage('Erro: Organização (tenant) do usuário não identificada.');
      return;
    }

    if (!formData.full_name.trim()) {
      setErrorMessage('O Nome Completo é obrigatório.');
      return;
    }

    setLoading(true);

    try {
      // Injeta explicitamente o tenant_id proveniente do AuthContext
      const { error } = await supabase.from('clients').insert([
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
      ]);

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_clients_tenant_cpf')) {
          setErrorMessage('Já existe um cliente cadastrado com este CPF nesta organização.');
        } else {
          setErrorMessage(`Erro ao salvar cliente: ${error.message}`);
        }
        setLoading(false);
        return;
      }

      // Sucesso
      setLoading(false);
      onClientCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao cadastrar cliente.';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Novo Cliente</h3>
            <p className="text-xs text-slate-500">
              Registrando cliente vinculado à organização atual
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
              {errorMessage}
            </div>
          )}

          {/* Seção 1: Dados Básicos */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Identificação do Cliente
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Ex: Maria das Graças Silva"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RG
                </label>
                <input
                  type="text"
                  name="rg"
                  value={formData.rg}
                  onChange={handleChange}
                  placeholder="00.000.000-0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Mãe
                </label>
                <input
                  type="text"
                  name="mother_name"
                  value={formData.mother_name}
                  onChange={handleChange}
                  placeholder="Nome completo da genitora"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Contatos */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Informações de Contato
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  E-mail
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Dados de Acesso Governamental (Gov Passwords) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Acessos aos Portais Governamentais (Gov.br / Senhas)
              </label>
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                Confidencial
              </span>
            </div>
            <textarea
              name="gov_passwords"
              rows={2}
              value={formData.gov_passwords}
              onChange={handleChange}
              placeholder="Ex: Gov.br Login: 000.000.000-00 | Senha: ... | Nível: Prata"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs"
            />
          </div>

          {/* Rodapé e Ações */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                'Salvando...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Cliente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
