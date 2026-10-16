import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, LogOut, Contact, Inbox, CalendarCheck, FileText, Kanban, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { profile, signOut } = useAuth();

  const navItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard },
    { label: 'Triagem (Kanban)', path: '/atendimento', icon: Kanban },
    { label: 'Tarefas e Prazos', path: '/tarefas', icon: CalendarCheck },
    { label: 'Clientes', path: '/clientes', icon: Contact },
    { label: 'Publicações', path: '/publicacoes', icon: Inbox },
    { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
    { label: 'Modelos de Documentos', path: '/modelos', icon: FileText },
    { label: 'Usuários do Tenant', path: '/users', icon: Users },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen">
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-100">
        <Building2 className="w-6 h-6 text-brand-600" />
        <span className="font-bold text-slate-800 text-lg tracking-tight">SaaS Multi-tenant</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="mb-3 px-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant Atual</p>
          <p className="text-sm font-medium text-slate-700 truncate">{profile?.tenant_id || 'Não vinculado'}</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 capitalize">
            {profile?.role || 'Visitante'}
          </span>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
};
