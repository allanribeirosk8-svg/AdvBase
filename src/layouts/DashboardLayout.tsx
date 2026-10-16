import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

export const DashboardLayout: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-medium text-slate-500">Painel de Controle</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <span className="text-sm font-medium text-slate-700">{profile?.full_name || 'Carregando...'}</span>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
