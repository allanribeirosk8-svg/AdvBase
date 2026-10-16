import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { ClientsList } from './pages/ClientsList';
import { ClientFormPage } from './pages/ClientFormPage';
import { ClientDossier } from './pages/ClientDossier';
import { CaseDetail } from './pages/CaseDetail';
import { ProcessInbox } from './pages/ProcessInbox';
import { MyTasks } from './pages/MyTasks';
import { TemplatesList } from './pages/TemplatesList';
import { LeadsKanban } from './pages/LeadsKanban';
import { FinancialDashboard } from './pages/FinancialDashboard';
import { ClientPortal } from './pages/ClientPortal';
import { LoginPage } from './pages/LoginPage';

/**
 * Componente de Guarda de Rota
 * Garante que apenas utilizadores com sessão válida acessem as rotas internas.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 font-medium text-sm space-y-3">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Carregando sessão do tenant...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota Pública de Autenticação */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rota Pública do Portal do Cliente (Semáforo Processual Mobile-First) */}
          <Route path="/portal/:token" element={<ClientPortal />} />

          {/* Todas as Rotas Protegidas envolvidas por ProtectedRoute + DashboardLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Página Inicial / Painel */}
            <Route index element={<Dashboard />} />

            {/* Módulo de Funil de Captação / Triagem (Kanban) */}
            <Route path="atendimento" element={<LeadsKanban />} />

            {/* Módulo de Gestão de Clientes */}
            <Route path="clientes" element={<ClientsList />} />
            <Route path="clientes/novo" element={<ClientFormPage />} />
            <Route path="clientes/:id" element={<ClientDossier />} />

            {/* Módulo de Casos e Processos */}
            <Route path="casos/:caseId" element={<CaseDetail />} />

            {/* Módulo de Publicações e Andamentos (Inbox) */}
            <Route path="publicacoes" element={<ProcessInbox />} />

            {/* Módulo de Tarefas e Prazos (Anti-Sinistro) */}
            <Route path="tarefas" element={<MyTasks />} />

            {/* Módulo Financeiro e Funil de RPVs/Alvarás */}
            <Route path="financeiro" element={<FinancialDashboard />} />

            {/* Módulo de Modelos de Documentos (Document Assembly) */}
            <Route path="modelos" element={<TemplatesList />} />

            {/* Aliases e Redirecionamentos para Compatibilidade */}
            <Route path="leads" element={<Navigate to="/atendimento" replace />} />
            <Route path="financial" element={<Navigate to="/financeiro" replace />} />
            <Route path="clients" element={<Navigate to="/clientes" replace />} />
            <Route path="clients/new" element={<Navigate to="/clientes/novo" replace />} />
            <Route path="clients/:id" element={<Navigate to="/clientes/:id" replace />} />
            <Route path="cases/:caseId" element={<Navigate to="/casos/:caseId" replace />} />
            <Route path="inbox" element={<Navigate to="/publicacoes" replace />} />
            <Route path="tasks" element={<Navigate to="/tarefas" replace />} />
            <Route path="templates" element={<Navigate to="/modelos" replace />} />
          </Route>

          {/* Fallback Global */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
