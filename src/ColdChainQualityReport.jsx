import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Empty, Flex, Progress, Row, Skeleton,
  Space, Statistic, Table, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, PrinterOutlined,
  SafetyCertificateOutlined, WarningOutlined,
} from '@ant-design/icons';
import { coldchainApi } from './coldchainApi';

const { Title, Text, Paragraph } = Typography;
const DIMENSION_LABELS = {
  contract:'字段契约', temporal:'时间连续性', physical:'温湿度物理规则',
  geospatial:'GPS 与运输阶段', ground_truth:'事件与 Ground Truth', privacy:'隐私契约',
  template_rules:'模板字段规则',coverage_labels:'覆盖标签一致性',
};
const EVENT_LABELS = {
  normal:'正常运输', power_off_short:'短时断电', door_open:'开门',
  initial_warm_load:'初始暖货', blocked_airflow:'风道受阻',
  cooling_degradation:'制冷衰减', sensor_bias:'传感器偏差', vessel_delay:'船期延误',
};
const COVERAGE_VALUE_LABELS={
  ...EVENT_LABELS,none:'无异常阶段',origin_pretrip:'起运前检查',origin_road:'起运公路',origin_terminal:'起运港区',ocean:'海运',destination_terminal:'目的港区',destination_road:'目的地公路',delivered:'交付',
  stable:'稳定',recovery:'断电后恢复',transient_warming:'短时升温',cooldown:'逐步降温',slow_warming:'缓慢升温',slow_drift:'缓慢漂移',level_shift:'测量偏移',extended_duration:'运输时长延长',
};
const coverageLabel=value=>COVERAGE_VALUE_LABELS[value]||value;

function StatusCard({ status, count, total }) {
  const meta={PASS:['#52c41a','通过'],REVIEW:['#faad14','待复核/低质'],REJECT:['#ff4d4f','不通过/低质']}[status];
  return <Card className={`quality-status-card status-${status.toLowerCase()}`}><Flex justify="space-between" align="center"><div><Text type="secondary">{meta[1]}</Text><Title level={3}>{status}</Title></div><Statistic value={count||0} suffix={`/ ${total||0}`} valueStyle={{color:meta[0]}}/></Flex><Progress percent={total?Math.round((count||0)/total*100):0} showInfo={false} strokeColor={meta[0]}/></Card>;
}

function BarChart({ rows, suffix='' }) {
  const maximum=Math.max(1,...rows.map(item=>Number(item.value)||0));
  return <div className="coldchain-report-bars">{rows.map(item=><div className="coldchain-report-bar-row" key={item.key}><Text className="coldchain-report-bar-label">{item.label}</Text><div className="coldchain-report-bar-track"><div className="coldchain-report-bar-fill" style={{width:`${Math.max(2,(Number(item.value)||0)/maximum*100)}%`,background:item.color||'#1677ff'}}/></div><Text className="coldchain-report-bar-value">{item.value}{suffix}</Text></div>)}</div>;
}

