import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Collapse, Descriptions, Divider, Empty,
  Flex, Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Spin, Steps, Switch, Table, Tag,
  Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, DeleteOutlined,
  LeftOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, SaveOutlined,
} from '@ant-design/icons';
import { coldchainApi } from './coldchainApi';
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
  {title:'事件 Prompt 与样本标签',description:'事件边界、标签枚举与判定依据'},
  {title:'输出参数配置',description:'字段定义与生成规则'},
  {title:'合成指令预览',description:'检查实际模型输入'},
  {title:'质检规则配置',description:'参数、事件、隐私与整体质量'},
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
const PARAMETER_TYPES = [{value:'number',label:'数值'},{value:'string',label:'文本'},{value:'boolean',label:'布尔值'},{value:'object',label:'对象'}];
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

function parseCoverageLabels(markdown='', allowedEvents=[]) {
  const allowed=new Set(allowedEvents);const seen=new Set();
  return String(markdown).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const [value,...nameParts]=line.replace(/^[-*]\s*/, '').split('|');
    const key=String(value||'').trim();
    const name=nameParts.join('|').trim()||EVENT_OPTIONS.find(item=>item.value===key)?.label||key;
    if(!allowed.has(key))throw new Error(`标签“${key}”不在允许事件白名单中`);
    if(seen.has(key))throw new Error(`标签“${key}”重复`);
    seen.add(key);return {value:key,name};
  });
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
const DEFAULT_GLOBAL_QUALITY_RULES = [
  {rule_id:'QC-EVENT-VALIDITY',name:'事件内容合法性',target:'semantic_event',mode:'semantic',threshold:0.85,prompt:'判断事件名称、发生阶段、持续时间和恢复过程是否完整，并且符合模板选择的异常事件候选。',system:true,enabled:true},
  {rule_id:'QC-PARAM-RELATION',name:'参数关系一致性',target:'temporal_parameters',mode:'function',python_code:'def validate(series, context):\n    # 校验设定温度、送风、回风、货物温度等参数之间的约束关系\n    return validate_parameter_relations(series)',system:true,enabled:true},
  {rule_id:'QC-OVERALL-WAVE',name:'整体波动合理性',target:'temporal_parameters',mode:'semantic',threshold:0.82,prompt:'结合完整时间序列判断整体趋势、突变、漂移、恢复速度和波动幅度是否符合冷链运输过程。',system:true,enabled:true},
  {rule_id:'QC-EVENT-PARAM',name:'参数与事件一致性',target:'both',mode:'semantic',threshold:0.85,prompt:'判断事件发生前后各参数的变化方向、幅度、持续时间和恢复过程是否与事件描述一致。',system:true,enabled:true},
];
const BASE_TIME_SERIES_RULES=[
  {rule_id:'BASE-STRUCTURE',name:'输出内容结构检查',target:'both',description:'检查事件对象、时间戳、字段类型和必填结构是否完整。'},
  {rule_id:'BASE-PRIVACY',name:'隐私与敏感信息检查',target:'both',description:'检查真实姓名、联系方式、地址、业务标识和密钥等敏感信息。',privacy:true},
  {rule_id:'BASE-DUPLICATE',name:'重复检查',target:'both',description:'检查事件与时序样本是否存在完全重复。'},
];
const BASE_LABEL_COVERAGE_RULE={rule_id:'BASE-LABEL-COVERAGE',name:'标签覆盖率',target:'both',description:'统计各标签枚举值的样本数量，供后续定向扩增使用。'};

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

