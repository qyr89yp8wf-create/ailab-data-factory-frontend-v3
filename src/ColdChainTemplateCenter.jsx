import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Collapse, Descriptions, Divider, Empty,
  Flex, Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Spin, Steps, Switch, Table, Tabs, Tag,
  Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, CopyOutlined, DeleteOutlined,
  DownloadOutlined, LeftOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, SaveOutlined,
} from '@ant-design/icons';
import { coldchainApi } from './coldchainApi';
import { COLDCHAIN_MODEL_CONFIGURATION, COLDCHAIN_MODEL_EVENTS } from './timeSeriesModelSeed';
import { compileStage1, compileStage2, DEMO_FROZEN_EVENT, PREVIEW_RUNTIME, samplePreviewAssignment, STAGE2_SYSTEM } from './timeSeriesPromptCompiler';
import { formatDateTime, nowDateTime } from './timeUtils';
import { COLD_CHAIN_PARAMETER_OPTIONS } from './ColdChainMvp';
import { TemplateActionButtons } from './TemplateActionButtons';

const { Title, Paragraph, Text } = Typography;
const TRIAL_EVENT_LABELS = {
  normal:'正常运输', power_off_short:'短时断电', door_open:'开门',
  initial_warm_load:'初始热负载', blocked_airflow:'气流受阻',
  cooling_degradation:'制冷能力下降', sensor_bias:'传感器偏移', vessel_delay:'船期延误',
  network_offline:'断网上报', defrost:'除霜',
};
const TRIAL_STAGE_LABELS = {
  none:'无异常阶段', origin_pretrip:'起运前检查', origin_road:'起运公路',
  origin_terminal:'起运港区', ocean:'海运', destination_terminal:'目的港区',
  destination_road:'目的地公路', delivered:'交付',
};
const STEP_ITEMS = [
  {title:'模板与时序场景配置',description:'模板信息、业务过程与时序边界'},
  {title:'生成配置',description:'采样维度、事件定义与输出字段'},
  {title:'合成指令预览',description:'检查实际模型输入'},
  {title:'质检规则配置',description:'基础、隐私、场景与分类标签'},
  {title:'试运行与发布',description:'Qwen3-14B 小批验证'},
];
const EVENT_OPTIONS = [
  {label:'正常运输',value:'normal'}, {label:'短时断电',value:'power_off_short'},
  {label:'开门',value:'door_open'}, {label:'初始热负载',value:'initial_warm_load'},
  {label:'气流受阻',value:'blocked_airflow'}, {label:'制冷能力下降',value:'cooling_degradation'},
  {label:'传感器偏移',value:'sensor_bias'}, {label:'船期延误',value:'vessel_delay'},
];
const ANOMALY_EVENT_OPTIONS = EVENT_OPTIONS.filter(item => item.value !== 'normal');
const DEFAULT_EVENT_PROMPTS = {
  power_off_short:'生成一次短时断电事件，说明发生阶段、持续时间、恢复过程以及对温湿度和设备状态的影响。',
  door_open:'生成一次运输途中的开门事件，说明发生阶段、持续时间以及箱内温度变化与恢复过程。',
  initial_warm_load:'生成一次初始热负载事件，说明装载阶段、初始货物温度以及制冷系统逐步降温的过程。',
  blocked_airflow:'生成一次气流受阻事件，说明发生阶段、可能表现以及送风温度与回风温度的变化关系。',
  cooling_degradation:'生成一次制冷能力下降事件，说明发生阶段、持续时间以及温度缓慢偏离设定值的过程。',
  sensor_bias:'生成一次传感器偏移事件，说明发生阶段、偏移方向以及该读数与其它关联参数之间的不一致。',
  vessel_delay:'生成一次船期延误事件，说明延误阶段、持续时间以及运输时长变化，数值真值仍由规则引擎计算。',
};
const DEFAULT_EVENT_CANDIDATES = ANOMALY_EVENT_OPTIONS.map(item => ({ event_id:item.value, name:item.label, selected:true, prompt:DEFAULT_EVENT_PROMPTS[item.value], custom:false }));
const PARAMETER_TYPES = [{value:'number',label:'数值'},{value:'integer',label:'整数'},{value:'string',label:'文本'},{value:'boolean',label:'布尔值'},{value:'object',label:'对象'}];
const DEFAULT_FIELD_UNITS={temperature_setpoint:'℃',supply_air_temperature:'℃',return_air_temperature:'℃',cargo_temperature:'℃',ambient_temperature:'℃',relative_humidity:'%',gps:'经纬度',power_status:'',transport_event:'',network_status:''};
const EVENT_STAGE_OPTIONS = [
  {label:'无异常阶段',value:'none'},{label:'起运前检查',value:'origin_pretrip'},
  {label:'起运公路',value:'origin_road'},{label:'起运港区',value:'origin_terminal'},
  {label:'海运',value:'ocean'},{label:'目的港区',value:'destination_terminal'},
  {label:'目的地公路',value:'destination_road'},{label:'交付',value:'delivered'},
];
const TEMPORAL_PATTERN_OPTIONS = [
  {label:'稳定',value:'stable'},{label:'断电后恢复',value:'recovery'},
  {label:'短时升温',value:'transient_warming'},{label:'逐步降温',value:'cooldown'},
  {label:'缓慢升温',value:'slow_warming'},{label:'缓慢漂移',value:'slow_drift'},
  {label:'测量偏移',value:'level_shift'},{label:'运输时长延长',value:'extended_duration'},
];
const COVERAGE_EVENT_DEFAULTS = {
  normal:{event_stage:'none',temporal_pattern:'stable'},
  power_off_short:{event_stage:'origin_road',temporal_pattern:'recovery'},
  door_open:{event_stage:'destination_terminal',temporal_pattern:'transient_warming'},
  initial_warm_load:{event_stage:'origin_pretrip',temporal_pattern:'cooldown'},
  blocked_airflow:{event_stage:'ocean',temporal_pattern:'slow_warming'},
  cooling_degradation:{event_stage:'ocean',temporal_pattern:'slow_drift'},
  sensor_bias:{event_stage:'ocean',temporal_pattern:'level_shift'},
  vessel_delay:{event_stage:'ocean',temporal_pattern:'extended_duration'},
};
const COVERAGE_DIMENSIONS = [
  {dimension_id:'primary_event',name:'主要事件',labels:EVENT_OPTIONS.map(item=>({value:item.value,name:item.label}))},
  {dimension_id:'event_stage',name:'事件阶段',labels:EVENT_STAGE_OPTIONS.map(item=>({value:item.value,name:item.label}))},
  {dimension_id:'temporal_pattern',name:'时序形态',labels:TEMPORAL_PATTERN_OPTIONS.map(item=>({value:item.value,name:item.label}))},
];
const DEFAULT_COVERAGE_LABELS = EVENT_OPTIONS.map(item=>`${item.value} | ${item.label}`).join('\n');
const DEFAULT_EVENT_DIMENSIONS = [
  {dimension_id:'dim_event_type',name:'事件类型',values:['正常运行','开门','短时断电','制冷能力下降','传感器偏移','初始热负载','气流受阻','船期延误'],option_ids:{'正常运行':'opt_event_normal','开门':'opt_event_door','短时断电':'opt_event_power','制冷能力下降':'opt_event_cooling','传感器偏移':'opt_event_sensor','初始热负载':'opt_event_warm_load','气流受阻':'opt_event_airflow','船期延误':'opt_event_vessel_delay'},description:'本条样本需要体现的主要运行事件',applicability_conditions:'所有样本',prohibited_conditions:''},
  {dimension_id:'dim_operation_stage',name:'运行阶段',values:['公路运输','港口等待','海运'],option_ids:{'公路运输':'opt_stage_road','港口等待':'opt_stage_port','海运':'opt_stage_ocean'},description:'本条样本所处或重点覆盖的运输运行阶段',applicability_conditions:'所有样本',prohibited_conditions:''},
  {dimension_id:'dim_cargo_type',name:'货物类型',values:['冷藏货物'],option_ids:{'冷藏货物':'opt_cargo_chilled'},description:'按模板业务定义参与采样的货物类别',applicability_conditions:'所有样本',prohibited_conditions:''},
  {dimension_id:'dim_environment',name:'环境条件',values:['常规环境'],option_ids:{'常规环境':'opt_environment_normal'},description:'按模板业务定义参与采样的外部环境条件',applicability_conditions:'所有样本',prohibited_conditions:''},
];
const stableConfigId = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

function parseCoverageLabels(markdown='', allowedEvents=[], { ignoreUnavailable=false }={}) {
  const allowed=new Set(allowedEvents);const seen=new Set();
  return String(markdown).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const [value,...nameParts]=line.replace(/^[-*]\s*/, '').split('|');
    const key=String(value||'').trim();
    const name=nameParts.join('|').trim()||EVENT_OPTIONS.find(item=>item.value===key)?.label||key;
    if(!allowed.has(key)){if(ignoreUnavailable)return null;throw new Error(`标签“${key}”不在允许事件白名单中`);}
    if(seen.has(key))throw new Error(`标签“${key}”重复`);
    seen.add(key);return {value:key,name};
  }).filter(Boolean);
}
const CONDITION_VARIABLES = [
  {label:'始终',value:'always'}, {label:'运输事件',value:'transport_event'},
  {label:'运输阶段',value:'transport_stage'}, {label:'供电状态',value:'power_status'},
  {label:'联网状态',value:'network_status'}, {label:'温度设定值',value:'temperature_setpoint'},
  {label:'外界温度',value:'ambient_temperature'}, {label:'相对湿度',value:'relative_humidity'},
];
const CONDITION_OPERATORS = [
  {label:'始终',value:'always'}, {label:'等于',value:'equals'}, {label:'不等于',value:'not_equals'},
  {label:'大于',value:'greater_than'}, {label:'小于',value:'less_than'}, {label:'位于范围',value:'between'},
];
const EFFECT_OPERATORS = [
  {label:'由内置引擎生成',value:'engine_default'}, {label:'向参考字段变化',value:'move_towards'},
  {label:'增加',value:'add'}, {label:'减少',value:'subtract'}, {label:'设为指定值',value:'set'}, {label:'限制在范围',value:'clamp'},
];
const QC_CHECK_TYPES = [
  {label:'不得缺失',value:'required'}, {label:'数值范围',value:'range'},
  {label:'每小时最大变化率',value:'max_change_rate'}, {label:'允许值枚举',value:'allowed_values'},
  {label:'与参考字段差值',value:'delta_from_reference'}, {label:'事件一致性',value:'event_consistency'},
];
const REFERENCE_OPTIONS = [...COLD_CHAIN_PARAMETER_OPTIONS,{label:'箱内空气 Ground Truth',value:'ground_truth_box_air_temperature'}];
const QUALITY_TARGET_OPTIONS = [
  {label:'语义事件',value:'semantic_event'},{label:'时序参数',value:'temporal_parameters'},{label:'两者',value:'both'},
];
const BASE_TIME_SERIES_RULES=[
  ['BASE-READABLE','文件与记录可读取','确认文件可打开、样本记录可解析，损坏或截断数据不会进入后续检查。'],
  ['BASE-STRUCTURE','数据结构完整','检查样本及嵌套对象是否符合模板约定的结构。'],
  ['BASE-FIELD-TYPE','字段类型合法','检查字段定义与各时间点的实际值类型是否一致。'],
  ['BASE-NUMERIC-VALID','数值有效','检查数值字段中是否存在 NaN、Inf 等非法数值。'],
  ['BASE-ENUM','枚举值合法','检查状态、阶段和事件类型是否位于已配置枚举中。'],
  ['BASE-MISSING','缺失策略符合配置','检查字段缺失及其表示方式是否符合模板配置。'],
  ['BASE-HARD-RANGE','字段硬范围合法','仅按已明确配置的硬范围检查各时间点数值，不把正常范围当作硬范围。'],
  ['BASE-UNIT-PRECISION','单位与精度符合配置','检查字段单位、数值精度与模板配置是否一致。'],
  ['BASE-TIMESTAMP','时间戳合法','检查时间戳格式、时区与可解析性。'],
  ['BASE-TIMELINE','时间轴与点数一致','检查索引顺序、重复时间、采样间隔、点数和观测窗口。'],
  ['BASE-SAMPLE-ID','样本标识合法','检查样本 ID 格式及数据集内唯一性。'],
  ['BASE-REFERENCE','引用有效','检查字段、事件、模板及配置引用是否存在且可用。'],
  ['BASE-EVENT-PLAN','事件计划结构合法','检查阶段、事件区间、响应索引和已结构化适用约束。'],
  ['BASE-FROZEN-PLAN','序列与冻结计划一致','检查初始值及已明确映射的阶段、活动事件标记。'],
  ['BASE-LINEAGE','生成与处理血缘完整','检查当前生成方式要求的输入、配置、处理记录及引用。'],
  ['BASE-EXACT-DUPLICATE','完全重复','在批次内按规范化样本内容检查完全重复，排除 ID 与血缘字段。'],
  ['BASE-NEAR-DUPLICATE','近重复','在批次内形成高度相似序列的待复核候选，不自动删除。'],
].map(([rule_id,name,description])=>({rule_id,name,description,target:'both',system:true}));
const DEFAULT_BASE_RULE_IDS=BASE_TIME_SERIES_RULES.map(rule=>rule.rule_id);
const PRIVACY_QUALITY_RULES=[
  {rule_id:'DINGO-PII',name:'标准 PII',scope:'整条序列 + 每条记录',engine:'Dingo Rule',severity:'BLOCK',description:'检测手机号、身份证、邮箱、信用卡、护照、SSN 和 IPv4。'},
  {rule_id:'FIXED-PRIVACY-PERSON',name:'个人身份隐私',scope:'整条序列 + 每条记录',engine:'系统规则 / 正则',severity:'BLOCK',description:'检查姓名、手机号和身份证号等个人身份信息。'},
  {rule_id:'FIXED-PRIVACY-CONTACT',name:'联系与位置隐私',scope:'整条序列 + 每条记录',engine:'系统规则 / 正则',severity:'BLOCK',description:'检查详细地址、邮箱、车牌号及精确位置等信息。'},
  {rule_id:'FIXED-PRIVACY-BUSINESS',name:'业务标识隐私',scope:'整条序列 + 每条记录',engine:'系统规则 / 正则',severity:'BLOCK',description:'检查真实运单号、客户编号和企业内部账号。'},
  {rule_id:'FIXED-PRIVACY-CREDENTIAL',name:'账号与密钥安全',scope:'整条序列 + 每条记录',engine:'凭据扫描',severity:'BLOCK',description:'检查 API Key、Token、Cookie 和密码；报告只保留类型与掩码预览。'},
].map(rule=>({...rule,target:'both',system:true,enabled:true,required:true}));
const ENGINE_QUALITY_RULES={
  coldchain_physics_v1:[
    {rule_id:'CC-QC-POWER-CONSISTENCY',name:'断电状态一致性',description:'核对供电状态、断电事件区间及恢复时点是否一致。',required:true,fields:['power_status','transport_event']},
    {rule_id:'CC-QC-TEMP-RESPONSE',name:'温度响应与恢复',description:'检查断电或开门后的温度响应、滞后及恢复过程是否符合冻结计划。',recommended:true,fields:['return_air_temperature','cargo_temperature']},
    {rule_id:'CC-QC-SENSOR-BIAS',name:'传感器偏移一致性',description:'检查传感器偏移是否只作用于读数，并与真实温度变化区分。',recommended:true,fields:['return_air_temperature','cargo_temperature']},
    {rule_id:'CC-QC-STAGE-GPS',name:'运输阶段与定位一致性',description:'检查运输阶段、时间轴和定位轨迹之间的对应关系。',recommended:true,fields:['gps','transport_event']},
  ],
  generic_timeseries_engine_v1:[],
};
const DEFAULT_MODEL_QUALITY_RULES=[{
  rule_id:'QC-SCENE-POWER-RESPONSE',name:'断电后的温度响应',enabled:true,mode:'semantic',target_fields:['power_status','return_air_temperature','cargo_temperature'],
  condition_scope:'本条存在短时断电时，检查断电期间及各字段对应的恢复窗口。',
  acceptance_requirement:'供电状态与断电区间一致；箱温和货物温度的响应幅度、延迟及恢复符合本条冻结计划，不出现无依据的瞬间恢复。',
  exceptions_tolerance:'不要求货物一定超温；允许货物恢复跨阶段，但须符合本条恢复窗口。',on_failure:'review',python_code:'def validate(series, context):\n    return validate_power_response(series, context)',
}];
const DEFAULT_COVERAGE_PROMPT=`根据最终时序数据、时间轴及本条事件计划，核验本样本实际体现的主要事件类型。仅从已配置枚举中选择，一期每条样本最多确认一个主要事件标签。

检查事件对应字段、发生区间及响应表现是否支持本条计划。不能仅复制采样目标、事件说明或 active_event_type 列作为核验结果。证据不足返回无法判定；计划与数据矛盾时说明冲突，不强行确认目标标签。

分类不代替质检，不输出整体质量通过结论；normal 仅表示在已配置且可检查的范围内未发现目标异常。`;

