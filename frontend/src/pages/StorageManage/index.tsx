import React, { useEffect, useState } from 'react';
import { Table, Select, Card, Statistic, Popconfirm, message, Space, Row, Col, Tag, Button } from 'antd';
import { DeleteOutlined, DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';
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
  if (bytes === 0) return '0 B';
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
      setRecords(recordsRes.data);
      setStats(statsRes.data);
    } catch {
      message.error(t('pages.storage.fetchFailed'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [fileTypeFilter]);

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
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: t('pages.storage.fileType'),
      dataIndex: 'file_type',
      width: 100,
      render: (t: string) => <Tag color={fileTypeColors[t] || 'default'}>{t}</Tag>,
    },
    {
      title: t('pages.storage.filePath'),
      dataIndex: 'file_path',
      ellipsis: true,
    },
    {
      title: t('pages.storage.fileSize'),
      dataIndex: 'file_size',
      width: 120,
      render: (size: number | null) => size != null ? formatSize(size) : '-',
    },
    {
      title: t('pages.storage.relatedType'),
      dataIndex: 'related_type',
      width: 100,
      render: (t: string | null) => t || '-',
    },
    {
      title: t('pages.storage.relatedId'),
      dataIndex: 'related_id',
      width: 80,
      render: (id: number | null) => id ?? '-',
    },
    {
      title: t('pages.storage.description'),
      dataIndex: 'description',
      ellipsis: true,
      render: (d: string | null) => d || '-',
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 170,
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: t('common.actions'),
      width: 80,
      render: (_: unknown, record: StorageRecord) => (
        <Popconfirm
          title={t('pages.storage.confirmDelete')}
          description={t('pages.storage.confirmDeleteDesc')}
          onConfirm={() => handleDelete(record.id)}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('pages.storage.totalFiles')}
              value={stats?.total_files ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('pages.storage.totalSize')}
              value={stats?.total_size ?? 0}
              formatter={(val) => formatSize(val as number)}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Statistic title={t('pages.storage.typeFilter')} value="-" />
              <Select
                allowClear
                placeholder={t('pages.storage.allTypes')}
                style={{ width: 140 }}
                value={fileTypeFilter}
                onChange={setFileTypeFilter}
                options={[
                  { value: 'image', label: t('pages.storage.typeImage') },
                  { value: 'video', label: t('pages.storage.typeVideo') },
                  { value: 'model', label: t('pages.storage.typeModel') },
                  { value: 'keyframe', label: t('pages.storage.typeKeyframe') },
                ]}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {stats?.by_type && stats.by_type.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {stats.by_type.map((item) => (
            <Col key={item.file_type} span={6}>
              <Card size="small">
                <Statistic
                  title={item.file_type}
                  value={item.count}
                  suffix={`${t('pages.storage.countUnit')} / ${formatSize(item.total_size)}`}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => t('common.total', { count: total }) }}
      />
    </div>
  );
};

export default StorageManage;