function FieldRuleEditor({ field, fieldIndex, form, onRemove }) {
  const enabled=Form.useWatch(['fields',fieldIndex,'enabled'],form)!==false;
  const generationMode=Form.useWatch(['fields',fieldIndex,'generation_mode'],form)||'function';
  const isCustom=Boolean(field.custom);
  return <Card size="small" className="section-title coldchain-parameter-card" title={<Space><Form.Item name={[fieldIndex,'enabled']} valuePropName="checked" noStyle><Checkbox/></Form.Item><Text strong>{field.label||'自定义参数'}</Text><Tag>{field.field_id||'待填写参数 ID'}</Tag></Space>} extra={isCustom?<Button type="text" danger icon={<DeleteOutlined/>} onClick={onRemove}>删除参数</Button>:null}>
    {!enabled?<Text type="secondary">该参数不会进入模板输出，也不会出现在数据生成任务的输出参数选项中。</Text>:<>
      <Row gutter={16}>
        <Col span={9}><Form.Item name={[fieldIndex,'label']} label="参数名称" rules={[{required:true,whitespace:true}]}><Input disabled={!isCustom} placeholder="例如：压缩机转速"/></Form.Item></Col>
        <Col span={9}><Form.Item name={[fieldIndex,'field_id']} label="参数 ID" rules={[{required:true,pattern:/^[a-z][a-z0-9_]{1,63}$/,message:'使用小写字母、数字和下划线'}]}><Input disabled={!isCustom} placeholder="例如：compressor_speed"/></Form.Item></Col>
        <Col span={6}><Form.Item name={[fieldIndex,'type']} label="数据类型" rules={[{required:true}]}><Select disabled={!isCustom} options={PARAMETER_TYPES}/></Form.Item></Col>
      </Row>
      <Divider orientation="left">生成规则</Divider>
      <Form.Item name={[fieldIndex,'generation_mode']} label="生成方式" rules={[{required:true}]}><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'函数生成',value:'function'},{label:'语义生成',value:'semantic'}]}/></Form.Item>
      {generationMode==='function'
        ? <Form.Item name={[fieldIndex,'generation_python']} label="Python 生成函数" rules={[{required:true,whitespace:true,message:'请填写 Python 生成函数'}]} extra="函数接收当前样本上下文并返回该参数的值。"><Input.TextArea className="coldchain-code-textarea" rows={10} spellCheck={false}/></Form.Item>
        : <Form.Item name={[fieldIndex,'generation_prompt']} label="语义生成 Prompt" rules={[{required:true,whitespace:true,message:'请填写语义生成 Prompt'}]} extra="说明模型应如何根据事件与上下文生成该参数。"><Input.TextArea rows={7}/></Form.Item>}
    </>}
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

function SynthesisPromptPreview({ form }) {
  const values=Form.useWatch([],form)||{};
  const selectedEvents=(values.eventCandidates||[]).filter(item=>item.selected).map(item=>({event_id:item.event_id,name:item.name,prompt:item.prompt}));
  const outputFields=(values.fields||[]).filter(item=>item.enabled!==false).map(item=>({field_id:item.field_id,label:item.label,type:item.type,generation_mode:item.generation_mode,generation_content:item.generation_mode==='semantic'?item.generation_prompt:item.generation_python}));
  const prompt={task:'生成一条冷链运输事件方案和对应的时序数据生成约束',business_context:values.scenarioPrompt,event_candidates:selectedEvents,output_fields:outputFields,output_contract:{event:'结构化事件对象',series:'按试运行设置生成逐时间戳参数数据',gps:'经纬度轨迹'}};
  const text=JSON.stringify(prompt,null,2);const tokens=Math.ceil(text.length/3);
  return <><Alert type="info" showIcon message="这是系统实际组织给生成模型的合成指令" description="试运行时还会注入样本数、时序步数、时间间隔和模型参数。"/><Flex justify="space-between" className="section-title"><Text strong>合成指令 JSON</Text><Tag color="blue">预估 {tokens} Tokens</Tag></Flex><Input.TextArea className="coldchain-json-textarea" value={text} readOnly autoSize={{minRows:20,maxRows:34}}/></>;
}