function EventCandidatesEditor({ form }) {
  const candidates=Form.useWatch('eventCandidates',form)||[];
  return <Form.List name="eventCandidates">{(fields,{add,remove})=><>
    <Row gutter={[12,12]}>{fields.map((field,index)=>{
      const item=candidates[index]||{};
      const selected=item.selected!==false;
      return <Col span={12} key={field.key}><Card size="small" className={`coldchain-event-card ${selected?'coldchain-event-card-selected':''}`} title={<Space><Form.Item name={[field.name,'selected']} valuePropName="checked" noStyle><Checkbox/></Form.Item><Text strong>{item.custom?'自定义异常事件':item.name}</Text></Space>} extra={item.custom?<Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>remove(field.name)}>删除</Button>:null}>
        <Form.Item name={[field.name,'event_id']} hidden><Input/></Form.Item><Form.Item name={[field.name,'custom']} hidden valuePropName="checked"><Checkbox/></Form.Item>{!item.custom&&<Form.Item name={[field.name,'name']} hidden><Input/></Form.Item>}
        {!selected?<Text type="secondary">未选择时，该异常事件及其 Prompt 不会进入模板。</Text>:<>
          {item.custom&&<Form.Item name={[field.name,'name']} label="异常事件名称" rules={[{required:true,whitespace:true,message:'请输入异常事件名称'}]}><Input placeholder="例如：压缩机频繁启停"/></Form.Item>}
          <Form.Item name={[field.name,'prompt']} label="事件描述 Prompt" rules={[{required:true,whitespace:true,message:'请填写事件描述 Prompt'}]}><Input.TextArea rows={5} placeholder="说明事件的发生阶段、持续时间、变化过程以及与其它参数的关系"/></Form.Item>
        </>}
      </Card></Col>;
    })}</Row>
    <Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({event_id:`custom_event_${Date.now()}`,name:'',prompt:'',selected:true,custom:true})}>添加自定义异常事件</Button>
  </>}</Form.List>;
}

function EventSamplingDimensionsEditor({ form }) {
  const dimensions=Form.useWatch('eventDimensions',form)||[];
  const [advancedIndex,setAdvancedIndex]=useState(null);
  const advanced=advancedIndex==null?null:dimensions[advancedIndex];
  return <>
    <Alert type="info" showIcon message="定义事件的可采样空间" description="每个维度至少维护一个枚举值；选项占比在创建合成任务时配置。系统提供的示例维度也可以删除或改名。"/>
    <Form.List name="eventDimensions" rules={[{validator:(_,items)=>items?.length?Promise.resolve():Promise.reject(new Error('请至少配置一个事件采样维度'))}]}>{(fields,{add,remove},{errors})=><>
      <Table className="section-title" rowKey="key" pagination={false} dataSource={fields} columns={[
        {title:'维度名称',width:'25%',render:(_,field,index)=><Form.Item name={[field.name,'name']} rules={[{required:true,whitespace:true,message:'请输入维度名称'}]}><Input disabled={index===0} placeholder="例如：运行阶段" suffix={index===0?<Tag>系统必填</Tag>:null}/></Form.Item>},
        {title:'维度可选值',render:(_,field)=><Form.Item name={[field.name,'values']} rules={[{validator:(_,values)=>Array.isArray(values)&&values.filter(value=>String(value||'').trim()).length>=1?Promise.resolve():Promise.reject(new Error('至少维护 1 个枚举值'))}]}><Select mode="tags" tokenSeparators={[',','，']} placeholder="输入枚举值后按回车"/></Form.Item>},
        {title:'高级配置（可选）',width:150,render:(_,field,index)=><Button onClick={()=>setAdvancedIndex(index)}>配置</Button>},
        {title:'操作',width:80,render:(_,field,index)=>index===0?<Text type="secondary">不可删除</Text>:<Button type="text" danger icon={<DeleteOutlined/>} aria-label="删除维度" onClick={()=>remove(field.name)}/>},
      ]}/>
      <Form.ErrorList errors={errors}/>
      <Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({dimension_id:stableConfigId('dim'),option_ids:{},name:'',values:[],description:'',applicability_conditions:'',prohibited_conditions:''})}>新增维度</Button>
    </>}</Form.List>
    <Modal title={`高级配置${advanced?.name?`：${advanced.name}`:''}`} open={advancedIndex!=null} onCancel={()=>setAdvancedIndex(null)} onOk={()=>setAdvancedIndex(null)} okText="完成" cancelText="取消" destroyOnHidden>
      {advancedIndex!=null&&<>
        <Form.Item name={['eventDimensions',advancedIndex,'description']} label="维度说明"><Input.TextArea rows={3} placeholder="说明这个维度表示什么"/></Form.Item>
        <Form.Item name={['eventDimensions',advancedIndex,'applicability_conditions']} label="适用条件"><Input.TextArea rows={3} placeholder="什么情况下参与采样；没有限制可留空"/></Form.Item>
        <Form.Item name={['eventDimensions',advancedIndex,'prohibited_conditions']} label="禁止条件"><Input.TextArea rows={3} placeholder="填写不能出现的取值或组合；没有限制可留空"/></Form.Item>
      </>}
    </Modal>
  </>;
}

const DEFAULT_EVENT_DEFINITION_TEXT = {
  '正常运行':'系统在无目标异常时按正常规律持续运行。','开门':'运输过程中发生开门，外部空气交换影响箱内环境，关闭后逐步恢复。','短时断电':'制冷设备短时失去供电，恢复供电后重新建立制冷能力。','制冷能力下降':'制冷系统仍在运行但能力下降，相关温度逐步偏离正常状态。','传感器偏移':'传感器读数产生偏移，但不直接改变被监测对象的真实状态。','初始热负载':'运输开始时货物或箱内环境高于目标温度，随后逐步降温。','气流受阻':'箱内气流循环受阻，送风、回风与货物温度关系发生变化。','船期延误':'海运计划发生延误，运输过程持续时间延长。',
};
const EVENT_NAME_TO_ID={...Object.fromEntries(EVENT_OPTIONS.map(item=>[item.label,item.value])),'正常运行':'normal'};
const MODEL_EVENT_BY_NAME=new Map(COLDCHAIN_MODEL_EVENTS.map(item=>[item.name,item]));
const DEFAULT_EVENT_ADVANCED = {
  '正常运行':['制冷设备、箱内空气、货物及监测传感器','贯穿完整运输过程','所有运行阶段且不存在目标异常'],
  '开门':['箱内空气、货物及温湿度传感器','5～15分钟','允许进行装卸或查验的阶段'],
  '短时断电':['供电系统、制冷设备及箱内温度','5～30分钟','设备原本处于供电和制冷运行状态'],
  '制冷能力下降':['制冷设备、送回风温度及货物温度','30分钟～6小时','制冷设备运行期间'],
  '传感器偏移':['目标传感器读数','10分钟～完整运输过程','目标传感器处于采集状态'],
  '初始热负载':['货物、箱内空气及制冷设备','1～12小时','装载完成后的起运初期'],
  '气流受阻':['箱内气流、送回风温度及货物温度','30分钟～8小时','货物已装载且制冷设备运行中'],
  '船期延误':['运输计划、运输阶段及环境暴露时长','1～72小时','港口等待或海运衔接阶段'],
};
const normalizeEventDimensions = source => {
  const copied=(source?.length?source:DEFAULT_EVENT_DIMENSIONS).filter(Boolean).map(item=>({...item,values:[...(Array.isArray(item.values)?item.values:[])],option_ids:{...(item.option_ids||{})}}));
  const index=copied.findIndex(item=>['event_type','dim_event_type'].includes(item.dimension_id)||item.name==='事件类型');
  const event=index>=0?copied.splice(index,1)[0]:{...DEFAULT_EVENT_DIMENSIONS[0],values:[],option_ids:{}};
  event.dimension_id='event_type';event.name='事件类型';
  for(const name of DEFAULT_EVENT_DIMENSIONS[0].values) if(!event.values.includes(name)) event.values.push(name);
  event.option_ids={...DEFAULT_EVENT_DIMENSIONS[0].option_ids,...event.option_ids};
  return [event,...copied];
};

function EventDefinitionsEditor({ form }) {
  const dimensions=Form.useWatch('eventDimensions',form)||[];
  const definitions=Form.useWatch('eventDefinitions',form)||[];
  const [advancedIndex,setAdvancedIndex]=useState(null);
  const eventDimension=dimensions.find(item=>item.dimension_id==='event_type')||dimensions[0];
  const eventTypes=(eventDimension?.values||[]).map(value=>String(value||'').trim()).filter(Boolean);
  useEffect(()=>{
    const current=form.getFieldValue('eventDefinitions')||[];
    const byName=new Map(current.map(item=>[item.name,item]));
    const next=eventTypes.map((name,index)=>{const defaults=DEFAULT_EVENT_ADVANCED[name]||['','',''];const seeded=MODEL_EVENT_BY_NAME.get(name);return byName.get(name)||{event_id:seeded?.event_id||EVENT_NAME_TO_ID[name]||eventDimension?.option_ids?.[name]||`event_${index}_${Date.now().toString(36)}`,name,description_definition:seeded?.description_definition||DEFAULT_EVENT_DEFINITION_TEXT[name]||'',impact_targets:seeded?.impact_targets||defaults[0],duration_range:seeded?.duration_range||defaults[1],intensity_parameters:seeded?.intensity_parameters||'',occurrence_conditions:seeded?.occurrence_conditions||defaults[2],parameter_names:seeded?.parameter_names||[]};});
    if(JSON.stringify(current.map(item=>item.name))!==JSON.stringify(next.map(item=>item.name))) form.setFieldValue('eventDefinitions',next);
  },[eventDimension?.option_ids,eventTypes.join('\u0001'),form]);
  const advanced=advancedIndex==null?null:definitions[advancedIndex];
  return <>
    <Alert type="info" showIcon message="事件定义与上方“事件类型”枚举自动同步" description="新增、改名或删除事件类型后，这里会同步生成对应配置；事件描述与定义为必填。"/>
    <Form.List name="eventDefinitions">{fields=><Table className="section-title" rowKey="key" pagination={false} dataSource={fields} columns={[
      {title:'事件类型',width:180,render:(_,field,index)=><><Form.Item name={[field.name,'event_id']} hidden><Input/></Form.Item><Form.Item name={[field.name,'name']}><Input disabled value={definitions[index]?.name}/></Form.Item></>},
      {title:'事件描述与定义',render:(_,field)=><Form.Item name={[field.name,'description_definition']} rules={[{required:true,whitespace:true,message:'请填写事件描述与定义'}]}><Input.TextArea rows={3} placeholder="说明事件是什么、怎样发生，以及主要变化过程"/></Form.Item>},
      {title:'高级配置',width:150,render:(_,field,index)=><Button onClick={()=>setAdvancedIndex(index)}>配置</Button>},
    ]}/>}</Form.List>
    <Modal title={`事件高级配置${advanced?.name?`：${advanced.name}`:''}`} open={advancedIndex!=null} onCancel={()=>setAdvancedIndex(null)} onOk={()=>setAdvancedIndex(null)} okText="完成" cancelText="取消" destroyOnHidden>
      {advancedIndex!=null&&<>
        <Form.Item name={['eventDefinitions',advancedIndex,'impact_targets']} label="影响对象" rules={[{required:true,whitespace:true,message:'请填写影响对象'}]} extra="作用于设备、传感器或其它对象。"><Input.TextArea rows={3} placeholder="例如：制冷设备、温度传感器、箱内空气"/></Form.Item>
        <Form.Item name={['eventDefinitions',advancedIndex,'duration_range']} label="持续时间范围" rules={[{required:true,whitespace:true,message:'请填写持续时间范围'}]} extra="请明确数值范围和单位。"><Input placeholder="例如：5～15分钟"/></Form.Item>
        <Form.Item name={['eventDefinitions',advancedIndex,'intensity_parameters']} label="强度参数（可选）"><Input.TextArea rows={3} placeholder="例如：传感器偏移量及范围"/></Form.Item>
        <Form.Item name={['eventDefinitions',advancedIndex,'occurrence_conditions']} label="发生条件" rules={[{required:true,whitespace:true,message:'请填写发生条件'}]} extra="说明允许在哪些阶段或状态下发生。"><Input.TextArea rows={3} placeholder="例如：海运阶段且制冷设备运行中"/></Form.Item>
      </>}
    </Modal>
  </>;
}

