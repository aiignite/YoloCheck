import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Alerts from './pages/Alerts';
import Statistics from './pages/Statistics';
import VideoLearning from './pages/VideoLearning';
import LiveMonitor from './pages/LiveMonitor';
import Users from './pages/Users';
import MES from './pages/MES';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import ModelManager from './pages/ModelManager';
import BatchAnalysis from './pages/BatchAnalysis';
import AlertWorkflow from './pages/AlertWorkflow';
import StorageManage from './pages/StorageManage';
import { Spin } from 'antd';

function ProtectedRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <MainLayout />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoutes />}>
            <Route index element={<Dashboard />} />
            <Route path="live-monitor" element={<LiveMonitor />} />
            <Route path="cameras" element={<Cameras />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="video-learning" element={<VideoLearning />} />
            <Route path="users" element={<Users />} />
            <Route path="mes" element={<MES />} />
            <Route path="models" element={<ModelManager />} />
            <Route path="batch-analysis" element={<BatchAnalysis />} />
            <Route path="alert-workflow" element={<AlertWorkflow />} />
            <Route path="storage" element={<StorageManage />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
