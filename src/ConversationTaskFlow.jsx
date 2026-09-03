import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Descriptions, Divider, Empty, Flex,
  Form, Input, InputNumber, Progress, Radio, Row, Select, Space, Statistic, Switch,
  Table, Tag, Timeline, Tooltip, Typography, message,
} from 'antd';
import {
  CheckCircleOutlined, FileTextOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { conversationApi } from './conversationApi';
import { formatDateTime } from './timeUtils';

const { Text, Paragraph, Title } = Typography;

export const CONVERSATION_TASK_INITIAL_VALUES = {
  conversationTemplateId:'', conversationTemplateVersion:'', conversationTemplateName:'', count:20, seed:20260819,
  turnMin:3, turnMax:6, provider:'mock', modelAlias:'qwen3-14b', temperature:0.7, enableThinking:false,
  enableQuality:true,
  enableAugmentation:true, augmentationMethods:['expression_rewrite','context_noise'],
  augmentationRatio:20, augmentationMaxNew:100, augmentationModelAlias:'qwen3-14b', augmentationEnableThinking:false, augmentationTemperature:0.7,
  passThreshold:0.85, duplicateThreshold:0.92, qualityModelAlias:'qwen3-14b', qualityEnableThinking:false, qualityTemperature:0,
  enableExpansion:true, maxNew:8, coverageOverrides:[],
};

function parseCoverageLabels(text='') {
  const rows=[]; let current=null;
  String(text).split(/\r?\n/).forEach(line=>{
    const heading=line.match(/^#{2,3}\s+([^|｜]+)[|｜]\s*(.+)$/);
    if (heading) { current={dimension_id:heading[1].trim(),dimension_name:heading[2].trim()}; return; }
    const bullet=line.match(/^\s*[-*+]\s+(.+?)\s*$/);
    if (bullet&&current) rows.push({...current,label:bullet[1].split(/：|:/,1)[0].trim(),recommended:null});
  });
  return rows;
}

export const CONVERSATION_STAGE_META = {
  queued:['排队中','default'], extracting_rules:['规则卡校验','processing'], retrieving:['规则检索','processing'],
  planning:['Prompt 生成','processing'], generating_dialogues:['对话合成','processing'],
  augmenting:['数据增强','processing'], quality_checking:['初次质检','processing'],
  expanding:['定向扩增','processing'], rechecking:['全量复检','processing'],
  writing_results:['结果写入','processing'], completed:['已完成','success'], failed:['失败','error'],
};

const AUGMENTATION_OPTIONS = [
  {label:'表达同义改写',value:'expression_rewrite'},
  {label:'无关上下文注入',value:'context_noise'},
  {label:'规则绕过对抗样本',value:'adversarial_instruction'},
];

const API_MODEL_OPTIONS = [
  {label:'Qwen3-14B（非思考模式）',value:'qwen3-14b'},
];

const PRIVACY_CHECK_ROWS = [
  {key:'identity',types:'姓名、手机号、身份证号',mask:'姓名使用合成代号；号码按类型保留少量必要字符，其余使用 *'},
  {key:'contact',types:'地址、邮箱、车牌号',mask:'保留类型与必要区域，其余使用 *'},
  {key:'business',types:'真实运单号、客户编号、企业内部账号',mask:'替换为 SYN_ / CUSTOMER_ / ACCOUNT_ 合成标识'},
  {key:'secret',types:'API Key、Token、密码等凭证',mask:'替换为 [REDACTED_SECRET]，同时判为 REJECT'},
];

const toolModeLabels = {
  provided_result:'工具结果已提供（不调用真实工具）', none:'纯对话',
  agent_trace:'生成工具调用训练轨迹（模拟工具返回）',
};

export function ConversationTemplateSelectionFields({ form }) {
  const [templates, setTemplates] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const templateId = Form.useWatch('conversationTemplateId', form);
  const loadList = async () => {
    setLoading(true);
    try {
      const result = await conversationApi.listTemplates();
      const enabled = (result.items || []).filter(item => item.status === 'enabled');
      setTemplates(enabled);
      const current = form.getFieldValue('conversationTemplateId');
      if ((!current || !enabled.some(item => item.template_id === current)) && enabled[0]) {
        form.setFieldsValue({conversationTemplateId:enabled[0].template_id, conversationTemplateVersion:enabled[0].version});
      }
    } catch (error) { message.error(`对话模板读取失败：${error.message}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    if (!templateId) { setDetail(null); return; }
    let active = true;
    conversationApi.getTemplate(templateId).then(value => {
      if (!active) return;
      setDetail(value);
      const scenario = value.selected_version?.configuration_v2?.scenario || {};
      form.setFieldsValue({
        conversationTemplateVersion:value.version,
        conversationTemplateName:value.name,
        coverageOverrides:parseCoverageLabels(scenario.coverage_labels_markdown||''),
      });
    }).catch(error => message.error(error.message));
    return () => { active = false; };
  }, [templateId, form]);
  const options = templates.map(item => ({
    label:`${item.name} · ${item.version} · ${item.rule_card_count} 张规则卡`, value:item.template_id,
  }));
  const selected = detail?.selected_version || {};
  const prompt = selected.prompt_generation || {};
  const configuration = selected.configuration_v2 || {};
  const scenario = configuration.scenario || {};
  const knowledge = configuration.knowledge || selected.knowledge || {};
  const tools = configuration.tools || {};
  const qualityRules = (configuration.quality?.scenario_rules || []).filter(item => item.enabled !== false);
  const effectiveToolMode = tools.enabled === false ? 'none' : (tools.mode || prompt.tool_mode || 'none');
  return <>
    <Alert type="info" showIcon message="任务只选择已经配置好的对话模板" description="场景、角色、目标、约束、事实状态机、知识规则和工具方式均由模板版本提供；提交任务时固化不可变快照。"/>
    <Row gutter={16} className="section-title">
      <Col span={18}><Form.Item name="conversationTemplateId" label="对话模板" rules={[{required:true,message:'请选择对话模板'}]}><Select loading={loading} showSearch optionFilterProp="label" options={options} placeholder="从模板中心选择已启用模板"/></Form.Item></Col>
      <Col span={6}><Form.Item name="conversationTemplateVersion" label="模板版本" rules={[{required:true}]}><Input readOnly/></Form.Item></Col>
    </Row>
    {!templates.length && !loading && <Alert type="warning" showIcon message="暂无已启用的对话模板" description="请先到模板中心创建并启用对话模板。"/>}
    {detail && <Card size="small" title="模板快照预览" extra={<Space><Tag color="blue">{detail.version}</Tag><Badge status="success" text="已启用"/></Space>}>
      <Descriptions size="small" column={2} items={[
        {key:'id',label:'模板 ID',children:<Text copyable>{detail.template_id}</Text>},
        {key:'business',label:'业务类型',children:detail.business_type},
        {key:'knowledge',label:'知识资产',children:knowledge.mode==='task_rule_cards'?`${selected.rule_card_count||detail.rule_card_count} 张长期规则卡`:knowledge.mode==='external_rag'?'外部 RAG 冻结快照':'未启用'},
        {key:'tool',label:'工具方式',children:`${toolModeLabels[effectiveToolMode]||effectiveToolMode}${tools.enabled===false?'':` · ${(tools.catalog||[]).length} 个工具`}`},
        {key:'turn',label:'任务对话轮数',children:'在数据生成配置中设置'},
        {key:'quality',label:'场景质检规则',children:`${qualityRules.length} 条（随模板锁定）`},
        {key:'desc',label:'模板说明',span:2,children:detail.description||'-'},
      ]}/>
      <Divider orientation="left">Prompt 摘要</Divider>
      <Paragraph ellipsis={{rows:4,expandable:true,symbol:'展开'}}>{scenario.scene_markdown||prompt.scene_markdown}</Paragraph>
      <Alert type="success" showIcon message="运行时会固化该版本的完整契约" description="场景、知识、工具、状态路径种子、覆盖类型和场景质检规则全部来自该模板；本次任务不会覆盖这些内容。"/>
    </Card>}
  </>;
}

export function ConversationGenerationFields({ form }) {
  const provider = Form.useWatch('provider', form) || 'mock';
  const count = Number(Form.useWatch('count', form) || 20);
  return <>
    <Alert type="info" showIcon message="配置本次生成批次" description="模板负责“生成什么”；此处设置数量、对话轮数、随机性、模型和交付格式。一轮从一条 user 消息开始，到对应 assistant 的最终文本回答结束；中间的工具调用和工具返回仍属于同一轮。"/>
    <Row gutter={16} className="section-title">
      <Col span={6}><Form.Item name="count" label="目标原始样本数" rules={[{required:true}]}><InputNumber min={1} max={200} style={{width:'100%'}}/></Form.Item></Col>
      <Col span={6}><Form.Item name="turnMin" label="最少对话轮数" tooltip="一轮=user发起，到assistant最终文本回答结束；中间工具轨迹不另计轮数。" rules={[{required:true}]}><InputNumber min={1} max={15} style={{width:'100%'}}/></Form.Item></Col>
      <Col span={6}><Form.Item name="turnMax" label="最多对话轮数" dependencies={['turnMin']} rules={[{required:true},{validator:(_,value)=>value>=Number(form.getFieldValue('turnMin'))?Promise.resolve():Promise.reject(new Error('不能小于最少对话轮数'))}]}><InputNumber min={1} max={15} style={{width:'100%'}}/></Form.Item></Col>
      <Col span={6}><Form.Item name="seed" label="随机种子" tooltip="相同模板版本、配置和随机种子可复现本地 Mock 结果。" rules={[{required:true}]}><InputNumber min={1} max={2147483647} style={{width:'100%'}}/></Form.Item></Col>
      <Col span={8}><Form.Item name="provider" label="生成方式"><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'本地 Mock',value:'mock'},{label:'API',value:'bailian'}]}/></Form.Item></Col>
      <Col span={8}><Form.Item name="modelAlias" label="API 模型" rules={[{required:provider==='bailian',message:'请选择 API 模型'}]}><Select disabled={provider==='mock'} options={API_MODEL_OPTIONS} placeholder={provider==='mock'?'本地 Mock 不调用模型':'请选择模型'}/></Form.Item></Col>
      <Col span={8}><Form.Item name="temperature" label="Temperature"><InputNumber min={0} max={2} step={0.1} disabled={provider==='mock'} style={{width:'100%'}}/></Form.Item></Col>
      <Col span={8}><Form.Item name="enableThinking" label="思考模式" valuePropName="checked"><Switch disabled={provider==='mock'} checkedChildren="开启" unCheckedChildren="关闭"/></Form.Item></Col>
    </Row>
    <Alert type={provider==='mock'?'success':'warning'} showIcon message={provider==='mock'?'本次不会产生付费调用':`原始数据预计 ${count*2} 次模型调用`} description={provider==='mock'?'使用本地确定性模板验证完整异步任务链路。':'每条数据调用一次模型生成事实与状态机，再调用一次生成完整对话；语义质检和扩增可能增加调用。'}/>
  </>;
}

export function ConversationAugmentationFields({ form, standalone = false }) {
  const enabled = standalone || Boolean(Form.useWatch('enableAugmentation', form));
  const ratio = Number(Form.useWatch('augmentationRatio', form) || 0);
  const count = Number(form.getFieldValue('count') || 0);
  const estimated = enabled ? Math.ceil(count * ratio / 100) : 0;
  return <>
    <Alert type="info" showIcon message="增强由 Qwen 重新生成完整样本" description="系统把增强方式的默认 Prompt、模板约束和原始样本拼接后调用模型；原始样本保留，增强结果重新生成标签并重新质检。数据增强与定向扩增相互独立。"/>
    <Card size="small" title="通用多样性增强" extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableAugmentation" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Paragraph type="secondary">从原始候选中抽取种子，每条增强数据调用一次模型，并保留 source_conversation_id 血缘。标签只能从模板定义的允许值中重新选择。</Paragraph>
      <Form.Item name="augmentationMethods" label="增强方式" rules={[{validator:(_,value)=>!enabled||value?.length?Promise.resolve():Promise.reject(new Error('至少选择一种增强方式'))}]}><Checkbox.Group disabled={!enabled} options={AUGMENTATION_OPTIONS}/></Form.Item>
      <Row gutter={16}>
        <Col span={6}><Form.Item name="augmentationRatio" label="对原始样本的增强比例"><InputNumber min={1} max={100} addonAfter="%" disabled={!enabled} style={{width:'100%'}}/></Form.Item></Col>
        <Col span={6}><Form.Item name="augmentationMaxNew" label="最大新增上限"><InputNumber min={0} max={200} disabled={!enabled} style={{width:'100%'}}/></Form.Item></Col>
        <Col span={6}><Form.Item name="augmentationModelAlias" label="增强 API 模型" rules={[{required:enabled,message:'请选择增强模型'}]}><Select disabled={!enabled} options={API_MODEL_OPTIONS}/></Form.Item></Col>
        <Col span={6}><Form.Item name="augmentationEnableThinking" label="思考模式" valuePropName="checked"><Switch disabled={!enabled} checkedChildren="开启" unCheckedChildren="关闭"/></Form.Item></Col>
        <Col span={6}><Form.Item name="augmentationTemperature" label="Temperature"><InputNumber min={0} max={2} step={0.1} disabled={!enabled} style={{width:'100%'}}/></Form.Item></Col>
      </Row>
      <Alert type="warning" showIcon message={`预计新增约 ${estimated} 条，并产生约 ${estimated} 次增强模型调用`} description="每条增强结果都会重新生成标签、执行结构校验并进入后续质检。"/>
    </Card>
    {!standalone&&<Card className="section-title" size="small" title="两种扩充模式的边界"><Descriptions size="small" column={1} items={[
      {key:'general',label:'通用数据增强',children:'用户主动选择方式和比例，目标是提高表达与扰动多样性。'},
      {key:'targeted',label:'质检驱动定向扩增',children:'先检测 PASS 覆盖缺口，再按薄弱场景和状态路径新增数据。'},
    ]}/></Card>}
  </>;
}

export function ConversationQualityExpansionFields({ form, mode = 'combined', standalone = false }) {
  const showQuality = mode !== 'expansion';
  const showExpansion = mode !== 'quality';
  const enabled = (standalone && showExpansion) || Boolean(Form.useWatch('enableExpansion', form));
  const coverageOverrides = Form.useWatch('coverageOverrides', form) || [];
  return <>
    <Alert type="info" showIcon message="先质检，再决定定向扩增" description="模板中的固定规则和场景规则始终保留。存在阻断错误时为 REJECT；没有阻断错误且达到 PASS 阈值时为 PASS，否则为 REVIEW。"/>
    {showQuality&&<Divider orientation="left">质量阈值</Divider>}
    <Row gutter={16}>
      {showQuality&&<Col span={6}><Form.Item name="passThreshold" label="PASS 阈值" rules={[{required:true}]}><InputNumber min={0} max={1} step={0.01} precision={2} style={{width:'100%'}}/></Form.Item></Col>}
      {showQuality&&<Col span={6}><Form.Item name="duplicateThreshold" label="近重复阈值"><InputNumber min={0.5} max={1} step={0.01} style={{width:'100%'}}/></Form.Item></Col>}
      <Col span={6}><Form.Item name="qualityModelAlias" label="质检与扩增 API 模型" rules={[{required:true}]}><Select options={API_MODEL_OPTIONS}/></Form.Item></Col>
      <Col span={6}><Form.Item name="qualityEnableThinking" label="思考模式" valuePropName="checked"><Switch checkedChildren="开启" unCheckedChildren="关闭"/></Form.Item></Col>
      <Col span={6}><Form.Item name="qualityTemperature" label="Temperature"><InputNumber min={0} max={2} step={0.1} style={{width:'100%'}}/></Form.Item></Col>
    </Row>
    {showQuality&&<Card size="small" className="section-title" title="隐私检查与自动脱敏" extra={<Space><Tag color="green">默认启用</Tag><Tag>系统固定策略</Tag></Space>}>
      <Paragraph type="secondary">对生成、增强和定向扩增的 Prompt、messages、工具轨迹与 Ground Truth 执行隐私检查；命中后自动使用系统默认掩码，暂不允许用户自定义脱敏方式。</Paragraph>
      <Table size="small" pagination={false} rowKey="key" dataSource={PRIVACY_CHECK_ROWS} columns={[{title:'隐私检查项',dataIndex:'types'},{title:'自动脱敏结果',dataIndex:'mask'}]}/>
    </Card>}
    {showExpansion&&<Card size="small" title="质检驱动定向扩增" extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableExpansion" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Paragraph type="secondary">按所选模板试运行形成的覆盖类型计算 PASS 数量缺口，新增独立事实、单条 Prompt 和对话后全量复检。不同模板会自动使用各自的覆盖类型。</Paragraph>
      <Form.Item name="maxNew" label="最大新增样本数" rules={[{validator:(_,value)=>!enabled||Number(value)>=0?Promise.resolve():Promise.reject(new Error('请设置扩增上限'))}]}><InputNumber min={0} max={100} disabled={!enabled} style={{width:240}}/></Form.Item>
      <Divider orientation="left">逐标签扩增数量</Divider>
      <Alert type="info" showIcon message="留空时使用系统建议值" description="系统默认值为均匀目标数量减PASS数量；手工填写后覆盖该标签的建议数量。多维标签会组合生成，一条样本可同时补足多个维度。"/>
      <Form.List name="coverageOverrides">{fields=><Table className="section-title" size="small" pagination={false} rowKey="key" dataSource={fields.map((field,index)=>({key:field.key,field,index,...coverageOverrides[index]}))} columns={[
        {title:'维度',render:(_,row)=><><Text>{row.dimension_name}</Text><br/><Text type="secondary">{row.dimension_id}</Text></>},
        {title:'标签',dataIndex:'label'},
        {title:'扩增数量调整',render:(_,row)=><Form.Item name={[row.field.name,'recommended']} noStyle><InputNumber min={0} max={100} disabled={!enabled} placeholder="系统缺口"/></Form.Item>},
      ]}/>}</Form.List>
    </Card>}
    {showQuality&&<Card className="section-title" size="small" title="三类质检结果"><Row gutter={12}>{[
      ['PASS','满足硬规则和质量门槛，进入训练交付集。','green'],['REVIEW','无硬错误但低于 PASS 门槛，进入人工复核集。','gold'],['REJECT','事实、规则、状态、工具或安全契约失败，不进入训练集。','red'],
    ].map(([title,desc,color])=><Col span={8} key={title}><Card size="small"><Tag color={color}>{title}</Tag><Paragraph type="secondary">{desc}</Paragraph></Card></Col>)}</Row></Card>}
  </>;
}

export function ConversationSubmissionSummary({ form }) {
  const values = form.getFieldsValue(true);
  const estimated = values.enableAugmentation ? Math.ceil(Number(values.count||0)*Number(values.augmentationRatio||0)/100) : 0;
  return <>
    <Alert type="info" showIcon message="点击“提交任务”后创建对话合成 Mock" description="提交成功后自动返回对话类数据任务列表；新任务出现在第一行，并可查看模拟阶段日志和结果。"/>
    <Descriptions bordered size="small" column={2} className="section-title" items={[
      {key:'template',label:'模板',children:`${values.conversationTemplateName||values.conversationTemplateId||'-'} / ${values.conversationTemplateVersion||'-'}`},
      {key:'count',label:'原始样本',children:`${values.count||0} 条`},
      {key:'turn',label:'对话轮数范围',children:`${values.turnMin||0}～${values.turnMax||0} 轮`},
      {key:'provider',label:'生成模型',children:values.provider==='mock'?'本地 Mock':values.modelAlias},
      {key:'augment',label:'通用增强',children:values.enableAugmentation?`${values.augmentationRatio}% · 预计 ${estimated} 条`:'未启用'},
      {key:'augmentModel',label:'增强模型',children:values.enableAugmentation?`${values.augmentationModelAlias} · 思考${values.augmentationEnableThinking?'开启':'关闭'} · T=${values.augmentationTemperature}`:'-'},
      {key:'methods',label:'增强方式',children:values.enableAugmentation?`${(values.augmentationMethods||[]).length} 种`:'-'},
      {key:'qc',label:'质检门槛',children:`PASS ${values.passThreshold}`},
      {key:'qualityModel',label:'质检与扩增模型',children:`${values.qualityModelAlias} · 思考${values.qualityEnableThinking?'开启':'关闭'} · T=${values.qualityTemperature}`},
      {key:'expansion',label:'定向扩增',children:values.enableExpansion?`最多新增 ${values.maxNew||0} 条`:'未启用'},
    ]}/>
  </>;
}

export async function createConversationBackendJob(form) {
  const values = form.getFieldsValue(true);
  if (!values.conversationTemplateId || !values.conversationTemplateVersion) throw new Error('请选择有效的对话模板版本');
  return conversationApi.createJob({
    template_id:values.conversationTemplateId, template_version:values.conversationTemplateVersion,
    count:Number(values.count), seed:Number(values.seed), turn_range:[Number(values.turnMin),Number(values.turnMax)],
    sft_format:'messages_jsonl',
    model:{provider:values.provider,alias:values.modelAlias,enable_thinking:Boolean(values.enableThinking),temperature:Number(values.temperature),max_retries:1},
    augmentation:{enabled:Boolean(values.enableAugmentation),methods:values.augmentationMethods||[],ratio:Number(values.augmentationRatio||0)/100,max_new:Number(values.augmentationMaxNew||0),model:{provider:'bailian',alias:values.augmentationModelAlias||'qwen3-14b',enable_thinking:Boolean(values.augmentationEnableThinking),temperature:Number(values.augmentationTemperature),max_retries:1}},
    quality:{enabled:values.enableQuality!==false,judge_enabled:values.enableQuality!==false,pass_threshold:Number(values.passThreshold),duplicate_threshold:Number(values.duplicateThreshold),model:{provider:'bailian',alias:values.qualityModelAlias||'qwen3-14b',enable_thinking:Boolean(values.qualityEnableThinking),temperature:Number(values.qualityTemperature),max_retries:1}},
    expansion:{enabled:values.enableQuality!==false&&Boolean(values.enableExpansion),max_new:values.enableQuality!==false&&values.enableExpansion?Number(values.maxNew||0):0,label_overrides:Object.fromEntries((values.coverageOverrides||[]).filter(item=>item.recommended!==null&&item.recommended!==undefined&&item.recommended!=='').map(item=>[`${item.dimension_id}::${item.label}`,Number(item.recommended)]))},
  });
}

export function conversationStages(values={}) {
  return ['Prompt生成','对话合成',...(values.enableAugmentation?['增强']:[]),...(values.enableQuality===false?[]:['质量评估']),...(values.enableQuality!==false&&values.enableExpansion?['定向扩增']:[]),'结果写入'];
}

export function ConversationTaskInformation({ task }) {
  const job = task.backendJob || {};
  const values = task.configSnapshot || {};
  const params = job.parameters || {};
  const snapshot = params.template_snapshot || {};
  return <>
    <Descriptions bordered size="small" column={2} className="detail-descriptions" items={[
      {key:'id',label:'任务 ID',children:task.id},{key:'status',label:'状态',children:<Badge status={task.status==='已完成'?'success':task.status==='失败'?'error':'processing'} text={task.status}/>},
      {key:'stage',label:'当前节点',children:task.currentStage},{key:'created',label:'创建时间',children:task.created},
      {key:'input',label:'输入',children:task.input},{key:'output',label:'输出',children:task.output},
      {key:'path',label:'模拟产物目录',span:2,children:job.storage_path?<Text copyable>{job.storage_path}</Text>:'任务创建后由 Mock 分配'},
    ]}/>
    <Divider orientation="left">配置快照</Divider>
    <Descriptions bordered size="small" column={2} items={[
      {key:'template',label:'模板',children:`${snapshot.template_name||values.conversationTemplateId||'-'} / ${snapshot.template_version||values.conversationTemplateVersion||'-'}`},
      {key:'planning',label:'事实与扩增来源',children:snapshot.planning_source==='published_trial_contract'?'已发布模板试运行契约':snapshot.planning_source||'-'},
      {key:'rules',label:'长期规则卡',children:`${snapshot.rule_card_count??'-'} 张`},
      {key:'tool',label:'工具方式',children:toolModeLabels[params.prompt_generation?.tool_mode]||'-'},
      {key:'count',label:'原始样本',children:`${values.count??params.count??'-'} 条`},
      {key:'turns',label:'对话轮数范围',children:(values.turnMin&&values.turnMax)?`${values.turnMin}～${values.turnMax} 轮`:`${(params.turn_range||[]).join('～')} 轮`},
      {key:'model',label:'模型',children:params.model?.provider==='mock'?'本地 Mock':params.model?.alias||'-'},
      {key:'seed',label:'随机种子',children:values.seed??params.seed??'-'},
      {key:'augment',label:'通用增强',children:params.augmentation?.enabled?`${Math.round(Number(params.augmentation.ratio||0)*100)}% · ${(params.augmentation.methods||[]).length} 种`:'未启用'},
      {key:'quality',label:'质检阈值',children:`PASS ${params.quality?.pass_threshold??values.passThreshold??'-'}`},
      {key:'qualityModel',label:'质检与扩增模型',children:params.quality?.model?`${params.quality.model.alias} · 思考${params.quality.model.enable_thinking?'开启':'关闭'} · T=${params.quality.model.temperature}`:values.qualityModelAlias||'-'},
      {key:'expansion',label:'定向扩增',children:params.expansion?.enabled?`最多 ${params.expansion.max_new} 条`:'未启用'},
      {key:'write',label:'结果写入',children:values.outputMode==='newVersion'?`${values.targetDataset} / 新版本`:values.outputDatasetName||'-'},
    ]}/>
  </>;
}

export function ConversationTaskLogs({ task }) {
  const job = task.backendJob || {};
  const status = CONVERSATION_STAGE_META[job.status] || [task.currentStage||'等待中','default'];
  const events = job.events || [];
  return <>
    <Alert type={job.status==='failed'?'error':job.status==='completed'?'success':'info'} showIcon message={`当前执行：${job.message||task.currentStage||'等待资源'}`} description={job.status==='failed'?job.error:'日志由浏览器中的 Mock 阶段事件恢复。'}/>
    <Progress className="section-title" percent={Number(job.progress??task.progress)||0} status={job.status==='failed'?'exception':job.status==='completed'?'success':'active'}/>
    <Space><Badge status={status[1]} text={status[0]}/><Text type="secondary">最后更新：{formatDateTime(job.updated_at)}</Text></Space>
    <Divider orientation="left">运行日志明细</Divider>
    {events.length?<Timeline items={[...events].reverse().map((event,index)=>({color:event.status==='failed'?'red':index===0&&!['completed','failed'].includes(job.status)?'blue':event.status==='completed'?'green':'gray',children:<div><Text strong>{CONVERSATION_STAGE_META[event.status]?.[0]||event.status}</Text><div>{event.message}</div><Text type="secondary">{formatDateTime(event.time)}</Text></div>}))}/>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待 Mock 写入日志"/>}
  </>;
}

function resultMetric(result, key, fallback='-') {
  return key.split('.').reduce((value, part)=>value?.[part], result) ?? fallback;
}

export function ConversationTaskResults({ job }) {
  if (!job) return <Alert type="info" showIcon message="任务提交后将在此展示运行结果"/>;
  const result = job.result || {};
  const finalQuality = result.final_quality || {};
  const initialQuality = result.initial_quality || {};
  const augmentation = result.augmentation || {};
  const initialPrivacyRisks = Number(initialQuality.privacy_risk_count || 0);
  const finalPrivacyRisks = Number(finalQuality.privacy_risk_count || 0);
  const maskedPrivacyCount = Number(result.privacy?.masked_count || 0);
  const urls = result.artifact_urls || {};
  const completed = job.status === 'completed';
  return <div className="section-title">
    <Alert type={job.status==='failed'?'error':completed?'success':'info'} showIcon icon={completed?<CheckCircleOutlined/>:undefined} message={completed?'对话合成、增强、质检、定向扩增与结果写入已完成':job.message||'任务执行中'} description={job.status==='failed'?job.error:'阶段结果会由 Mock 流程自动生成。'}/>
    <Row gutter={[12,12]} className="section-title">
      <Col span={6}><Card size="small"><Statistic title="原始对话" value={resultMetric(result,'generation.initial_count')}/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="通用增强" value={augmentation.generated_count??'-'}/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="最终样本" value={resultMetric(result,'generation.final_count')}/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="最终 PASS" value={finalQuality.status_counts?.PASS??'-'}/></Card></Col>
    </Row>
    {(initialQuality.sample_count||finalQuality.sample_count)&&<><Divider orientation="left">质检与扩增结果</Divider><Descriptions bordered size="small" column={2} items={[
      {key:'initial',label:'初次质检',children:`PASS ${initialQuality.status_counts?.PASS??0} / REVIEW ${initialQuality.status_counts?.REVIEW??0} / REJECT ${initialQuality.status_counts?.REJECT??0}`},
      {key:'final',label:'最终质检',children:`PASS ${finalQuality.status_counts?.PASS??0} / REVIEW ${finalQuality.status_counts?.REVIEW??0} / REJECT ${finalQuality.status_counts?.REJECT??0}`},
      {key:'augment',label:'通用增强',children:augmentation.enabled?`${augmentation.generated_count} 条 · ${Object.keys(augmentation.method_counts||{}).length} 种方式`:'未启用'},
      {key:'expand',label:'定向扩增建议',children:`${result.expansion_plan?.recommended_new??0} 条`},
      {key:'score',label:'最终平均分',children:finalQuality.average_score??'-'},
      {key:'usage',label:'模型调用',children:`${result.usage?.calls??0} 次`},
    ]}/></>}
    {(initialQuality.sample_count||finalQuality.sample_count)&&<Card className="section-title" size="small" title="隐私检查与脱敏报告" extra={<Tag color={finalPrivacyRisks?'red':'green'}>{finalPrivacyRisks?'REJECT':'PASS'}</Tag>}>
      <Descriptions bordered size="small" column={3} items={[
        {key:'initialPrivacy',label:'初次隐私风险',children:`${initialPrivacyRisks} 项`},
        {key:'masked',label:'自动脱敏',children:`${maskedPrivacyCount} 项`},
        {key:'finalPrivacy',label:'复检残留风险',children:`${finalPrivacyRisks} 项`},
      ]}/>
      <Table className="section-title" size="small" pagination={false} rowKey="key" dataSource={PRIVACY_CHECK_ROWS} columns={[{title:'检查项目',dataIndex:'types'},{title:'系统默认掩码',dataIndex:'mask'},{title:'结果',render:()=>finalPrivacyRisks?'存在残留风险，详见质检报告':'未检出残留风险'}]}/>
    </Card>}
    {finalQuality.coverage?.rows?.length>0&&<><Divider orientation="left">覆盖率统计（仅统计PASS）</Divider><Alert type="info" showIcon message={`整体覆盖率 ${Math.round(Number(finalQuality.coverage.overall_coverage_rate||0)*10000)/100}%`} description="有效缺口=目标数量-PASS数量；REVIEW和REJECT导致的不足已经包含在缺口内，不会重复计算。"/><Table className="section-title" size="small" pagination={false} rowKey={row=>`${row.dimension_id}-${row.label}`} dataSource={finalQuality.coverage.rows} columns={[
      {title:'维度',dataIndex:'dimension_name'},{title:'标签',dataIndex:'label'},{title:'目标',dataIndex:'target_count'},{title:'PASS',dataIndex:'pass_count'},{title:'REVIEW',dataIndex:'review_count'},{title:'REJECT',dataIndex:'reject_count'},{title:'有效缺口',dataIndex:'effective_gap'},{title:'覆盖率',dataIndex:'coverage_rate',render:value=>`${Math.round(Number(value||0)*10000)/100}%`},
    ]}/></>}
    {result.retrieval_preview?.length>0&&<><Divider orientation="left">实际规则召回</Divider><Table size="small" pagination={false} rowKey="rule_id" dataSource={result.retrieval_preview} columns={[{title:'#',dataIndex:'rank',width:50},{title:'规则 ID',dataIndex:'rule_id'},{title:'名称',dataIndex:'title'},{title:'分数',dataIndex:'score'}]}/></>}
    {result.preview_samples?.[0]&&<><Divider orientation="left">对话样本预览</Divider><Card size="small">{result.preview_samples[0].messages?.map((item,index)=><div className={`conversation-message role-${item.role}`} key={`${item.turn}-${index}`}><Tag>{item.role}</Tag><Text>{item.content||(item.tool_call?`调用 ${item.tool_call.name}`:'')}</Text></div>)}</Card></>}
    <Divider orientation="left">结果文件</Divider>
    <Space wrap>{urls.final_quality_report&&<Button href={urls.final_quality_report} target="_blank">最终质检报告 MD</Button>}{job.id&&<Button type="primary" href={`/reports/conversations/${encodeURIComponent(job.id)}/quality`} target="_blank">打开可视化质检报告</Button>}{urls.prompt_generator&&<Button href={urls.prompt_generator} target="_blank">Prompt 生成器</Button>}{urls.synthesis_prompts&&<Button href={urls.synthesis_prompts} target="_blank">单条 Prompt</Button>}{urls.augmented_conversations&&<Button href={urls.augmented_conversations}>增强样本</Button>}{urls.train_pass&&<Button href={urls.train_pass}>下载 PASS JSONL</Button>}</Space>
    {!Object.keys(urls).length&&<Alert className="section-title" type="info" showIcon icon={<SafetyCertificateOutlined/>} message="结果文件将在对应阶段完成后写入"/>}
  </div>;
}