function FieldRuleEditor({ fieldIndex }) {
  const form=Form.useFormInstance();
  const type=Form.useWatch(['fields',fieldIndex,'type'],form);
  return <div className="coldchain-field-editor-flat">
      <Row gutter={16}>
        <Col span={6}><Form.Item name={[fieldIndex,'label']} label="字段名称" rules={[{required:true,whitespace:true}]}><Input placeholder="例如：回风温度"/></Form.Item></Col>
        <Col span={6}><Form.Item name={[fieldIndex,'field_id']} label="字段 ID" rules={[{required:true,pattern:/^[a-z][a-z0-9_]{1,63}$/,message:'使用小写字母、数字和下划线'}]}><Input placeholder="例如：return_air_temperature"/></Form.Item></Col>
        <Col span={6}><Form.Item name={[fieldIndex,'type']} label="数据类型" rules={[{required:true}]}><Select options={PARAMETER_TYPES}/></Form.Item></Col>
        <Col span={6}><Form.Item name={[fieldIndex,'unit']} label="单位" rules={[{max:40}]}><Input placeholder="例如：℃、%、km/h"/></Form.Item></Col>
      </Row>
      <Row gutter={16} align="bottom"><Col span={10}><Form.Item name={[fieldIndex,'enum_values']} label="枚举值（可选）" extra="离散字段维护允许值；输入后按回车。"><Select mode="tags" tokenSeparators={[',','，']} placeholder="例如：road、port、sea"/></Form.Item></Col><Col span={5}><Form.Item name={[fieldIndex,'nullable']} label="允许缺失" valuePropName="checked"><Switch checkedChildren="允许" unCheckedChildren="不允许"/></Form.Item></Col>{['number','integer'].includes(type)&&<><Col span={4}><Form.Item name={[fieldIndex,'value_schema','minimum']} label="全局最小值"><InputNumber style={{width:'100%'}}/></Form.Item></Col><Col span={4}><Form.Item name={[fieldIndex,'value_schema','maximum']} label="全局最大值"><InputNumber style={{width:'100%'}}/></Form.Item></Col></>}</Row>
      <Divider orientation="left">字段生成 Prompt</Divider>
      <Form.Item name={[fieldIndex,'overall_change_rules']} label="整体变化规则" rules={[{required:true,whitespace:true,message:'请填写整体变化规则'}]} extra="填写初始值、取值范围、正常趋势、周期和日常波动。"><Input.TextArea rows={4} placeholder="初始4～6℃；正常时围绕4℃小幅波动"/></Form.Item>
      <Form.Item name={[fieldIndex,'stage_event_rules']} label="阶段、事件与关键时点规则（可选）" extra="填写特定区间内如何变化、结束后如何恢复，或某时点的要求。"><Input.TextArea rows={3} placeholder="开门期间向环境温度靠近；关门后逐渐恢复"/></Form.Item>
      <Form.Item name={[fieldIndex,'relations_special_constraints']} label="关联与特殊约束（可选）" extra="填写与其他字段的关系、响应延迟，以及特有的噪声、偏移或缺失要求。"><Input.TextArea rows={3} placeholder="使用同一时刻的环境温度；断网期间读数缺失，不填为0"/></Form.Item>
  </div>;
}

const ENGINE_CATALOG=[
  {value:'coldchain_physics_v1',label:'冷链物理时序引擎 v1',fields:COLD_CHAIN_PARAMETER_OPTIONS.map(item=>item.value),events:EVENT_OPTIONS.map(item=>item.value)},
  {value:'generic_timeseries_engine_v1',label:'通用时序规则引擎 v1',fields:['value','status','latitude','longitude','timestamp'],events:['normal','anomaly','interruption','sensor_error']},
];

function GenerationMethodSelector({ form }) {
  const method=Form.useWatch('generationMethod',form)||'engine';
  return <Card className="main-card" title="生成方式">
    <Form.Item name="generationMethod" rules={[{required:true}]}><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'模型生成',value:'model'},{label:'引擎生成',value:'engine'}]}/></Form.Item>
    <Alert type="info" showIcon message={method==='model'?'模型生成':'引擎生成'} description={method==='model'?'定义允许的事件与每个输出字段的变化规则。系统先生成事件计划，再一次联合生成全部启用字段；本页不会执行模型调用。':'从已接入引擎支持的事件和输出字段中勾选所需能力。'}/>
  </Card>;
}

const ENGINE_FIELD_RULES={temperature_setpoint:'按冷链温区生成稳定设定值',supply_air_temperature:'按制冷状态与设定值计算送风温度',return_air_temperature:'结合送风、环境和负载计算回风温度',cargo_temperature:'按热惯性滞后响应箱内空气温度',ambient_temperature:'按运输阶段生成外界环境温度',relative_humidity:'按环境与开门事件生成湿度变化',gps:'按路线和运输阶段生成连续坐标',power_status:'按断电事件生成供电状态',transport_event:'输出当前运输阶段与事件',network_status:'按联网事件生成在线状态',value:'生成通用数值序列',status:'生成通用状态序列',latitude:'生成纬度序列',longitude:'生成经度序列',timestamp:'生成连续时间戳'};
function HiddenFormValue(){return null;}

function EngineGenerationEditor({ form }) {
  const engineId=Form.useWatch('generationEngineId',form)||'coldchain_physics_v1';
  const selectedFieldValue=Form.useWatch('engineSelectedFields',form);
  const selectedEventValue=Form.useWatch('engineSelectedEvents',form);
  const advancedValue=Form.useWatch('engineEventOverrides',form);
  const selectedFields=Array.isArray(selectedFieldValue)?selectedFieldValue:[];
  const selectedEvents=Array.isArray(selectedEventValue)?selectedEventValue:[];
  const overrides=Array.isArray(advancedValue)?advancedValue.filter(Boolean):[];
  const [advancedEvent,setAdvancedEvent]=useState(null);
  const engine=ENGINE_CATALOG.find(item=>item.value===engineId)||ENGINE_CATALOG[0];
  const fieldRows=engine.fields.map(name=>({english_name:name,chinese_name:COLD_CHAIN_PARAMETER_OPTIONS.find(item=>item.value===name)?.label||({value:'数值',status:'状态',latitude:'纬度',longitude:'经度',timestamp:'时间戳'}[name]||name),generation_rule:ENGINE_FIELD_RULES[name]||'由引擎规则生成'}));
  const eventRows=engine.events.map(name=>({english_name:name,chinese_name:EVENT_OPTIONS.find(item=>item.value===name)?.label||({anomaly:'异常',interruption:'中断',sensor_error:'传感器异常'}[name]||name),generation_rule:DEFAULT_EVENT_DEFINITION_TEXT[EVENT_OPTIONS.find(item=>item.value===name)?.label]||'由引擎按内置事件规则生成'}));
  const toggle=(field,value,checked)=>form.setFieldValue(field,checked?[...new Set([...(field==='engineSelectedFields'?selectedFields:selectedEvents),value])]:(field==='engineSelectedFields'?selectedFields:selectedEvents).filter(item=>item!==value));
  const currentOverride=overrides.find(item=>item.event_id===advancedEvent);
  const openAdvanced=eventId=>{const event=eventRows.find(item=>item.english_name===eventId);const defaults=DEFAULT_EVENT_ADVANCED[event?.chinese_name]||['相关输出字段','按引擎默认范围','所有适用阶段'];if(!overrides.some(item=>item.event_id===eventId))form.setFieldValue('engineEventOverrides',[...overrides,{event_id:eventId,allowed_stages:defaults[2],duration:defaults[1],affected_fields:engine.fields.slice(0,Math.min(3,engine.fields.length)).join(',')}]);setAdvancedEvent(eventId);};
  const updateOverride=(key,value)=>form.setFieldValue('engineEventOverrides',(form.getFieldValue('engineEventOverrides')||[]).filter(Boolean).map(item=>item.event_id===advancedEvent?{...item,[key]:value}:item));
  return <Card className="main-card conversation-step-card section-title" title="引擎能力配置">
    <Form.Item name="engineSelectedFields" hidden><HiddenFormValue/></Form.Item>
    <Form.Item name="engineSelectedEvents" hidden><HiddenFormValue/></Form.Item>
    <Form.Item name="engineEventOverrides" hidden><HiddenFormValue/></Form.Item>
    <Form.Item name="generationEngineId" label="生成引擎" rules={[{required:true,message:'请选择已接入的生成引擎'}]}><Select options={ENGINE_CATALOG.map(({value,label})=>({value,label}))}/></Form.Item>
    <Divider orientation="left">引擎支持的事件</Divider>
    <Table rowKey="english_name" pagination={false} dataSource={eventRows} columns={[
      {title:'中文名',dataIndex:'chinese_name'},{title:'英文名',dataIndex:'english_name',render:value=><Text code>{value}</Text>},{title:'生成规则',dataIndex:'generation_rule'},{title:'高级配置',render:(_,row)=><Button onClick={()=>openAdvanced(row.english_name)}>配置</Button>},{title:'操作',width:80,render:(_,row)=><Checkbox checked={selectedEvents.includes(row.english_name)} onChange={event=>toggle('engineSelectedEvents',row.english_name,event.target.checked)}/>} ]}/>
    <Divider orientation="left">引擎支持的输出字段</Divider>
    <Table rowKey="english_name" pagination={false} dataSource={fieldRows} columns={[
      {title:'中文名',dataIndex:'chinese_name'},{title:'英文名',dataIndex:'english_name',render:value=><Text code>{value}</Text>},{title:'生成规则',dataIndex:'generation_rule'},{title:'操作',width:80,render:(_,row)=><Checkbox checked={selectedFields.includes(row.english_name)} onChange={event=>toggle('engineSelectedFields',row.english_name,event.target.checked)}/>} ]}/>
    <Modal title={`事件高级配置：${eventRows.find(item=>item.english_name===advancedEvent)?.chinese_name||''}`} open={Boolean(advancedEvent)} onCancel={()=>setAdvancedEvent(null)} onOk={()=>setAdvancedEvent(null)} okText="完成" cancelText="取消">
      <Form.Item label="允许发生阶段" required><Input.TextArea rows={3} value={currentOverride?.allowed_stages||''} onChange={event=>updateOverride('allowed_stages',event.target.value)}/></Form.Item>
      <Form.Item label="持续时间" required><Input value={currentOverride?.duration||''} onChange={event=>updateOverride('duration',event.target.value)} placeholder="例如：5～15分钟"/></Form.Item>
      <Form.Item label="影响字段" required><Select mode="multiple" value={String(currentOverride?.affected_fields||'').split(/[,，、]/).filter(Boolean)} options={engine.fields.map(value=>({value,label:value}))} onChange={value=>updateOverride('affected_fields',value.join(','))}/></Form.Item>
    </Modal>
  </Card>;
}

function ParameterQualityRuleEditor({ field, fieldIndex, form }) {
  const mode=Form.useWatch(['fields',fieldIndex,'quality_mode'],form)||'function';
  return <Card size="small" className="coldchain-parameter-card">
    <Row gutter={16}><Col span={8}><Form.Item label="规则名称"><Input value={`${field.label||field.field_id}质检`} disabled/></Form.Item></Col><Col span={8}><Form.Item label="规则 ID"><Input value={`QC-${String(field.field_id||'FIELD').toUpperCase()}`} disabled/></Form.Item></Col><Col span={8}><Form.Item label="检查对象"><Input value={field.label||field.field_id} disabled/></Form.Item></Col></Row>
    <Form.Item name={[fieldIndex,'quality_mode']} label="检查方式" rules={[{required:true}]}><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'函数判断',value:'function'},{label:'语义判断',value:'semantic'}]}/></Form.Item>
    {mode==='function'?<Form.Item name={[fieldIndex,'quality_python']} label="Python 判断函数" rules={[{required:true,whitespace:true}]} extra="统一返回 true 或 false。"><Input.TextArea className="coldchain-code-textarea" rows={8} spellCheck={false}/></Form.Item>:<><Form.Item name={[fieldIndex,'quality_threshold']} label="语义阈值" rules={[{required:true}]}><InputNumber min={0} max={1} step={0.01} style={{width:220}}/></Form.Item><Form.Item name={[fieldIndex,'quality_prompt']} label="语义判断 Prompt" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={6}/></Form.Item><Row gutter={12}><Col span={12}><Form.Item name={[fieldIndex,'quality_positive_example']} label="通过示例（可选）"><Input.TextArea rows={2}/></Form.Item></Col><Col span={12}><Form.Item name={[fieldIndex,'quality_negative_example']} label="不通过示例（可选）"><Input.TextArea rows={2}/></Form.Item></Col></Row></>}
  </Card>;
}

function GlobalQualityRuleEditor({ rule, field, index, remove, form }) {
  const mode=Form.useWatch(['qualityRules',index,'mode'],form)||'function';
  return <Card size="small" className="section-title conversation-quality-rule" title={<Space><Text strong>{rule.name||'新质检规则'}</Text>{rule.system&&<Tag color="blue">预置规则</Tag>}</Space>} extra={<Space><Form.Item name={[field.name,'enabled']} valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item><Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>remove(field.name)}>删除</Button></Space>}>
    <Row gutter={16}><Col span={8}><Form.Item name={[field.name,'name']} label="规则名称" rules={[{required:true,whitespace:true}]}><Input/></Form.Item></Col><Col span={8}><Form.Item name={[field.name,'rule_id']} label="规则 ID"><Input disabled/></Form.Item></Col><Col span={8}><Form.Item name={[field.name,'target']} label="检查对象" rules={[{required:true}]}><Select options={QUALITY_TARGET_OPTIONS}/></Form.Item></Col></Row>
    <Form.Item name={[field.name,'mode']} label="检查方式" rules={[{required:true}]}><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'函数判断',value:'function'},{label:'语义判断',value:'semantic'}]}/></Form.Item>
    {mode==='semantic'?<><Form.Item name={[field.name,'threshold']} label="语义阈值" rules={[{required:true}]}><InputNumber min={0} max={1} step={0.01} style={{width:220}}/></Form.Item><Form.Item name={[field.name,'prompt']} label="语义判断 Prompt" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={6}/></Form.Item><Row gutter={12}><Col span={12}><Form.Item name={[field.name,'positive_example']} label="通过示例（可选）"><Input.TextArea rows={2}/></Form.Item></Col><Col span={12}><Form.Item name={[field.name,'negative_example']} label="不通过示例（可选）"><Input.TextArea rows={2}/></Form.Item></Col></Row></>:<Form.Item name={[field.name,'python_code']} label="Python 判断函数" rules={[{required:true,whitespace:true}]} extra="统一返回 true 或 false。"><Input.TextArea className="coldchain-code-textarea" rows={8} spellCheck={false}/></Form.Item>}
  </Card>;
}

