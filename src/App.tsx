import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Ranking } from './pages/Ranking';
import { Banks } from './pages/Banks';
import { BankDetail } from './pages/BankDetail';
import { Dimensoes } from './pages/Dimensoes';
import { Avaliacao } from './pages/Avaliacao';
import { Evidencias } from './pages/Evidencias';
import { Exportar } from './pages/Exportar';
import { Configuracoes } from './pages/Configuracoes';
import { Revisao } from './pages/Revisao';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Página pública */}
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas — qualquer utilizador autenticado */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/banks" element={<Banks />} />
              <Route path="/banks/:id" element={<BankDetail />} />
              <Route path="/dimensoes" element={<Dimensoes />} />
              <Route path="/avaliacao" element={<Avaliacao />} />
              <Route path="/evidencias" element={<Evidencias />} />
              <Route path="/exportar" element={<Exportar />} />

              {/* Revisão — apenas gestor */}
              <Route element={<ProtectedRoute allowedRoles={['gestor']} />}>
                <Route path="/revisao" element={<Revisao />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
