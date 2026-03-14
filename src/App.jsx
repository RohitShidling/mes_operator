import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';

// Layout
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/guards/ProtectedRoute';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// App Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import MachineChecklistPage from './pages/machines/MachineChecklistPage';
import MachineDetailPage from './pages/machines/MachineDetailPage';
import WorkOrdersPage from './pages/work-orders/WorkOrdersPage';
import WorkOrderDetailPage from './pages/work-orders/WorkOrderDetailPage';
import RejectionsPage from './pages/rejections/RejectionsPage';
import BreakdownsPage from './pages/breakdowns/BreakdownsPage';
import SkillsPage from './pages/skills/SkillsPage';
import AssignmentsPage from './pages/assignments/AssignmentsPage';

// Auth Route Guard - redirects to dashboard if already logged in
function AuthRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="spinner-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes - accessible only when NOT logged in */}
      <Route
        path="/login"
        element={
          <AuthRoute>
            <LoginPage />
          </AuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <AuthRoute>
            <RegisterPage />
          </AuthRoute>
        }
      />

      {/* Protected Routes - accessible only when logged in */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="machines" element={<MachineChecklistPage />} />
        <Route path="machines/:machineId" element={<MachineDetailPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="work-orders/:workOrderId" element={<WorkOrderDetailPage />} />
        <Route path="rejections" element={<RejectionsPage />} />
        <Route path="breakdowns" element={<BreakdownsPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                },
                success: {
                  iconTheme: { primary: '#10b981', secondary: '#fff' },
                },
                error: {
                  iconTheme: { primary: '#ef4444', secondary: '#fff' },
                },
              }}
            />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