function ModelSceneQualityEditor({ field, index, remove, form, fieldOptions }) {
  const mode=Form.useWatch(['modelQualityRules',index,'mode'],form)||'semantic';
  const enabled=Form.useWatch(['modelQualityRules',index,'enabled'],form)!==false;
  return <Card size="small" className="section-title conversation-quality-rule" title={<Space><Text strong>{form.getFieldValue(['modelQualityRules',index,'name'])||'新场景规则'}</Text><Tag color="purple">模型评审</Tag></Space>} extra={<Space><Form.Item name={[field.name,'enabled']} valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item><Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>remove(field.name)}>删除</Button></Space>}>
    <Form.Item name={[field.name,'rule_id']} hidden><Input/></Form.Item>
    <Row gutter={16}><Col span={10}><Form.Item name={[field.name,'name']} label="规则名称" rules={enabled?[{required:true,whitespace:true,message:'请输入规则名称'}]:[]}><Input placeholder="例如：断电后的温度响应"/></Form.Item></Col><Col span={14}><Form.Item name={[field.name,'target_fields']} label="检查对象" rules={enabled?[{required:true,type:'array',min:1,message:'至少选择一个检查字段'}]:[]}><Select mode="multiple" options={fieldOptions} placeholder="选择第二步已启用字段"/></Form.Item></Col></Row>
    <Form.Item name={[field.name,'condition_scope']} label="检查条件与范围 Prompt" rules={enabled?[{required:true,whitespace:true,message:'请填写检查条件与范围'}]:[]} extra="说明何时适用，以及检查整段、事件期间还是各字段自己的恢复窗口。"><Input.TextArea rows={3} placeholder="所有样本，整条序列"/></Form.Item>
    <Form.Item name={[field.name,'acceptance_requirement']} label="合格判定要求 Prompt" rules={enabled?[{required:true,whitespace:true,message:'请填写合格判定要求'}]:[]} extra="描述应满足的趋势、关联、响应、阈值或结果，不需要填写样本索引。"><Input.TextArea rows={4} placeholder="说明模型应依据实际序列判断哪些表现符合要求"/></Form.Item>
    <Form.Item name={[field.name,'exceptions_tolerance']} label="例外与容差 Prompt（可选）" extra="填写允许偏差，以及证据不足时不能直接判错的情况。"><Input.TextArea rows={3}/></Form.Item>
    <Collapse ghost items={[{key:'advanced',label:'高级设置',children:<><Row gutter={16}><Col span={12}><Form.Item name={[field.name,'on_failure']} label="不满足时处理"><Select options={[{value:'review',label:'进入待复核'},{value:'reject',label:'判定不通过'}]}/></Form.Item></Col><Col span={12}><Form.Item name={[field.name,'mode']} label="检查方式"><Radio.Group options={[{value:'semantic',label:'模型评审'},{value:'function',label:'Python 函数'}]}/></Form.Item></Col></Row>{mode==='function'&&<Form.Item name={[field.name,'python_code']} label="Python 判断函数" rules={enabled?[{required:true,whitespace:true,message:'请填写判断函数'}]:[]} extra="沿用已有函数返回协议；三段文本作为规则说明保留，不再发起模型评审。"><Input.TextArea className="coldchain-code-textarea" rows={8} spellCheck={false}/></Form.Item>}</>}]} />
  </Card>;
}

function QualityConfiguration({ form, fields, generationMethod, labelsEnabled }) {
  const engineId=Form.useWatch('generationEngineId',form)||'coldchain_physics_v1';
  const selectedEngineFields=Form.useWatch('engineSelectedFields',form)||[];
  const engineRules=ENGINE_QUALITY_RULES[engineId]||[];
  const fieldOptions=(generationMethod==='engine'
    ? selectedEngineFields.map(fieldId=>({value:fieldId,label:COLD_CHAIN_PARAMETER_OPTIONS.find(item=>item.value===fieldId)?.label||fieldId}))
    : fields.filter(item=>item.enabled!==false).map(item=>({value:item.field_id,label:item.label||item.field_id}))).filter(item=>item.value);
  const engine=ENGINE_CATALOG.find(item=>item.value===engineId);
  const baseColumns=[
    {title:'启用',width:72,render:(_,rule)=><Checkbox value={rule.rule_id}/>},
    {title:'规则名称',dataIndex:'name',width:260,render:value=><Text strong>{value}</Text>},
    {title:'检查说明',dataIndex:'description'},
  ];
  const privacyColumns=[
    {title:'启用',width:72,render:()=> <Checkbox checked disabled/>},
    {title:'规则包 / 检测项',dataIndex:'name',width:240,render:(value,row)=><Space direction="vertical" size={0}><Text strong>{value}</Text><Text type="secondary" style={{fontSize:12}}>{row.rule_id}</Text></Space>},
    {title:'检查范围',dataIndex:'scope',width:180,render:value=><Tag color="geekblue">{value}</Tag>},
    {title:'检测方法',dataIndex:'engine',width:170},
    {title:'处理级别',dataIndex:'severity',width:100,render:value=><Tag color="red">{value}</Tag>},
    {title:'说明',dataIndex:'description'},
  ];
  const sectionItems=[
    {key:'base',label:<Space><Text strong>基础质检</Text><Tag color="green">{BASE_TIME_SERIES_RULES.length} 个规则</Tag></Space>,children:<><Flex justify="flex-end"><Space><Button type="link" onClick={()=>form.setFieldValue('baseQualityRuleIds',DEFAULT_BASE_RULE_IDS)}>全选</Button><Button type="link" onClick={()=>form.setFieldValue('baseQualityRuleIds',[])}>取消全选</Button></Space></Flex><Form.Item name="baseQualityRuleIds" style={{marginBottom:0}}><Checkbox.Group style={{width:'100%'}}><Table rowKey="rule_id" size="small" pagination={false} dataSource={BASE_TIME_SERIES_RULES} columns={baseColumns}/></Checkbox.Group></Form.Item></>},
    {key:'privacy',label:<Space><Text strong>隐私质检</Text><Tag color="purple">强制启用 · {PRIVACY_QUALITY_RULES.length} 项</Tag></Space>,children:<><Alert type="warning" showIcon message="Dingo PII 负责识别，系统脱敏策略负责处置" description="所有隐私规则强制启用；命中后只保留类型、记录位置和掩码预览，原文默认不进入报告。"/><Table className="section-title" rowKey="rule_id" size="small" pagination={false} dataSource={PRIVACY_QUALITY_RULES} columns={privacyColumns} scroll={{x:960}}/></>},
    {key:'scene',label:<Space><Text strong>场景质检</Text><Tag color={generationMethod==='model'?'purple':'blue'}>{generationMethod==='model'?'模型生成':'引擎生成'}</Tag></Space>,children:<>
      {generationMethod==='engine'?<>
        <Descriptions bordered size="small" column={2} items={[{key:'engine',label:'所选引擎',children:engine?.label||engineId},{key:'fields',label:'已映射字段',children:selectedEngineFields.length?selectedEngineFields.map(id=><Tag key={id}>{COLD_CHAIN_PARAMETER_OPTIONS.find(item=>item.value===id)?.label||id}</Tag>):<Text type="danger">尚未映射字段</Text>}]}/>
        {!engineRules.length?<Empty className="section-title" description="引擎尚未提供场景质检规则"/>:<Form.Item name="engineQualityRuleIds" className="section-title"><Checkbox.Group style={{width:'100%'}}><Table pagination={false} rowKey="rule_id" dataSource={engineRules} columns={[
          {title:'启用',width:72,render:(_,rule)=><Checkbox value={rule.rule_id} disabled={rule.required}/>},
          {title:'规则名称',dataIndex:'name',width:180,render:(value,rule)=><Space><Text strong>{value}</Text>{rule.required?<Tag color="red">必检</Tag>:<Tag color="blue">推荐</Tag>}</Space>},
          {title:'检查说明',dataIndex:'description'},
          {title:'检查对象',render:(_,rule)=>rule.fields.map(id=><Tag key={id} color={selectedEngineFields.includes(id)?'blue':'default'}>{COLD_CHAIN_PARAMETER_OPTIONS.find(item=>item.value===id)?.label||id}</Tag>)},
          {title:'判定参数',width:150,render:()=><Text type="secondary">使用引擎默认配置</Text>},
        ]}/></Checkbox.Group></Form.Item>}
        <Alert type="info" showIcon message="规则消费实际生成结果、冻结计划和 runtime" description="必要字段缺失属于配置错误；没有适用事件记录为“不适用”，不会回退为通过。"/>
      </>:<>
        <Alert type="info" showIcon message="用户配置场景质检 Prompt，默认由模型评审" description="系统会把三段 Prompt、选中字段的实际序列、时间轴、适用事件计划和字段说明一起编译为评审请求；输入不足时返回无法判定。"/>
        <Form.List name="modelQualityRules">{(ruleFields,{add,remove})=><>{ruleFields.map((field,index)=><ModelSceneQualityEditor key={field.key} field={field} index={index} remove={remove} form={form} fieldOptions={fieldOptions}/>)}<Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({rule_id:stableConfigId('QC-SCENE'),name:'',enabled:true,mode:'semantic',target_fields:[],condition_scope:'所有样本，整条序列',acceptance_requirement:'',exceptions_tolerance:'',on_failure:'review',python_code:''})}>新增场景规则</Button></>}</Form.List>
      </>}
    </>},
    {key:'classification',label:<Space><Text strong>分类标签</Text><Tag color="blue">独立功能</Tag></Space>,children:<>
      <Flex justify="flex-end"><Form.Item name="labelsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item></Flex>
      {!labelsEnabled?<Alert type="info" showIcon message="分类标签未启用" description="后续样本不执行分类；已有内容和历史标签保留，重新开启后可继续编辑。"/>:<>
        <Form.Item name="coverageLabelsMarkdown" label="标签枚举值" rules={[{required:true,whitespace:true},{max:2000}]} extra="每行填写“内部值 | 中文名称”。"><Input.TextArea rows={8}/></Form.Item>
        <Form.Item name="coverageLabelingPrompt" label="分类判定要求" rules={[{required:true,whitespace:true},{max:4000}]}><Input.TextArea rows={8}/></Form.Item>
        <Alert type="info" showIcon message="覆盖率与分布分析是独立功能" description="模板页不填写目标数量；有效覆盖依据生成后已核验标签统计，不使用采样目标冒充实际覆盖。"/>
      </>}
    </>},
  ];
  return <Collapse className="section-title" defaultActiveKey={['base','privacy','scene','classification']} items={sectionItems}/>;
}

function SynthesisPromptPreview({ form }) {
  Form.useWatch([],form);
  const values=form.getFieldsValue(true)||{};
  const generationMethod=values.generationMethod||'engine';
  const [seed,setSeed]=useState(20260905);
  const [demoBound,setDemoBound]=useState(true);
  const template=useMemo(()=>({fields:(values.fields||[]).filter(Boolean),event_generation:{scene_config:{business_scene_description:values.businessSceneDescription,monitored_object_and_system:values.monitoredObjectAndSystem,sample_scope:values.sampleScope,normal_operation_patterns:values.normalOperationPatterns,event_parameter_relationships:values.eventParameterRelationships,business_constraints:values.businessConstraints,other_notes:values.otherNotes||''},sampling_dimensions:values.eventDimensions||[],event_definitions:values.eventDefinitions||[],compatibility_rules:COLDCHAIN_MODEL_CONFIGURATION.event_generation.compatibility_rules}}),[values]);
  const assignment=useMemo(()=>demoBound?{selected_values:[{dimension_id:'event_type',dimension_name:'事件类型',option_id:'door_open',option_name:'开门'},{dimension_id:'primary_event_stage',dimension_name:'主要事件发生阶段',option_id:'port',option_name:'港口等待'},{dimension_id:'cargo_type',dimension_name:'货物类型',option_id:'chilled_goods',option_name:'冷藏货物'},{dimension_id:'environment',dimension_name:'环境条件',option_id:'mild_warm',option_name:'常规温暖环境'}],not_applicable_dimensions:[]}:samplePreviewAssignment(template,seed),[template,seed,demoBound]);
  let stage1=null;let stage2=null;let compileError='';
  try{stage1=compileStage1(template,assignment,PREVIEW_RUNTIME);if(demoBound)stage2=compileStage2(template,PREVIEW_RUNTIME,{assignment,event:DEMO_FROZEN_EVENT});}catch(error){compileError=error.message;}
  const assignedEventId=assignment.selected_values?.find(item=>item.dimension_id==='event_type')?.option_id;
  const skeletonInput={business_config:template.event_generation.scene_config,output_fields:(values.fields||[]).filter(field=>field?.enabled!==false),selected_event_definition:(values.eventDefinitions||[]).find(item=>item.event_id===assignedEventId)||null,runtime:PREVIEW_RUNTIME,frozen_event:'待阶段一生成并通过结构校验后绑定',output_schema:'绑定冻结事件后由编译器动态生成'};
  const skeleton={system:STAGE2_SYSTEM,userInput:skeletonInput,userText:JSON.stringify(skeletonInput,null,2),messages:[{role:'system',content:STAGE2_SYSTEM},{role:'user',content:JSON.stringify(skeletonInput,null,2)}]};
  const copy=text=>navigator.clipboard.writeText(text).then(()=>message.success('已复制')).catch(()=>message.error('复制失败'));
  const readableRequest=compiled=><Input.TextArea
    className="coldchain-json-textarea"
    value={JSON.stringify({messages:compiled.messages},null,2)}
    readOnly
    autoSize={{minRows:24,maxRows:40}}
  />;
  const requestViews=compiled=>[
    {key:'system',label:'系统指令（System Prompt）',children:<Input.TextArea className="coldchain-json-textarea" value={compiled.system} readOnly autoSize={{minRows:18,maxRows:30}}/>},
    {key:'user',label:'本条生成指令（User Prompt）',children:<Input.TextArea className="coldchain-json-textarea" value={compiled.userText} readOnly autoSize={{minRows:18,maxRows:30}}/>},
    {key:'request',label:'完整请求',children:readableRequest(compiled)},
  ];
  return <>
    <Alert type="info" showIcon message="模型生成 · 两阶段联合生成" description="预览、切换页签和换采样条件均只运行本地编译器，不调用模型。字段规则按字段配置，第二阶段一次联合生成全部启用字段。"/>
    <Flex justify="space-between" align="center" className="section-title"><Space><Tag color="blue">配置快照已编译</Tag><Tag>演示运行参数：12小时 · 15分钟/点 · 48点</Tag><Tag>估算：{Math.ceil(((stage1?.userText.length||0)+(stage1?.system.length||0))/3)} Tokens（字符估算）</Tag></Space><Button onClick={()=>{setSeed(current=>current+1);setDemoBound(false);}}>换一组采样条件</Button></Flex>
    {compileError&&<Alert className="section-title" type="error" showIcon message="编译校验未通过" description={compileError}/>} 
    <Tabs className="section-title" items={[
      {key:'assignment',label:'已分配采样条件',children:<><Flex justify="flex-end"><Button icon={<CopyOutlined/>} onClick={()=>copy(JSON.stringify(assignment,null,2))}>复制采样条件</Button></Flex><pre className="conversation-prompt-preview section-title">{JSON.stringify(assignment,null,2)}</pre></>},
      {key:'stage1',label:'阶段一：事件生成 Prompt',children:stage1?<><Flex justify="flex-end"><Button icon={<CopyOutlined/>} onClick={()=>copy(JSON.stringify({messages:stage1.messages},null,2))}>复制请求</Button></Flex><Tabs items={requestViews(stage1)}/></>:<Empty description="请先修复编译问题"/>},
      generationMethod==='model'?{key:'stage2',label:'阶段二：时序数据生成 Prompt',children:<><Alert type={demoBound?'warning':'info'} showIcon message={demoBound?'当前绑定内置演示事件':'frozen_event 待阶段一生成并校验'} description={demoBound?'此事件仅用于页面联调，不是当前模型实际生成结果。':'System Prompt与请求骨架可预览；未绑定冻结事件前不是可发送请求。'}/><Flex justify="space-between" align="center" className="section-title"><Space><Tag>预计输出 48 点</Tag><Tag>{(values.fields||[]).filter(field=>field?.enabled!==false).length} 个字段</Tag></Space><Button icon={<CopyOutlined/>} disabled={!stage2} onClick={()=>stage2&&copy(JSON.stringify({messages:stage2.messages},null,2))}>复制可执行请求</Button></Flex><Tabs items={requestViews(stage2||skeleton)}/></>}:null,
    ].filter(Boolean)}/>
  </>;
}

