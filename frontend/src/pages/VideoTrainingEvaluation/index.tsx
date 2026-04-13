import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Empty, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import ReactEChartsCore from 'echarts-for-react/lib/core';

import api from '../../utils/api';
import { echarts } from '../../utils/echarts';

interface EvaluationModel {
  id: number;
  name: string;
  version?: string;
  model_type: string;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  map50?: number | null;
  map50_95?: number | null;
  inference_speed?: number | null;
  is_active?: boolean;
  status?: string;
}

interface EvaluationJob {
  id: number;
  name: string;
  log_path?: string | null;
  metrics_json?: Record<string, any> | null;
}

interface EvaluationItem {
  model: EvaluationModel;
  job?: EvaluationJob | null;
}

interface CompareResult {
  model_a: Record<string, any>;
  model_b: Record<string, any>;
  dataset_diff?: Record<string, any>;
  class_metrics_diff?: Record<string, Record<string, number>>;
}

const percent = (value?: number | null) => {
  if (value == null) return '-';
  return `${(value * 100).toFixed(1)}%`;
};

const canRenderCharts = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.getContext === 'function';

export default function VideoTrainingEvaluation() {
  const [modelType, setModelType] = useState<'custom_object' | 'custom_action'>('custom_object');
  const [items, setItems] = useState<EvaluationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const loadEvaluations = async (nextType: 'custom_object' | 'custom_action') => {
    setLoading(true);
    try {
      const res = await api.get(`/video-training/models/${nextType}/evaluations`);
      const nextItems = Array.isArray(res.data) ? res.data : [];
      setItems(nextItems);
      setSelectedIds(nextItems.slice(0, 2).map((item: EvaluationItem) => item.model.id));
      setCompareResult(null);
    } catch {
      message.error('加载训练评估失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvaluations(modelType);
  }, [modelType]);

  const selectedOptions = useMemo(() => {
    return items.map((item) => ({
      value: item.model.id,
      label: `${item.model.name}${item.model.is_active ? ' (active)' : ''}`,
    }));
  }, [items]);

  const runCompare = async () => {
    if (selectedIds.length < 2) {
      message.warning('请先选择两个模型');
      return;
    }
    try {
      const res = await api.get(`/video-training/models/compare/${selectedIds[0]}/${selectedIds[1]}`);
      setCompareResult(res.data);
    } catch {
      message.error('加载模型对比失败');
    }
  };

  const datasetChartOption = useMemo(() => {
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: items.map((item) => item.model.name),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'annotation_count',
          type: 'bar',
          data: items.map((item) => item.job?.metrics_json?.dataset_export?.annotation_count || 0),
          itemStyle: { color: '#1677ff' },
        },
      ],
    };
  }, [items]);

  const compareChartOption = useMemo(() => {
    const classMetrics = compareResult?.class_metrics_diff || {};
    const labels = Object.keys(classMetrics);
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['precision_diff', 'recall_diff'] },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'precision_diff',
          type: 'bar',
          data: labels.map((label) => classMetrics[label]?.precision_diff || 0),
          itemStyle: { color: '#13c2c2' },
        },
        {
          name: 'recall_diff',
          type: 'bar',
          data: labels.map((label) => classMetrics[label]?.recall_diff || 0),
          itemStyle: { color: '#722ed1' },
        },
      ],
    };
  }, [compareResult]);

  const totalModels = items.length;
  const activeModels = items.filter((item) => item.model.is_active).length;
  const bestAccuracy = items.reduce((max, item) => Math.max(max, item.model.accuracy || 0), 0);
  const fastestInference = items.reduce((min, item) => {
    const speed = item.model.inference_speed ?? Number.POSITIVE_INFINITY;
    return Math.min(min, speed);
  }, Number.POSITIVE_INFINITY);

  return (
    <div>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>训练评估中心</Typography.Title>
              <Typography.Text type="secondary">集中查看自定义训练模型历史、训练日志与版本差异</Typography.Text>
            </div>
            <Space wrap>
              <Select
                value={modelType}
                style={{ width: 180 }}
                onChange={(value) => setModelType(value)}
                options={[
                  { value: 'custom_object', label: '物体模型' },
                  { value: 'custom_action', label: '动作模型' },
                ]}
              />
              <Select
                mode="multiple"
                maxCount={2}
                value={selectedIds}
                onChange={(value) => setSelectedIds(value as number[])}
                style={{ width: 320 }}
                options={selectedOptions}
                placeholder="选择两个模型进行对比"
              />
              <Button type="primary" onClick={() => void runCompare()}>对比所选模型</Button>
            </Space>
          </Space>
        </Card>

        <Row gutter={16}>
          <Col span={6}><Card><Statistic title="模型总数" value={totalModels} /></Card></Col>
          <Col span={6}><Card><Statistic title="活跃模型" value={activeModels} /></Card></Col>
          <Col span={6}><Card><Statistic title="最佳精度" value={(bestAccuracy * 100).toFixed(1)} suffix="%" /></Card></Col>
          <Col span={6}><Card><Statistic title="最快推理" value={Number.isFinite(fastestInference) ? fastestInference.toFixed(1) : '-'} suffix="ms" /></Card></Col>
        </Row>

        <Row gutter={16} align="stretch">
          <Col span={14}>
            <Card title="模型历史版本">
              <Table
                rowKey={(item) => item.model.id}
                loading={loading}
                pagination={false}
                dataSource={items}
                columns={[
                  {
                    title: '模型',
                    key: 'model',
                    render: (_, record: EvaluationItem) => (
                      <Space direction="vertical" size={0}>
                        <strong>{record.model.name}</strong>
                        <Typography.Text type="secondary">{record.job?.name || '-'}</Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: '状态',
                    key: 'status',
                    render: (_, record: EvaluationItem) => (
                      <Space>
                        {record.model.is_active ? <Tag color="green">active</Tag> : null}
                        <Tag>{record.model.status || '-'}</Tag>
                      </Space>
                    ),
                  },
                  {
                    title: '精度',
                    key: 'accuracy',
                    render: (_, record: EvaluationItem) => percent(record.model.accuracy),
                  },
                  {
                    title: 'mAP@50',
                    key: 'map50',
                    render: (_, record: EvaluationItem) => percent(record.model.map50),
                  },
                  {
                    title: 'annotation_count',
                    key: 'annotation_count',
                    render: (_, record: EvaluationItem) => record.job?.metrics_json?.dataset_export?.annotation_count ?? '-',
                  },
                ]}
              />
            </Card>
          </Col>
          <Col span={10}>
            <Card title="训练数据概览" style={{ height: '100%' }}>
              {items.length ? (
                canRenderCharts ? (
                  <ReactEChartsCore echarts={echarts} option={datasetChartOption} style={{ height: 300 }} />
                ) : (
                  <Typography.Text>图表预览不可用</Typography.Text>
                )
              ) : (
                <Empty description="暂无训练评估数据" />
              )}
            </Card>
          </Col>
        </Row>

        <Card title="模型对比结果">
          {compareResult ? (
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="模型A">{compareResult.model_a.name}</Descriptions.Item>
                <Descriptions.Item label="模型B">{compareResult.model_b.name}</Descriptions.Item>
                <Descriptions.Item label="annotation_count_diff">
                  {compareResult.dataset_diff?.annotation_count_diff ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="class_count_diff">
                  {compareResult.dataset_diff?.class_count_diff ?? '-'}
                </Descriptions.Item>
              </Descriptions>

              {canRenderCharts ? (
                <ReactEChartsCore echarts={echarts} option={compareChartOption} style={{ height: 320 }} />
              ) : (
                <Typography.Text>图表预览不可用</Typography.Text>
              )}

              <Table
                rowKey={(item) => item[0]}
                pagination={false}
                dataSource={Object.entries(compareResult.class_metrics_diff || {})}
                columns={[
                  { title: '类别', key: 'className', render: (_, record) => record[0] },
                  { title: 'precision_diff', key: 'precision', render: (_, record) => String(record[1].precision_diff ?? 0) },
                  { title: 'recall_diff', key: 'recall', render: (_, record) => String(record[1].recall_diff ?? 0) },
                  { title: 'sample_count_diff', key: 'sampleCount', render: (_, record) => String(record[1].sample_count_diff ?? 0) },
                ]}
              />
            </Space>
          ) : (
            <Empty description="选择两个模型后开始对比" />
          )}
        </Card>
      </Space>
    </div>
  );
}
