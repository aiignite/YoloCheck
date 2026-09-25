import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import { Spin } from 'antd';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Cameras = lazy(() => import('./pages/Cameras'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Statistics = lazy(() => import('./pages/Statistics'));
const VideoLearning = lazy(() => import('./pages/VideoLearning'));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor'));
const Users = lazy(() => import('./pages/Users'));
const MES = lazy(() => import('./pages/MES'));
const Settings = lazy(() => import('./pages/Settings'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const ModelManager = lazy(() => import('./pages/ModelManager'));
const VideoTraining = lazy(() => import('./pages/VideoTraining'));
const VideoTrainingEvaluation = lazy(() => import('./pages/VideoTrainingEvaluation'));
const BatchAnalysis = lazy(() => import('./pages/BatchAnalysis'));
const AlertWorkflow = lazy(() => import('./pages/AlertWorkflow'));
const StorageManage = lazy(() => import('./pages/StorageManage'));
const Sessions = lazy(() => import('./pages/Sessions'));
const LoginHistory = lazy(() => import('./pages/LoginHistory'));
const DatasetAudit = lazy(() => import('./pages/DatasetAudit'));

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', fontSize: 16 }}>
      页面加载中...
    </div>
  );
}

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
        <Suspense fallback={<PageFallback />}>
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
              <Route path="video-training" element={<VideoTraining />} />
              <Route path="video-training/evaluation" element={<VideoTrainingEvaluation />} />
              <Route path="batch-analysis" element={<BatchAnalysis />} />
              <Route path="dataset-audit" element={<DatasetAudit />} />
              <Route path="alert-workflow" element={<AlertWorkflow />} />
              <Route path="storage" element={<StorageManage />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="login-history" element={<LoginHistory />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