function buildConfiguration(values) {
  const generationMethod=values.generationMethod||'engine';
  const dimensions=values.eventDimensions||[];
  if(generationMethod==='model'&&(dimensions[0]?.dimension_id!=='event_type'||dimensions[0]?.name!=='事件类型'))throw new Error('事件类型必须保留为第一项系统维度');
  if(generationMethod==='model'&&!(dimensions[0]?.values||[]).length)throw new Error('事件类型至少需要一个枚举值');
  if(generationMethod==='model'&&(!dimensions.length||dimensions.some(item=>!item||!String(item.name||'').trim()||!(item.values||[]).length)))throw new Error('每个事件采样维度都必须填写名称并至少维护一个枚举值');
  const eventTypeNames=generationMethod==='engine'?(Array.isArray(values.engineSelectedEvents)?values.engineSelectedEvents:[]):((dimensions[0]?.values||[]).map(value=>String(value||'').trim()).filter(Boolean));
  const definitionByName=new Map((values.eventDefinitions||[]).map(item=>[item.name,item]));
  if(generationMethod==='model')for(const name of eventTypeNames){const item=definitionByName.get(name);if(!item||!String(item.description_definition||'').trim())throw new Error(`请填写“${name}”的事件描述与定义`);if(!String(item.impact_targets||'').trim()||!String(item.duration_range||'').trim()||!String(item.occurrence_conditions||'').trim())throw new Error(`请完成“${name}”的影响对象、持续时间范围和发生条件`);}
  const engineOverrides=new Map((Array.isArray(values.engineEventOverrides)?values.engineEventOverrides:[]).filter(Boolean).map(item=>[item.event_id,item]));
  const selectedEvents=generationMethod==='model'?(values.eventDefinitions||[]).filter(Boolean).map(item=>({...item,prompt:[item.description_definition,item.impact_targets&&`影响对象：${item.impact_targets}`,item.duration_range&&`持续时间范围：${item.duration_range}`,item.intensity_parameters&&`强度参数：${item.intensity_parameters}`,item.occurrence_conditions&&`发生条件：${item.occurrence_conditions}`].filter(Boolean).join('\n'),custom:!EVENT_OPTIONS.some(option=>option.value===item.event_id)})):eventTypeNames.map(eventId=>{const meta=EVENT_OPTIONS.find(item=>item.value===eventId);return {event_id:eventId,name:meta?.label||eventId,engine_rule:true,...(engineOverrides.get(eventId)||{})};});
  const allowedEvents=[...new Set([...eventTypeNames.map(name=>EVENT_NAME_TO_ID[name]).filter(Boolean),...selectedEvents.map(item=>item.event_id)])];
  const safeFields=(Array.isArray(values.fields)?values.fields:[]).filter(Boolean);
  const fieldIds=safeFields.map(item=>item.field_id);
  if(new Set(fieldIds).size!==fieldIds.length)throw new Error('输出字段 ID 必须唯一');
  if(safeFields.some(item=>!PARAMETER_TYPES.some(type=>type.value===item.type)))throw new Error('输出字段存在不支持的数据类型');
  if(safeFields.some(item=>['string','integer'].includes(item.type)&&(item.enum_values||[]).length===0&&item.value_schema?.enum?.length===0))throw new Error('离散输出字段必须维护至少一个枚举值');
  if(fieldIds.includes('return_air_temperature_observed')&&!fieldIds.includes('return_air_temperature'))throw new Error('箱温传感器读数依赖真实箱温（回风），请恢复 return_air_temperature 或删除依赖字段');
  const engine=ENGINE_CATALOG.find(item=>item.value===values.generationEngineId);
  const engineSelectedFields=Array.isArray(values.engineSelectedFields)?values.engineSelectedFields:[];
  if(generationMethod==='engine'&&!engine)throw new Error('请选择已接入的生成引擎');
  if(generationMethod==='engine'&&!eventTypeNames.length)throw new Error('请至少勾选一个引擎事件');
  if(generationMethod==='engine'&&!engineSelectedFields.length)throw new Error('请至少勾选一个引擎输出字段');
  const sourceFields=generationMethod==='model'?safeFields:engineSelectedFields.map(fieldId=>safeFields.find(item=>item.field_id===fieldId)||{field_id:fieldId,label:COLD_CHAIN_PARAMETER_OPTIONS.find(item=>item.value===fieldId)?.label||fieldId,type:['power_status','transport_event','network_status','status'].includes(fieldId)?'string':fieldId==='gps'?'object':'number',unit:DEFAULT_FIELD_UNITS[fieldId]||'',enum_values:[],quality_mode:'function',quality_python:'def validate(value, context):\n    return value is not None'});
  if(generationMethod==='model'&&sourceFields.some(item=>!String(item.overall_change_rules||'').trim()))throw new Error('请填写每个输出字段的整体变化规则');
  const fields=sourceFields.map(item=>{
    const {
      generation_mode='function',generation_python='',generation_prompt='',
      quality_mode='function',quality_threshold=0.8,quality_python='',quality_prompt='',quality_positive_example='',quality_negative_example='',generation_rules,quality_rules,
      ...field
    }=item;
    return {
      ...field,enabled:true,
      generation_rules:[{rule_id:`GEN-${String(item.field_id).toUpperCase()}`,mode:generationMethod,target_field:item.field_id,...(generationMethod==='model'?{prompt_config:{overall_change_rules:item.overall_change_rules,stage_event_rules:item.stage_event_rules||'',relations_special_constraints:item.relations_special_constraints||''}}:{engine_id:values.generationEngineId,engine_field:item.field_id})}],
      quality_rules:[{rule_id:`QC-${String(item.field_id).toUpperCase()}`,name:`${item.label||item.field_id}质检`,target:'temporal_parameters',mode:quality_mode,target_field:item.field_id,...(quality_mode==='function'?{python_code:quality_python}:{threshold:Number(quality_threshold||0.8),prompt:quality_prompt,positive_example:quality_positive_example,negative_example:quality_negative_example})}],
    };
  });
  const coverageLabels=values.labelsEnabled?parseCoverageLabels(values.coverageLabelsMarkdown,allowedEvents,{ignoreUnavailable:true}):[];
  if(coverageLabels.length&&!String(values.coverageLabelingPrompt||'').trim())throw new Error('配置样本标签后需要填写打标签依据 Prompt');
  const selectedBaseIds=new Set(Array.isArray(values.baseQualityRuleIds)?values.baseQualityRuleIds:DEFAULT_BASE_RULE_IDS);
  const engineQualityRules=ENGINE_QUALITY_RULES[values.generationEngineId]||[];
  const selectedEngineRuleIds=new Set([...(values.engineQualityRuleIds||[]),...engineQualityRules.filter(rule=>rule.required).map(rule=>rule.rule_id)]);
  const modelQualityRules=(values.modelQualityRules||[]).filter(Boolean).map(rule=>({
    ...rule,rule_id:rule.rule_id||stableConfigId('QC-SCENE'),enabled:rule.enabled!==false,target_fields:rule.target_fields||[],on_failure:rule.on_failure||'review',
    prompt_config:{condition_scope:rule.condition_scope||'',acceptance_requirement:rule.acceptance_requirement||'',exceptions_tolerance:rule.exceptions_tolerance||''},
    review_input:{include_actual_series:true,include_timeline:true,include_event_plan:true,include_field_context:true,truncation_policy:'fail_if_incomplete'},
    result_protocol:{applicability:['applicable','not_applicable','undetermined'],decision:['pass','fail','review','execution_failed'],evidence_required:true},
  }));
  return {
    name:values.name,description:values.description,scope:'custom',business_type:values.businessType||'传感器时序',
    event_generation:{prompt_version:'timeseries-two-stage/v1',scene_config:{business_scene_description:values.businessSceneDescription,monitored_object_and_system:values.monitoredObjectAndSystem,sample_scope:values.sampleScope,normal_operation_patterns:values.normalOperationPatterns,event_parameter_relationships:values.eventParameterRelationships,business_constraints:values.businessConstraints,other_notes:values.otherNotes||''},scenario_prompt:[values.businessSceneDescription,values.monitoredObjectAndSystem,values.sampleScope,values.normalOperationPatterns,values.eventParameterRelationships,values.businessConstraints,values.otherNotes].filter(Boolean).join('\n\n'),sampling_dimensions:(values.eventDimensions||[]).map((item,index)=>({...item,dimension_id:item.dimension_id||stableConfigId('dim'),option_ids:Object.fromEntries((item.values||[]).map((value,optionIndex)=>[value,item.option_ids?.[value]||`opt_${index}_${optionIndex}_${Date.now().toString(36)}`]))})),allowed_events:allowedEvents,event_definitions:selectedEvents,event_candidates:selectedEvents,compatibility_rules:COLDCHAIN_MODEL_CONFIGURATION.event_generation.compatibility_rules,event_strategy:'candidate_selection',llm_numeric_truth_impact:false},
    coverage:coverageLabels.length?{
      schema_version:'coldchain-coverage/v1',strategy:'template_profile_pass_only',labeling_prompt:values.coverageLabelingPrompt,
      dimensions:[{dimension_id:'primary_event',name:'主要事件',labels:coverageLabels}],
      profiles:coverageLabels.map(item=>({profile_id:`${item.value}_profile`,name:item.name,labels:{primary_event:item.value},target_weight:1,minimum_pass_count:0,required:true})),
    }:null,
    generation:{method:generationMethod,...(generationMethod==='model'?{field_prompt_mode:'per_field_joint_call'}:{engine_id:values.generationEngineId,selected_fields:engineSelectedFields,selected_events:eventTypeNames,event_overrides:values.engineEventOverrides||[]})},
    rule_engine:{engine_id:generationMethod==='engine'?values.generationEngineId:null,user_code_allowed:false},
    quality:{
      base_rules:BASE_TIME_SERIES_RULES.map(rule=>({...rule,enabled:selectedBaseIds.has(rule.rule_id),execution_scope:['BASE-EXACT-DUPLICATE','BASE-NEAR-DUPLICATE'].includes(rule.rule_id)?'batch':'sample'})),
      privacy:{enabled:true,required:true,rules:PRIVACY_QUALITY_RULES.map(rule=>({...rule,enabled:true,required:true}))},
      scene:{active_mode:generationMethod,engine:{engine_id:values.generationEngineId,enabled_rule_ids:[...selectedEngineRuleIds],rules:engineQualityRules.map(rule=>({...rule,enabled:selectedEngineRuleIds.has(rule.rule_id)}))},model:{rules:modelQualityRules}},
      classification:{enabled:Boolean(values.labelsEnabled)},
      rules:generationMethod==='engine'?engineQualityRules.filter(rule=>selectedEngineRuleIds.has(rule.rule_id)).map(rule=>({...rule,mode:'function',enabled:true})):modelQualityRules,
    },
    fields,
    trial_config:{model_alias:values.trialModel||'qwen3-14b',quality_model_alias:values.trialQualityModel||'qwen3-14b',sample_count:Number(values.trialSampleCount||1),step_count:Number(values.trialStepCount||48),interval_minutes:Number(values.trialIntervalMinutes||15),start_time:'2026-09-08T08:00:00+08:00',timezone:'Asia/Shanghai',duration_minutes:Number(values.trialStepCount||48)*Number(values.trialIntervalMinutes||15),...(values.trialGenerationParamsEnabled?{generation_parameters:JSON.parse(values.trialGenerationParamsJson)}:{}),...(values.trialQualityParamsEnabled?{quality_parameters:JSON.parse(values.trialQualityParamsJson)}:{})},
  };
}

