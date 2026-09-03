import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Empty, Flex, Progress, Row,
  Skeleton, Space, Statistic, Table, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, FileTextOutlined,
  PrinterOutlined, SafetyCertificateOutlined, WarningOutlined,
} from '@ant-design/icons';
import { customsApi } from './customsApi';

const { Title, Text, Paragraph } = Typography;

const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';
const percent = value => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : '-';

function splitCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function isDividerRow(line) {
  return splitCells(line).every(cell => /^:?-{3,}:?$/.test(cell));
}

function inline(value) {
  const parts = String(value).split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function parseMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const document = { title: '进口报关单质检报告', intro: [], sections: [] };
  let section = { title: '报告概览', blocks: [] };
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    section.blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushSection = () => {
    flushParagraph();
    if (section.blocks.length) document.sections.push(section);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('# ')) {
      document.title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      flushSection();
      section = { title: line.slice(3).trim(), blocks: [] };
      continue;
    }
    if (!line) {
      flushParagraph();
      continue;
    }
    if (line.startsWith('|') && lines[index + 1]?.trim().startsWith('|') && isDividerRow(lines[index + 1])) {
      flushParagraph();
      const headers = splitCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitCells(lines[index]));
        index += 1;
      }
      index -= 1;
      section.blocks.push({ type: 'table', headers, rows });
      continue;
    }
    if (/^-\s+/.test(line)) {
      flushParagraph();
      const items = [line.replace(/^-\s+/, '')];
      while (index + 1 < lines.length && /^-\s+/.test(lines[index + 1].trim())) {
        items.push(lines[index + 1].trim().replace(/^-\s+/, ''));
        index += 1;
      }
      section.blocks.push({ type: 'list', items });
      continue;
    }
    paragraph.push(line);
  }
  flushSection();
  return document;
}

function MarkdownBlock({ block }) {
  if (block.type === 'table') return <div className="quality-markdown-table-wrap"><table className="quality-markdown-table"><thead><tr>{block.headers.map((header, index) => <th key={index}>{inline(header)}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.headers.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || '')}</td>)}</tr>)}</tbody></table></div>;
  if (block.type === 'list') return <ul className="quality-markdown-list">{block.items.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>;
  return <Paragraph className="quality-markdown-paragraph">{inline(block.text)}</Paragraph>;
}

function StatusCard({ status, count, total }) {
  const meta = {
    PASS: ['#52c41a', '通过'], REVIEW: ['#faad14', '待复核'], REJECT: ['#ff4d4f', '不通过'],
  }[status];
  return <Card className={`quality-status-card status-${status.toLowerCase()}`}>
    <Flex justify="space-between" align="center"><div><Text type="secondary">{meta[1]}</Text><Title level={3}>{status}</Title></div><Statistic value={count || 0} suffix={`/ ${total || 0}`} valueStyle={{ color: meta[0] }}/></Flex>
    <Progress percent={total ? Math.round((count || 0) / total * 100) : 0} showInfo={false} strokeColor={meta[0]}/>
  </Card>;
}

function MetricCard({ label, value, display, threshold, passed, observation = false }) {
  return <Card size="small" className="quality-metric-card">
    <Flex justify="space-between" align="start"><Text type="secondary">{label}</Text>{observation ? <Tag>观察项</Tag> : <Tag color={passed ? 'success' : 'warning'}>{passed ? '达标' : '需关注'}</Tag>}</Flex>
    <Title level={3}>{display(value)}</Title>
    <Text type="secondary">参考阈值：{threshold}</Text>
  </Card>;
}

