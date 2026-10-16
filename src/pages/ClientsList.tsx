import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClientFormModal } from '../components/ClientFormModal';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Calendar,
  Key,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';

export interface Client {
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
  created_at: string;
}

export const ClientsList: React.FC = () => {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedClientForView, setSelectedClientForView] = useState<Client | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // O Supabase filtra automaticamente pelo RLS e tenant_id
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar clientes:', error.message);
      } else {
        setClients((data as Client[]) || []);
      }
    } catch (err) {
      console.error('Falha de conexão com a tabela clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [profile?.tenant_id]);

  // Filtro inteligente por Nome ou CPF
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase().trim();
    return clients.filter((c) => {
      const nameMatch = c.full_name?.toLowerCase().includes(query);
      const cpfMatch = c.cpf?.replace(/\D/g, '').includes(query.replace(/\D/g, '')) || c.cpf?.includes(query);
      return nameMatch || cpfMatch;
    });
  }, [clients, searchQuery]);

  // Formatador de data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">Clientes da Organização</h2>
            <span className="bg-brand-50 text-brand-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-brand-100">
              {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gerenciamento centralizado da carteira de clientes com isolamento multi-tenant
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchClients}
            title="Atualizar lista"
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/clientes/novo"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </Link>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar cliente por Nome Completo ou CPF..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
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

      {/* Conteúdo Principal: Tabela ou Estados Alternativos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && clients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Carregando carteira de clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-700">
                {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? `Não encontramos resultados correspondentes a "${searchQuery}".`
                  : 'Comece a cadastrar os clientes da sua organização para gerenciar seus dados com segurança.'}
              </p>
            </div>
            {!searchQuery && (
              <Link
                to="/clientes/novo"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Cadastrar Primeiro Cliente
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Nome do Cliente</th>
                  <th className="px-6 py-3.5">CPF / RG</th>
                  <th className="px-6 py-3.5">Nascimento</th>
                  <th className="px-6 py-3.5">Contato</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Nome & Mãe */}
                    <td className="px-6 py-4">
                      <Link
                        to={`/clientes/${client.id}`}
                        className="font-semibold text-slate-800 hover:text-brand-600 transition-colors block"
                      >
                        {client.full_name}
                      </Link>
                      {client.mother_name && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Mãe: {client.mother_name}
                        </div>
                      )}
                    </td>

                    {/* CPF / RG */}
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      <div>{client.cpf || <span className="text-slate-300 font-sans">Sem CPF</span>}</div>
                      {client.rg && (
                        <div className="text-[11px] text-slate-400 mt-0.5">RG: {client.rg}</div>
                      )}
                    </td>

                    {/* Nascimento */}
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(client.birth_date)}</span>
                      </div>
                    </td>

                    {/* Contato */}
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="space-y-1">
                        {client.contact_phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{client.contact_phone}</span>
                          </div>
                        )}
                        {client.contact_email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-[180px]">{client.contact_email}</span>
                          </div>
                        )}
                        {!client.contact_phone && !client.contact_email && (
                          <span className="text-slate-300">Sem contato</span>
                        )}
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/clientes/${client.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Dossiê
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação de Cliente */}
      <ClientFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onClientCreated={fetchClients}
      />

      {/* Modal de Visualização da Ficha Completa do Cliente */}
      {selectedClientForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-base">Ficha do Cliente</h3>
              <button
                onClick={() => setSelectedClientForView(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Nome Completo</span>
                <p className="font-semibold text-slate-800 text-base">{selectedClientForView.full_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">CPF</span>
                  <p className="font-mono text-slate-700">{selectedClientForView.cpf || '-'}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">RG</span>
                  <p className="font-mono text-slate-700">{selectedClientForView.rg || '-'}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Data de Nascimento</span>
                  <p className="text-slate-700">{formatDate(selectedClientForView.birth_date)}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Telefone</span>
                  <p className="text-slate-700">{selectedClientForView.contact_phone || '-'}</p>
                </div>
              </div>

              {selectedClientForView.mother_name && (
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Nome da Mãe</span>
                  <p className="text-slate-700">{selectedClientForView.mother_name}</p>
                </div>
              )}

              {selectedClientForView.gov_passwords && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
                    <Key className="w-3.5 h-3.5" />
                    Acessos aos Portais Governamentais (Confidencial)
                  </div>
                  <pre className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap select-all">
                    {selectedClientForView.gov_passwords}
                  </pre>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedClientForView(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