function configurationToForm(config) {
  const primaryDimension=(config.coverage?.dimensions||[]).find(item=>item.dimension_id==='primary_event');
  const selectedEvents=new Map((config.event_generation?.event_candidates||[]).map(item=>[item.event_id,item]));
  const allowedEvents=new Set(config.event_generation?.allowed_events||[]);
  const builtInCandidates=DEFAULT_EVENT_CANDIDATES.map(item=>({
    ...item,
    selected:selectedEvents.has(item.event_id)||allowedEvents.has(item.event_id),
    prompt:selectedEvents.get(item.event_id)?.prompt||item.prompt,
  }));
  const customCandidates=(config.event_generation?.event_candidates||[]).filter(item=>item.custom||!ANOMALY_EVENT_OPTIONS.some(option=>option.value===item.event_id)).map(item=>({...item,selected:true,custom:true}));
  const fields=(Array.isArray(config.fields)?config.fields:[]).filter(Boolean).map(item=>{
    const generationRule=(item.generation_rules||[])[0]||{};
    const qualityRule=(item.quality_rules||[])[0]||{};
    const generationMode=item.generation_mode||generationRule.mode||(generationRule.prompt?'semantic':'function');
    const qualityMode=item.quality_mode||qualityRule.mode||(qualityRule.prompt?'semantic':'function');
    const isCustom=Boolean(item.custom)||!COLD_CHAIN_PARAMETER_OPTIONS.some(option=>option.value===item.field_id);
    const parameterLabel=item.label||COLD_CHAIN_PARAMETER_OPTIONS.find(option=>option.value===item.field_id)?.label||item.field_id;
    const parameterType=item.type||(item.field_id==='gps'?'object':['power_status','transport_event','network_status'].includes(item.field_id)?'string':'number');
    return {
      ...item,label:parameterLabel,custom:isCustom,type:parameterType,enabled:true,generation_mode:generationMode,quality_mode:qualityMode,
      unit:item.unit??DEFAULT_FIELD_UNITS[item.field_id]??'',enum_values:item.enum_values||[],
      overall_change_rules:item.overall_change_rules||generationRule.prompt_config?.overall_change_rules||generationRule.prompt||`${parameterLabel} 按业务允许范围随时间连续变化，正常状态下保持合理的小幅波动。`,
      stage_event_rules:item.stage_event_rules||generationRule.prompt_config?.stage_event_rules||'',relations_special_constraints:item.relations_special_constraints||generationRule.prompt_config?.relations_special_constraints||'',
      generation_python:generationRule.python_code||`def generate(context):\n    # 根据当前样本上下文生成 ${parameterLabel}\n    return context.get("${item.field_id}")`,
      generation_prompt:generationRule.prompt||`根据当前运输事件和样本上下文生成“${parameterLabel}”，保持与其它时序参数一致。`,
      quality_python:qualityRule.python_code||`def validate(value, context):\n    # 返回 True 表示该参数通过质检\n    return value is not None`,
      quality_prompt:qualityRule.prompt||`判断“${parameterLabel}”是否符合当前运输事件、时间顺序及关联参数，输出通过、复核或拒绝。`,
      quality_threshold:qualityRule.threshold??0.8,
      quality_positive_example:qualityRule.positive_example||'',quality_negative_example:qualityRule.negative_example||'',
    };
  });
  const scene=config.event_generation?.scene_config||{};
  const legacyPrompt=String(config.event_generation?.scenario_prompt||'').replaceAll('允许事件白名单','异常事件候选').replaceAll('白名单外事件','未选择的候选事件');
  const eventDimensions=normalizeEventDimensions(config.event_generation?.sampling_dimensions);
  const storedDefinitions=config.event_generation?.event_definitions||config.event_generation?.event_candidates||[];
  const byDefinitionName=new Map(storedDefinitions.map(item=>[item.name,item]));
  const byDefinitionId=new Map(storedDefinitions.map(item=>[item.event_id,item]));
  const eventDefinitions=eventDimensions[0].values.map((name,index)=>{const stored=byDefinitionName.get(name)||byDefinitionId.get(EVENT_NAME_TO_ID[name]);const defaults=DEFAULT_EVENT_ADVANCED[name]||['','',''];return {event_id:stored?.event_id||EVENT_NAME_TO_ID[name]||eventDimensions[0].option_ids?.[name]||`event_${index}`,name,description_definition:stored?.description_definition||stored?.prompt||DEFAULT_EVENT_DEFINITION_TEXT[name]||'',impact_targets:stored?.impact_targets||defaults[0],duration_range:stored?.duration_range||defaults[1],intensity_parameters:stored?.intensity_parameters||'',occurrence_conditions:stored?.occurrence_conditions||defaults[2],parameter_names:stored?.parameter_names||[]};});
  const generation=config.generation||{};const generationMethod=generation.method||'engine';
  const engineFieldMappings=generation.field_mappings||fields.map(item=>({source_field_id:item.field_id,source_field_name:item.label,engine_field:item.generation_rules?.[0]?.engine_field||item.field_id}));
  const engineEventMappings=generation.event_mappings||eventDefinitions.map(item=>({source_event:item.name,engine_event:item.event_id}));
  return {
    name:config.name,businessType:config.business_type||'传感器时序',description:config.description,
    businessSceneDescription:scene.business_scene_description||legacyPrompt||'冷藏货物经历公路运输、港口等待和海运，期间持续进行环境与设备监测',
    monitoredObjectAndSystem:scene.monitored_object_and_system||'一台装载货物的冷藏集装箱，包含制冷设备、箱内空气、货物及温湿度传感器',
    sampleScope:scene.sample_scope||'一条样本对应一个集装箱的一次运输过程，包含多个连续监测时刻',
    normalOperationPatterns:scene.normal_operation_patterns||'制冷设备围绕设定温度调节；送风、回风和货物温度存在差异；货物温度变化通常比空气温度慢',
    eventParameterRelationships:scene.event_parameter_relationships||'开门改变内外空气交换；断电影响制冷能力；传感器偏移影响读数，不直接改变真实货温',
    businessConstraints:scene.business_constraints||'公路阶段的位置沿路线推进；短时断电不必然导致货温超限；网络中断不等于温度变为0',
    dataUsage:scene.data_usage||'检验异常识别流程，区分设备异常与传感器异常',otherNotes:scene.other_notes||'',
    eventDimensions,eventDefinitions,eventCandidates:[...builtInCandidates,...customCandidates],fields,
    generationMethod,generationEngineId:generation.engine_id||config.rule_engine?.engine_id||'coldchain_physics_v1',engineFieldMappings,engineEventMappings,
    engineSelectedFields:generation.selected_fields?.length?generation.selected_fields:fields.map(item=>item.field_id),engineSelectedEvents:generation.selected_events?.length?generation.selected_events:eventDefinitions.map(item=>item.event_id),engineEventOverrides:generation.event_overrides||eventDefinitions.map(item=>({event_id:item.event_id,allowed_stages:item.occurrence_conditions,duration:item.duration_range,affected_fields:fields.slice(0,3).map(field=>field.field_id).join(',')})),
    modelInitialStateRange:generation.model_config?.initial_state_and_range||'设定温度4℃；初始箱温4～6℃，初始货温5～7℃',modelNormalChangeRules:generation.model_config?.normal_change_rules||'设定值保持不变；箱温围绕设定值小幅波动',modelFieldRelations:generation.model_config?.field_relations_and_delay||'货温跟随箱温变化，但响应更慢；两者不能每个时刻完全相同',modelEventRecoveryRules:generation.model_config?.event_impact_and_recovery||'开门期间箱温向环境温度靠近；关门后逐渐恢复，货温响应滞后',modelNoiseMissingRules:generation.model_config?.noise_and_missing_rules||'温度读数叠加小幅噪声；断网期间观测值缺失，不填写为0',
    labelsEnabled:config.quality?.classification?.enabled??(config.coverage!==null),
    coverageLabelingPrompt:config.coverage?.labeling_prompt||DEFAULT_COVERAGE_PROMPT,
    coverageLabelsMarkdown:config.coverage==null?DEFAULT_COVERAGE_LABELS:(primaryDimension?.labels||[]).map(item=>`${item.value} | ${item.name||item.value}`).join('\n'),
    baseQualityRuleIds:Array.isArray(config.quality?.base_rules)&&config.quality.base_rules.some(rule=>DEFAULT_BASE_RULE_IDS.includes(rule.rule_id)&&Object.prototype.hasOwnProperty.call(rule,'enabled'))?config.quality.base_rules.filter(rule=>rule.enabled!==false&&DEFAULT_BASE_RULE_IDS.includes(rule.rule_id)).map(rule=>rule.rule_id):DEFAULT_BASE_RULE_IDS,
    engineQualityRuleIds:config.quality?.scene?.engine?.enabled_rule_ids||ENGINE_QUALITY_RULES[generation.engine_id||config.rule_engine?.engine_id||'coldchain_physics_v1']?.filter(rule=>rule.required||rule.recommended).map(rule=>rule.rule_id)||[],
    modelQualityRules:config.quality?.scene?.model?.rules?.length?config.quality.scene.model.rules.map(rule=>({...rule,condition_scope:rule.condition_scope||rule.prompt_config?.condition_scope||'所有样本，整条序列',acceptance_requirement:rule.acceptance_requirement||rule.prompt_config?.acceptance_requirement||rule.prompt||'',exceptions_tolerance:rule.exceptions_tolerance||rule.prompt_config?.exceptions_tolerance||''})):(generationMethod==='model'&&config.quality?.rules?.length?config.quality.rules.map(rule=>({rule_id:rule.rule_id,name:rule.name,enabled:rule.enabled!==false,mode:rule.mode||'semantic',target_fields:rule.target_fields||fields.map(item=>item.field_id),condition_scope:rule.condition_scope||rule.prompt_config?.condition_scope||'所有样本，整条序列',acceptance_requirement:rule.acceptance_requirement||rule.prompt_config?.acceptance_requirement||rule.prompt||'',exceptions_tolerance:rule.exceptions_tolerance||rule.prompt_config?.exceptions_tolerance||[rule.positive_example,rule.negative_example].filter(Boolean).join('\n'),on_failure:rule.on_failure||'review',python_code:rule.python_code||''})):DEFAULT_MODEL_QUALITY_RULES.map(rule=>({...rule,target_fields:[...rule.target_fields]}))),
    qualityRules:config.quality?.rules||[],
    trialModel:config.trial_config?.model_alias||'qwen3-14b',trialQualityModel:config.trial_config?.quality_model_alias||'qwen3-14b',trialSampleCount:config.trial_config?.sample_count||2,trialStepCount:config.trial_config?.step_count||100,trialIntervalMinutes:config.trial_config?.interval_minutes||10,trialGenerationParamsEnabled:Object.prototype.hasOwnProperty.call(config.trial_config||{},'generation_parameters'),trialGenerationParamsJson:JSON.stringify(config.trial_config?.generation_parameters||{temperature:0.7,top_p:0.9},null,2),trialQualityParamsEnabled:Object.prototype.hasOwnProperty.call(config.trial_config||{},'quality_parameters'),trialQualityParamsJson:JSON.stringify(config.trial_config?.quality_parameters||{temperature:0.1},null,2),
  };
}

const TRIAL_CHART_COLORS=['#1677ff','#52c41a','#fa8c16','#722ed1','#13c2c2','#eb2f96','#2f54eb','#a0d911'];

function TimeSeriesTrialChart({ rows=[], fields=[] }) {
  if(!rows.length||!fields.length)return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可绘制的数值型输出参数"/>;
  const width=1080,height=430,left=70,right=30,top=54,bottom=70,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const values=rows.flatMap(row=>fields.map(field=>Number(row[field.field_id])).filter(Number.isFinite));
  let min=Math.min(...values),max=Math.max(...values);if(min===max){min-=1;max+=1;}const padding=(max-min)*0.08;min-=padding;max+=padding;
  const x=index=>left+(index/Math.max(1,rows.length-1))*plotWidth;
  const y=value=>top+(max-Number(value))/(max-min)*plotHeight;
  const ticks=Array.from({length:6},(_,index)=>min+(max-min)*index/5);
  return <div style={{overflowX:'auto'}}><svg viewBox={`0 0 ${width} ${height}`} style={{display:'block',width:'100%',minWidth:820,background:'#fff'}} role="img" aria-label="试运行时序参数曲线">
    {ticks.map(value=><g key={value}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#eef0f3"/><text x={left-10} y={y(value)+4} textAnchor="end" fontSize="12" fill="#6b7280">{value.toFixed(1)}</text></g>)}
    <line x1={left} x2={left} y1={top} y2={height-bottom} stroke="#9ca3af"/><line x1={left} x2={width-right} y1={height-bottom} y2={height-bottom} stroke="#9ca3af"/>
    {fields.map((field,index)=><polyline key={field.field_id} fill="none" stroke={TRIAL_CHART_COLORS[index%TRIAL_CHART_COLORS.length]} strokeWidth="2" points={rows.map((row,rowIndex)=>`${x(rowIndex)},${y(row[field.field_id])}`).join(' ')}/>) }
    {[0,Math.floor((rows.length-1)/2),rows.length-1].map(index=><text key={index} x={x(index)} y={height-bottom+24} textAnchor={index===0?'start':index===rows.length-1?'end':'middle'} fontSize="12" fill="#6b7280">{rows[index]?.timestamp}</text>)}
    <text x={16} y={top-22} fontSize="13" fill="#374151">数值</text><text x={width/2} y={height-14} textAnchor="middle" fontSize="13" fill="#374151">时间戳</text>
    {fields.map((field,index)=>{const legendX=left+(index%4)*240,legendY=18+Math.floor(index/4)*22;return <g key={`legend-${field.field_id}`}><line x1={legendX} x2={legendX+22} y1={legendY} y2={legendY} stroke={TRIAL_CHART_COLORS[index%TRIAL_CHART_COLORS.length]} strokeWidth="3"/><text x={legendX+28} y={legendY+4} fontSize="12" fill="#374151">{field.label}</text></g>;})}
  </svg></div>;
}

function downloadTrialCsv(rows=[], templateName='时序模板') {
  if(!rows.length)return;
  const columns=[];
  rows.forEach(row=>Object.keys(row||{}).forEach(key=>{if(!columns.includes(key))columns.push(key);}));
  const escapeCell=value=>{
    const text=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
    return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  };
  const csv=`\uFEFF${[columns,...rows.map(row=>columns.map(key=>row?.[key]))].map(line=>line.map(escapeCell).join(',')).join('\r\n')}`;
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`${templateName||'时序模板'}-试运行完整数据.csv`;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),0);
}

