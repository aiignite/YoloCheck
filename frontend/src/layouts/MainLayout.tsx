import React from 'react';
import { Layout, Menu, Button, Space, Tag, Select } from 'antd';
import {
  DashboardOutlined,
  CameraOutlined,
  AlertOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  ScheduleOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  BellOutlined,
  SettingOutlined,
  MonitorOutlined,
  AuditOutlined,
  LogoutOutlined,
  UserOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
  ScanOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const { Header, Sider, Content } = Layout;

const roleColors: Record<string, string> = { admin: 'red', manager: 'blue', operator: 'green' };

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: t('menu.dashboard') },
    { key: '/live-monitor', icon: <MonitorOutlined />, label: t('menu.liveMonitor') },
    {
      key: 'sub_vision_lab',
      icon: <ExperimentOutlined style={{ color: '#fa8c16' }} />,
      label: '🔬 工业质检与视觉实验室',
      children: [
        { key: '/solder-lab', icon: <ExperimentOutlined style={{ color: '#fa8c16' }} />, label: '🛠️ SMT焊接质量质检' },
        { key: '/wave-solder-lab', icon: <SafetyCertificateOutlined style={{ color: '#1890ff' }} />, label: '🌊 波峰焊接质量评价' },
        { key: '/image-lab', icon: <ScanOutlined style={{ color: '#52c41a' }} />, label: '🔬 图像增强与SAHI切片' },
        { key: '/supervision-lab', icon: <SafetyCertificateOutlined style={{ color: '#b37feb' }} />, label: '🛡️ Supervision业务流' },
        { key: '/model-optimizer', icon: <ThunderboltOutlined style={{ color: '#faad14' }} />, label: '⚡ 模型响应加速' },
      ],
    },
    {
      key: 'sub_production_monitoring',
      icon: <CameraOutlined style={{ color: '#1890ff' }} />,
      label: '🏭 产线监控与告警',
      children: [
        { key: '/cameras', icon: <CameraOutlined />, label: t('menu.cameras') },
        { key: '/alerts', icon: <AlertOutlined />, label: t('menu.alerts') },
        { key: '/alert-workflow', icon: <BellOutlined />, label: t('menu.alertWorkflow') },
        { key: '/statistics', icon: <BarChartOutlined />, label: t('menu.statistics') },
        { key: '/mes', icon: <ScheduleOutlined />, label: t('menu.mes') },
      ],
    },
    {
      key: 'sub_ai_training',
      icon: <AppstoreOutlined style={{ color: '#52c41a' }} />,
      label: '🧠 算法训练与数据闭环',
      children: [
        { key: '/models', icon: <AppstoreOutlined />, label: t('menu.models') },
        { key: '/video-learning', icon: <VideoCameraOutlined />, label: t('menu.videoLearning') },
        { key: '/video-training', icon: <AppstoreOutlined />, label: t('menu.videoTraining') },
        { key: '/video-training/evaluation', icon: <BarChartOutlined />, label: t('menu.videoTrainingEvaluation') },
        { key: '/batch-analysis', icon: <CloudServerOutlined />, label: t('menu.batchAnalysis') },
        { key: '/dataset-audit', icon: <FileSearchOutlined />, label: t('menu.datasetAudit') || '数据集体检' },
      ],
    },
    {
      key: 'sub_system_settings',
      icon: <SettingOutlined style={{ color: '#faad14' }} />,
      label: '⚙️ 系统配置与安全',
      children: [
        { key: '/storage', icon: <DatabaseOutlined />, label: t('menu.storage') },
        { key: '/users', icon: <TeamOutlined />, label: t('menu.users') },
        { key: '/sessions', icon: <MonitorOutlined />, label: t('menu.sessions') || '会话管理' },
        { key: '/login-history', icon: <AuditOutlined />, label: t('menu.loginHistory') || '登录历史' },
        ...(user?.role === 'admin' ? [{ key: '/audit-logs', icon: <AuditOutlined />, label: t('menu.auditLogs') }] : []),
        { key: '/settings', icon: <SettingOutlined />, label: t('menu.settings') },
      ],
    },
  ];

  // Automatically expand parent SubMenu according to current pathname
  const defaultOpenKeys = [
    'sub_vision_lab',
    'sub_production_monitoring',
    'sub_ai_training',
    'sub_system_settings',
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={230} theme="dark" style={{ overflow: 'auto', height: '100vh', position: 'sticky', top: 0, left: 0 }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <img src="/favicon.svg" alt="" style={{ width: 28, height: 28 }} />
            <h2 style={{ color: '#fff', margin: 0, fontSize: 16 }}>{t('app.title')}</h2>
          </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={defaultOpenKeys}
          items={menuItems}
          onClick={({ key }) => {
            if (key.startsWith('/')) {
              navigate(key);
            }
          }}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8e8e8', boxShadow: '0 1px 4px rgba(0,21,41,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>{t('app.subtitle')}</h3>
            <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontSize: 12 }}>
              ● 产线在线边缘计算中心
            </Tag>
          </div>
          <Space size={16}>
            <Space size={4}>
              <GlobalOutlined style={{ color: '#8c8c8c' }} />
              <Select
                size="small"
                value={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
                onChange={(val) => i18n.changeLanguage(val)}
                options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]}
                style={{ width: 90 }}
              />
            </Space>
            {user && (
              <Space size={8}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fafafa', padding: '4px 10px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{user.display_name || user.username}</span>
                  <Tag color={roleColors[user.role]} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                    {t(`role.${user.role}`, user.role)}
                  </Tag>
                </div>
                <Button size="small" icon={<LogoutOutlined />} onClick={logout}>
                  {t('auth.logout')}
                </Button>
              </Space>
            )}
          </Space>
        </Header>
        <Content style={{ margin: 0, padding: 20, background: '#f0f2f5', flex: 1, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