export function CustomsQualityReportPage({ jobId }) {
  const [job, setJob] = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    customsApi.getJob(jobId).then(async value => {
      if (!value.result?.quality_report_url) throw new Error('该任务尚未生成质检报告');
      const content = await customsApi.getText(value.result.quality_report_url);
      if (active) { setJob(value); setMarkdown(content); }
    }).catch(reason => { if (active) setError(reason.message || '质检报告加载失败'); });
    return () => { active = false; };
  }, [jobId]);

  const parsed = useMemo(() => parseMarkdown(markdown), [markdown]);
  const qc = job?.result?.qc_summary;
  const status = qc?.status_counts || {};
  const total = qc?.sample_count || 0;
  const metrics = qc?.ocr_averages || {};
  const privacy = qc?.privacy || {};
  const scene = qc?.scene_composition || {};
  const readability = qc?.readability || {};
  const expansion = job?.result?.expansion_plan;
  const dominantStatus = status.REJECT ? 'REJECT' : status.REVIEW ? 'REVIEW' : status.PASS ? 'PASS' : '未判定';
  const verdictMeta = dominantStatus === 'PASS'
    ? { type: 'success', icon: <CheckCircleOutlined/>, text: '本批次通过自动质检' }
    : dominantStatus === 'REJECT'
      ? { type: 'error', icon: <WarningOutlined/>, text: '本批次存在不通过样本' }
      : { type: 'warning', icon: <WarningOutlined/>, text: '本批次存在需要复核的样本' };

  if (error) return <main className="quality-report-page"><Alert type="error" showIcon message="无法打开质检报告" description={error}/><Button className="section-title" href="/" icon={<ArrowLeftOutlined/>}>返回产品</Button></main>;
  if (!job) return <main className="quality-report-page"><Skeleton active paragraph={{ rows: 12 }}/></main>;

  return <main className="quality-report-page">
    <Flex className="quality-report-toolbar" justify="space-between" align="center" wrap="wrap" gap={12}>
      <Button href="/" icon={<ArrowLeftOutlined/>}>返回产品</Button>
      <Space wrap>
        <Button href={job.result.quality_report_url} target="_blank" icon={<FileTextOutlined/>}>查看原始 MD</Button>
        <Button href={job.result.quality_report_url} download icon={<DownloadOutlined/>}>下载 MD</Button>
        <Button onClick={() => window.print()} icon={<PrinterOutlined/>}>打印报告</Button>
      </Space>
    </Flex>

    <section className="quality-report-hero">
      <Space><SafetyCertificateOutlined/><Text>PP-OCRv5 · 隐私检查 · 本地自动质检</Text></Space>
      <Title>{parsed.title}</Title>
      <Paragraph>任务 {job.id} · 阈值版本 {qc?.threshold_version || '-'} · {qc?.models?.detection || '检测模型'} + {qc?.models?.recognition || '识别模型'}</Paragraph>
      <Alert type={verdictMeta.type} showIcon icon={verdictMeta.icon} message={verdictMeta.text} description={`综合判定：${dominantStatus}；报告耗时 ${number(qc?.elapsed_seconds)} 秒。`}/>
    </section>

    <Row gutter={[16, 16]} className="quality-report-status-row">
      {['PASS', 'REVIEW', 'REJECT'].map(item => <Col span={8} key={item}><StatusCard status={item} count={status[item]} total={total}/></Col>)}
    </Row>

    <Alert
      className="quality-report-section"
      type={qc?.low_quality_count ? 'warning' : 'success'}
      showIcon
      message={`低质样本 ${qc?.low_quality_count || 0} / ${total}`}
      description="任一 OCR、隐私、图片或几何质检项未通过都标记为低质。低质原样本不返工、不作为扩增源，扩增阶段重新生成独立样本补量。"
    />

    <Card className="quality-report-section" title="隐私检查" extra={<Tag color={privacy.failed_sample_count ? 'error' : 'success'}>{privacy.failed_sample_count ? '存在失败' : '通过'}</Tag>}>
      <Descriptions bordered size="small" column={4} items={[
        { key: 'engine', label: '公共引擎', children: privacy.engine || 'privacy_engine/v1' },
        { key: 'enabled', label: '启用保护样本', children: privacy.enabled_sample_count ?? 0 },
        { key: 'failed', label: '隐私失败样本', children: privacy.failed_sample_count ?? 0 },
        { key: 'status', label: '检查分布', children: Object.entries(privacy.status_counts || {}).map(([key, value]) => <Tag key={key}>{key} · {value}</Tag>) },
      ]}/>
    </Card>

    <Card className="quality-report-section" title="扩散成品配置" extra={<Tag color={readability.affected_sample_count ? 'warning' : 'success'}>{readability.affected_sample_count ? '建议调整' : '清晰度建议通过'}</Tag>}>
      <Descriptions bordered size="small" column={3} items={[
        { key: 'final', label: '正式成品尺寸', children: Object.entries(scene.formal_output_size_counts || {}).map(([key, value]) => <Tag color="blue" key={key}>{key} · {value}</Tag>) },
        { key: 'background', label: '背景原始尺寸', children: Object.entries(scene.background_source_size_counts || {}).map(([key, value]) => <Tag key={key}>{key} · {value}</Tag>) },
        { key: 'scale', label: '原始内容线性占比', children: Object.entries(scene.document_content_scale_counts || {}).map(([key, value]) => <Tag color="geekblue" key={key}>{`${Math.round(Number(key) * 100)}% · ${value}`}</Tag>) },
        { key: 'p10', label: '字段高度P10最低值', children: `${number(qc?.geometry_summary?.min_field_height_p10_px)} px（建议≥16px）` },
        { key: 'median', label: '字段高度中位数最低值', children: `${number(qc?.geometry_summary?.min_field_height_median_px)} px（建议≥20px）` },
        { key: 'quad', label: '四角越界失败', children: qc?.geometry_summary?.document_quad_failed_count ?? 0 },
      ]}/>
      {readability.affected_sample_count > 0 && <Alert className="section-title" type="warning" showIcon message={`${readability.affected_sample_count} 张图片存在清晰度建议`} description="建议提高正式输出分辨率或原始内容占比。字段高度是建议指标，不会单独改变 PASS / REVIEW / REJECT。"/>}
    </Card>

    <Card className="quality-report-section" title="核心识别指标" extra={<Text type="secondary">指标由 Ground Truth 与 OCR 结果逐字段比对</Text>}>
      <Row gutter={[12, 12]}>
        <Col span={8}><MetricCard label="CER" value={metrics.cer} display={v => number(v, 4)} threshold="≤ 0.10" passed={metrics.cer <= .1}/></Col>
        <Col span={8}><MetricCard label="字段完全一致率" value={metrics.field_exact_rate} display={percent} threshold="≥ 80%" passed={metrics.field_exact_rate >= .8}/></Col>
        <Col span={8}><MetricCard label="数字代码准确率" value={metrics.numeric_code_accuracy} display={percent} threshold="≥ 95%" passed={metrics.numeric_code_accuracy >= .95}/></Col>
        <Col span={8}><MetricCard label="检测覆盖率" value={metrics.detection_coverage} display={percent} threshold="≥ 90%" passed={metrics.detection_coverage >= .9}/></Col>
        <Col span={8}><MetricCard label="平均识别置信度" value={metrics.mean_recognition_confidence} display={percent} threshold="观察项" observation/></Col>
        <Col span={8}><MetricCard label="低置信字段率" value={metrics.low_confidence_rate} display={percent} threshold="≤ 10%" passed={metrics.low_confidence_rate <= .1}/></Col>
      </Row>
    </Card>

    <Row gutter={[16, 16]}>
      <Col span={12}><Card className="quality-report-section" title="图片与几何质量"><Descriptions column={2} size="small" items={[
        { key: 'grade', label: '图片分档', children: Object.entries(qc?.quality_grade_counts || {}).map(([key, value]) => <Tag color="blue" key={key}>{key} · {value}</Tag>) },
        { key: 'light', label: '平均亮度', children: number(qc?.image_quality_averages?.brightness) },
        { key: 'contrast', label: '平均对比度', children: number(qc?.image_quality_averages?.contrast) },
        { key: 'sharp', label: '平均清晰度', children: number(qc?.image_quality_averages?.sharpness) },
        { key: 'polygon', label: '最低有效 polygon', children: percent(qc?.geometry_summary?.min_valid_polygon_rate) },
        { key: 'bbox', label: '最大几何误差', children: `${number(qc?.geometry_summary?.max_bbox_polygon_error_px, 3)} px` },
        { key: 'rmse', label: '重投影 RMSE', children: `${number(qc?.geometry_summary?.max_reprojection_rmse_px, 6)} px` },
        { key: 'bounds', label: '最大越界比例', children: percent(qc?.geometry_summary?.max_out_of_bounds_rate) },
        { key: 'quad', label: '四角越界失败', children: qc?.geometry_summary?.document_quad_failed_count ?? 0 },
        { key: 'p10', label: '字段高度P10最低值', children: `${number(qc?.geometry_summary?.min_field_height_p10_px)} px` },
        { key: 'median', label: '字段高度中位数最低值', children: `${number(qc?.geometry_summary?.min_field_height_median_px)} px` },
      ]}/></Card></Col>
      <Col span={12}><Card className="quality-report-section" title="高频错误字段"><Table size="small" pagination={false} rowKey="field" dataSource={qc?.top_error_fields || []} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有错误字段"/> }} columns={[
        { title: '字段', dataIndex: 'field', render: value => <code>{value}</code> },
        { title: '错误次数', dataIndex: 'count', width: 100, align: 'right' },
      ]}/></Card></Col>
    </Row>

    <Card className="quality-report-section" title="质检驱动扩增建议" extra={<Tag color={expansion?.blocked ? 'error' : 'processing'}>{expansion?.blocked ? '已阻断' : `建议新增 ${expansion?.recommended_total || 0} 张`}</Tag>}>
      <Table pagination={false} rowKey="profile" dataSource={expansion?.profiles || []} locale={{ emptyText: '本批次没有扩增建议' }} columns={[
        { title: '安全扩增类型', dataIndex: 'profile', width: 220, render: value => <Tag color="geekblue">{value}</Tag> },
        { title: '建议数量', dataIndex: 'count', width: 110, align: 'center' },
        { title: '建议依据', dataIndex: 'reason' },
      ]}/>
      {expansion?.source_policy && <Alert className="section-title" type="info" showIcon message="扩增来源策略" description={expansion.source_policy}/>} 
    </Card>

    <Divider orientation="left">完整报告</Divider>
    {parsed.sections.map((section, index) => <Card className="quality-report-section quality-markdown-section" title={section.title} key={`${section.title}-${index}`}>
      {section.blocks.map((block, blockIndex) => <MarkdownBlock block={block} key={blockIndex}/>)}
    </Card>)}
  </main>;
}