function GpsTrialChart({ points=[] }) {
  if(!points.length)return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有 GPS 输出数据"/>;
  const width=1080,height=390,left=75,right=35,top=35,bottom=60;
  const longs=points.map(item=>item.longitude),lats=points.map(item=>item.latitude);const minLng=Math.min(...longs),maxLng=Math.max(...longs),minLat=Math.min(...lats),maxLat=Math.max(...lats);
  const x=value=>left+(value-minLng)/Math.max(0.00001,maxLng-minLng)*(width-left-right);const y=value=>top+(maxLat-value)/Math.max(0.00001,maxLat-minLat)*(height-top-bottom);
  return <div style={{overflowX:'auto'}}><svg viewBox={`0 0 ${width} ${height}`} style={{display:'block',width:'100%',minWidth:820,background:'#f7fbff'}} role="img" aria-label="试运行 GPS 轨迹图">
    {Array.from({length:6},(_,index)=><g key={index}><line x1={left} x2={width-right} y1={top+index*(height-top-bottom)/5} y2={top+index*(height-top-bottom)/5} stroke="#e2e8f0"/><line y1={top} y2={height-bottom} x1={left+index*(width-left-right)/5} x2={left+index*(width-left-right)/5} stroke="#e2e8f0"/></g>)}
    <polyline fill="none" stroke="#1677ff" strokeWidth="3" points={points.map(item=>`${x(item.longitude)},${y(item.latitude)}`).join(' ')}/>
    {points.filter((_,index)=>index===0||index===points.length-1||index%Math.max(1,Math.floor(points.length/8))===0).map((item,index)=><circle key={index} cx={x(item.longitude)} cy={y(item.latitude)} r={index===0||item===points.at(-1)?6:3} fill={index===0?'#52c41a':item===points.at(-1)?'#ff4d4f':'#1677ff'}/>) }
    <text x={left} y={height-18} fontSize="12" fill="#374151">起点：{minLng.toFixed(2)}°E</text><text x={width-right} y={height-18} textAnchor="end" fontSize="12" fill="#374151">终点：{maxLng.toFixed(2)}°E</text><text x={16} y={top} fontSize="12" fill="#374151">{maxLat.toFixed(2)}°N</text><text x={16} y={height-bottom} fontSize="12" fill="#374151">{minLat.toFixed(2)}°N</text>
  </svg></div>;
}

export function ColdChainTemplateEditor({ draftId, template, onClose, onPublished, readOnly = false }) {
  const [form]=Form.useForm();const [step,setStep]=useState(0);const [draft,setDraft]=useState(null);const [dirty,setDirty]=useState(false);const [action,setAction]=useState('');const [loading,setLoading]=useState(true);const [validation,setValidation]=useState(null);const [trial,setTrial]=useState(null);
  useEffect(()=>{let active=true;setLoading(true);const request=draftId?coldchainApi.getTemplateDraft(draftId):template?Promise.resolve(template):coldchainApi.createTemplateDraft({});request.then(value=>{if(!active)return;setDraft(value);setValidation(value.validation||null);setTrial(value.trial_run||null);form.setFieldsValue(configurationToForm(value.configuration||value));setDirty(false);}).catch(error=>message.error(error.message)).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[draftId,template,form]);
  const save=async({quiet=false}={})=>{setAction('save');try{await form.validateFields();const config=buildConfiguration(form.getFieldsValue(true));const response=await coldchainApi.saveTemplateDraft(draft.draft_id,config,draft.revision);setDraft(response);setValidation(response.validation||null);setTrial(response.trial_run||null);setDirty(false);if(!quiet)message.success('草稿已保存');return response;}finally{setAction('');}};
  const ensureSaved=async()=>!draft||dirty?save({quiet:true}):draft;
  const next=async()=>{if(readOnly){setStep(value=>Math.min(STEP_ITEMS.length-1,value+1));return;}try{if(step===0)await form.validateFields(['name','businessType','description','businessSceneDescription','monitoredObjectAndSystem','sampleScope','normalOperationPatterns','eventParameterRelationships','businessConstraints','otherNotes']);else await form.validateFields();await save({quiet:true});setStep(value=>Math.min(STEP_ITEMS.length-1,value+1));}catch(error){if(error?.errorFields)message.warning('请检查当前步骤配置');else message.error(error.message);}};
  const runTrial=async()=>{setAction('trial');try{const fields=['trialModel','trialQualityModel','trialSampleCount','trialStepCount','trialIntervalMinutes'];if(form.getFieldValue('trialGenerationParamsEnabled'))fields.push('trialGenerationParamsJson');if(form.getFieldValue('trialQualityParamsEnabled'))fields.push('trialQualityParamsJson');await form.validateFields(fields);const saved=await ensureSaved();const checked=await coldchainApi.validateTemplateDraft(saved.draft_id,saved.revision);setValidation(checked);if(!checked.valid){message.error((checked.errors||[]).join('；'));return;}const values=form.getFieldsValue(true);const generationParameters=values.trialGenerationParamsEnabled?JSON.parse(values.trialGenerationParamsJson):null;const qualityParameters=values.trialQualityParamsEnabled?JSON.parse(values.trialQualityParamsJson):null;const result=await coldchainApi.trialTemplateDraft(saved.draft_id,{expected_revision:saved.revision,model_alias:values.trialModel||'qwen3-14b',quality_model_alias:values.trialQualityModel||'qwen3-14b',sample_count:Number(values.trialSampleCount||2),step_count:Number(values.trialStepCount||100),interval_minutes:Number(values.trialIntervalMinutes||10),...(generationParameters?{generation_parameters:generationParameters}:{}),...(qualityParameters?{quality_parameters:qualityParameters}:{})});setTrial(result);message[result.status==='PASS'?'success':'error'](`试运行质检：${result.status}`);}catch(error){if(error?.errorFields)message.warning('请检查试运行配置');else message.error(error.message);}finally{setAction('');}};
  const publish=async()=>{setAction('publish');try{const response=await coldchainApi.publishTemplateDraft(draft.draft_id,draft.revision);message.success(`${response.published_template.template_id} / ${response.published_template.version} 已发布`);onPublished?.(response.published_template);}catch(error){message.error(error.message);}finally{setAction('');}};
  const currentTrial=trial&&draft&&trial.revision===draft.revision;
  const labelsEnabled=Form.useWatch('labelsEnabled',{form,preserve:true});
  const trialGenerationParamsEnabled=Form.useWatch('trialGenerationParamsEnabled',{form,preserve:true});
  const trialQualityParamsEnabled=Form.useWatch('trialQualityParamsEnabled',{form,preserve:true});
  const watchedQualityRules=Form.useWatch('modelQualityRules',{form,preserve:true})||[];
  const watchedTrialSampleCount=Form.useWatch('trialSampleCount',{form,preserve:true})||2;
  const generationMethod=Form.useWatch('generationMethod',{form,preserve:true})||'engine';
  if(loading)return <Spin tip="正在加载时序模板草稿"><div style={{height:200}}/></Spin>;
  const fields=(Array.isArray(form.getFieldValue('fields'))?form.getFieldValue('fields'):[]).filter(Boolean);
  const semanticRuleCount=generationMethod==='model'?watchedQualityRules.filter(rule=>rule.enabled!==false&&rule.mode!=='function').length:0;
  const generationCallEstimate=Number(watchedTrialSampleCount);const qualityCallEstimate=Number(watchedTrialSampleCount)*semanticRuleCount;
  return <div className="template-create-page coldchain-template-create-page">
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={onClose}/><div><Title level={2}>时序类数据模板</Title><Paragraph type="secondary">依次完成场景定义、生成配置、两阶段指令预览、质检规则和试运行。</Paragraph></div></Space></Flex>
    <Flex justify="space-between" align="center" wrap="wrap" gap={12} className="conversation-template-statusbar template-editor-step-actions-top">
      <Space><Tag color="blue">草稿已保存</Tag>{dirty&&<Tag color="orange">未保存</Tag>}{validation?.valid&&<Tag color="cyan">静态校验通过</Tag>}{currentTrial&&<Tag color={trial.status==='PASS'?'green':'red'}>试运行 {trial.status}</Tag>}<Text type="secondary">草稿 ID：{draft.draft_id}</Text></Space>
      <Space><Button icon={<ArrowLeftOutlined/>} disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))}>上一步</Button>{!readOnly&&<Button icon={<SaveOutlined/>} loading={action==='save'} disabled={!dirty} onClick={()=>save()}>保存模板草稿</Button>}{step<STEP_ITEMS.length-1&&<Button type="primary" icon={<ArrowRightOutlined/>} loading={action==='save'} onClick={next}>下一步</Button>}{!readOnly&&step===STEP_ITEMS.length-1&&<Button type="primary" icon={<CheckCircleOutlined/>} disabled={!currentTrial||trial.status!=='PASS'} loading={action==='publish'} onClick={publish}>发布模板</Button>}</Space>
    </Flex>
    <Steps current={step} items={STEP_ITEMS} onChange={target=>readOnly?setStep(target):target<step?setStep(target):null} className="template-editor-steps"/>
    <Form disabled={readOnly} form={form} layout="vertical" onValuesChange={changed=>{if(Object.keys(changed).every(key=>['trialModel','trialSampleCount'].includes(key)))return;setDirty(true);setValidation(null);setTrial(null);}}>
      {step===0&&<>
        <Card className="main-card" title="模板基本信息">
        <Row gutter={16}><Col span={12}><Form.Item name="name" label="模板名称" rules={[{required:true},{max:80}]}><Input/></Form.Item></Col><Col span={12}><Form.Item name="businessType" label="业务类型" rules={[{required:true},{max:80}]}><Input placeholder="例如：传感器时序"/></Form.Item></Col></Row>
        <Form.Item name="description" label="模板描述" rules={[{max:500}]}><Input.TextArea rows={3} maxLength={500} showCount placeholder="简要说明模板覆盖的时序业务和用途"/></Form.Item>
        </Card>
        <Card className="main-card conversation-step-card section-title" title="事件场景配置">
          <Alert type="info" showIcon message="描述业务过程、对象和约束边界" description="系统依据场景、事件和字段规则，分两阶段生成事件计划与时序数据。"/>
          <Form.Item className="section-title" name="businessSceneDescription" label="业务场景说明" rules={[{required:true,whitespace:true},{max:2000}]} extra="填写什么业务过程、在什么环境中发生。"><Input.TextArea rows={3} placeholder="冷藏货物经历公路运输、港口等待和海运，期间持续进行环境与设备监测"/></Form.Item>
          <Form.Item name="monitoredObjectAndSystem" label="监测对象与系统组成" rules={[{required:true,whitespace:true},{max:2000}]} extra="说明观察对象，以及由哪些关键部分组成。"><Input.TextArea rows={3} placeholder="一台装载货物的冷藏集装箱，包含制冷设备、箱内空气、货物及温湿度传感器"/></Form.Item>
          <Form.Item name="sampleScope" label="单条样本范围" rules={[{required:true,whitespace:true},{max:2000}]} extra="说明一条样本覆盖一个还是多个对象，代表什么过程。"><Input.TextArea rows={3} placeholder="一条样本对应一个集装箱的一次运输过程，包含多个连续监测时刻"/></Form.Item>
          <Form.Item name="normalOperationPatterns" label="正常运行规律" rules={[{required:true,whitespace:true},{max:2000}]} extra="说明没有目标异常时系统通常怎样运行。"><Input.TextArea rows={3} placeholder="制冷设备围绕设定温度调节；送风、回风和货物温度存在差异；货物温度变化通常比空气温度慢"/></Form.Item>
          <Form.Item name="eventParameterRelationships" label="事件影响与参数关联" rules={[{required:true,whitespace:true},{max:2000}]} extra="说明事件影响哪些量、字段依赖以及恢复过程。"><Input.TextArea rows={3} placeholder="开门改变内外空气交换；断电影响制冷能力；传感器偏移影响读数，不直接改变真实货温"/></Form.Item>
          <Form.Item name="businessConstraints" label="业务约束与边界" rules={[{required:true,whitespace:true},{max:2000}]} extra="说明不能出现的情况和不能随意假设的结论。"><Input.TextArea rows={4} placeholder="公路阶段的位置沿路线推进；短时断电不必然导致货温超限；网络中断不等于温度变为0"/></Form.Item>
          <Form.Item name="otherNotes" label="其它说明（可选）" rules={[{max:1000}]}><Input.TextArea rows={2} placeholder="尚未覆盖的业务补充，可留空"/></Form.Item>
        </Card>
      </>}
      {step===1&&<>
      <GenerationMethodSelector form={form}/>
      {generationMethod==='model'?<>
      <Card className="main-card conversation-step-card section-title" title="事件生成配置">
        <Card size="small" className="conversation-config-card" title="事件采样维度"><EventSamplingDimensionsEditor form={form}/></Card>
        <Card size="small" className="conversation-config-card section-title" title="事件定义">
          <EventDefinitionsEditor form={form}/>
        </Card>
      </Card>
      <Card className="main-card conversation-step-card section-title" title="输出字段">
        <Alert type="success" showIcon message="配置输出字段及其生成方式" description="参数质检规则统一放在后续“质检规则配置”步骤。"/>
        <Form.List name="fields">{(fieldItems,{add,remove})=><><Collapse className="section-title" defaultActiveKey={['return_air_temperature']} items={fieldItems.map(item=>{const field=form.getFieldValue(['fields',item.name])||{};return {key:field.field_id||String(item.key),label:<Flex justify="space-between" align="center"><Space><Text strong>{field.label||field.field_id||'输出字段'}</Text><Tag color="blue">可编辑</Tag></Space><Button type="text" danger icon={<DeleteOutlined/>} onClick={event=>{event.stopPropagation();remove(item.name);}}>删除字段</Button></Flex>,children:<FieldRuleEditor fieldIndex={item.name}/>};})}/><Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({field_id:`custom_parameter_${Date.now()}`,label:'',type:'number',unit:'',enum_values:[],enabled:true,custom:true,overall_change_rules:'',stage_event_rules:'',relations_special_constraints:'',quality_mode:'function',quality_python:'def validate(value, context):\n    return value is not None',quality_prompt:''})}>添加输出字段</Button></>}</Form.List>
      </Card></>:<EngineGenerationEditor form={form}/>}</>}
      {step===2&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[2].title}><SynthesisPromptPreview form={form}/></Card>}
      {step===3&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[3].title}>
        <Alert type="info" showIcon message="配置本模板实际执行的质检范围" description="本页只制定规则，不展示模拟通过结果；执行状态、证据和错误请在试运行或任务报告中查看。"/>
        <div className="section-title"><QualityConfiguration form={form} fields={fields} generationMethod={generationMethod} labelsEnabled={labelsEnabled}/></div>
      </Card>}
      {step===4&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[4].title}>
        <Divider orientation="left">生成配置</Divider>
        <Row gutter={16} className="section-title"><Col span={9}><Form.Item name="trialModel" label="生成模型" rules={[{required:true}]}><Select options={[{value:'qwen3-14b',label:'Qwen3-14B（非思考模式）'}]}/></Form.Item></Col><Col span={5}><Form.Item name="trialSampleCount" label="试运行样本数量" rules={[{required:true}]}><InputNumber min={1} max={5} addonAfter="票" style={{width:'100%'}}/></Form.Item></Col><Col span={5}><Form.Item name="trialStepCount" label="时序数据步数" rules={[{required:true}]}><InputNumber min={2} max={10000} addonAfter="步" style={{width:'100%'}}/></Form.Item></Col><Col span={5}><Form.Item name="trialIntervalMinutes" label="时间戳间隔" rules={[{required:true}]}><InputNumber min={1} max={1440} addonAfter="分钟" style={{width:'100%'}}/></Form.Item></Col></Row>
        <Card size="small" className="conversation-config-card" title="生成模型参数（可选）" extra={<Form.Item name="trialGenerationParamsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="关闭"/></Form.Item>}>
          {!trialGenerationParamsEnabled?<Alert type="info" showIcon message="使用模型默认生成参数" description="关闭后，试运行请求不会传递任何生成参数。"/>:<Form.Item name="trialGenerationParamsJson" extra="使用 JSON 配置温度、Top P 等模型参数。" rules={[{validator:(_,value)=>{try{const parsed=JSON.parse(String(value||''));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?Promise.resolve():Promise.reject(new Error('请输入 JSON 对象'));}catch{return Promise.reject(new Error('JSON 格式不正确'));}}}]}><Input.TextArea className="coldchain-json-textarea" rows={7} spellCheck={false} placeholder={'{\n  "temperature": 0.7,\n  "top_p": 0.9\n}'}/></Form.Item>}
        </Card>
        <Divider orientation="left">质检配置</Divider>
        <Form.Item name="trialQualityModel" label="质检模型" rules={[{required:true}]}><Select options={[{value:'qwen3-14b',label:'Qwen3-14B（非思考模式）'}]}/></Form.Item>
        <Card size="small" className="conversation-config-card" title="质检模型参数（可选）" extra={<Form.Item name="trialQualityParamsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="关闭"/></Form.Item>}>
          {!trialQualityParamsEnabled?<Alert type="info" showIcon message="使用质检模型默认参数" description="关闭后，质检请求不会传递任何模型参数。"/>:<Form.Item name="trialQualityParamsJson" extra="使用 JSON 配置质检模型参数。" rules={[{validator:(_,value)=>{try{const parsed=JSON.parse(String(value||''));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?Promise.resolve():Promise.reject(new Error('请输入 JSON 对象'));}catch{return Promise.reject(new Error('JSON 格式不正确'));}}}]}><Input.TextArea className="coldchain-json-textarea" rows={7} spellCheck={false} placeholder={'{\n  "temperature": 0.1\n}'}/></Form.Item>}
        </Card>
        <Descriptions className="section-title" bordered size="small" column={3} items={[{key:'generation',label:'生成模型调用预估',children:`${generationCallEstimate} 次`},{key:'quality',label:'质检模型调用预估',children:`${qualityCallEstimate} 次`},{key:'total',label:'API 总调用次数预估',children:<Text strong>{generationCallEstimate+qualityCallEstimate} 次</Text>}]}/>
        {!readOnly&&<Flex justify="flex-end"><Button type="primary" icon={<SafetyCertificateOutlined/>} loading={action==='trial'} onClick={runTrial}>开始试运行并质检</Button></Flex>}
        <Divider/>{!currentTrial?<Empty description={trial?'模板已修改，原试运行结果失效':'尚未试运行'}/>:<Card size="small" title={`试运行结果：${trial.status}`} extra={<Tag color={trial.status==='PASS'?'green':'red'}>{trial.status}</Tag>}><Descriptions bordered size="small" column={3} items={[
          {key:'model',label:'生成模型',children:trial.model_alias},{key:'quality-model',label:'质检模型',children:trial.quality_model_alias},{key:'count',label:'样本数量',children:`${trial.sample_count} 票`},
          {key:'steps',label:'时序规格',children:`${trial.step_count} 步 / ${trial.interval_minutes} 分钟间隔`},
          {key:'qwen',label:'Qwen',children:`${trial.qwen?.status} / ${trial.qwen?.call_count||0} 次`},{key:'score',label:'平均质量分',children:trial.quality?.average_score??'-'},
          {key:'local',label:'本地规则',children:trial.quality?.local_rule_pass?<Tag color="green">通过</Tag>:<Tag color="red">未通过</Tag>},
          {key:'status',label:'样本结论',children:Object.entries(trial.quality?.status_counts||{}).map(([key,value])=><Tag key={key} color={key==='PASS'?'green':key==='REVIEW'?'orange':'red'}>{key} {value}</Tag>)},
        ]}/>
          <Card className="section-title" size="small" title="1. 事件内容生成请求">
            <Tabs items={[
              {key:'assignment',label:'分配采样条件',children:<Input.TextArea className="coldchain-json-textarea" value={JSON.stringify(trial.assignment||{},null,2)} readOnly autoSize={{minRows:14,maxRows:26}}/>},
              {key:'stage1',label:'阶段一完整请求',children:<Input.TextArea className="coldchain-json-textarea" value={JSON.stringify(trial.stage1_request||{},null,2)} readOnly autoSize={{minRows:14,maxRows:26}}/>},
            ]}/>
          </Card>
          <Card className="section-title" size="small" title="2. 事件内容合成" extra={<Text copyable={{text:JSON.stringify(trial.generated_event||{},null,2)}}>复制 JSON</Text>}>
            <Input.TextArea className="coldchain-json-textarea" value={JSON.stringify(trial.generated_event||{},null,2)} readOnly autoSize={{minRows:14,maxRows:26}}/>
          </Card>
          {trial.stage2_request&&<Card className="section-title" size="small" title="3. 阶段二完整请求" extra={<Text copyable={{text:JSON.stringify(trial.stage2_request,null,2)}}>复制 JSON</Text>}>
            <Input.TextArea className="coldchain-json-textarea" value={JSON.stringify(trial.stage2_request,null,2)} readOnly autoSize={{minRows:14,maxRows:26}}/>
          </Card>}
          <Divider orientation="left">输出参数时序曲线</Divider>
          <TimeSeriesTrialChart rows={trial.output_series||[]} fields={trial.numeric_fields||[]}/>
          <Flex justify="flex-end" className="section-title"><Button icon={<DownloadOutlined/>} disabled={!trial.output_series?.length} onClick={()=>downloadTrialCsv(trial.output_series,draft.name)}>下载完整数据（CSV）</Button></Flex>
          <Divider orientation="left">GPS 轨迹</Divider>
          <GpsTrialChart points={trial.gps_track||[]}/>
          <Divider orientation="left">质检项目明细</Divider>
          <Table rowKey="key" size="small" pagination={false} scroll={{x:1040}} dataSource={trial.quality_items||[]} columns={[
            {title:'质检项目',dataIndex:'name',width:220},{title:'检查对象',dataIndex:'target',width:180},
            {title:'判断方式',dataIndex:'evaluator',width:110,render:value=><Tag color={value==='semantic'?'blue':'green'}>{value==='semantic'?'语义判断':'规则判断'}</Tag>},
            {title:'质检内容',dataIndex:'content',width:420},{title:'阈值',dataIndex:'threshold',width:80,render:(value,row)=>row.evaluator==='semantic'?Number(value).toFixed(2):'-'},
            {title:'输出结果',dataIndex:'output',width:110,fixed:'right',render:(value,row)=>{const passed=row.evaluator==='semantic'?Number(value)>=Number(row.threshold):value===true;return <Tag color={passed?'green':'red'}>{row.evaluator==='semantic'?Number(value).toFixed(2):String(value===true)}</Tag>; }},
          ]}/>
        </Card>}
      </Card>}
    </Form>
  </div>;
}

