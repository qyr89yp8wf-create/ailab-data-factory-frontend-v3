import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Flex, Progress, Row, Skeleton,
  Space, Statistic, Table, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, FileTextOutlined,
  PrinterOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { conversationApi } from './conversationApi';

const { Title, Text, Paragraph } = Typography;
const percent = value => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : '-';
const PRIVACY_ROWS = [
  {key:'identity',types:'姓名、手机号、身份证号',mask:'合成代号或部分保留＋*'},
  {key:'contact',types:'地址、邮箱、车牌号',mask:'保留必要区域，其余使用 *'},
  {key:'business',types:'真实运单号、客户编号、企业内部账号',mask:'替换为合成业务标识'},
  {key:'secret',types:'API Key、Token、密码等凭证',mask:'[REDACTED_SECRET]，并判为 REJECT'},
];

function StatusCard({ status, count, total }) {
  const meta = {
    PASS: ['success', '可训练'], REVIEW: ['warning', '待人工复核'], REJECT: ['error', '不进入训练集'],
  }[status];
  return <Card className={`conversation-report-status status-${status.toLowerCase()}`}>
    <Flex justify="space-between" align="center"><div><Text type="secondary">{meta[1]}</Text><Title level={3}>{status}</Title></div><Statistic value={count || 0} suffix={`/ ${total || 0}`}/></Flex>
    <Progress percent={total ? Math.round((count || 0) / total * 100) : 0} showInfo={false} status={status === 'REJECT' ? 'exception' : status === 'PASS' ? 'success' : 'normal'}/>
  </Card>;
}