function buildConfiguration(values) {
  const selectedEvents=(values.eventCandidates||[]).filter(item=>item.selected).map(item=>({event_id:item.event_id,name:item.name,prompt:item.prompt,custom:Boolean(item.custom)}));
  const allowedEvents=['normal',...selectedEvents.map(item=>item.event_id)];
  const fields=(values.fields||[]).filter(item=>item.enabled!==false).map(item=>{
    const {
      generation_mode='function',generation_python='',generation_prompt='',
      quality_mode='function',quality_threshold=0.8,quality_python='',quality_prompt='',quality_positive_example='',quality_negative_example='',generation_rules,quality_rules,
      ...field
    }=item;
    return {
      ...field,
      generation_rules:[{rule_id:`GEN-${String(item.field_id).toUpperCase()}`,mode:generation_mode,target_field:item.field_id,...(generation_mode==='function'?{python_code:generation_python}:{prompt:generation_prompt})}],
      quality_rules:[{rule_id:`QC-${String(item.field_id).toUpperCase()}`,name:`${item.label||item.field_id}质检`,target:'temporal_parameters',mode:quality_mode,target_field:item.field_id,...(quality_mode==='function'?{python_code:quality_python}:{threshold:Number(quality_threshold||0.8),prompt:quality_prompt,positive_example:quality_positive_example,negative_example:quality_negative_example})}],
    };
  });
  const coverageLabels=values.labelsEnabled?parseCoverageLabels(values.coverageLabelsMarkdown,allowedEvents):[];
  if(coverageLabels.length&&!String(values.coverageLabelingPrompt||'').trim())throw new Error('配置样本标签后需要填写打标签依据 Prompt');
  return {
    name:values.name,description:values.description,scope:'custom',business_type:values.businessType||'传感器时序',
    event_generation:{prompt_version:'coldchain-event-plan/v3',scenario_prompt:values.scenarioPrompt,allowed_events:allowedEvents,event_candidates:selectedEvents,event_strategy:'candidate_selection',llm_numeric_truth_impact:false},
    coverage:coverageLabels.length?{
      schema_version:'coldchain-coverage/v1',strategy:'template_profile_pass_only',labeling_prompt:values.coverageLabelingPrompt,
      dimensions:[{dimension_id:'primary_event',name:'主要事件',labels:coverageLabels}],
      profiles:coverageLabels.map(item=>({profile_id:`${item.value}_profile`,name:item.name,labels:{primary_event:item.value},target_weight:1,minimum_pass_count:0,required:true})),
    }:null,
    rule_engine:{engine_id:'coldchain_physics_v1',user_code_allowed:false},
    quality:{base_rules:[...BASE_TIME_SERIES_RULES,...(values.labelsEnabled?[BASE_LABEL_COVERAGE_RULE]:[])],rules:(values.qualityRules||[]).map(rule=>({...rule,threshold:rule.mode==='semantic'?Number(rule.threshold||0.8):undefined}))},
    fields,
    trial_config:{model_alias:values.trialModel||'qwen3-14b',quality_model_alias:values.trialQualityModel||'qwen3-14b',sample_count:Number(values.trialSampleCount||2),step_count:Number(values.trialStepCount||100),interval_minutes:Number(values.trialIntervalMinutes||10),...(values.trialGenerationParamsEnabled?{generation_parameters:JSON.parse(values.trialGenerationParamsJson)}:{}),...(values.trialQualityParamsEnabled?{quality_parameters:JSON.parse(values.trialQualityParamsJson)}:{})},
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
  const fields=(config.fields||[]).map(item=>{
    const generationRule=(item.generation_rules||[])[0]||{};
    const qualityRule=(item.quality_rules||[])[0]||{};
    const generationMode=item.generation_mode||generationRule.mode||(generationRule.prompt?'semantic':'function');
    const qualityMode=item.quality_mode||qualityRule.mode||(qualityRule.prompt?'semantic':'function');
    const isCustom=Boolean(item.custom)||!COLD_CHAIN_PARAMETER_OPTIONS.some(option=>option.value===item.field_id);
    const parameterLabel=item.label||COLD_CHAIN_PARAMETER_OPTIONS.find(option=>option.value===item.field_id)?.label||item.field_id;
    const parameterType=item.type||(item.field_id==='gps'?'object':['power_status','transport_event','network_status'].includes(item.field_id)?'string':'number');
    return {
      ...item,label:parameterLabel,custom:isCustom,type:parameterType,generation_mode:generationMode,quality_mode:qualityMode,
      generation_python:generationRule.python_code||`def generate(context):\n    # 根据当前样本上下文生成 ${parameterLabel}\n    return context.get("${item.field_id}")`,
      generation_prompt:generationRule.prompt||`根据当前运输事件和样本上下文生成“${parameterLabel}”，保持与其它时序参数一致。`,
      quality_python:qualityRule.python_code||`def validate(value, context):\n    # 返回 True 表示该参数通过质检\n    return value is not None`,
      quality_prompt:qualityRule.prompt||`判断“${parameterLabel}”是否符合当前运输事件、时间顺序及关联参数，输出通过、复核或拒绝。`,
      quality_threshold:qualityRule.threshold??0.8,
      quality_positive_example:qualityRule.positive_example||'',quality_negative_example:qualityRule.negative_example||'',
    };
  });
  return {
    name:config.name,businessType:config.business_type||'传感器时序',description:config.description,scenarioPrompt:String(config.event_generation?.scenario_prompt||'').replaceAll('允许事件白名单','异常事件候选').replaceAll('白名单外事件','未选择的候选事件'),
    eventCandidates:[...builtInCandidates,...customCandidates],fields,
    labelsEnabled:Boolean(config.coverage),
    coverageLabelingPrompt:config.coverage?.labeling_prompt||'',
    coverageLabelsMarkdown:config.coverage==null?'':(primaryDimension?.labels||[]).map(item=>`${item.value} | ${item.name||item.value}`).join('\n'),
    qualityRules:config.quality?.rules?.length?config.quality.rules:DEFAULT_GLOBAL_QUALITY_RULES.map(rule=>({...rule})),
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
  const next=async()=>{if(readOnly){setStep(value=>Math.min(STEP_ITEMS.length-1,value+1));return;}try{if(step===0)await form.validateFields(['name','businessType','scenarioPrompt','eventCandidates','coverageLabelingPrompt','coverageLabelsMarkdown']);else await form.validateFields();await save({quiet:true});setStep(value=>Math.min(STEP_ITEMS.length-1,value+1));}catch(error){if(error?.errorFields)message.warning('请检查当前步骤配置');else message.error(error.message);}};
  const runTrial=async()=>{setAction('trial');try{const fields=['trialModel','trialQualityModel','trialSampleCount','trialStepCount','trialIntervalMinutes'];if(form.getFieldValue('trialGenerationParamsEnabled'))fields.push('trialGenerationParamsJson');if(form.getFieldValue('trialQualityParamsEnabled'))fields.push('trialQualityParamsJson');await form.validateFields(fields);const saved=await ensureSaved();const checked=await coldchainApi.validateTemplateDraft(saved.draft_id,saved.revision);setValidation(checked);if(!checked.valid){message.error((checked.errors||[]).join('；'));return;}const values=form.getFieldsValue(true);const generationParameters=values.trialGenerationParamsEnabled?JSON.parse(values.trialGenerationParamsJson):null;const qualityParameters=values.trialQualityParamsEnabled?JSON.parse(values.trialQualityParamsJson):null;const result=await coldchainApi.trialTemplateDraft(saved.draft_id,{expected_revision:saved.revision,model_alias:values.trialModel||'qwen3-14b',quality_model_alias:values.trialQualityModel||'qwen3-14b',sample_count:Number(values.trialSampleCount||2),step_count:Number(values.trialStepCount||100),interval_minutes:Number(values.trialIntervalMinutes||10),...(generationParameters?{generation_parameters:generationParameters}:{}),...(qualityParameters?{quality_parameters:qualityParameters}:{})});setTrial(result);message[result.status==='PASS'?'success':'error'](`试运行质检：${result.status}`);}catch(error){if(error?.errorFields)message.warning('请检查试运行配置');else message.error(error.message);}finally{setAction('');}};
  const publish=async()=>{setAction('publish');try{const response=await coldchainApi.publishTemplateDraft(draft.draft_id,draft.revision);message.success(`${response.published_template.template_id} / ${response.published_template.version} 已发布`);onPublished?.(response.published_template);}catch(error){message.error(error.message);}finally{setAction('');}};
  const currentTrial=trial&&draft&&trial.revision===draft.revision;
  const labelsEnabled=Form.useWatch('labelsEnabled',form);
  const trialGenerationParamsEnabled=Form.useWatch('trialGenerationParamsEnabled',form);
  const trialQualityParamsEnabled=Form.useWatch('trialQualityParamsEnabled',form);
  const watchedQualityRules=Form.useWatch('qualityRules',form)||[];
  const watchedTrialSampleCount=Form.useWatch('trialSampleCount',form)||2;
  if(loading)return <Spin tip="正在加载时序模板草稿"><div style={{height:200}}/></Spin>;
  const fields=form.getFieldValue('fields')||[];
  const semanticRuleCount=watchedQualityRules.filter(rule=>rule.enabled!==false&&rule.mode==='semantic').length+fields.filter(field=>field.enabled!==false&&field.quality_mode==='semantic').length;
  const generationCallEstimate=Number(watchedTrialSampleCount);const qualityCallEstimate=Number(watchedTrialSampleCount)*semanticRuleCount;
  return <div className="template-create-page coldchain-template-create-page">
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={onClose}/><div><Title level={2}>时序类数据模板</Title><Paragraph type="secondary">依次完成事件、输出参数、合成指令、质检规则和试运行配置。</Paragraph></div></Space></Flex>
    <Flex justify="space-between" align="center" wrap="wrap" gap={12} className="conversation-template-statusbar template-editor-step-actions-top">
      <Space><Tag color="blue">草稿已保存</Tag>{dirty&&<Tag color="orange">未保存</Tag>}{validation?.valid&&<Tag color="cyan">静态校验通过</Tag>}{currentTrial&&<Tag color={trial.status==='PASS'?'green':'red'}>试运行 {trial.status}</Tag>}<Text type="secondary">草稿 ID：{draft.draft_id}</Text></Space>
      <Space><Button icon={<ArrowLeftOutlined/>} disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))}>上一步</Button>{!readOnly&&<Button icon={<SaveOutlined/>} loading={action==='save'} disabled={!dirty} onClick={()=>save()}>保存模板草稿</Button>}{step<STEP_ITEMS.length-1&&<Button type="primary" icon={<ArrowRightOutlined/>} loading={action==='save'} onClick={next}>下一步</Button>}{!readOnly&&step===STEP_ITEMS.length-1&&<Button type="primary" icon={<CheckCircleOutlined/>} disabled={!currentTrial||trial.status!=='PASS'} loading={action==='publish'} onClick={publish}>发布模板</Button>}</Space>
    </Flex>
    <Steps current={step} items={STEP_ITEMS} onChange={target=>readOnly?setStep(target):target<step?setStep(target):null} className="template-editor-steps"/>
    <Form disabled={readOnly} form={form} layout="vertical" onValuesChange={changed=>{if(Object.keys(changed).every(key=>['trialModel','trialSampleCount'].includes(key)))return;setDirty(true);setValidation(null);setTrial(null);}}>
      {step===0&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[0].title}>
        <Divider orientation="left">模板基本信息</Divider>
        <Row gutter={16}><Col span={12}><Form.Item name="name" label="模板名称" rules={[{required:true},{max:80}]}><Input/></Form.Item></Col><Col span={12}><Form.Item name="businessType" label="业务类型" rules={[{required:true},{max:80}]}><Input placeholder="例如：传感器时序"/></Form.Item></Col></Row>
        <Form.Item name="description" label="模板说明" rules={[{max:500}]}><Input.TextArea rows={2} maxLength={500} showCount/></Form.Item>
        <Divider orientation="left">事件 Prompt 配置</Divider>
        <Alert type="info" showIcon message="模型负责生成事件语义，数值真值仍由规则引擎计算" description="基础 Prompt 定义整体业务背景；异常事件候选中的 Prompt 分别定义每类异常的发生阶段、过程和参数关系。"/>
        <Form.Item className="section-title" name="scenarioPrompt" label="事件生成 Prompt" rules={[{required:true},{max:4000}]}><Input.TextArea rows={8}/></Form.Item>
        <Divider orientation="left">异常事件候选</Divider>
        <Paragraph type="secondary">选择本模板允许生成的异常事件。选中后可编辑对应事件 Prompt，也可以添加业务自定义异常事件。</Paragraph>
        <EventCandidatesEditor form={form}/>
        <Card size="small" className="conversation-config-card" title="样本标签配置（可选）" extra={<Form.Item name="labelsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="需要" unCheckedChildren="不需要"/></Form.Item>}>
          {!labelsEnabled?<Alert type="info" showIcon message="本模板不需要样本标签" description="标签枚举、打标 Prompt 和标签覆盖统计均不会进入模板。"/>:<>
            <Alert type="info" showIcon message="模板只定义标签，不配置本次任务的数量目标" description="每行填写“英文值 | 中文名称”。目标权重和最低 PASS 数在创建合成任务时配置。"/>
            <Form.Item className="section-title" name="coverageLabelsMarkdown" label="标签枚举值" rules={[{required:true,whitespace:true},{max:2000}]} extra="示例：door_open | 开门；每行一个标签。"><Input.TextArea rows={8}/></Form.Item>
            <Form.Item name="coverageLabelingPrompt" label="打标签依据 Prompt" rules={[{required:true,whitespace:true},{max:2000}]} extra="说明如何依据生成事件判定标签；数值一致性仍由规则引擎复核。"><Input.TextArea rows={4}/></Form.Item>
          </>}
        </Card>
      </Card>}
      {step===1&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[1].title}>
        <Alert type="success" showIcon message="这里仅配置输出字段及其生成方式" description="参数质检规则已统一移到后续“质检规则配置”步骤。"/>
        <Form.List name="fields">{(fieldItems,{add,remove})=><><Collapse className="section-title" defaultActiveKey={['return_air_temperature']} items={fieldItems.map((item,index)=>{const field=fields[index]||{};return {key:field.field_id||String(index),label:<Space><Checkbox checked={field.enabled!==false} onClick={event=>event.stopPropagation()} onChange={event=>form.setFieldValue(['fields',index,'enabled'],event.target.checked)}/><Text strong>{field.label||field.field_id||'自定义参数'}</Text><Tag color={field.custom?'purple':'blue'}>{field.custom?'自定义参数':'预置参数'}</Tag></Space>,children:<FieldRuleEditor field={field} fieldIndex={index} form={form} onRemove={()=>remove(item.name)}/>};})}/><Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({field_id:`custom_parameter_${Date.now()}`,label:'',type:'number',enabled:true,custom:true,generation_mode:'function',generation_python:'def generate(context):\n    return None',generation_prompt:'',quality_mode:'function',quality_python:'def validate(value, context):\n    return value is not None',quality_prompt:''})}>添加自定义输出参数</Button></>}</Form.List>
      </Card>}
      {step===2&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[2].title}><SynthesisPromptPreview form={form}/></Card>}
      {step===3&&<Card className="main-card conversation-step-card" title={STEP_ITEMS[3].title}>
        <Divider orientation="left">基础规则</Divider>
        <Alert type="success" showIcon message="基础规则由系统维护，不需要用户配置" description="隐私检查使用蓝色，其它基础规则使用绿色；标签开关启用时才执行标签覆盖率。"/>
        <Row gutter={[12,12]} className="section-title">{[...BASE_TIME_SERIES_RULES,...(labelsEnabled?[BASE_LABEL_COVERAGE_RULE]:[])].map(rule=><Col span={8} key={rule.rule_id}><Card size="small" className={`conversation-fixed-rule ${rule.privacy?'conversation-fixed-rule-privacy':'conversation-fixed-rule-other'}`}><Space direction="vertical" size={3}><Space><CheckCircleOutlined style={{color:rule.privacy?'#1677ff':'#52c41a'}}/><Text strong>{rule.name}</Text><Tag color={rule.privacy?'blue':'green'}>{rule.privacy?'隐私检查':'基础规则'}</Tag></Space><Text type="secondary">{rule.description}</Text><Tag>{rule.rule_id}</Tag></Space></Card></Col>)}</Row>
        <Divider orientation="left">场景规则</Divider>
        <Paragraph type="secondary">检查对象统一为语义事件、时序参数或两者；规则 ID 由系统生成。函数判断返回 true / false，语义判断返回 0–1 分数。</Paragraph>
        <Divider orientation="left">输出参数规则</Divider>
        {(fields||[]).map((field,index)=>field.enabled===false?null:<Collapse key={field.field_id||index} className="section-title" items={[{key:field.field_id||String(index),label:<Space><Text strong>{field.label||field.field_id}</Text><Tag>{`QC-${String(field.field_id||'FIELD').toUpperCase()}`}</Tag></Space>,children:<ParameterQualityRuleEditor field={field} fieldIndex={index} form={form}/>}]} />)}
        <Divider orientation="left">事件与整体规则</Divider>
        <Form.List name="qualityRules">{(ruleFields,{add,remove})=><>{ruleFields.map((field,index)=><GlobalQualityRuleEditor key={field.key} field={field} index={index} rule={(form.getFieldValue('qualityRules')||[])[index]||{}} remove={remove} form={form}/>)}<Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({rule_id:`QC-CUSTOM-${Date.now().toString(36).toUpperCase()}`,name:'',target:'both',mode:'function',python_code:'def validate(data, context):\n    return True',threshold:0.8,prompt:'',system:false,enabled:true})}>添加自定义质检规则</Button></>}</Form.List>
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
          <Divider orientation="left">事件内容（实际模型输入）</Divider>
          <Input.TextArea className="coldchain-json-textarea" value={JSON.stringify(trial.model_input||{},null,2)} readOnly autoSize={{minRows:14,maxRows:26}}/>
          <Divider orientation="left">输出参数时序曲线</Divider>
          <TimeSeriesTrialChart rows={trial.output_series||[]} fields={trial.numeric_fields||[]}/>
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