export function ColdChainTemplateCreatePage({ onBack, onCreated }) {
  return <ColdChainTemplateEditor onClose={onBack} onPublished={onCreated}/>;
}

export function ColdChainTemplateCenter({ onCreate }) {
  const [items,setItems]=useState([]);const [drafts,setDrafts]=useState([]);const [loading,setLoading]=useState(false);const [editingDraft,setEditingDraft]=useState(null);
  const refresh=()=>{setLoading(true);Promise.all([coldchainApi.listTemplates(),coldchainApi.listTemplateDrafts()]).then(([templates,draftValues])=>{setItems(templates.items||[]);setDrafts((draftValues.items||[]).filter(item=>item.status!=='published'));}).catch(error=>message.error(error.message)).finally(()=>setLoading(false));};
  useEffect(()=>{refresh();},[]);
  const showDetail=(item,isDraft=false)=>Modal.info({title:item.name||'时序模板详情',width:680,okText:'关闭',content:<Descriptions bordered size="small" column={2} className="section-title" items={[
    {key:'id',label:isDraft?'草稿 ID':'模板 ID',span:2,children:<Text copyable>{isDraft?item.draft_id:item.template_id}</Text>},
    ...(!isDraft?[{key:'version',label:'版本',children:item.version}]:[]),
    {key:'status',label:'状态',children:isDraft?(item.trial_status||'尚未试运行'):'已发布'},
    {key:'fields',label:'字段数量',children:item.field_count??item.parameter_count??'-'},
    {key:'rules',label:'规则数量',children:(item.generation_rule_count!=null||item.quality_rule_count!=null)?`${item.generation_rule_count||0} 生成 · ${item.quality_rule_count||0} 质检`:'-'},
  ]}/>});
  const publishDraft=async item=>{try{await coldchainApi.publishTemplateDraft(item.draft_id,item.revision);message.success(`模板“${item.name}”已发布`);refresh();}catch(error){message.error(error.message);}};
  const copyAsDraft=item=>{const now=Date.now();setDrafts(current=>[{...item,draft_id:`DRAFT-COPY-${now}`,name:`${item.name}（副本）`,revision:1,trial_status:null,updated_at:nowDateTime(),_prototypeCopy:true},...current]);message.success('模板已复制为草稿');};
  const deleteTemplate=(item,isDraft=false)=>Modal.confirm({title:`删除模板“${item.name}”？`,content:'正式产品中删除前需要检查任务引用；当前原型只从列表移除该记录。',okText:'确认删除',okType:'danger',cancelText:'取消',onOk:()=>{if(isDraft)setDrafts(current=>current.filter(value=>value.draft_id!==item.draft_id));else setItems(current=>current.filter(value=>value.template_id!==item.template_id));message.success('模板已删除');}});
  if(editingDraft)return <ColdChainTemplateEditor draftId={editingDraft} onClose={()=>{setEditingDraft(null);refresh();}} onPublished={()=>{setEditingDraft(null);refresh();}}/>;
  const columns=[
    {title:'模板',dataIndex:'name',render:(value,row)=><Space direction="vertical" size={0}><Text strong>{value}</Text><Text type="secondary">{row.template_id}</Text></Space>},
    {title:'版本',dataIndex:'version',render:value=><Tag color="blue">{value}</Tag>},{title:'来源',dataIndex:'scope',render:value=><Tag color={value==='official'?'green':'default'}>{value==='official'?'官方':'自定义'}</Tag>},
    {title:'字段/规则/覆盖',render:(_,row)=>`${row.parameter_count} 字段 · ${row.generation_rule_count} 生成 · ${row.quality_rule_count} 质检 · ${row.coverage_profile_count||0} 标签组合`},
    {title:'试运行',dataIndex:'trial_status',render:value=><Tag color={value==='PASS'?'green':'default'}>{value||'历史版本'}</Tag>},{title:'状态',render:()=> <Badge status="success" text="已发布"/>},{title:'操作',width:300,render:(_,row)=><TemplateActionButtons onDetail={()=>showDetail(row)} onEdit={()=>{}} onPublish={()=>{}} onCopy={()=>copyAsDraft(row)} onDelete={()=>deleteTemplate(row)} canEdit={false} canPublish={false} canDelete={row.scope!=='official'} editReason="已发布版本不可直接编辑，请复制后修改" publishReason="该版本已经发布" deleteReason="官方模板不可删除"/>},
  ];
  const draftColumns=[
    {title:'草稿',dataIndex:'name'},{title:'字段',dataIndex:'field_count',render:value=>`${value} 个`},{title:'标签组合',dataIndex:'coverage_profile_count',render:value=>`${value||0} 组`},{title:'试运行',dataIndex:'trial_status',render:value=>value?<Tag color={value==='PASS'?'green':'red'}>{value}</Tag>:<Tag>未运行</Tag>},{title:'更新时间',dataIndex:'updated_at',render:formatDateTime},{title:'操作',width:300,render:(_,row)=><TemplateActionButtons onDetail={()=>showDetail(row,true)} onEdit={()=>setEditingDraft(row.draft_id)} onPublish={()=>publishDraft(row)} onCopy={()=>copyAsDraft(row)} onDelete={()=>deleteTemplate(row,true)} canEdit={!row._prototypeCopy} canPublish={row.trial_status==='PASS'} editReason="内置示例草稿仅用于查看" publishReason="试运行通过后才能发布"/>},
  ];
  return <div>
    <Flex justify="space-between" align="center" className="section-title"><Alert style={{flex:1,marginRight:16}} type="success" showIcon message="五步制作时序模板" description="事件与标签 → 输出参数 → 合成指令预览 → 统一质检规则 → 试运行与发布。"/><Space><Button icon={<ReloadOutlined/>} loading={loading} onClick={refresh}>刷新</Button><Button type="primary" icon={<PlusOutlined/>} onClick={onCreate}>新建时序模板</Button></Space></Flex>
    {!!drafts.length&&<Card size="small" title={`模板草稿（${drafts.length}）`}><Table rowKey="draft_id" dataSource={drafts} columns={draftColumns} pagination={false}/></Card>}
    <Card className="section-title" size="small" title={`已发布模板（${items.length}）`}>{items.length?<Table rowKey="template_id" dataSource={items} columns={columns} pagination={false}/>:<Empty description="暂无已发布时序模板"/>}</Card>
  </div>;
}
