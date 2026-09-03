import React, { useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Descriptions, Divider, Flex, Form, Image,
  Input, InputNumber, Progress, Row, Select, Space, Spin, Statistic, Steps, Switch, Table, Tag,
  Typography, message,
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, EnvironmentOutlined, ExperimentOutlined,
  PlayCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { coldchainApi } from './coldchainApi';

const { Text, Paragraph, Title } = Typography;

export const COLD_CHAIN_PARAMETER_OPTIONS = [
  { label:'温度设定值', value:'temperature_setpoint' },
  { label:'送风温度', value:'supply_air_temperature' },
  { label:'回风温度', value:'return_air_temperature' },
  { label:'货物温度', value:'cargo_temperature' },
  { label:'环境温度', value:'ambient_temperature' },
  { label:'相对湿度', value:'relative_humidity' },
  { label:'GPS 位置', value:'gps' },
  { label:'供电状态', value:'power_status' },
  { label:'运输阶段与事件', value:'transport_event' },
  { label:'联网状态', value:'network_status' },
];

const PRIVACY_FIELDS = [
  { field:'shipment_id', label:'运输票号', strategies:['synthetic_replace','random_replace'] },
  { field:'container_id', label:'集装箱号', strategies:['synthetic_replace','random_replace','generalize','partial_mask','full_mask','delete'] },
  { field:'route_id', label:'路线标识', strategies:['synthetic_replace','random_replace','generalize','partial_mask','full_mask','delete'] },
];
const STRATEGY_LABELS = {
  synthetic_replace:'虚构替换', random_replace:'随机替换', generalize:'泛化',
  partial_mask:'部分掩码', full_mask:'完全掩码', delete:'删除',
};

function PrivacyFieldEditor({ value={}, onChange }) {
  const strategies=value&&typeof value==='object'?value:{};
  const update=next=>onChange?.(next);
  return <Row gutter={[12,12]}>{PRIVACY_FIELDS.map(item=><Col span={8} key={item.field}><Card size="small" title={item.label} extra={<Checkbox checked={Boolean(strategies[item.field])} onChange={event=>{const next={...strategies};if(event.target.checked)next[item.field]=item.strategies[0];else delete next[item.field];update(next);}}/>}><Select disabled={!strategies[item.field]} value={strategies[item.field]} style={{width:'100%'}} options={item.strategies.map(strategy=>({value:strategy,label:STRATEGY_LABELS[strategy]}))} onChange={strategy=>update({...strategies,[item.field]:strategy})}/></Card></Col>)}</Row>;
}

function CoverageTargetsEditor({ value=[], onChange, count }) {
  const rows=Array.isArray(value)?value:[];
  const update=(index,patch)=>onChange?.(rows.map((item,rowIndex)=>rowIndex===index?{...item,...patch}:item));
  if(!rows.length)return <Alert type="info" showIcon message="当前模板未配置样本标签" description="本次任务不执行标签生成、覆盖率质检和按标签缺口扩增；其它字段、物理和隐私质检仍正常执行。"/>;
  return <><Alert type="info" showIcon message="标签枚举来自模板，本次任务只配置覆盖目标" description="系统默认每个标签权重为 1、最低 PASS 为 1 票。最低 PASS 表示该标签至少要有多少票通过质检；REVIEW 和 REJECT 不计入。"/><Table className="section-title" size="small" pagination={false} rowKey="profile_id" dataSource={rows} columns={[
    {title:'标签',dataIndex:'label',render:value=><Text strong>{value}</Text>},
    {title:'目标权重',render:(_,row,index)=><InputNumber value={row.target_weight} min={0.1} max={1000} style={{width:160}} onChange={target_weight=>update(index,{target_weight})}/>},
    {title:'最低 PASS',render:(_,row,index)=><InputNumber value={row.minimum_pass_count} min={0} max={count} addonAfter="票" style={{width:180}} onChange={minimum_pass_count=>update(index,{minimum_pass_count})}/>},
  ]}/></>;
}

export const COLD_CHAIN_INITIAL_VALUES = {
  coldchainTemplateId:'',
  coldchainTemplateVersion:'',
  coldchainTemplateName:'',
  count:10,
  seed:20260818,
  sampleIntervalMinutes:60,
  modelAlias:'qwen3-14b',
  parameters:COLD_CHAIN_PARAMETER_OPTIONS.map(item=>item.value),
  enableAugmentation:false,
  augmentationMethods:['sensor_jitter','time_shift','planned_missing','gps_noise'],
  augmentationRatio:20,
  augmentationIntensity:'light',
  augmentationMaxNew:5,
  enablePrivacy:false,
  privacyFieldStrategies:{ shipment_id:'synthetic_replace', container_id:'partial_mask' },
  enableQuality:true,
  privacyCheckEnabled:true,
  enableExpansion:false,
  maxExpansionCount:5,
  coverageTargets:[],
};

const statusMeta = {
  queued:['排队中','default'], generating:['生成中','processing'],
  quality_checking:['汇总结果中','processing'], completed:['已完成','success'], failed:['失败','error'],
};
const stageOrder = ['queued','generating','quality_checking','completed'];

export function coldchainStages(values={}) {
  return [
    '生成',
    ...(values.enableAugmentation ? ['增强'] : []),
    ...(values.enablePrivacy ? ['隐私处理'] : []),
    ...(values.enableQuality ? ['质量评估'] : []),
    ...(values.enableQuality && values.enableExpansion ? ['定向扩增'] : []),
  ];
}

function TermGrid({ items }) {
  return <div className="customs-term-grid">{items.map(([title,desc])=><div className="customs-term-item" key={title}><Text strong>{title}</Text><Text type="secondary">{desc}</Text></div>)}</div>;
}

const EVENT_LABELS = {
  normal:'正常运输', power_off_short:'短时断电', door_open:'开门',
  initial_warm_load:'初始热负载', blocked_airflow:'气流受阻',
  cooling_degradation:'制冷能力下降', sensor_bias:'传感器偏移', vessel_delay:'船期延误',
};

export function ColdChainTemplateSelectionFields({ form }) {
  const [templates,setTemplates]=useState([]);
  const [detail,setDetail]=useState(null);
  const [loading,setLoading]=useState(false);
  const templateId=Form.useWatch('coldchainTemplateId',form);
  useEffect(()=>{let active=true;setLoading(true);coldchainApi.listTemplates().then(result=>{
    if(!active)return;const enabled=(result.items||[]).filter(item=>item.status==='enabled'&&Number(item.generation_rule_count||0)>0&&Number(item.quality_rule_count||0)>0);setTemplates(enabled);
    const current=form.getFieldValue('coldchainTemplateId');
    if((!current||!enabled.some(item=>item.template_id===current))&&enabled[0])form.setFieldsValue({coldchainTemplateId:enabled[0].template_id,coldchainTemplateVersion:enabled[0].version});
  }).catch(error=>message.error(`时序模板读取失败：${error.message}`)).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[form]);
  useEffect(()=>{if(!templateId){setDetail(null);return undefined;}let active=true;coldchainApi.getTemplate(templateId).then(value=>{
    if(!active)return;setDetail(value);const config=value.configuration||{};const configuredOptions=(config.fields||[]).filter(item=>item.enabled!==false).map(item=>({value:item.field_id,label:item.label||COLD_CHAIN_PARAMETER_OPTIONS.find(option=>option.value===item.field_id)?.label||item.field_id}));const legacyFields=config.output_schema?.parameters||[];const available=configuredOptions.length?configuredOptions.map(item=>item.value):legacyFields;const availableOptions=configuredOptions.length?configuredOptions:COLD_CHAIN_PARAMETER_OPTIONS.filter(item=>legacyFields.includes(item.value));
    form.setFieldsValue({
      coldchainTemplateVersion:value.version,coldchainTemplateName:value.name,
      parameters:available,coldchainAvailableParameters:available,coldchainAvailableParameterOptions:availableOptions,
      coverageTargets:(config.coverage?.profiles||[]).map(item=>({profile_id:item.profile_id,label:item.name||EVENT_LABELS[item.labels?.primary_event]||item.profile_id,target_weight:1,minimum_pass_count:1})),
    });
  }).catch(error=>message.error(error.message));return()=>{active=false;};},[templateId,form]);
  const config=detail?.configuration||{};const events=config.event_generation?.allowed_events||[];
  return <>
    <Alert type="info" showIcon message="选择已发布的时序模板" description="模板锁定事件提示词、异常事件候选、规则引擎和默认参数；任务创建时会保存不可变模板快照。"/>
    <Row gutter={16} className="section-title">
      <Col span={18}><Form.Item name="coldchainTemplateId" label="时序模板" rules={[{required:true,message:'请选择时序模板'}]}><Select loading={loading} showSearch optionFilterProp="label" placeholder="从模板中心选择已发布模板" options={templates.map(item=>({value:item.template_id,label:`${item.name} · ${item.version} · ${item.scope==='official'?'官方':'自定义'}`}))}/></Form.Item></Col>
      <Col span={6}><Form.Item name="coldchainTemplateVersion" label="模板版本" rules={[{required:true}]}><Input readOnly/></Form.Item></Col>
    </Row>
    {!templates.length&&!loading&&<Alert type="warning" showIcon message="暂无可用时序模板" description="请先到模板中心制作并发布时序模板。"/>}
    {detail&&<Card size="small" title="模板快照预览" extra={<Space><Tag color="blue">{detail.version}</Tag><Tag color={detail.scope==='official'?'green':'default'}>{detail.scope==='official'?'官方模板':'自定义模板'}</Tag></Space>}>
      <Descriptions size="small" column={2} items={[
        {key:'id',label:'模板 ID',children:<Text copyable>{detail.template_id}</Text>},
        {key:'engine',label:'规则引擎',children:config.rule_engine?.engine_id||'-'},
        {key:'generationRules',label:'生成规则',children:`${(config.fields||[]).reduce((sum,item)=>sum+(item.generation_rules||[]).length,0)} 条`},
        {key:'qualityRules',label:'质检规则',children:`${(config.fields||[]).reduce((sum,item)=>sum+(item.quality_rules||[]).length,0)} 条`},
        {key:'coverageProfiles',label:'样本标签',children:`${config.coverage?.profiles?.length||0} 个枚举值 · 任务中配置目标`},
        {key:'params',label:'输出参数',children:`${(config.fields||[]).length||config.output_schema?.parameters?.length||0} 项`},
        {key:'desc',label:'模板说明',span:2,children:detail.description||'-'},
      ]}/>
      <Divider orientation="left">异常事件候选</Divider><Space wrap>{events.filter(value=>value!=='normal').map(value=><Tag key={value}>{EVENT_LABELS[value]||config.event_generation?.event_candidates?.find(item=>item.event_id===value)?.name||value}</Tag>)}</Space>
      <Alert className="section-title" type="success" showIcon message="语言模型不生成数值真值" description="Qwen 只为模板允许的运输事件补充叙事；温湿度、GPS 和设备联动由已注册规则引擎计算。"/>
    </Card>}
  </>;
}

export function ColdChainGenerationFields({ form }) {
  const enablePrivacy = Form.useWatch('enablePrivacy', form);
  const availableParameters=Form.useWatch('coldchainAvailableParameters',form)||COLD_CHAIN_PARAMETER_OPTIONS.map(item=>item.value);
  const availableParameterOptions=Form.useWatch('coldchainAvailableParameterOptions',form)||COLD_CHAIN_PARAMETER_OPTIONS.filter(item=>availableParameters.includes(item.value));
  return <>
    <Alert type="success" showIcon message="填写随机种子和票数，并选择需要交付的参数；路线、货物和事件由系统自动选择。"/>
    <Row gutter={18} className="section-title">
      <Col span={6}><Form.Item name="seed" label="随机种子" rules={[{required:true}]} tooltip="同一模板版本、配置和种子会得到相同路线、事件和数值。"><InputNumber min={1} max={2147483647} style={{width:'100%'}}/></Form.Item></Col>
      <Col span={6}><Form.Item name="count" label="生成票数" rules={[{required:true}]} tooltip="一票是一只冷藏集装箱的完整国际运输序列。"><InputNumber min={1} max={20} style={{width:'100%'}} addonAfter="票"/></Form.Item></Col>
      <Col span={6}><Form.Item name="sampleIntervalMinutes" label="采样间隔" rules={[{required:true}]}><Select options={[10,15,30,60].map(value=>({value,label:`每 ${value} 分钟`}))}/></Form.Item></Col>
      <Col span={6}><Form.Item name="modelAlias" label="事件生成模型" rules={[{required:true}]} tooltip="模型只生成受模板约束的事件说明，不生成温湿度或坐标数值。"><Select options={[{value:'qwen3-14b',label:'Qwen3-14B（非思考模式）'}]}/></Form.Item></Col>
    </Row>
    <Form.Item name="parameters" label="生成参数" rules={[{type:'array',min:1,message:'至少选择一个输出参数'}]} tooltip="时间戳、票号、箱号、采样间隔和温度单位始终保留。">
      <Checkbox.Group style={{width:'100%'}}><Row gutter={[12,10]}>{availableParameterOptions.filter(item=>availableParameters.includes(item.value)).map(item=><Col span={8} key={item.value}><Checkbox value={item.value}>{item.label}</Checkbox></Col>)}</Row></Checkbox.Group>
    </Form.Item>
    <Alert type="info" showIcon message="所有 *_temperature_c 字段均为摄氏度；sample_interval_minutes=60 表示每 60 分钟采样一次，不是 60°C。"/>
    <Card className="section-title" size="small" title={<Space><SafetyCertificateOutlined/>生成阶段隐私保护</Space>} extra={<Form.Item name="enablePrivacy" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Paragraph type="secondary">默认关闭。开启后复用公共隐私引擎，对选定标识做一致性替换；同一票内所有时序点、票级元数据和路线属性会同步变化。</Paragraph>
      {enablePrivacy ? <Form.Item name="privacyFieldStrategies" noStyle><PrivacyFieldEditor/></Form.Item> : <Text type="secondary">未开启时仍保留“纯合成来源”隐私契约，供质检确认没有真实个人数据来源。</Text>}
    </Card>
    <Card size="small" title="系统自动确定"><TermGrid items={[
      ['路线走廊','从港口与起终点字典自动选择；语言模型不生成坐标。'],
      ['货物与温区','根据货物 Profile 选择温湿度范围和热负荷。'],
      ['完整时序','内部计算 GPS、温湿度、供电、联网、运输阶段和事件。'],
      ['Ground Truth','保存事件窗口、异常类型和数值真值，用于训练与质检。'],
    ]}/></Card>
  </>;
}

const AUGMENTATION_OPTIONS = [
  {label:'传感器轻微抖动',value:'sensor_jitter'},
  {label:'整段时间平移',value:'time_shift'},
  {label:'计划性断网上报',value:'planned_missing'},
  {label:'GPS 微扰',value:'gps_noise'},
];

export function ColdChainAugmentationFields({ form, standalone = false }) {
  const enabled=standalone||Boolean(Form.useWatch('enableAugmentation',form));
  const ratio=Number(Form.useWatch('augmentationRatio',form)||0);
  const count=Number(Form.useWatch('count',form)||0);
  const maxNew=Number(Form.useWatch('augmentationMaxNew',form)||0);
  const estimated=enabled?Math.min(maxNew,Math.ceil(count*ratio/100),Math.max(0,20-count)):0;
  return <>
    <Alert type="info" showIcon message="通用增强用于增加多样性，不修改原始时序" description="系统复制部分原始样本后施加受控扰动，并记录 source_shipment_id 和增强方法；它与独立的定向扩增任务不同。"/>
    <Card className="section-title" size="small" title="通用多样性增强" extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableAugmentation" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Form.Item name="augmentationMethods" label="增强方式" rules={[{validator:(_,value)=>!enabled||value?.length?Promise.resolve():Promise.reject(new Error('至少选择一种增强方式'))}]}><Checkbox.Group disabled={!enabled} options={AUGMENTATION_OPTIONS}/></Form.Item>
      <Row gutter={16}>
        <Col span={8}><Form.Item name="augmentationRatio" label="增强比例"><InputNumber disabled={!enabled} min={10} max={100} addonAfter="%" style={{width:'100%'}}/></Form.Item></Col>
        <Col span={8}><Form.Item name="augmentationIntensity" label="增强强度"><Select disabled={!enabled} options={[{value:'light',label:'轻度'},{value:'medium',label:'中度'}]}/></Form.Item></Col>
        <Col span={8}><Form.Item name="augmentationMaxNew" label="最大新增票数"><InputNumber disabled={!enabled} min={0} max={Math.max(0,20-count)} style={{width:'100%'}} addonAfter="票"/></Form.Item></Col>
      </Row>
      <Alert type="success" showIcon message={`预计新增 ${estimated} 票；原始 ${count} 票保持不变`} description="增强幅度被限制在既有质量规则的可接受范围内。"/>
    </Card>
    {!standalone&&<Card className="section-title" size="small" title="两种扩充模式"><Descriptions size="small" column={1} items={[
      {key:'general',label:'通用数据增强',children:'用户主动选择扰动和比例，目标是增加观测多样性。'},
      {key:'targeted',label:'质检驱动定向扩增',children:'根据事件覆盖或质量短板生成新的独立运输样本，不返工低质样本。'},
    ]}/></Card>}
  </>;
}

export function ColdChainMechanismFields() {
  return <>
    <Row gutter={18}>
      <Col span={8}><Card className="customs-option-card enabled" title={<Space><EnvironmentOutlined/>路线与阶段状态机</Space>}><Paragraph type="secondary">多式联运阶段固定；海运使用 searoute，GPS 与阶段同步。</Paragraph><Tag color="green">本地执行</Tag></Card></Col>
      <Col span={8}><Card className="customs-option-card enabled" title={<Space><ExperimentOutlined/>热湿度规则引擎</Space>}><Paragraph type="secondary">依据换热、制冷、开门、除霜、货物呼吸和传感器观测逐时计算。</Paragraph><Tag color="green">CoolProp + 数值规则</Tag></Card></Col>
      <Col span={8}><Card className="customs-option-card enabled" title={<Space><ApiOutlined/>Qwen3-14B 叙事</Space>}><Paragraph type="secondary">整批最多调用 1 次，只补充已有事实说明，不生成坐标或温度数值。</Paragraph><Tag color="blue">非思考模式 · 0/1 次</Tag></Card></Col>
    </Row>
    <Alert className="section-title" type="warning" showIcon message="当前为 L1 标准/公开资料驱动版本，未使用客户真实设备数据校准，不用于导航、食品安全放行或设备验收。"/>
  </>;
}

export function ColdChainQualityFields({ form, mode = 'combined', standalone = false }) {
  const showQuality=mode!=='expansion';
  const showExpansion=mode!=='quality';
  const count = Number(Form.useWatch('count', form) || 10);
  const enableQuality = Form.useWatch('enableQuality', form) !== false;
  const enableExpansion = (standalone&&showExpansion)||Boolean(Form.useWatch('enableExpansion', form));
  const enableAugmentation=Boolean(Form.useWatch('enableAugmentation',form));
  const augmentationRatio=Number(Form.useWatch('augmentationRatio',form)||0);
  const augmentationMax=Number(Form.useWatch('augmentationMaxNew',form)||0);
  const estimatedAugmentation=enableAugmentation?Math.min(augmentationMax,Math.ceil(count*augmentationRatio/100),Math.max(0,20-count)):0;
  const maxAllowed = Math.max(0, 20-count-estimatedAugmentation);
  return <>
    {showQuality&&<Card size="small" title="质检" extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableQuality" valuePropName="checked" noStyle><Switch onChange={checked=>{if(!checked)form.setFieldValue('enableExpansion',false);}}/></Form.Item>}>
      <Paragraph type="secondary">默认开启。逐票检查字段契约、摄氏度单位、采样连续性、温湿度物理边界、GPS/阶段、Ground Truth 和隐私契约。</Paragraph>
      {enableQuality && <>
        <TermGrid items={[
          ['三类结论','PASS 可交付；REVIEW/REJECT 均标记为低质。'],
          ['低质处理','原样本保留标记，不返工，也不作为扩增复制源。'],
          ['单位防误判','温度只接受 degC；60 分钟采样间隔不会被当作 60°C。'],
        ]}/>
        <Flex justify="space-between" align="center" className="section-title"><div><Text strong>隐私检查</Text><br/><Text type="secondary">检查字段动作覆盖、源值不落盘和同票一致性。</Text></div><Form.Item name="privacyCheckEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      </>}
    </Card>}
    {showExpansion&&<Card className="section-title" size="small" title="质检驱动定向扩增" extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableExpansion" valuePropName="checked" noStyle><Switch disabled={!enableQuality || maxAllowed===0}/></Form.Item>}>
      <Paragraph type="secondary">默认关闭。开启后根据 PASS 标签覆盖缺口生成新的独立样本；低质样本只保留标记、不返工。</Paragraph>
      {enableExpansion && enableQuality && <>
        <Form.Item name="maxExpansionCount" label="最大扩增数量" rules={[{required:true}]} tooltip={`初始 ${count} 票，MVP 最终最多 20 票。`}><InputNumber min={1} max={maxAllowed} style={{width:260}} addonAfter={`票（最多 ${maxAllowed}）`}/></Form.Item>
        <Divider orientation="left">本次任务的标签覆盖目标</Divider>
        <Form.Item name="coverageTargets" noStyle><CoverageTargetsEditor count={count}/></Form.Item>
      </>}
    </Card>}
  </>;
}

function buildPayload(form) {
  const values=form.getFieldsValue(true);
  const enableQuality=values.enableQuality!==false;
  return {
    template_id:values.coldchainTemplateId, template_version:values.coldchainTemplateVersion,
    seed:Number(values.seed), count:Number(values.count), parameters:values.parameters||[],
    sample_interval_minutes:Number(values.sampleIntervalMinutes||60),
    model_alias:values.modelAlias||'qwen3-14b',
    augmentation:{enabled:Boolean(values.enableAugmentation),methods:values.augmentationMethods||[],ratio:Number(values.augmentationRatio||0)/100,intensity:values.augmentationIntensity||'light',max_new:values.enableAugmentation?Number(values.augmentationMaxNew||0):0},
    enable_privacy:Boolean(values.enablePrivacy), privacy_field_strategies:values.privacyFieldStrategies||{},
    enable_quality:enableQuality, privacy_check_enabled:enableQuality&&values.privacyCheckEnabled!==false,
    enable_expansion:enableQuality&&Boolean(values.enableExpansion),
    max_expansion_count:enableQuality&&values.enableExpansion?Number(values.maxExpansionCount||0):0,
    coverage_profile_targets:enableQuality?(values.coverageTargets||[]).map(item=>({profile_id:item.profile_id,target_weight:Number(item.target_weight||1),minimum_pass_count:Number(item.minimum_pass_count||0)})):[],
  };
}

export async function createColdChainBackendJob(form) {
  const values=form.getFieldsValue(true);
  if(!values.coldchainTemplateId||!values.coldchainTemplateVersion)throw new Error('请选择有效的时序模板版本');
  return coldchainApi.createJob(buildPayload(form));
}

export function ColdChainSubmissionSummary({ form }) {
  const values=form.getFieldsValue(true);
  const enhanced=values.enableAugmentation?Math.min(Number(values.augmentationMaxNew||0),Math.ceil(Number(values.count||0)*Number(values.augmentationRatio||0)/100),Math.max(0,20-Number(values.count||0))):0;
  return <>
    <Alert type="info" showIcon message="点击“提交任务”后启动冷链生成 Mock" description="模板版本、模型、规则配置和增强设置会固化进模拟任务记录；任务完成后自动写入数据中心。"/>
    <Descriptions bordered size="small" column={2} className="section-title" items={[
      {key:'template',label:'模板',children:`${values.coldchainTemplateName||values.coldchainTemplateId||'-'} / ${values.coldchainTemplateVersion||'-'}`},
      {key:'count',label:'原始票数',children:`${values.count||0} 票`},
      {key:'model',label:'叙事模型',children:values.modelAlias==='local-deterministic'?'本地确定性模式':values.modelAlias||'qwen3-14b'},
      {key:'interval',label:'采样间隔',children:`每 ${values.sampleIntervalMinutes||60} 分钟`},
      {key:'params',label:'交付参数',children:`${(values.parameters||[]).length} 项`},
      {key:'augmentation',label:'通用增强',children:values.enableAugmentation?`预计新增 ${enhanced} 票`:'未启用'},
      {key:'quality',label:'质检',children:values.enableQuality===false?'未启用':'已启用'},
      {key:'expansion',label:'定向扩增',children:values.enableExpansion?`最多新增 ${values.maxExpansionCount||0} 票`:'未启用'},
      {key:'maximum',label:'预计最大总量',children:`不超过 ${Math.min(20,Number(values.count||0)+enhanced+(values.enableExpansion?Number(values.maxExpansionCount||0):0))} 票`},
    ]}/>
  </>;
}

function Metrics({ job }) {
  const result=job?.result||{}; const initial=result.initial_qc||{}; const final=result.final_qc||{};
  if(!result.quality_enabled) return <Row gutter={[12,12]}><Col span={8}><Card size="small"><Statistic title="生成票数" value={result.generation_summary?.shipment_count??'-'}/></Card></Col><Col span={8}><Card size="small"><Statistic title="时序点数" value={result.generation_summary?.row_count??'-'}/></Card></Col><Col span={8}><Card size="small"><Statistic title="质量状态" value="未质检"/></Card></Col></Row>;
  return <Row gutter={[12,12]}>
    <Col span={6}><Card size="small"><Statistic title="初始票数" value={initial.shipment_count??'-'}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="最终票数" value={final.shipment_count??'-'}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="最终 PASS" value={final.status_counts?.PASS??0}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="低质样本" value={final.low_quality_count??0}/></Card></Col>
  </Row>;
}

function ChartExplanation({ title, children }) {
  return <Card size="small" className="coldchain-chart-note"><Text strong>{title}</Text><Paragraph type="secondary">{children}</Paragraph></Card>;
}

const qualityReportUrl = jobId => `/reports/cold-chain/${encodeURIComponent(jobId)}/quality`;

export function ColdChainRunPanel({ form, job, setJob }) {
  const [health,setHealth]=useState(null); const [healthError,setHealthError]=useState(''); const [downloading,setDownloading]=useState(false);
  const terminal=['completed','failed'].includes(job?.status);
  const checkHealth=()=>coldchainApi.health().then(v=>{setHealth(v);setHealthError('');}).catch(e=>{setHealth(null);setHealthError(e.message);});
  useEffect(()=>{let active=true;coldchainApi.health().then(v=>{if(active){setHealth(v);setHealthError('');}}).catch(e=>{if(active){setHealth(null);setHealthError(e.message);}});return()=>{active=false;};},[]);
  useEffect(()=>{if(!job?.id||terminal)return undefined;const timer=window.setTimeout(()=>coldchainApi.getJob(job.id).then(setJob).catch(e=>setJob(v=>({...v,status:'failed',error:e.message}))),1000);return()=>window.clearTimeout(timer);},[job,setJob,terminal]);
  const run=async()=>{try{const value=await coldchainApi.createJob(buildPayload(form));setJob(value);message.success('冷链时序任务已提交到本地 Mock');}catch(error){message.error(error.message);}};
  const downloadSelectedCsv=async()=>{const url=job?.result?.final_delivery_url;if(!url){message.error('任务没有可下载的所选参数 CSV');return;}setDownloading(true);try{const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);const contentType=(response.headers.get('content-type')||'').toLowerCase();const csvTypes=['text/csv','application/csv','application/vnd.ms-excel','application/octet-stream'];if(!csvTypes.some(type=>contentType.includes(type)))throw new Error(`返回格式异常：${contentType||'未知'}`);const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=`${job.id}_selected_parameters.csv`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(objectUrl);message.success('CSV 已开始下载');}catch(error){message.error(`下载失败：${error.message}`);}finally{setDownloading(false);}};
  const meta=statusMeta[job?.status]||['未运行','default'];
  return <>
    {healthError&&<Alert type="error" showIcon message="本地 Mock 数据不可用" description={`${healthError}。请刷新页面后重试。`} action={<Button size="small" onClick={checkHealth}>重新检查环境</Button>}/>} 
    {health&&<Descriptions bordered size="small" column={3} items={[
      {key:'ready',label:'本地环境',children:<Badge status={health.ready?'success':'error'} text={health.ready?'就绪':'不完整'}/>},
      {key:'route',label:'路线与规则',children:health.components?.route_dictionary&&health.components?.rule_catalog?'已加载':'缺失'},
      {key:'privacy',label:'公共隐私引擎',children:health.components?.privacy_engine?'已复用':'缺失'},
    ]} extra={<Button size="small" onClick={checkHealth}>重新检查环境</Button>}/>} 
    <Divider/>
    {!job&&<Flex vertical align="center" gap={14} className="customs-run-empty"><PlayCircleOutlined className="customs-run-icon"/><Title level={4}>生成 → 可选质检 → 可选定向扩增</Title><Button type="primary" size="large" icon={<PlayCircleOutlined/>} disabled={!health?.ready} onClick={run}>运行配置链路</Button></Flex>}
    {job&&<><Flex justify="space-between" align="center"><Space><Badge status={meta[1]} text={meta[0]}/><Text>{job.message}</Text></Space>{job.status==='failed'&&<Button onClick={run}>重新运行</Button>}</Flex><Progress percent={job.progress||0} status={job.status==='failed'?'exception':job.status==='completed'?'success':'active'} className="section-title"/><Steps size="small" current={job.status==='failed'?-1:Math.max(0,stageOrder.indexOf(job.status))} items={stageOrder.slice(1).map(key=>({title:statusMeta[key][0]}))}/>
      {job.status==='failed'&&<Alert className="section-title" type="error" showIcon message="任务失败" description={job.error||'请重新提交 Mock 任务'}/>} 
      {job.status==='completed'&&<><Divider/><Metrics job={job}/>{job.result?.quality_enabled&&job.result?.final_qc?.low_quality_count>0&&<Alert className="section-title" type="warning" showIcon message={`${job.result.final_qc.low_quality_count} 票已标记为低质`} description="低质原样本未返工；若开启扩增，新增样本由规则引擎独立生成。"/>}<Row gutter={16} className="section-title"><Col span={12}><Image width="100%" src={job.result?.generation_preview_url}/><Row gutter={[8,8]}><Col span={12}><ChartExplanation title="温度变化曲线">看设定温度、送风温度和回风温度是否随运输事件合理变化；突刺通常对应开门、除霜或断电。</ChartExplanation></Col><Col span={12}><ChartExplanation title="运输路线图">绿色点是起点、红色点是终点，折线表示本票合成的国际运输轨迹，不用于真实导航。</ChartExplanation></Col></Row></Col>{job.result?.quality_enabled&&<Col span={12}><Image width="100%" src={job.result?.comparison_preview_url}/><Row gutter={[8,8]}><Col span={12}><ChartExplanation title="质检结果分布">比较扩增前后 PASS、REVIEW、REJECT 数量；REVIEW 和 REJECT 都会被标记为低质。</ChartExplanation></Col><Col span={12}><ChartExplanation title="PASS 标签覆盖率">按模板设定的事件、阶段和时序形态目标，统计通过质检的样本覆盖情况；REVIEW、REJECT 不计入覆盖，其缺口会用于定向扩增。</ChartExplanation></Col></Row></Col>}</Row><Space wrap>
        {job.result?.quality_enabled&&<Button type="primary" href={qualityReportUrl(job.id)} target="_blank">打开可视化质检报告</Button>}
        {job.result?.comparison_report_url&&<Button href={job.result.comparison_report_url} target="_blank">查看前后对比 MD</Button>}
        <Button type="primary" loading={downloading} onClick={downloadSelectedCsv}>下载所选参数 CSV</Button>
      </Space></>}
    </>}
  </>;
}

export function ColdChainResultSummary({ job }) {
  if(!job)return <Alert type="warning" showIcon message="尚未运行冷链 MVP"/>;
  if(job.status!=='completed')return <Spin tip="等待本地流程完成"><div style={{height:80}}/></Spin>;
  const quality=job.result?.quality_enabled;
  return <><Alert type="success" showIcon icon={<CheckCircleOutlined/>} message={quality?'冷链生成与所选质检/扩增流程已完成':'冷链时序生成已完成（本次未启用质检）'}/><Metrics job={job}/><Descriptions bordered size="small" column={2} className="section-title" items={[
    {key:'id',label:'Mock 任务',children:job.id},
    {key:'qwen',label:'Qwen 调用',children:`${job.result?.qwen_call_count??0} 次（${job.result?.qwen_status||'-'}）`},
    {key:'privacy',label:'隐私保护',children:job.result?.privacy?.enabled?<Tag color="green">已执行</Tag>:<Tag>纯合成来源契约</Tag>},
    {key:'quality',label:'质检',children:quality?<Tag color="green">已执行</Tag>:<Tag>未执行</Tag>},
    {key:'plan',label:'定向新增',children:`${job.result?.expansion_plan?.recommended_new??0} 票`},
    {key:'maturity',label:'成熟度',children:<Tag color="gold">L1 · 未用真实数据校准</Tag>},
  ]}/></>;
}

export function ColdChainTaskDetail({ job, onOpenDataset }) {
  const completed=job?.status==='completed';
  return <div className="section-title"><Flex justify="space-between" align="center"><Title level={5}>冷链时序任务运行快照</Title><Space><Button type="primary" disabled={!completed||!onOpenDataset} onClick={onOpenDataset}>进入数据集</Button><Button disabled={!completed||!job?.result?.quality_enabled} href={completed&&job?.result?.quality_enabled?qualityReportUrl(job.id):undefined} target="_blank">打开质检报告</Button></Space></Flex><ColdChainResultSummary job={job}/></div>;
}
