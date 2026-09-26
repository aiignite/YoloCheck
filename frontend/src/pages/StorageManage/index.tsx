import React, { useEffect, useState } from 'react';
import { Table, Select, Card, Statistic, Popconfirm, message, Space, Row, Col, Tag, Button, Tooltip } from 'antd';
import {
  DeleteOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';

interface StorageRecord {
  id: number;
  file_type: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  related_type: string | null;
  related_id: number | null;
  description: string | null;
  created_at: string;
}

interface StorageStats {
  total_files: number;
  total_size: number;
  by_type: { file_type: string; count: number; total_size: number }[];
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

const fileTypeColors: Record<string, string> = {
  image: 'blue',
  video: 'purple',
  model: 'orange',
  keyframe: 'cyan',
};

const StorageManage: React.FC = () => {
  const [records, setRecords] = useState<StorageRecord[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string | undefined>(undefined);
  const { t } = useTranslation();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = fileTypeFilter ? { file_type: fileTypeFilter } : {};
      const [recordsRes, statsRes] = await Promise.all([
        api.get('/storage', { params }),
        api.get('/storage/stats'),
      ]);
      setRecords(Array.isArray(recordsRes.data) ? recordsRes.data : recordsRes.data.items || []);
      setStats(statsRes.data);
    } catch {
      message.error(t('pages.storage.fetchFailed'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [fileTypeFilter]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/storage/${id}`);
      message.success(t('pages.storage.deleteSuccess'));
      fetchData();
    } catch {
      message.error(t('pages.storage.deleteFailed'));
    }
  };

  const columns = [
    {
      title: '存储文件 ID',
      dataIndex: 'id',
      width: 120,
      render: (id: number) => (
        <span style={{ fontFamily: 'var(--mono)', color: '#096dd9', fontWeight: 600 }}>
          #{id}
        </span>
      ),
    },
    {
      title: t('pages.storage.fileType'),
      dataIndex: 'file_type',
      width: 120,
      render: (type: string) => (
        <Tag color={fileTypeColors[type] || 'default'} style={{ fontWeight: 600 }}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: t('pages.storage.filePath'),
      dataIndex: 'file_path',
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#595959' }}>
            {path}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('pages.storage.fileSize'),
      dataIndex: 'file_size',
      width: 120,
      render: (size: number | null) => (
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {size !== null ? formatSize(size) : '-'}
        </span>
      ),
    },
    {
      title: t('pages.storage.mimeType'),
      dataIndex: 'mime_type',
      width: 140,
      render: (mime: string | null) => (
        <Tag>{mime || 'application/octet-stream'}</Tag>
      ),
    },
    {
      title: t('pages.storage.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (date: string) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8c8c8c' }}>
          {new Date(date).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('common.actions'),
      width: 100,
      render: (_: any, record: StorageRecord) => (
        <Popconfirm
          title={t('pages.storage.confirmDelete')}
          okText={t('common.confirm') || '确定'}
          cancelText={t('common.cancel') || '取消'}
          okType="danger"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('pages.storage.totalFiles')}
              value={stats?.total_files ?? 0}
              prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title={t('pages.storage.totalSize')}
              value={stats?.total_size ?? 0}
              formatter={(val) => formatSize(val as number)}
              prefix={<CloudServerOutlined style={{ color: '#52c41a' }} />}
              styles={{ content: { color: '#389e0d' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="industrial-metric-card" size="small">
            <Statistic
              title="存储引擎架构"
              value="本地高速 SSD / 分布式挂载"
              prefix={<PieChartOutlined style={{ color: '#722ed1' }} />}
              styles={{ content: { fontSize: 18 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Subcategory breakdown cards */}
      {stats?.by_type && stats.by_type.length > 0 && (
        <Row gutter={[16, 16]}>
          {stats.by_type.map((item) => (
            <Col key={item.file_type} xs={12} sm={6}>
              <Card className="industrial-metric-card" size="small">
                <Statistic
                  title={`${item.file_type.toUpperCase()} 资源`}
                  value={item.count}
                  suffix={`件 / ${formatSize(item.total_size)}`}
                  prefix={<FileTextOutlined style={{ color: fileTypeColors[item.file_type] || '#1890ff' }} />}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Main Table Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatabaseOutlined style={{ color: '#1890ff' }} />
            <span>质检快照、视频样本与模型介质持久化库</span>
          </div>
        }
        extra={
          <Space>
            <Select
              allowClear
              placeholder={t('pages.storage.allTypes')}
              style={{ width: 150 }}
              value={fileTypeFilter}
              onChange={setFileTypeFilter}
              options={[
                { value: 'image', label: t('pages.storage.typeImage') },
                { value: 'video', label: t('pages.storage.typeVideo') },
                { value: 'model', label: t('pages.storage.typeModel') },
                { value: 'keyframe', label: t('pages.storage.typeKeyframe') },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个存储资产`,
          }}
        />
      </Card>
    </div>
  );
};

export default StorageManage;