export function ConversationQualityReportPage({ jobId }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    conversationApi.getJob(jobId).then(value => { if (active) setJob(value); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [jobId]);

  const result = job?.result || {};
  const initial = result.initial_quality || {};
  const final = result.final_quality || {};
  const counts = final.status_counts || {};
  const total = final.sample_count || 0;
  const profileRows = useMemo(() => {
    const keys = new Set([...Object.keys(initial.profile_pass_counts || {}), ...Object.keys(final.profile_pass_counts || {})]);
    return [...keys].sort().map(profile => ({ key: profile, profile, before: initial.profile_pass_counts?.[profile] || 0, after: final.profile_pass_counts?.[profile] || 0 }));
  }, [initial, final]);
  const artifacts = result.artifact_urls || {};

  if (error) return <main className="quality-report-page"><Alert type="error" showIcon message="无法打开智能客服质检报告" description={error}/><Button className="section-title" href="/" icon={<ArrowLeftOutlined/>}>返回产品</Button></main>;
  if (!job) return <main className="quality-report-page"><Skeleton active paragraph={{ rows: 12 }}/></main>;

  return <main className="quality-report-page">
    <Flex className="quality-report-toolbar" justify="space-between" align="center" wrap="wrap" gap={12}>
      <Button href="/" icon={<ArrowLeftOutlined/>}>返回产品</Button>
      <Space wrap>
        {artifacts.final_quality_report && <Button href={artifacts.final_quality_report} target="_blank" icon={<FileTextOutlined/>}>查看终检 MD</Button>}
        {artifacts.quality_comparison && <Button href={artifacts.quality_comparison} download icon={<DownloadOutlined/>}>下载前后对比</Button>}
        <Button onClick={() => window.print()} icon={<PrinterOutlined/>}>打印报告</Button>
      </Space>
    </Flex>

    <section className="quality-report-hero conversation-report-hero">
      <Space><SafetyCertificateOutlined/><Text>事实/状态/工具/证据校验 · 隐私脱敏 · 语义质检 · 覆盖驱动扩增</Text></Space>
      <Title>智能客服对话质检与扩增报告</Title>
      <Paragraph>任务 {job.id} · 场景 {result.scenario_name} · Provider {result.generation?.provider}</Paragraph>
      <Alert type="success" showIcon icon={<CheckCircleOutlined/>} message="完整链路已完成" description={`初始 ${result.generation?.initial_count || 0} 条，定向扩增后 ${result.generation?.final_count || 0} 条；最终 ${result.delivery?.pass || 0} 条进入训练集。`}/>
    </section>

    <Row gutter={[16, 16]} className="quality-report-status-row">
      {['PASS', 'REVIEW', 'REJECT'].map(status => <Col span={8} key={status}><StatusCard status={status} count={counts[status]} total={total}/></Col>)}
    </Row>

    <Card className="quality-report-section" title="核心质量指标" extra={<Tag color="success">平均分 {final.average_score || 0}</Tag>}>
      <Row gutter={[12, 12]}>
        <Col span={6}><Statistic title="Schema 合法率" value={percent(final.schema_valid_rate)}/></Col>
        <Col span={6}><Statistic title="状态转移合法率" value={percent(final.state_legal_rate)}/></Col>
        <Col span={6}><Statistic title="工具调用准确率" value={percent(final.tool_accuracy_rate)}/></Col>
        <Col span={6}><Statistic title="证据可解析率" value={percent(final.evidence_resolvable_rate)}/></Col>
      </Row>
    </Card>

    <Card className="quality-report-section" title="隐私检查与自动脱敏" extra={<Tag color={Number(final.privacy_risk_count||0)?'error':'success'}>{Number(final.privacy_risk_count||0)?'存在残留风险':'PASS'}</Tag>}>
      <Row gutter={[12,12]}>
        <Col span={8}><Statistic title="初检隐私风险" value={Number(initial.privacy_risk_count||0)} suffix="项"/></Col>
        <Col span={8}><Statistic title="自动脱敏" value={Number(result.privacy?.masked_count||0)} suffix="项"/></Col>
        <Col span={8}><Statistic title="复检残留风险" value={Number(final.privacy_risk_count||0)} suffix="项"/></Col>
      </Row>
      <Table className="section-title" pagination={false} size="small" rowKey="key" dataSource={PRIVACY_ROWS} columns={[{title:'检查项目',dataIndex:'types'},{title:'系统默认掩码',dataIndex:'mask'},{title:'结果',render:()=>Number(final.privacy_risk_count||0)?'存在残留风险':'未检出残留风险'}]}/>
    </Card>

    <Row gutter={[16, 16]}>
      <Col span={14}><Card className="quality-report-section" title="场景覆盖前后对比"><Table pagination={false} size="small" dataSource={profileRows} columns={[
        { title:'Profile', dataIndex:'profile', render:value => <Tag color="geekblue">{value}</Tag> },
        { title:'初检 PASS', dataIndex:'before', align:'right' },
        { title:'复检 PASS', dataIndex:'after', align:'right' },
        { title:'变化', render:(_, row) => <Text type={row.after > row.before ? 'success' : 'secondary'}>{row.after - row.before >= 0 ? '+' : ''}{row.after - row.before}</Text>, align:'right' },
      ]}/></Card></Col>
      <Col span={10}><Card className="quality-report-section" title="任务与血缘"><Descriptions column={1} size="small" items={[
        { key:'snapshot', label:'知识快照', children:result.knowledge?.snapshot_id },
        { key:'rules', label:'规则卡', children:`${result.knowledge?.rule_card_count || 0} 张` },
        { key:'facts', label:'初始事实/状态机', children:`${result.planning?.fact_count || 0} 条` },
        { key:'expansion', label:'实际新增', children:`${result.expansion_plan?.recommended_new || 0} 条` },
        { key:'calls', label:'付费模型调用', children:`${result.usage?.calls || 0} 次` },
      ]}/></Card></Col>
    </Row>

    <Card className="quality-report-section" title="质检驱动扩增计划">
      <Table pagination={false} rowKey="profile" dataSource={result.expansion_plan?.items || []} columns={[
        { title:'Profile', dataIndex:'profile', render:value => <Tag color="blue">{value}</Tag> },
        { title:'初检 PASS', dataIndex:'current_pass', align:'right' },
        { title:'目标', dataIndex:'target', align:'right' },
        { title:'新增', dataIndex:'recommended', align:'right' },
        { title:'依据', dataIndex:'reason' },
      ]}/>
    </Card>

    <Divider orientation="left">报告文件</Divider>
    <Space wrap>
      {artifacts.initial_quality_report && <Button href={artifacts.initial_quality_report} target="_blank">初次质检 MD</Button>}
      {artifacts.final_quality_report && <Button href={artifacts.final_quality_report} target="_blank">扩增后质检 MD</Button>}
      {artifacts.quality_comparison && <Button href={artifacts.quality_comparison} target="_blank">前后对比 MD</Button>}
      {artifacts.train_pass && <Button type="primary" href={artifacts.train_pass} download>下载 PASS JSONL</Button>}
      {artifacts.review && <Button href={artifacts.review} download>下载 REVIEW JSONL</Button>}
      {artifacts.manifest && <Button href={artifacts.manifest} target="_blank">查看 manifest</Button>}
    </Space>
  </main>;
}