export function ColdChainQualityReportPage({ jobId }) {
  const [job,setJob]=useState(null); const [report,setReport]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{let active=true;coldchainApi.getJob(jobId).then(async value=>{if(!value.result?.quality_report_data_url)throw new Error('该任务未启用质检，或尚未生成报告');const response=await fetch(value.result.quality_report_data_url);if(!response.ok)throw new Error(`报告数据读取失败：HTTP ${response.status}`);const data=await response.json();if(active){setJob(value);setReport(data);}}).catch(reason=>{if(active)setError(reason.message||'质检报告加载失败');});return()=>{active=false;};},[jobId]);
  const initial=report?.initial||{}; const final=report?.final||{}; const plan=report?.expansion_plan||{}; const counts=final.status_counts||{}; const total=final.shipment_count||0;
  const verdict=counts.REJECT?'REJECT':counts.REVIEW||final.coverage?.met===false?'REVIEW':'PASS';
  const dimensionRows=useMemo(()=>{const shipments=final.shipments||[];return Object.keys(DIMENSION_LABELS).map(key=>({key,label:DIMENSION_LABELS[key],value:shipments.length?Math.round(shipments.reduce((sum,item)=>sum+Number(item.dimension_scores?.[key]||0),0)/shipments.length):0}));},[final.shipments]);
  const coverageTableRows=(final.coverage?.rows||[]).map(item=>({...item,key:`${item.dimension_id}-${item.label}`}));
  const coverageRows=coverageTableRows.map(item=>({key:item.key,label:`${item.dimension_name} / ${coverageLabel(item.label)}`,value:item.pass_count}));
  const shipmentRows=(final.shipments||[]).map(item=>({...item,key:item.shipment_id,topFinding:item.findings?.[0]?.message||'-'}));
  if(error)return <main className="quality-report-page"><Alert type="error" showIcon message="无法打开冷链质检报告" description={error}/><Button className="section-title" href="/" icon={<ArrowLeftOutlined/>}>返回产品</Button></main>;
  if(!job||!report)return <main className="quality-report-page"><Skeleton active paragraph={{rows:14}}/></main>;
  return <main className="quality-report-page">
    <Flex className="quality-report-toolbar" justify="space-between" align="center" wrap="wrap" gap={12}><Button href="/" icon={<ArrowLeftOutlined/>}>返回产品</Button><Space><Button href={job.result.initial_report_url} target="_blank" icon={<DownloadOutlined/>}>下载 MD 报告</Button><Button onClick={()=>window.print()} icon={<PrinterOutlined/>}>打印报告</Button></Space></Flex>
    <section className="quality-report-hero"><Space><SafetyCertificateOutlined/><Text>规则引擎 · 物理边界 · GPS/阶段 · Ground Truth · 覆盖标签 · 公共隐私引擎</Text></Space><Title>冷藏集装箱国际运输时序质检报告</Title><Paragraph>任务 {job.id} · 温度统一采用摄氏度（degC）· REVIEW/REJECT 均作为低质样本</Paragraph><Alert type={verdict==='PASS'?'success':verdict==='REJECT'?'error':'warning'} showIcon icon={verdict==='PASS'?<CheckCircleOutlined/>:<WarningOutlined/>} message={`最终结论：${verdict}`} description={`最终 ${total} 票，低质 ${final.low_quality_count||0} 票；标签覆盖目标${final.coverage?.met?'已满足':'仍有缺口'}；扩增${report.expansion_enabled?'已开启':'未开启'}。`}/></section>
    <Row gutter={[16,16]} className="quality-report-status-row">{['PASS','REVIEW','REJECT'].map(status=><Col span={8} key={status}><StatusCard status={status} count={counts[status]} total={total}/></Col>)}</Row>
    <Row gutter={[16,16]} className="quality-report-section">
      <Col span={6}><Card><Statistic title="平均质量分" value={final.average_score||0} suffix="/100"/></Card></Col>
      <Col span={6}><Card><Statistic title="PASS标签覆盖率" value={final.coverage_score==null?'未启用':final.coverage_score} suffix={final.coverage_score==null?'':'%'}/></Card></Col>
      <Col span={6}><Card><Statistic title="低质样本" value={final.low_quality_count||0} suffix="票"/></Card></Col>
      <Col span={6}><Card><Statistic title="定向新增" value={plan.recommended_new||0} suffix="票"/></Card></Col>
    </Row>
    <Row gutter={[16,16]}>
      <Col span={12}><Card className="quality-report-section" title="各维度平均得分" extra={<Text type="secondary">越接近 100 越好</Text>}><BarChart rows={dimensionRows} suffix=""/></Card></Col>
      <Col span={12}><Card className="quality-report-section" title="各标签PASS覆盖" extra={<Text type="secondary">REVIEW/REJECT不计入覆盖</Text>}><BarChart rows={coverageRows} suffix=" 票"/></Card></Col>
    </Row>
    <Card className="quality-report-section" title="模板标签覆盖目标" extra={<Tag color={final.coverage?.met?'success':'warning'}>{final.coverage?.met?'已满足':'存在有效缺口'}</Tag>}><Alert type="info" showIcon message="有效缺口 = 模板目标数量 − PASS样本数" description="质检不通过的样本已经从PASS覆盖中扣除，不会再单独重复计算扩增数量。"/><Table className="section-title" size="small" pagination={false} rowKey="key" dataSource={coverageTableRows} columns={[
      {title:'维度',dataIndex:'dimension_name'},{title:'标签',dataIndex:'label',render:coverageLabel},{title:'目标',dataIndex:'target_count'},{title:'已生成',dataIndex:'generated_count'},{title:'PASS',dataIndex:'pass_count'},{title:'REVIEW',dataIndex:'review_count'},{title:'REJECT',dataIndex:'reject_count'},{title:'有效缺口',dataIndex:'effective_gap',render:value=><Tag color={value?'warning':'success'}>{value}</Tag>},{title:'覆盖率',dataIndex:'coverage_rate',render:value=>`${Math.round(Number(value||0)*10000)/100}%`},
    ]}/></Card>
    <Card className="quality-report-section" title="单位与字段契约" extra={<Tag color="success">已明确</Tag>}><Descriptions bordered size="small" column={3} items={[
      {key:'temp',label:'温度单位',children:'摄氏度（°C），字段后缀 _c，temperature_unit=degC'},
      {key:'interval',label:'采样间隔',children:`sample_interval_minutes=${final.units?.sample_interval_minutes||60} 表示每 ${final.units?.sample_interval_minutes||60} 分钟采样`},
      {key:'humidity',label:'湿度单位',children:'relative_humidity_pct 为 %RH'},
    ]}/><Alert className="section-title" type="info" showIcon message="CSV 中紧邻集装箱号的 60 是采样间隔，不是温度，也不是华氏度。所有温度列都有 _c 后缀。"/></Card>
    <Card className="quality-report-section" title="隐私质检" extra={<Tag color={final.privacy?.failed_sample_count?'error':'success'}>{report.privacy_check_enabled?'已检查':'未启用'}</Tag>}><Descriptions bordered size="small" column={4} items={[
      {key:'engine',label:'公共引擎',children:final.privacy?.engine||'privacy_engine/qc.py'},
      {key:'checked',label:'检查票数',children:final.privacy?.checked_sample_count||0},
      {key:'failed',label:'失败票数',children:final.privacy?.failed_sample_count||0},
      {key:'status',label:'结果分布',children:Object.entries(final.privacy?.status_counts||{}).map(([key,value])=><Tag key={key}>{key} · {value}</Tag>)},
    ]}/></Card>
    <Card className="quality-report-section" title="质检驱动定向扩增计划" extra={<Tag color={plan.enabled?'processing':'default'}>{plan.enabled?`实际新增 ${plan.recommended_new||0} 票`:'未开启'}</Tag>}><Descriptions bordered size="small" column={3} items={[
      {key:'max',label:'用户设置最大数量',children:`${plan.requested_max_new||0} 票`},
      {key:'low',label:'首轮低质样本',children:`${plan.low_quality_source_count||0} 票`},
      {key:'targets',label:'目标事件',children:(plan.target_events||[]).length?(plan.target_events||[]).map((item,index)=><Tag key={`${item}-${index}`}>{EVENT_LABELS[item]||item}</Tag>):'无'},
    ]}/><Alert className="section-title" type="info" showIcon message={plan.source_policy||'低质原样本只标记、不返工、不作为复制源。'} description={plan.reason}/></Card>
    {!!plan.items?.length&&<Card className="quality-report-section" title="按标签组合的扩增缺口"><Table size="small" pagination={false} rowKey="profile_id" dataSource={plan.items} columns={[
      {title:'标签组合',dataIndex:'profile_name'},{title:'目标PASS',dataIndex:'target'},{title:'当前PASS',dataIndex:'current_pass'},{title:'建议新增',dataIndex:'recommended'},{title:'标签',dataIndex:'labels',render:labels=><Space wrap>{Object.entries(labels||{}).map(([key,value])=><Tag key={key}>{key}：{coverageLabel(value)}</Tag>)}</Space>},
    ]}/></Card>}
    <Card className="quality-report-section" title="逐票结果"><Table size="small" rowKey="shipment_id" pagination={false} dataSource={shipmentRows} locale={{emptyText:<Empty description="没有逐票结果"/>}} columns={[
      {title:'票号',dataIndex:'shipment_id',render:value=><code>{value}</code>},
      {title:'结论',dataIndex:'status',width:100,render:value=><Tag color={value==='PASS'?'success':value==='REVIEW'?'warning':'error'}>{value}</Tag>},
      {title:'质量分',dataIndex:'score',width:90},
      {title:'低质',dataIndex:'low_quality',width:80,render:value=>value?<Tag color="error">是</Tag>:<Tag color="success">否</Tag>},
      {title:'覆盖标签',dataIndex:'coverage_labels',render:labels=><Space wrap>{Object.values(labels||{}).map(value=><Tag key={value}>{coverageLabel(value)}</Tag>)}</Space>},
      {title:'主要发现',dataIndex:'topFinding'},
    ]}/></Card>
  </main>;
}
