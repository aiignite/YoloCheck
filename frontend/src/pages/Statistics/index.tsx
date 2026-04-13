import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Select, Space, Button, Statistic, message } from 'antd';
import { DownloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { echarts } from '../../utils/echarts';

const Statistics: React.FC = () => {
  const [efficiency, setEfficiency] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [comparison, setComparison] = useState<any>(null);
  const chartRef1 = useRef<ReactEChartsCore>(null);
  const chartRef2 = useRef<ReactEChartsCore>(null);
  const chartRef3 = useRef<ReactEChartsCore>(null);
  const { t } = useTranslation();

  const fetchData = async () => {
    try {
      const [effRes, compRes] = await Promise.all([
        api.get('/stats/efficiency', { params: { days } }),
        api.get('/reports/comparison', { params: { days } }),
      ]);
      setEfficiency(effRes.data);
      setComparison(compRes.data);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  const handleExportExcel = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    window.open(`${api.defaults.baseURL}/reports/export/excel?start_date=${startStr}&end_date=${endStr}`, '_blank');
    message.success(t('pages.statistics.downloadingExcel'));
  };

  const handleExportCSV = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    window.open(`${api.defaults.baseURL}/reports/export/csv?start_date=${startStr}&end_date=${endStr}`, '_blank');
    message.success(t('pages.statistics.downloadingCsv'));
  };

  const handleExportChart = (ref: React.RefObject<ReactEChartsCore | null>, name: string) => {
    const instance = ref.current?.getEchartsInstance();
    if (instance) {
      const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.png`;
      a.click();
      message.success(t('pages.statistics.chartExported', { name }));
    }
  };

  const toolbox = {
    show: true,
    feature: { saveAsImage: { title: t('pages.statistics.saveImage'), pixelRatio: 2 } },
  };

  const productionOption = {
    title: { text: t('pages.statistics.productionTrend'), left: 'center' },
    tooltip: { trigger: 'axis' as const },
    toolbox,
    xAxis: { type: 'category' as const, data: efficiency.map((e) => e.date) },
    yAxis: { type: 'value' as const },
    series: [
      { name: t('pages.statistics.production'), type: 'bar', data: efficiency.map((e) => e.total_count), itemStyle: { color: '#1890ff' } },
    ],
  };

  const yieldOption = {
    title: { text: t('pages.statistics.yieldTrend'), left: 'center' },
    tooltip: { trigger: 'axis' as const },
    toolbox,
    xAxis: { type: 'category' as const, data: efficiency.map((e) => e.date) },
    yAxis: { type: 'value' as const, min: 80, max: 100 },
    series: [
      { name: t('pages.statistics.yieldRate'), type: 'line', data: efficiency.map((e) => e.yield_rate), itemStyle: { color: '#52c41a' }, areaStyle: { opacity: 0.2 } },
    ],
  };

  const cycleTimeOption = {
    title: { text: t('pages.statistics.cycleTimeTrend'), left: 'center' },
    tooltip: { trigger: 'axis' as const },
    toolbox,
    xAxis: { type: 'category' as const, data: efficiency.map((e) => e.date) },
    yAxis: { type: 'value' as const, name: t('pages.statistics.seconds') },
    series: [
      { name: t('pages.statistics.cycleTime'), type: 'line', data: efficiency.map((e) => e.avg_cycle_time), smooth: true, itemStyle: { color: '#faad14' } },
    ],
  };

  const comp = comparison?.comparison;

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select value={days} onChange={setDays} style={{ width: 120 }}>
          <Select.Option value={7}>{t('pages.statistics.last7days')}</Select.Option>
          <Select.Option value={14}>{t('pages.statistics.last14days')}</Select.Option>
          <Select.Option value={30}>{t('pages.statistics.last30days')}</Select.Option>
        </Select>
        <Button icon={<DownloadOutlined />} type="primary" onClick={handleExportExcel}>{t('pages.statistics.exportExcel')}</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>{t('pages.statistics.exportCsv')}</Button>
        <Button onClick={() => handleExportChart(chartRef1, t('pages.statistics.productionTrend'))}>{t('pages.statistics.exportProductionChart')}</Button>
        <Button onClick={() => handleExportChart(chartRef2, t('pages.statistics.yieldTrend'))}>{t('pages.statistics.exportYieldChart')}</Button>
        <Button onClick={() => handleExportChart(chartRef3, t('pages.statistics.cycleTime'))}>{t('pages.statistics.exportCycleChart')}</Button>
      </Space>

      {comp && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.statistics.productionChange')}
                value={comp.total_production?.change_percent ?? 0}
                precision={1}
                suffix="%"
                prefix={comp.total_production?.change_percent >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                styles={{ content: { color: comp.total_production?.change_percent >= 0 ? '#3f8600' : '#cf1322', fontSize: 20 } }}
              />
              <div style={{ color: '#999', fontSize: 12 }}>
                {t('pages.statistics.currentPeriod')} {comp.total_production?.current} / {t('pages.statistics.previousPeriod')} {comp.total_production?.previous}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.statistics.yieldChange')}
                value={comp.yield_rate?.change_percent ?? 0}
                precision={2}
                suffix="%"
                prefix={comp.yield_rate?.change_percent >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                styles={{ content: { color: comp.yield_rate?.change_percent >= 0 ? '#3f8600' : '#cf1322', fontSize: 20 } }}
              />
              <div style={{ color: '#999', fontSize: 12 }}>
                {t('pages.statistics.currentPeriod')} {comp.yield_rate?.current}% / {t('pages.statistics.previousPeriod')} {comp.yield_rate?.previous}%
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.statistics.defectChange')}
                value={comp.total_defects?.change_percent ?? 0}
                precision={1}
                suffix="%"
                prefix={comp.total_defects?.change_percent <= 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
                styles={{ content: { color: comp.total_defects?.change_percent <= 0 ? '#3f8600' : '#cf1322', fontSize: 20 } }}
              />
              <div style={{ color: '#999', fontSize: 12 }}>
                {t('pages.statistics.currentPeriod')} {comp.total_defects?.current} / {t('pages.statistics.previousPeriod')} {comp.total_defects?.previous}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('pages.statistics.cycleTimeChange')}
                value={comp.avg_cycle_time?.change_percent ?? 0}
                precision={1}
                suffix="%"
                prefix={comp.avg_cycle_time?.change_percent <= 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
                styles={{ content: { color: comp.avg_cycle_time?.change_percent <= 0 ? '#3f8600' : '#cf1322', fontSize: 20 } }}
              />
              <div style={{ color: '#999', fontSize: 12 }}>
                {t('pages.statistics.currentPeriod')} {comp.avg_cycle_time?.current}s / {t('pages.statistics.previousPeriod')} {comp.avg_cycle_time?.previous}s
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card><ReactEChartsCore echarts={echarts} ref={chartRef1} option={productionOption} style={{ height: 300 }} /></Card>
        </Col>
        <Col span={12}>
          <Card><ReactEChartsCore echarts={echarts} ref={chartRef2} option={yieldOption} style={{ height: 300 }} /></Card>
        </Col>
        <Col span={12}>
          <Card><ReactEChartsCore echarts={echarts} ref={chartRef3} option={cycleTimeOption} style={{ height: 300 }} /></Card>
        </Col>
      </Row>
    </div>
  );
};

export default Statistics;
