import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Descriptions, Divider, Empty, Flex,
  Form, Input, InputNumber, Modal, Radio, Result, Row, Select, Space,
  Spin, Steps, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ApiOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LeftOutlined,
  CopyOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, PlusOutlined,
  ReloadOutlined, SafetyCertificateOutlined, SaveOutlined, ToolOutlined,
} from '@ant-design/icons';
import { conversationApi } from './conversationApi';
import { formatDateTime, nowDateTime } from './timeUtils';
import { CONVERSATION_INITIAL_VALUES } from './ConversationMvp';
import { TemplateActionButtons } from './TemplateActionButtons';

const { Title, Text, Paragraph } = Typography;

const STEP_ITEMS = [
  { title: '对话场景配置', description: '场景、角色、目标与状态机' },
  { title: '知识卡与工具配置', description: '按需启用并配置' },
  { title: '合成指令预览', description: '数据格式与 Prompt' },
  { title: '质检规则配置', description: '基础规则与场景规则' },
  { title: '试运行', description: '小批验证后发布' },
];

const TOOL_MODES = [
  { value: 'provided_result', label: '工具结果作为已知上下文', description: '系统合成工具参数与返回，将结果放进单条合成指令；最终对话中不保留工具调用轨迹。' },
  { value: 'agent_trace', label: 'Agent 工具调用轨迹', description: '生成 assistant tool_call、模拟 tool 返回和最终回答，用于训练工具调用能力；不会连接真实业务系统。' },
];

const PARAM_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object'];

const PLACEHOLDERS = [
  ['{{runtime.sequence}}', '当前单条数据在任务中的序号'],
  ['{{runtime.seed}}', '当前单条生成使用的随机种子'],
  ['{{scenario.markdown}}', '场景、角色、目标、约束、事实与状态机'],
  ['{{knowledge.context_json}}', '模板中配置的知识卡内容与引用 ID'],
  ['{{tools.catalog_json}}', '已启用工具的名称、Schema 与调用条件'],
  ['{{runtime.coverage_target_json}}', '系统为当前单条数据分配的标签目标'],
  ['{{quality.generation_constraints_json}}', '固定规则与场景质检约束'],
  ['{{output.schema_json}}', '单条事实与状态机的结构化输出契约'],
];

const PROMPT_SOURCE = `# 单条事实与状态机生成指令

只生成 1 条业务事实、1 条状态路径和1份工具上下文，不要生成最终对话，不要返回数组。
当前序号为 {{runtime.sequence}}，随机种子为 {{runtime.seed}}。

## 场景与目标
{{scenario.markdown}}

## 可用知识
{{knowledge.context_json}}

## 可用工具
{{tools.catalog_json}}

## 当前覆盖标签目标
{{runtime.coverage_target_json}}

## 生成与质检约束
{{quality.generation_constraints_json}}

coverage_labels 必须逐项复制当前目标，不得新增、遗漏或改写。输出必须包含独立业务事实、证据引用、合法状态路径、预期终态和工具上下文。

## 系统管理的状态机输出契约

- state_path 与 expected_final_state 只能填写 lower_snake_case 英文内部状态 ID，例如 collect_information、query_status、ticket_created、human_handoff、resolved。
- 中文状态名称只能用于自然语言说明，不能写入状态字段。
- expected_final_state 必须与 state_path 最后一项逐字一致；ticket_created 与 human_handoff 是不同状态。

严格按照以下 Schema 返回：
{{output.schema_json}}`;

const FIXED_RULES = [
  { id: 'FIXED-STRUCTURE', name: '输出结构', scope: 'synthesis_instruction', description: '单条 JSON 对象和必填字段必须完整。' },
  { id: 'FIXED-UNIQUE-ID', name: '唯一标识', scope: 'synthesis_instruction', description: '每条 instruction_id 必须存在且不重复。' },
  { id: 'FIXED-PLACEHOLDER', name: '占位符完整性', scope: 'synthesis_instruction', description: '禁止未知或未解析占位符，必需变量不得缺失。' },
  { id: 'FIXED-PRIVACY-PERSON', name: '个人身份隐私', scope: 'both', description: '检查姓名、手机号和身份证号等个人身份信息。' },
  { id: 'FIXED-PRIVACY-CONTACT', name: '联系与位置隐私', scope: 'both', description: '检查地址、邮箱和车牌号等联系与位置信息。' },
  { id: 'FIXED-PRIVACY-BUSINESS', name: '业务标识隐私', scope: 'both', description: '检查真实运单号、客户编号和企业内部账号。' },
  { id: 'FIXED-PRIVACY-CREDENTIAL', name: '账号与密钥安全', scope: 'both', description: '检查 API Key、Token、密码等凭证；命中即阻断并按所选方法处理。' },
  { id: 'FIXED-RULE-TRACE', name: '知识证据可追溯', scope: 'both', description: '知识卡 ID 必须来自当前模板配置的知识卡。' },
  { id: 'FIXED-STATE', name: '状态机合法性', scope: 'both', description: '状态使用 lower_snake_case 英文内部 ID，路径非空且最后一项必须等于预期终态。' },
  { id: 'FIXED-TOOL', name: '工具契约', scope: 'both', description: '工具名、参数和返回值必须符合已启用工具 Schema。' },
  { id: 'FIXED-DUPLICATE', name: '完全重复检查', scope: 'both', description: '发现完全相同数据时进入人工复核。' },
  { id: 'FIXED-COVERAGE-LABEL', name: '覆盖标签契约', scope: 'synthesis_instruction', description: '标签维度必须完整，取值必须来自模板定义，并与系统分配目标一致。' },
];

const PRIVACY_METHOD_OPTIONS = ['部分掩码', '全掩码', '删除', '泛化', '随机替换', '虚构替换'].map(value => ({ value, label: value }));

const PRIVACY_MASK_ROWS = [
  { key: 'person', types: '姓名', defaultMethod: '部分掩码', example: '姓氏＋**' },
  { key: 'phone', types: '手机号', defaultMethod: '部分掩码', example: '138****5678' },
  { key: 'id', types: '身份证号', defaultMethod: '部分掩码', example: '前6位********后4位' },
  { key: 'contact', types: '地址、邮箱、车牌号', defaultMethod: '部分掩码', example: '保留类型与必要区域，其余使用 *' },
  { key: 'business', types: '真实运单号、客户编号、企业内部账号', defaultMethod: '虚构替换', example: 'SYN_ / CUSTOMER_ / ACCOUNT_ 合成标识' },
  { key: 'secret', types: 'API Key、Token、密码等凭证', defaultMethod: '全掩码', example: '[REDACTED_SECRET]（同时判为 REJECT）' },
];

const DEFAULT_PRIVACY_METHODS = Object.fromEntries(PRIVACY_MASK_ROWS.map(item => [item.key, item.defaultMethod]));

const DEFAULT_COVERAGE_LABELS = `## business_intent | 业务意图
- 物流状态查询
- 运输延误投诉
- 修改收货信息
- 申请转人工

## customer_emotion | 用户情绪
- 平静
- 焦虑
- 愤怒

## information_completeness | 信息完整度
- 信息完整
- 缺少运单号
- 信息冲突

## tool_path | 工具路径
- 不使用工具
- 查询成功
- 查询失败
- 查询后创建工单`;

const QUALITY_PRESETS = [
  { rule_id: 'SCENE_FACT_CONSISTENCY', name: '事实与上下文一致', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'BLOCK', threshold: 0.85, rubric: '对话中的事实、时间、状态和结论必须能在冻结事实、知识或工具结果中找到依据。', source: 'preset' },
  { rule_id: 'SCENE_EVIDENCE_EXISTS', name: '证据存在性检查', scope: 'final_conversation', evaluator: 'evidence_trace', severity: 'BLOCK', rubric: '引用的知识卡必须真实存在于当前模板配置中。', source: 'preset' },
  { rule_id: 'SCENE_SEMANTIC_GROUNDED', name: '语义有据性检查', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'BLOCK', threshold: 0.85, rubric: '时间、状态、条件和结论必须能够由证据片段推出。', source: 'preset' },
  { rule_id: 'SCENE_ACTIONABLE_NEXT_STEP', name: '最终回答提供下一步', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'REVIEW', threshold: 0.80, rubric: '结束前应说明已确认事实、能力边界以及用户可以执行的下一步。', source: 'preset' },
  { rule_id: 'SCENE_ROLE_STABILITY', name: '角色始终保持一致', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'REVIEW', threshold: 0.80, rubric: '各参与角色在多轮交互中保持身份、立场、语气、权限和能力边界一致。', source: 'preset' },
  { rule_id: 'SCENE_STATE_TRANSITION', name: '状态转换合法', scope: 'synthesis_instruction', evaluator: 'state_transition', severity: 'BLOCK', field_path: 'state_path', expected_values: '[]', rubric: '状态路径中的相邻状态必须属于场景定义的允许转换。', source: 'preset' },
];

const LABEL_COVERAGE_RULE = {
  rule_id: 'SCENE_LABEL_COVERAGE',
  name: '标签覆盖率',
  scope: 'final_conversation',
  evaluator: 'label_coverage',
  severity: 'INFO',
  rubric: '按标签维度统计每个枚举值的样本数量，形成覆盖分布，供后续定向扩增使用。',
  source: 'preset',
};

const DEFAULT_TOOL = {
  name: 'query_shipment',
  description: '根据合成运单号查询当前运输状态。',
  call_condition: '客户提供了格式有效的合成运单号，且需要核实当前状态。',
  input_fields: [
    { name: 'shipment_id', type: 'string', required: true, description: '合成运单号' },
  ],
  output_fields: [
    { name: 'status', type: 'string', required: true, description: '当前运输状态' },
    { name: 'last_update_time', type: 'string', required: true, description: '最后更新时间' },
    { name: 'known_reason', type: 'string', required: false, description: '已知异常原因' },
  ],
  example_arguments: '{"shipment_id":"SYN2026000001"}',
  example_result: '{"status":"运输延误","last_update_time":"2026-08-25 16:30:00","known_reason":"天气影响"}',
};

const DEFAULT_SCENARIO_RULES = [...QUALITY_PRESETS.slice(0, 4), LABEL_COVERAGE_RULE].map(item => ({ ...item, enabled: true }));

const INITIAL_VALUES = {
  ...CONVERSATION_INITIAL_VALUES,
  name: '物流智能客服对话模板',
  description: '物流状态查询、延误解释和异常受理示例。',
  businessType: '智能客服多轮对话',
  knowledgeEnabled: true,
  toolsEnabled: true,
  toolMode: 'provided_result',
  toolCatalog: [{ ...DEFAULT_TOOL }],
  scenarioRules: DEFAULT_SCENARIO_RULES,
  scenarioQualityEnabled: true,
  privacyMethods: DEFAULT_PRIVACY_METHODS,
  sampleLabelsEnabled: true,
  coverageLabelsMarkdown: DEFAULT_COVERAGE_LABELS,
  coverageLabelPrompt: '根据用户意图、情绪、信息完整度及工具调用路径进行打标；每个维度只能选择一个已配置的枚举值，不能新增或改写标签。',
  otherInstructionsEnabled: false,
  otherMarkdown: '',
  outputFormat: 'verl_sft',
  trialModel: 'qwen3-8b',
  trialGenerationParamsEnabled: false,
  trialGenerationParamsJson: '{\n  "temperature": 0.7,\n  "top_p": 0.9\n}',
  trialQualityModel: 'qwen3-8b',
  trialQualityParamsEnabled: false,
  trialQualityParamsJson: '{\n  "temperature": 0.1\n}',
  trialSampleCount: 3,
  trialMinTurns: 3,
  trialMaxTurns: 6,
  reviewAcknowledged: false,
};

function ruleIds(text = '') {
  return [...String(text).matchAll(/^\s*\[(?:知识卡|规则)\s+([^\]]+)\]\s*$/gm)].map(match => match[1].trim());
}

function compactJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function estimatePromptTokens(value = '') {
  const text = String(value);
  if (!text.trim()) return 0;
  const chineseCharacterCount = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  const remainingCharacterCount = text.replace(/[\u3400-\u4dbf\u4e00-\u9fff\s]/g, '').length;
  return Math.ceil(chineseCharacterCount + remainingCharacterCount / 4);
}

function jsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function jsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

const jsonArrayFieldRule = label => ({
  validator: (_, value) => {
    try {
      const parsed = JSON.parse(String(value || ''));
      return Array.isArray(parsed) && parsed.length ? Promise.resolve() : Promise.reject(new Error(`${label}必须是非空 JSON 数组`));
    } catch { return Promise.reject(new Error(`${label}必须是合法 JSON 数组`)); }
  },
});

function problemText(problem) {
  if (typeof problem === 'string') return problem;
  return problem?.message || compactJson(problem);
}

function promptPreview(values = {}) {
  const scenario = [
    values.sceneMarkdown,
    values.rolesMarkdown,
    values.goalsMarkdown,
    values.constraintsMarkdown,
    values.factStateMarkdown,
    ...(values.sampleLabelsEnabled ? [values.coverageLabelsMarkdown, values.coverageLabelPrompt] : []),
    ...(values.otherInstructionsEnabled ? [values.otherMarkdown] : []),
  ]
    .filter(Boolean).join('\n\n');
  const knowledge = !values.knowledgeEnabled
    ? '{"enabled":false,"note":"本模板不注入知识卡"}'
    : compactJson({ enabled: true, mode: 'knowledge_cards', card_ids: ruleIds(values.knowledgeText), content: values.knowledgeText || '' });
  const tools = !values.toolsEnabled
    ? '{"enabled":false,"catalog":[]}'
    : compactJson({ enabled: true, mode: values.toolMode, catalog: values.toolCatalog || [] });
  const quality = compactJson({
    fixed_policy_ref: 'conversation-fixed-quality/v1',
    scenario_rules: values.scenarioQualityEnabled === false ? [] : (values.scenarioRules || []).filter(rule => values.sampleLabelsEnabled || rule.rule_id !== LABEL_COVERAGE_RULE.rule_id),
  });
  const output = compactJson(values.outputFormat === 'verl_sft' ? {
    data_source: 'conversation_synthesis',
    prompt: [{ role: 'system', content: 'string' }, { role: 'user', content: 'string' }],
    response: 'string',
    ability: 'customer_service',
    extra_info: { instruction_id: 'TRIAL-0001', coverage_labels: {}, state_path: [], expected_final_state: 'resolved' },
  } : {});
  return PROMPT_SOURCE
    .replace('{{runtime.sequence}}', '1')
    .replace('{{runtime.seed}}', '20260826')
    .replace('{{scenario.markdown}}', scenario || '（等待填写场景配置）')
    .replace('{{knowledge.context_json}}', knowledge)
    .replace('{{tools.catalog_json}}', tools)
    .replace('{{runtime.coverage_target_json}}', values.sampleLabelsEnabled ? '{"business_intent":"物流状态查询","customer_emotion":"焦虑","information_completeness":"信息完整","tool_path":"查询成功"}' : '{}')
    .replace('{{quality.generation_constraints_json}}', quality)
    .replace('{{output.schema_json}}', `数据格式：VERL SFT\n${output}`);
}

function configurationFromValues(values) {
  const toolsEnabled = Boolean(values.toolsEnabled);
  const knowledgeEnabled = Boolean(values.knowledgeEnabled);
  const sampleLabelsEnabled = Boolean(values.sampleLabelsEnabled);
  const otherInstructionsEnabled = Boolean(values.otherInstructionsEnabled);
  const toolCatalog = (values.toolCatalog || []).map(tool => ({
    name: tool.name,
    description: tool.description,
    call_condition: tool.call_condition,
    input_fields: tool.input_fields || tool.input_schema || [],
    output_fields: tool.output_fields || tool.output_schema || [],
    example_arguments: jsonObject(tool.example_arguments),
    example_result: jsonObject(tool.example_result),
  }));
  return {
    identity: {
      name: values.name,
      description: values.description || '',
      business_type: values.businessType,
    },
    scenario: {
      scene_markdown: values.sceneMarkdown,
      roles_markdown: values.rolesMarkdown,
      goals_markdown: values.goalsMarkdown,
      constraints_markdown: values.constraintsMarkdown,
      fact_state_markdown: values.factStateMarkdown,
      sample_labels_enabled: sampleLabelsEnabled,
      coverage_labels_markdown: sampleLabelsEnabled ? values.coverageLabelsMarkdown : '',
      coverage_label_prompt: sampleLabelsEnabled ? values.coverageLabelPrompt || '' : '',
      other_instructions_enabled: otherInstructionsEnabled,
      other_markdown: otherInstructionsEnabled ? values.otherMarkdown || '' : '',
      language: 'zh-CN',
      turn_range: [3, 6],
      coverage_plan: [
        { dimension: 'conversation_difficulty', values: ['standard', 'complex', 'edge_case'] },
        { dimension: 'user_emotion', values: ['neutral', 'anxious', 'dissatisfied'] },
        { dimension: 'information_completeness', values: ['complete', 'partially_missing'] },
        { dimension: 'state_path', values: ['resolved', 'needs_follow_up', 'human_handoff'] },
      ],
    },
    knowledge: knowledgeEnabled ? {
      enabled: true,
      mode: 'knowledge_cards',
      text: values.knowledgeText || '',
    } : { enabled: false, mode: 'none' },
    tools: toolsEnabled ? {
      enabled: true,
      mode: values.toolMode,
      catalog: toolCatalog,
      instructions_markdown: values.toolInstructionsMarkdown || '',
    } : { enabled: false, mode: 'none', catalog: [] },
    prompt_template: {
      version: 'conversation-synthesis-prompt/v2',
      output_format: values.outputFormat || 'verl_sft',
      source: PROMPT_SOURCE,
      required_variables: PLACEHOLDERS.map(([value]) => value.slice(2, -2)),
      user_editable: false,
    },
    quality: {
      fixed_policy_ref: 'conversation-fixed-quality/v1',
      fixed_rules_locked: true,
      custom_enabled: values.scenarioQualityEnabled !== false,
      label_coverage_enabled: sampleLabelsEnabled && (values.scenarioRules || []).some(rule => rule.rule_id === LABEL_COVERAGE_RULE.rule_id),
      scenario_rules: (values.scenarioRules || []).filter(rule => sampleLabelsEnabled || rule.rule_id !== LABEL_COVERAGE_RULE.rule_id).map(rule => {
        const { severity, ...ruleWithoutSeverity } = rule;
        return ({
        ...ruleWithoutSeverity,
        ...(rule.expected_values !== undefined ? { expected_values: jsonArray(rule.expected_values) } : {}),
        ...(rule.phrases !== undefined ? { phrases: jsonArray(rule.phrases) } : {}),
        enabled: values.scenarioQualityEnabled !== false && rule.enabled !== false,
      }); }),
    },
    trial_config: {
      model: {
        provider: values.trialModel === 'mock' ? 'mock' : 'bailian',
        alias: values.trialModel || 'qwen3-8b',
        display_name: values.trialModel === 'mock' ? '本地 Mock' : values.trialModel === 'qwen3-14b' ? 'Qwen3-14B' : 'Qwen-8B',
        temperature: 0.2,
        enable_thinking: false,
      },
      ...(values.trialGenerationParamsEnabled ? { generation_parameters: jsonObject(values.trialGenerationParamsJson || '{}') } : {}),
      quality_model: { provider: values.trialQualityModel === 'mock' ? 'mock' : 'bailian', alias: values.trialQualityModel || 'qwen3-8b' },
      ...(values.trialQualityParamsEnabled ? { quality_parameters: jsonObject(values.trialQualityParamsJson || '{}') } : {}),
      sample_count: Number(values.trialSampleCount || 3),
      min_turns: Number(values.trialMinTurns || 3),
      max_turns: Number(values.trialMaxTurns || 6),
      generate_dialogue: true,
      judge_enabled: true,
    },
  };
}

function valuesFromDetail(detail) {
  const selected = detail?.selected_version || {};
  const config = detail?.configuration || selected.configuration_v2 || selected.configuration || {};
  const identity = config.identity || {};
  const scenario = config.scenario || {};
  const legacyPrompt = selected.prompt_generation || {};
  const knowledge = config.knowledge || selected.knowledge || {};
  const tools = config.tools || {};
  const quality = config.quality || {};
  const trial = config.trial_config || {};
  const coverageLabelsMarkdown = scenario.coverage_labels_markdown || legacyPrompt.coverage_labels_markdown || INITIAL_VALUES.coverageLabelsMarkdown;
  const coverageLabelPrompt = scenario.coverage_label_prompt || INITIAL_VALUES.coverageLabelPrompt;
  const sampleLabelsEnabled = scenario.sample_labels_enabled ?? Boolean(String(coverageLabelsMarkdown).trim());
  const otherMarkdown = scenario.other_markdown || legacyPrompt.other_markdown || '';
  const otherInstructionsEnabled = scenario.other_instructions_enabled ?? Boolean(otherMarkdown.trim());
  const storedScenarioRules = quality.scenario_rules?.length ? quality.scenario_rules.map(rule => ({
    ...rule,
    rubric: rule.rubric || rule.description || '',
    ...(Array.isArray(rule.expected_values) ? { expected_values: compactJson(rule.expected_values) } : {}),
    ...(Array.isArray(rule.phrases) ? { phrases: compactJson(rule.phrases) } : {}),
  })) : DEFAULT_SCENARIO_RULES;
  const labelCoverageEnabled = quality.label_coverage_enabled ?? sampleLabelsEnabled;
  const scenarioRules = sampleLabelsEnabled && labelCoverageEnabled && !storedScenarioRules.some(rule => rule.rule_id === LABEL_COVERAGE_RULE.rule_id)
    ? [...storedScenarioRules, { ...LABEL_COVERAGE_RULE, enabled: true }]
    : storedScenarioRules.filter(rule => sampleLabelsEnabled || rule.rule_id !== LABEL_COVERAGE_RULE.rule_id);
  return {
    ...INITIAL_VALUES,
    name: identity.name || detail?.name || INITIAL_VALUES.name,
    description: identity.description ?? detail?.description ?? INITIAL_VALUES.description,
    businessType: identity.business_type || detail?.business_type || INITIAL_VALUES.businessType,
    sceneMarkdown: scenario.scene_markdown || legacyPrompt.scene_markdown || INITIAL_VALUES.sceneMarkdown,
    rolesMarkdown: scenario.roles_markdown || legacyPrompt.roles_markdown || INITIAL_VALUES.rolesMarkdown,
    goalsMarkdown: scenario.goals_markdown || legacyPrompt.goals_markdown || INITIAL_VALUES.goalsMarkdown,
    constraintsMarkdown: scenario.constraints_markdown || legacyPrompt.constraints_markdown || INITIAL_VALUES.constraintsMarkdown,
    factStateMarkdown: scenario.fact_state_markdown || legacyPrompt.fact_state_markdown || INITIAL_VALUES.factStateMarkdown,
    sampleLabelsEnabled,
    coverageLabelsMarkdown,
    coverageLabelPrompt,
    otherInstructionsEnabled,
    otherMarkdown,
    knowledgeEnabled: knowledge.enabled !== false && knowledge.mode !== 'none',
    knowledgeText: knowledge.text || '',
    toolsEnabled: tools.enabled ?? (legacyPrompt.tool_mode && legacyPrompt.tool_mode !== 'none'),
    toolMode: tools.mode || legacyPrompt.tool_mode || 'provided_result',
    toolCatalog: tools.catalog?.length ? tools.catalog.map(tool => ({
      ...tool,
      input_fields: tool.input_fields || tool.parameters || tool.input_schema || [],
      output_fields: tool.output_fields || tool.returns || tool.output_schema || [],
      example_arguments: compactJson(tool.example_arguments || {}),
      example_result: compactJson(tool.example_result || {}),
    })) : [{ ...DEFAULT_TOOL }],
    toolInstructionsMarkdown: tools.instructions_markdown || legacyPrompt.tool_instructions_markdown || INITIAL_VALUES.toolInstructionsMarkdown,
    scenarioRules,
    scenarioQualityEnabled: quality.custom_enabled ?? (!(quality.scenario_rules || []).length || (quality.scenario_rules || []).some(rule => rule.enabled !== false)),
    outputFormat: config.prompt_template?.output_format || 'verl_sft',
    trialModel: trial.model?.alias || trial.model_alias || 'qwen3-8b',
    trialGenerationParamsEnabled: Object.prototype.hasOwnProperty.call(trial, 'generation_parameters') || Boolean(trial.model?.parameters),
    trialGenerationParamsJson: compactJson(trial.generation_parameters || trial.model?.parameters || { temperature: 0.7, top_p: 0.9 }),
    trialQualityModel: trial.quality_model?.alias || 'qwen3-8b',
    trialQualityParamsEnabled: Object.prototype.hasOwnProperty.call(trial, 'quality_parameters') || Boolean(trial.quality_model?.parameters),
    trialQualityParamsJson: compactJson(trial.quality_parameters || trial.quality_model?.parameters || { temperature: 0.1 }),
    trialSampleCount: trial.sample_count || trial.instruction_count || 3,
    trialMinTurns: trial.min_turns || 3,
    trialMaxTurns: trial.max_turns || 6,
  };
}

function MarkdownField({ name, label, description, rows = 6, required = true }) {
  return <Form.Item name={name} label={label} extra={description} rules={required ? [{ required: true, whitespace: true, message: `请用 Markdown 填写${label}` }] : []}>
    <Input.TextArea rows={rows} showCount/>
  </Form.Item>;
}

function SceneStep({ form, onManualChange }) {
  const sampleLabelsEnabled = Form.useWatch('sampleLabelsEnabled', form);
  const otherInstructionsEnabled = Form.useWatch('otherInstructionsEnabled', form);
  const changeSampleLabels = enabled => {
    const currentRules = form.getFieldValue('scenarioRules') || [];
    const withoutCoverage = currentRules.filter(rule => rule?.rule_id !== LABEL_COVERAGE_RULE.rule_id);
    form.setFieldValue('scenarioRules', enabled ? [...withoutCoverage, { ...LABEL_COVERAGE_RULE, enabled: true }] : withoutCoverage);
    onManualChange?.();
  };
  return <>
    <Alert type="info" showIcon message="只需要说明真实业务，不需要编写 Prompt" description="系统会把场景、角色、目标、约束和状态机自动编译成批量合成指令模板。输入框已预置物流客服示例，可直接修改。"/>
    <Divider orientation="left">模板基本信息</Divider>
    <Row gutter={16}>
      <Col span={12}><Form.Item name="name" label="模板名称" rules={[{ required: true }, { max: 80 }]}><Input placeholder="例如：物流运输延误智能客服"/></Form.Item></Col>
      <Col span={12}><Form.Item name="businessType" label="业务类型" rules={[{ required: true }]}><Input placeholder="例如：智能客服多轮对话"/></Form.Item></Col>
    </Row>
    <Form.Item name="description" label="模板说明"><Input.TextArea rows={2} maxLength={500} showCount/></Form.Item>
    <Divider orientation="left">对话场景</Divider>
    <Row gutter={16}>
      <Col span={12}><MarkdownField name="sceneMarkdown" label="场景说明" description="说明服务对象、业务范围和典型问题。"/></Col>
      <Col span={12}><MarkdownField name="rolesMarkdown" label="对话角色说明" description="说明各角色身份、已知信息、权限和语言风格。"/></Col>
      <Col span={12}><MarkdownField name="goalsMarkdown" label="对话目标说明" description="说明一次合格对话最终应解决什么问题。"/></Col>
      <Col span={12}><MarkdownField name="constraintsMarkdown" label="场景约束（包括禁止行为）" description="写清不能编造、不能承诺和必须遵守的业务边界。"/></Col>
    </Row>
    <MarkdownField name="factStateMarkdown" label="业务事实与状态机说明" rows={8} description="说明事实字段和状态流转。状态必须同时定义英文内部 ID 与中文含义，例如 human_handoff（转人工）；最终训练数据使用英文 ID。"/>
    <Card size="small" className="conversation-config-card" title="样本标签配置（可选）" extra={<Form.Item name="sampleLabelsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="需要" unCheckedChildren="不需要" onChange={changeSampleLabels}/></Form.Item>}>
      {!sampleLabelsEnabled ? <Alert type="info" showIcon message="本模板不需要样本标签" description="合成时不会生成标签，也不会执行标签覆盖率统计。"/> : <>
        <Paragraph type="secondary">标签枚举值定义允许使用的标签范围，打标依据提示词说明模型应如何判断每个样本的标签。</Paragraph>
        <Row gutter={16}>
          <Col span={12}><MarkdownField name="coverageLabelsMarkdown" label="标签枚举值" rows={12} description="每个标题使用“英文维度ID | 中文名称”，下面用列表填写允许取值。例如：## customer_emotion | 用户情绪；下一行填写 - 平静。"/></Col>
          <Col span={12}><MarkdownField name="coverageLabelPrompt" label="打标依据提示词" rows={12} description="说明每个标签维度的判断依据、优先级和冲突处理方式；模型只能从左侧枚举值中选择。"/></Col>
        </Row>
      </>}
    </Card>
    <Card size="small" className="conversation-config-card" title="其它说明（可选）" extra={<Form.Item name="otherInstructionsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="需要" unCheckedChildren="不需要"/></Form.Item>}>
      {!otherInstructionsEnabled ? <Alert type="info" showIcon message="本模板不需要其它说明"/> : <Form.Item name="otherMarkdown" extra="需要补充但不属于以上字段的信息可写在这里；系统会验证其已进入最终合成指令。" rules={[{ required: true, whitespace: true, message: '请填写其它说明' }]}>
        <Input.TextArea rows={5} showCount placeholder="可使用 Markdown"/>
      </Form.Item>}
    </Card>
  </>;
}

function SchemaFields({ fieldName, title }) {
  return <Form.List name={fieldName}>{(fields, { add, remove }) => <Card size="small" title={title} extra={<Button size="small" icon={<PlusOutlined/>} onClick={() => add({ type: 'string', required: false })}>添加字段</Button>}>
    {fields.length ? fields.map(field => <Row gutter={8} key={field.key} align="middle">
      <Col span={5}><Form.Item name={[field.name, 'name']} rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '使用英文字母开头的字段名' }]}><Input placeholder="字段名"/></Form.Item></Col>
      <Col span={4}><Form.Item name={[field.name, 'type']} rules={[{ required: true }]}><Select options={PARAM_TYPES.map(value => ({ value, label: value }))}/></Form.Item></Col>
      <Col span={3}><Form.Item name={[field.name, 'required']} valuePropName="checked"><Switch checkedChildren="必填" unCheckedChildren="可选"/></Form.Item></Col>
      <Col span={10}><Form.Item name={[field.name, 'description']}><Input placeholder="字段含义与取值约束"/></Form.Item></Col>
      <Col span={2}><Form.Item><Button type="text" danger icon={<DeleteOutlined/>} onClick={() => remove(field.name)}/></Form.Item></Col>
    </Row>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加字段"/>}
  </Card>}</Form.List>;
}

function ToolCatalogEditor() {
  return <Form.List name="toolCatalog">{(fields, { add, remove }) => <>
    <Flex justify="space-between" align="center" className="conversation-subsection-title">
      <div><Text strong>工具 List</Text><br/><Text type="secondary">工具仅用于合成训练数据，不会在配置或试运行时连接真实系统。</Text></div>
      <Button icon={<PlusOutlined/>} onClick={() => add({ name: '', description: '', call_condition: '', input_fields: [], output_fields: [], example_arguments: '{}', example_result: '{}' })}>添加工具</Button>
    </Flex>
    {fields.length ? fields.map((field, index) => <Card key={field.key} size="small" className="conversation-tool-card" title={<Space><ToolOutlined/>工具 {index + 1}</Space>} extra={<Button type="link" danger icon={<DeleteOutlined/>} onClick={() => remove(field.name)}>删除</Button>}>
      <Row gutter={16}>
        <Col span={8}><Form.Item name={[field.name, 'name']} label="工具名称" rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '例如 query_order' }]}><Input placeholder="query_order"/></Form.Item></Col>
        <Col span={16}><Form.Item name={[field.name, 'description']} label="工具说明" rules={[{ required: true }]}><Input placeholder="说明工具能查询或执行什么"/></Form.Item></Col>
      </Row>
      <Form.Item name={[field.name, 'call_condition']} label="调用条件" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="满足什么事实和状态时才允许使用该工具"/></Form.Item>
      <Row gutter={12}>
        <Col span={12}><SchemaFields fieldName={[field.name, 'input_fields']} title="输入参数"/></Col>
        <Col span={12}><SchemaFields fieldName={[field.name, 'output_fields']} title="输出结果"/></Col>
      </Row>
      <Row gutter={12} className="section-title">
        <Col span={12}><Form.Item name={[field.name, 'example_arguments']} label="合成参数示例" rules={[{ required: true }, { validator: (_, value) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('请输入 JSON 对象')); } catch { return Promise.reject(new Error('JSON 格式不正确')); } } }]}><Input.TextArea rows={3} placeholder='{"order_id":"SYN001"}'/></Form.Item></Col>
        <Col span={12}><Form.Item name={[field.name, 'example_result']} label="合成返回示例" rules={[{ required: true }, { validator: (_, value) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('请输入 JSON 对象')); } catch { return Promise.reject(new Error('JSON 格式不正确')); } } }]}><Input.TextArea rows={3} placeholder='{"status":"processing"}'/></Form.Item></Col>
      </Row>
    </Card>) : <Alert type="warning" showIcon message="工具已开启，请至少添加一个工具"/>}
  </>}</Form.List>;
}

function KnowledgeToolsStep({ form, onManualChange }) {
  const knowledgeEnabled = Form.useWatch('knowledgeEnabled', form);
  const toolsEnabled = Form.useWatch('toolsEnabled', form);
  const knowledgeText = Form.useWatch('knowledgeText', form) || '';
  const ids = ruleIds(knowledgeText);
  return <>
    <Alert type="info" showIcon message="知识卡和工具都不是必填项" description="关闭后系统会从合成指令中移除对应要求，并在质检时禁止模型虚构知识引用或工具调用。"/>
    <Card className="conversation-config-card" title={<Space><FileTextOutlined/>知识卡</Space>} extra={<Form.Item name="knowledgeEnabled" valuePropName="checked" noStyle><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item>}>
      {!knowledgeEnabled ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本模板不注入知识卡；仍可继续下一步"/> : <>
        <Alert type="success" showIcon message="知识卡示例" description={<span>知识卡用于提供模型回答问题时可直接引用的业务知识。每张卡以 <Text code>[知识卡 唯一ID]</Text> 开头，填写适用问题、已知业务事实和推荐回答；多张知识卡可连续粘贴，ID 不可重复。</span>}/>
        <Form.Item className="section-title" name="knowledgeText" label={<Space>知识卡内容<Tag color={ids.length ? 'green' : 'default'}>{ids.length} 张</Tag></Space>} rules={[{ required: true, whitespace: true, message: '请粘贴至少一张知识卡' }]} extra="示例：当用户询问运输状态长时间未更新时，说明状态停更的常见原因、当前可以确认的信息，以及建议用户采取的下一步。">
          <Input.TextArea rows={16} showCount placeholder={'[知识卡 DELIVERY-STATUS-001]\n知识主题：运输状态长时间未更新\n适用问题：用户询问物流信息为什么超过 24 小时没有更新\n已知业务事实：状态停更可能由转运扫描延迟、天气或网络同步延迟造成；状态停更不等于货物丢失\n推荐回答：先说明当前可查询到的最后物流节点和更新时间，再解释可能原因；如超过承诺时效，建议用户发起异常查询或联系人工客服'} onBlur={onManualChange}/>
        </Form.Item>
      </>}
    </Card>
    <Card className="conversation-config-card" title={<Space><ApiOutlined/>工具</Space>} extra={<Form.Item name="toolsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item>}>
      {!toolsEnabled ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成纯对话数据，不包含工具调用或工具返回"/> : <>
        <Form.Item name="toolMode" label="工具信息如何进入训练数据" rules={[{ required: true }]}><Radio.Group><Space direction="vertical">{TOOL_MODES.map(item => <Radio key={item.value} value={item.value}><Text strong>{item.label}</Text><Text type="secondary">　{item.description}</Text></Radio>)}</Space></Radio.Group></Form.Item>
        <ToolCatalogEditor/>
        <Form.Item name="toolInstructionsMarkdown" label="工具使用提示词"><Input.TextArea rows={3} placeholder="填写工具调用条件、优先级、禁止组合或其他场景约束"/></Form.Item>
      </>}
    </Card>
  </>;
}

function QualityRulesEditor({ form, onManualChange, fixedRules = FIXED_RULES }) {
  const rules = Form.useWatch('scenarioRules', form) || [];
  const scenarioQualityEnabled = Form.useWatch('scenarioQualityEnabled', form);
  const selectedPresetIds = rules.filter(item => item?.source === 'preset').map(item => item.rule_id);
  const sampleLabelsEnabled = Form.useWatch('sampleLabelsEnabled', form);
  const hasSampleLabels = Boolean(sampleLabelsEnabled && (Form.useWatch('coverageLabelsMarkdown', form) || '').trim());
  const availablePresets = hasSampleLabels ? [...QUALITY_PRESETS, LABEL_COVERAGE_RULE] : QUALITY_PRESETS;
  const fixedCard = item => {
    const isPrivacy = item.id.includes('PRIVACY');
    return <Col span={8} key={item.id}><Card size="small" className={`conversation-fixed-rule ${isPrivacy ? 'conversation-fixed-rule-privacy' : 'conversation-fixed-rule-other'}`}>
      <Space direction="vertical" size={3}>
        <Space><CheckCircleOutlined style={{ color: isPrivacy ? '#1677ff' : '#52c41a' }}/><Text strong>{item.id.includes('EVIDENCE')||item.id.includes('RULE-TRACE')?'知识卡ID可追溯':item.name}</Text><Tag color={isPrivacy ? 'blue' : 'green'}>{isPrivacy ? '隐私检查' : '其它规则'}</Tag></Space>
        <Text type="secondary">{item.description}</Text><Tag>{item.id}</Tag>
      </Space>
    </Card></Col>;
  };
  const changePresets = checked => {
    const custom = (form.getFieldValue('scenarioRules') || []).filter(item => item?.source !== 'preset');
    form.setFieldValue('scenarioRules', [...availablePresets.filter(item => checked.includes(item.rule_id)).map(item => ({ ...item, enabled: true })), ...custom]);
    onManualChange?.();
  };
  return <>
    <Divider orientation="left">按检查对象配置质检</Divider>
    <Alert type="success" showIcon message="固定规则由系统维护，不需要用户配置" description="蓝色表示隐私检查规则，绿色表示其它固定规则。规则不能被关闭，也不会被知识卡内容覆盖。"/>
    <Card size="small" className="section-title" title="检查对象：合成指令"><Text strong>基础规则</Text><Row gutter={[12,12]} className="section-title">{fixedRules.filter(item=>['synthesis_instruction','both'].includes(item.scope||'both')).map(fixedCard)}</Row></Card>
    <Card size="small" className="section-title" title="检查对象：最终对话"><Text strong>基础规则</Text><Row gutter={[12,12]} className="section-title">{fixedRules.filter(item=>['final_conversation','both'].includes(item.scope||'both')).map(fixedCard)}</Row></Card>
    <Alert className="section-title" type="info" showIcon message="语义质检统一使用 0–1.00 分数" description="Judge系统指令：只输出一个0到1之间、最多两位小数的数字，例如0.87；不得输出JSON、解释、标签、Markdown或其它字符。"/>
    <Divider orientation="left">场景质检规则（合成指令 / 最终对话）</Divider>
    <Flex justify="space-between" align="flex-start"><Paragraph type="secondary">先勾选常用规则，再按需要配置检查对象、检查方式、语义阈值和判定内容；规则 ID 由系统自动生成。</Paragraph><Form.Item name="scenarioQualityEnabled" valuePropName="checked"><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item></Flex>
    {!scenarioQualityEnabled ? <Alert type="info" showIcon message="场景自定义质检已关闭" description="格式、隐私、占位符、状态机和工具契约等固定基础规则仍会执行。"/> : <>
      {hasSampleLabels && <Alert className="section-title" type="success" showIcon message="已根据样本标签配置默认勾选“标签覆盖率”" description="该规则统计各标签枚举值对应的样本数量，结果供后续定向扩增使用；如当前模板不需要统计，可取消勾选。"/>}
      <Checkbox.Group value={selectedPresetIds} onChange={changePresets} className="conversation-quality-presets">
        {availablePresets.map(item => <Checkbox value={item.rule_id} key={item.rule_id}>{item.name}</Checkbox>)}
      </Checkbox.Group>
    <Form.List name="scenarioRules">{(fields, { add, remove }) => <>
      <Flex justify="space-between" className="conversation-subsection-title"><Text strong>已配置规则（{fields.length}）</Text><Button icon={<PlusOutlined/>} onClick={() => add({ rule_id: `SCENE-${Date.now().toString(36).toUpperCase()}`, name: '自定义场景规则', scope: 'final_conversation', evaluator: 'semantic_quality', threshold: 0.80, rubric: '', source: 'custom', enabled: true })}>添加自定义规则</Button></Flex>
      {fields.map(field => <Card size="small" className="conversation-quality-rule" key={field.key} extra={<Space><Form.Item name={[field.name, 'enabled']} valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item><Button type="link" danger icon={<DeleteOutlined/>} onClick={() => remove(field.name)}>删除</Button></Space>}>
        <Row gutter={12}>
          <Col span={6}><Form.Item name={[field.name, 'rule_id']} label="规则 ID"><Input disabled/></Form.Item></Col>
          <Col span={7}><Form.Item name={[field.name, 'name']} label="规则名称" rules={[{ required: true }]}><Input/></Form.Item></Col>
          <Col span={5}><Form.Item name={[field.name, 'scope']} label="检查对象"><Select options={[{ value: 'synthesis_instruction', label: '合成指令' }, { value: 'final_conversation', label: '最终对话' }, { value: 'both', label: '两者' }]}/></Form.Item></Col>
          <Col span={6}><Form.Item noStyle shouldUpdate>{() => form.getFieldValue(['scenarioRules', field.name, 'evaluator']) === 'semantic_quality' ? <Form.Item name={[field.name, 'threshold']} label="语义阈值"><InputNumber min={0} max={1} step={0.01} precision={2} style={{ width: '100%' }}/></Form.Item> : <Form.Item label="阈值"><Text type="secondary">规则检查无阈值</Text></Form.Item>}</Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={6}><Form.Item name={[field.name, 'evaluator']} label="检查方式"><Select options={[{ value: 'semantic_quality', label: '语义质检' }, { value: 'evidence_trace', label: '规则检查：证据存在' }, { value: 'label_coverage', label: '规则统计：标签覆盖率' }, { value: 'required_field', label: '规则检查：字段必填' }, { value: 'enum', label: '规则检查：枚举值' }, { value: 'regex', label: '规则检查：正则格式' }, { value: 'contains', label: '规则检查：必须包含' }, { value: 'forbidden', label: '规则检查：禁止包含' }]}/></Form.Item></Col>
          <Col span={18}><Form.Item name={[field.name, 'rubric']} label="判定说明" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="明确什么情况下通过、复核或拒绝"/></Form.Item></Col>
        </Row>
        <Form.Item noStyle shouldUpdate={(before, after) => before.scenarioRules?.[field.name]?.evaluator !== after.scenarioRules?.[field.name]?.evaluator}>{() => {
          const evaluator = form.getFieldValue(['scenarioRules', field.name, 'evaluator']);
          const needsPath = ['required_field', 'enum', 'regex', 'contains', 'forbidden', 'state_transition'].includes(evaluator);
          if (!needsPath) return null;
          return <>
            <Alert type="info" showIcon message="规则检查不调用模型" description="字段路径相对当前检查对象填写，例如 business_facts.status、state_path、messages 或 messages[0].content；不支持通配符。"/>
            <Row gutter={12} className="section-title">
              <Col span={evaluator === 'required_field' ? 24 : 10}><Form.Item name={[field.name, 'field_path']} label="字段路径" rules={[{ required: true, whitespace: true }]}><Input placeholder={evaluator === 'state_transition' ? 'state_path' : 'business_facts.status'}/></Form.Item></Col>
              {['enum', 'state_transition'].includes(evaluator) && <Col span={14}><Form.Item name={[field.name, 'expected_values']} label={evaluator === 'enum' ? '允许值（JSON 数组）' : '允许的状态转换（JSON 数组）'} rules={[jsonArrayFieldRule('允许值')]}><Input.TextArea rows={2} placeholder={evaluator === 'enum' ? '["运输中","已签收"]' : '["collect_information->resolve_request", ["resolve_request","completed"]]'}/></Form.Item></Col>}
              {evaluator === 'regex' && <Col span={14}><Form.Item name={[field.name, 'pattern']} label="正则表达式" rules={[{ required: true, whitespace: true }]}><Input placeholder="^SYN-[A-Z0-9-]+$"/></Form.Item></Col>}
              {['contains', 'forbidden'].includes(evaluator) && <Col span={14}><Form.Item name={[field.name, 'phrases']} label={evaluator === 'contains' ? '必须包含词（JSON 数组）' : '禁止出现词（JSON 数组）'} rules={[jsonArrayFieldRule('短语列表')]}><Input.TextArea rows={2} placeholder='["下一步","人工客服"]'/></Form.Item></Col>}
            </Row>
          </>;
        }}</Form.Item>
        <Form.Item noStyle shouldUpdate={(before, after) => before.scenarioRules?.[field.name]?.evaluator !== after.scenarioRules?.[field.name]?.evaluator}>{() =>
          form.getFieldValue(['scenarioRules', field.name, 'evaluator']) === 'semantic_quality' ? <Row gutter={12}>
            <Col span={12}><Form.Item name={[field.name, 'positive_example']} label="通过示例（可选）"><Input.TextArea rows={2} placeholder="帮助 Judge 理解符合规则的输出"/></Form.Item></Col>
            <Col span={12}><Form.Item name={[field.name, 'negative_example']} label="不通过示例（可选）"><Input.TextArea rows={2} placeholder="帮助 Judge 理解需要拦截的输出"/></Form.Item></Col>
          </Row> : null
        }</Form.Item>
        <Form.Item name={[field.name, 'source']} hidden><Input/></Form.Item>
      </Card>)}
    </>}</Form.List>
    </>}
  </>;
}

function PromptPreviewStep({ form, compileResult, compiling, onCompile, authoringContract }) {
  const watched = Form.useWatch([], form) || {};
  const localPreview = useMemo(() => promptPreview({ ...form.getFieldsValue(true), ...watched }), [form, watched]);
  const placeholders = authoringContract?.placeholders?.length ? authoringContract.placeholders.map(item => [`{{${item.name}}}`, item.description]) : PLACEHOLDERS;
  const compiled = typeof compileResult?.compiled_prompt === 'string'
    ? compileResult.compiled_prompt
    : compileResult?.compiled_prompt?.text || compileResult?.compiled_prompt?.rendered_markdown || localPreview;
  const estimatedTokens = useMemo(() => estimatePromptTokens(compiled), [compiled]);
  return <>
    <Alert type="info" showIcon message="系统自动管理 Prompt 骨架和占位符" description="用户只负责业务配置。核心输出契约不可删除；修改前面步骤后需要重新编译和试运行。"/>
    <Form.Item className="section-title" name="outputFormat" label="数据格式" rules={[{ required: true }]} extra="当前版本仅支持 VERL SFT；后续增加其他格式后，系统会按所选格式自动调整输出结构和最终合成指令。">
      <Select style={{ width: 320 }} options={[{ value: 'verl_sft', label: 'VERL SFT' }]}/>
    </Form.Item>
    <Divider orientation="left">系统占位符</Divider>
    <Row gutter={[12, 12]}>{placeholders.map(([value, help]) => <Col span={8} key={value}><Card size="small"><Tooltip title={help}><Tag color="blue">{value}</Tag></Tooltip><Paragraph type="secondary" className="conversation-placeholder-help">{help}</Paragraph></Card></Col>)}</Row>
    <Card className="section-title" size="small" title="最终合成指令 Prompt" extra={<Space><Tag color={compileResult?.valid === false ? 'red' : 'blue'}>{compileResult ? (compileResult.valid === false ? '编译失败' : 'Mock 已编译') : '本地实时预览'}</Tag><Button loading={compiling} onClick={onCompile}>重新编译并校验占位符</Button></Space>}>
      <Flex justify="space-between" align="center" className="conversation-token-estimate">
        <Space><Text strong>Tokens 预估</Text><Tag color="cyan">约 {estimatedTokens.toLocaleString()} Tokens</Tag></Space>
        <Text type="secondary">根据中英文字符长度估算，实际用量以所选模型返回为准</Text>
      </Flex>
      <Input.TextArea value={compiled} readOnly autoSize={{ minRows: 16, maxRows: 28 }}/>
      {(compileResult?.errors?.length > 0 || compileResult?.warnings?.length > 0) && <Alert className="section-title" type={compileResult.errors?.length ? 'error' : 'warning'} showIcon message={(compileResult.errors || []).map(problemText).join('；') || (compileResult.warnings || []).map(problemText).join('；')}/>} 
    </Card>
  </>;
}

function QualityRulesStep({ form, validation, onManualChange, authoringContract }) {
  const fixedRules = authoringContract?.fixed_rules?.length ? authoringContract.fixed_rules.map(rule => {
    const local = FIXED_RULES.find(item => item.id === rule.rule_id);
    return { id: rule.rule_id, name: rule.name, scope: rule.scope || local?.scope || 'both', description: local?.description || `${rule.severity || 'BLOCK'} 级系统固定检查` };
  }) : FIXED_RULES;
  return <>
    <QualityRulesEditor form={form} onManualChange={onManualChange} fixedRules={fixedRules}/>
    {validation && <Alert className="section-title" type={validation.valid ? 'success' : 'error'} showIcon message={validation.valid ? '模板静态校验通过，可以进入试运行' : '模板存在阻断问题'} description={(validation.errors || []).map(problemText).join('；') || `门槛结果：${validation.gate_status || 'PASS'}`}/>} 
  </>;
}

function trialItemText(item) {
  return item?.synthesis_instruction_markdown || item?.instruction || item?.prompt || item?.content || compactJson(item);
}

function TrialStep({ form, draft, trialRun, action, onTrial, authoringContract }) {
  const model = Form.useWatch('trialModel', form) || 'qwen3-8b';
  const generationParamsEnabled = Form.useWatch('trialGenerationParamsEnabled', form);
  const qualityParamsEnabled = Form.useWatch('trialQualityParamsEnabled', form);
  const count = Form.useWatch('trialSampleCount', form) || 3;
  const semanticRuleCount = (Form.useWatch('scenarioRules', form) || []).filter(rule => rule.enabled !== false && rule.evaluator === 'semantic_quality').length;
  const generationCallEstimate = Number(count);
  const qualityCallEstimate = Number(count) * semanticRuleCount;
  const status = trialRun?.status;
  const currentTrial = trialRun?.revision === draft?.revision;
  const items = trialRun?.items || [];
  const quality = trialRun?.quality_summary || {};
  const usage = trialRun?.usage || {};
  const instructionPreview = trialRun?.preview_instruction || items[0] || {};
  const conversationPreview = trialRun?.preview_training_sample || {
    data_source: 'conversation_synthesis',
    prompt: trialRun?.preview_dialogue?.messages?.filter(item => item.role !== 'assistant') || [],
    response: trialRun?.preview_dialogue?.messages?.filter(item => item.role === 'assistant').at(-1)?.content || '',
    ability: 'customer_service',
  };
  const qualityItems = trialRun?.quality_items || [
    { key: 'schema', name: '数据结构合法性', target: '对话合成指令', evaluator: 'rule', content: '校验 VERL SFT 必填字段及字段类型。', output: (quality.schema_valid_rate || 0) === 1 },
    { key: 'trace', name: '知识卡引用可追溯', target: '对话合成指令', evaluator: 'rule', content: '知识卡 ID 必须来自当前模板配置。', output: (quality.rule_traceability_rate || 0) === 1 },
    { key: 'state', name: '状态流转合法性', target: '最终合成对话', evaluator: 'rule', content: '状态路径非空且最后一项必须等于预期终态。', output: (quality.state_valid_rate || 0) === 1 },
    { key: 'tool', name: '工具调用契约', target: '最终合成对话', evaluator: 'rule', content: '工具名、参数和返回值必须符合已启用工具 Schema。', output: (quality.tool_contract_rate || 0) === 1 },
    { key: 'privacy', name: '隐私与敏感信息', target: '指令与最终对话', evaluator: 'rule', content: '检查姓名、手机号、证件号、地址及密钥等敏感信息。', output: !Number(quality.privacy_risk_count || 0) },
    { key: 'duplicate', name: '完全重复检查', target: '最终合成对话', evaluator: 'rule', content: '检查是否存在完全相同的样本。', output: !Number(quality.exact_duplicate_count || 0) },
  ];
  const modelOptions = authoringContract?.model_options?.length ? authoringContract.model_options.map(item => ({
    value: item.provider === 'mock' ? 'mock' : item.alias,
    label: `${item.display_name}${item.default ? '（默认）' : ''}`,
  })) : [{ value: 'qwen3-8b', label: 'Qwen-8B（默认）' }, { value: 'qwen3-14b', label: 'Qwen3-14B' }, { value: 'mock', label: '本地 Mock（不产生费用）' }];
  return <>
    <Alert type="info" showIcon message="先用少量样本验证模板，再发布正式版本" description="默认生成 3 条合成指令，并从中选择 1 条生成完整对话；这样既能检查指令结构，也能执行上下文语义一致性、角色稳定性等对话级质检。"/>
    <Card className="conversation-config-card" title="试运行设置">
      <Row gutter={16}>
        <Col span={9}><Form.Item name="trialModel" label="生成模型" rules={[{ required: true }]}><Select options={modelOptions}/></Form.Item></Col>
        <Col span={5}><Form.Item name="trialSampleCount" label="试运行样本数" rules={[{required:true}]}><InputNumber min={1} max={10} style={{ width: '100%' }}/></Form.Item></Col>
        <Col span={5}><Form.Item name="trialMinTurns" label="最少对话轮数" dependencies={['trialMaxTurns']} rules={[{required:true},{validator:(_,value)=>Number(value)<=Number(form.getFieldValue('trialMaxTurns'))?Promise.resolve():Promise.reject(new Error('不能大于最多轮数'))}]}><InputNumber min={1} max={50} addonAfter="轮" style={{width:'100%'}}/></Form.Item></Col>
        <Col span={5}><Form.Item name="trialMaxTurns" label="最多对话轮数" dependencies={['trialMinTurns']} rules={[{required:true},{validator:(_,value)=>Number(value)>=Number(form.getFieldValue('trialMinTurns'))?Promise.resolve():Promise.reject(new Error('不能小于最少轮数'))}]}><InputNumber min={1} max={50} addonAfter="轮" style={{width:'100%'}}/></Form.Item></Col>
      </Row>
      <Card size="small" className="conversation-config-card" title="生成模型参数（可选）" extra={<Form.Item name="trialGenerationParamsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="关闭"/></Form.Item>}>
        {!generationParamsEnabled ? <Alert type="info" showIcon message="使用模型默认生成参数" description="关闭后，试运行请求不会传递任何生成参数。"/> : <Form.Item
          name="trialGenerationParamsJson"
          extra="使用 JSON 配置 temperature、top_p 等生成参数。"
          rules={[{ validator: (_, value) => {
            try {
              const parsed = JSON.parse(String(value || ''));
              return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('生成参数必须是 JSON 对象'));
            } catch { return Promise.reject(new Error('请输入合法的 JSON 对象')); }
          } }]}
        >
          <Input.TextArea className="conversation-json-textarea" rows={6} spellCheck={false} placeholder={'{\n  "temperature": 0.7,\n  "top_p": 0.9\n}'}/>
        </Form.Item>}
      </Card>
      <Divider orientation="left">质检模型</Divider>
      <Form.Item name="trialQualityModel" label="质检模型" rules={[{required:true}]}><Select options={modelOptions}/></Form.Item>
      <Card size="small" className="conversation-config-card" title="质检模型参数（可选）" extra={<Form.Item name="trialQualityParamsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="关闭"/></Form.Item>}>
        {!qualityParamsEnabled?<Alert type="info" showIcon message="使用质检模型默认参数" description="关闭后，质检请求不会传递任何模型参数。"/>:<Form.Item name="trialQualityParamsJson" extra="使用 JSON 配置质检模型参数。" rules={[{validator:(_,value)=>{try{const parsed=JSON.parse(String(value||''));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?Promise.resolve():Promise.reject(new Error('质检参数必须是 JSON 对象'));}catch{return Promise.reject(new Error('请输入合法的 JSON 对象'));}}}]}><Input.TextArea className="conversation-json-textarea" rows={6} spellCheck={false} placeholder={'{\n  "temperature": 0.1\n}'}/></Form.Item>}
      </Card>
      <Descriptions className="section-title" bordered size="small" column={3} items={[{key:'generation',label:'生成模型调用预估',children:`${generationCallEstimate} 次`},{key:'quality',label:'质检模型调用预估',children:`${qualityCallEstimate} 次`},{key:'total',label:'API 总调用次数预估',children:<Text strong>{generationCallEstimate+qualityCallEstimate} 次</Text>}]}/>
      <Flex justify="flex-end" className="section-title"><Button type="primary" icon={<SafetyCertificateOutlined/>} loading={action === 'trial'} onClick={onTrial}>开始试运行并质检</Button></Flex>
    </Card>
    {!trialRun ? <Empty description="尚未试运行"/> : !currentTrial ? <Alert type="warning" showIcon message="配置已修改，本次试运行结果已失效" description="请保存后重新试运行。"/> : <>
      <Card className="section-title" size="small" title="1. 整体试运行结果">
        <Result status={status === 'PASS' ? 'success' : status === 'REVIEW' ? 'warning' : 'error'} title={`试运行结果：${status}`} subTitle={status === 'PASS' ? '对话合成指令、最终合成对话及全部质检项目均通过。' : status === 'REVIEW' ? '存在需要人工复核的质检项目。' : '存在阻断项，请修改模板后重新试运行。'}/>
        <Descriptions bordered size="small" column={6} items={[{ key: 'model', label: '生成模型', children: trialRun.model?.display_name || trialRun.model?.alias || model }, { key: 'qualityModel', label: '质检模型', children: trialRun.quality_model?.display_name || trialRun.quality_model?.alias || '-' }, { key: 'count', label: '试运行样本', children: trialRun.sample_count || items.length }, { key: 'turns', label: '对话轮数', children: `${trialRun.min_turns || 3}～${trialRun.max_turns || 6} 轮` }, { key: 'tokens', label: 'Token 用量', children: usage.total_tokens || 0 }, { key: 'format', label: '数据格式', children: <Tag color="blue">VERL SFT</Tag> }]}/>
      </Card>
      <Card className="section-title" size="small" title="2. 对话合成指令" extra={<Text copyable={{ text: compactJson(instructionPreview) }}>复制 JSON</Text>}>
        <Input.TextArea className="conversation-result-json" value={compactJson(instructionPreview)} readOnly autoSize={{ minRows: 14, maxRows: 24 }}/>
      </Card>
      <Card className="section-title" size="small" title="3. 最终合成对话" extra={<Space><Tag color="blue">VERL SFT</Tag><Text copyable={{ text: compactJson(conversationPreview) }}>复制 JSON</Text></Space>}>
        <Input.TextArea className="conversation-result-json" value={compactJson(conversationPreview)} readOnly autoSize={{ minRows: 14, maxRows: 24 }}/>
      </Card>
      <Card className="section-title" size="small" title="4. 质检项目明细">
        <Table rowKey="key" size="small" pagination={false} dataSource={qualityItems} columns={[
          { title: '质检项目', dataIndex: 'name', width: 220 },
          { title: '检查对象', dataIndex: 'target', width: 180 },
          { title: '判断方式', dataIndex: 'evaluator', width: 110, render: value => <Tag color={value === 'semantic' ? 'blue' : 'green'}>{value === 'semantic' ? '语义判断' : '规则判断'}</Tag> },
          { title: '质检内容', dataIndex: 'content', width: 420 },
          { title: '阈值', dataIndex: 'threshold', width: 80, render: (value, row) => row.evaluator === 'semantic' ? Number(value).toFixed(2) : '-' },
          { title: '输出结果', dataIndex: 'output', width: 110, fixed: 'right', render: (value, row) => {
            const passed = row.evaluator === 'semantic' ? Number(value) >= Number(row.threshold) : value === true;
            const output = row.evaluator === 'semantic' ? Number(value).toFixed(2) : String(value === true);
            return <Tag color={passed ? 'green' : 'red'}>{output}</Tag>;
          } },
        ]}/>
      </Card>
    </>}
  </>;
}

export function ConversationTemplateEditor({ open, template, draftId, onClose, onSaved, presentation = 'modal', readOnly = false }) {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(null);
  const [compileResult, setCompileResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [trialRun, setTrialRun] = useState(null);
  const [authoringContract, setAuthoringContract] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const examplePromise = conversationApi.getExample().catch(() => ({}));
        const contractPromise = conversationApi.getTemplateAuthoringContract().catch(() => null);
        const draftPromise = draftId ? conversationApi.getTemplateDraft(draftId) : Promise.resolve(null);
        const detailPromise = !draftId && template?.template_id ? conversationApi.getTemplate(template.template_id) : Promise.resolve(null);
        const [example, contract, loadedDraft, detail] = await Promise.all([examplePromise, contractPromise, draftPromise, detailPromise]);
        if (!active) return;
        setAuthoringContract(contract);
        const source = loadedDraft || detail;
        const values = source ? valuesFromDetail(source) : { ...INITIAL_VALUES };
        if (!source && example?.knowledge_text) {
          values.knowledgeText = example.knowledge_text;
          values.knowledgeFileName = example.knowledge_file_name || 'customer_service_rules.txt';
        }
        form.setFieldsValue(values);
        if (loadedDraft) {
          setDraft(loadedDraft);
          setCompileResult(loadedDraft.compiled_prompt || null);
          setValidation(loadedDraft.validation || null);
          setTrialRun(loadedDraft.trial_run || null);
          setStep(loadedDraft.trial_run ? 4 : loadedDraft.validation ? 3 : 0);
        }
        setDirty(false);
      } catch (error) { message.error(error.message); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; form.resetFields(); setDraft(null); setCompileResult(null); setValidation(null); setTrialRun(null); setAuthoringContract(null); setStep(0); };
  }, [open, template?.template_id, draftId, form]);

  const saveDraft = async ({ quiet = false } = {}) => {
    const values = form.getFieldsValue(true);
    const configuration = configurationFromValues(values);
    setAction('save');
    try {
      const response = draft?.draft_id
        ? await conversationApi.saveTemplateDraft(draft.draft_id, { configuration }, draft.revision)
        : await conversationApi.createTemplateDraft({ template_id: template?.template_id, template_version: template?.version, configuration });
      setDraft(response);
      setCompileResult(response.compiled_prompt || null);
      setValidation(response.validation || null);
      setTrialRun(response.trial_run || null);
      setDirty(false);
      if (!quiet) message.success('草稿已保存');
      return response;
    } finally { setAction(''); }
  };

  const ensureSaved = async () => {
    await form.validateFields();
    if (!draft?.draft_id || dirty) return saveDraft({ quiet: true });
    return draft;
  };

  const compileAndValidate = async ({ notify = true } = {}) => {
    setAction('compile');
    try {
      const saved = await ensureSaved();
      const compiled = await conversationApi.compileTemplateDraft(saved.draft_id, { expected_revision: saved.revision });
      setCompileResult(compiled);
      if (!compiled.valid) {
        if (notify) message.error('Prompt 编译失败，请检查占位符和配置');
        return { saved, compiled, checked: null };
      }
      const checked = await conversationApi.validateTemplateDraft(saved.draft_id, { expected_revision: saved.revision });
      setValidation(checked);
      if (notify) message[checked.valid ? 'success' : 'warning'](checked.valid ? 'Prompt 编译与模板校验通过' : '存在阻断问题，请按提示修改');
      return { saved, compiled, checked };
    } catch (error) { message.error(error.message); throw error; }
    finally { setAction(''); }
  };

  const changeStep = async target => {
    if (readOnly) { setStep(target); return; }
    if (target <= step) { setStep(target); return; }
    try {
      if (step === 0) {
        await form.validateFields(['name', 'businessType', 'sceneMarkdown', 'rolesMarkdown', 'goalsMarkdown', 'constraintsMarkdown', 'factStateMarkdown', 'coverageLabelsMarkdown', 'coverageLabelPrompt']);
        await saveDraft({ quiet: true });
      } else if (step === 1) {
        if (form.getFieldValue('toolsEnabled') && !(form.getFieldValue('toolCatalog') || []).length) {
          message.error('工具已开启，请至少配置一个工具'); return;
        }
        if (form.getFieldValue('knowledgeEnabled') && !form.getFieldValue('knowledgeText')) {
          message.error('知识卡已开启，请粘贴至少一张知识卡；也可以关闭知识卡开关'); return;
        }
        await form.validateFields();
        await saveDraft({ quiet: true });
      } else if (step === 2) {
        await form.validateFields(['outputFormat']);
        await saveDraft({ quiet: true });
      } else if (step === 3) {
        const result = await compileAndValidate({ notify: true });
        if (!result.compiled.valid || !result.checked?.valid) return;
      }
      setStep(target);
    } catch (error) {
      if (error?.errorFields) message.warning('请先完成当前步骤的必填配置');
      else if (error?.message) message.error(error.message);
    }
  };

  const trial = async () => {
    setAction('trial');
    try {
      const result = await compileAndValidate({ notify: false });
      if (!result.compiled.valid || !result.checked?.valid) { message.error('模板静态校验未通过，无法试运行'); return; }
      const values = form.getFieldsValue(true);
      const isMock = values.trialModel === 'mock';
      const generationParameters = values.trialGenerationParamsEnabled ? JSON.parse(values.trialGenerationParamsJson) : null;
      const qualityParameters = values.trialQualityParamsEnabled ? JSON.parse(values.trialQualityParamsJson) : null;
      const qualityIsMock = values.trialQualityModel === 'mock';
      const response = await conversationApi.trialTemplateDraft(result.saved.draft_id, {
        expected_revision: result.saved.revision,
        model: {
          provider: isMock ? 'mock' : 'bailian',
          alias: isMock ? 'mock' : values.trialModel || 'qwen3-8b',
          display_name: isMock ? '本地 Mock' : values.trialModel === 'qwen3-14b' ? 'Qwen3-14B' : 'Qwen-8B',
          ...(generationParameters ? { parameters: generationParameters } : {}),
          enable_thinking: false,
        },
        ...(generationParameters ? { generation_parameters: generationParameters } : {}),
        quality_model: { provider: qualityIsMock ? 'mock' : 'bailian', alias: qualityIsMock ? 'mock' : values.trialQualityModel || 'qwen3-8b', display_name: qualityIsMock ? '本地 Mock' : values.trialQualityModel === 'qwen3-14b' ? 'Qwen3-14B' : 'Qwen-8B' },
        ...(qualityParameters ? { quality_parameters: qualityParameters } : {}),
        sample_count: Number(values.trialSampleCount || 3),
        min_turns: Number(values.trialMinTurns || 3),
        max_turns: Number(values.trialMaxTurns || 6),
        generate_dialogue: true,
        judge_enabled: true,
        output_format: values.outputFormat || 'verl_sft',
      });
      setTrialRun(response);
      message[response.status === 'REJECT' ? 'warning' : 'success'](`试运行完成：${response.status}`);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };

  const publish = async () => {
    setAction('publish');
    try {
      const response = await conversationApi.publishTemplateDraft(draft.draft_id, {
        expected_revision: draft.revision,
        review_acknowledged: Boolean(form.getFieldValue('reviewAcknowledged')),
      });
      const published = response.published_template || response.template || response;
      message.success(`${published.template_id || '对话模板'} / ${published.version || '新版本'} 已发布`);
      onSaved?.(published);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };

  const requestClose = () => {
    if (readOnly || !dirty) { onClose?.(); return; }
    Modal.confirm({ title: '草稿尚未保存', content: '关闭后本次未保存的修改会丢失。', okText: '放弃修改并关闭', okButtonProps: { danger: true }, cancelText: '继续编辑', onOk: onClose });
  };

  const markConfigurationChanged = () => { setDirty(true); setCompileResult(null); setValidation(null); setTrialRun(null); };
  const publishable = trialRun?.revision === draft?.revision && ['PASS', 'REVIEW'].includes(trialRun?.status) && validation?.valid;
  const currentContent = step === 0 ? <SceneStep form={form} onManualChange={markConfigurationChanged}/> : step === 1 ? <KnowledgeToolsStep form={form} onManualChange={markConfigurationChanged}/> : step === 2
    ? <PromptPreviewStep form={form} compileResult={compileResult} compiling={action === 'compile'} onCompile={() => compileAndValidate()} authoringContract={authoringContract}/>
    : step === 3 ? <QualityRulesStep form={form} validation={validation} onManualChange={markConfigurationChanged} authoringContract={authoringContract}/>
    : <TrialStep form={form} draft={draft} trialRun={trialRun} action={action} onTrial={trial} authoringContract={authoringContract}/>;

  const editorContent = loading ? <div className="template-editor-loading"><Spin tip="正在加载对话模板配置"/></div> : <>
    <Flex justify="space-between" align="center" wrap="wrap" gap={12} className="conversation-template-statusbar template-editor-step-actions-top">
      <Space>{readOnly && template ? <Tag color="green">已发布</Tag> : <>{draft && <Tag color="blue">草稿已保存</Tag>}{!draft && <Tag>尚未保存</Tag>}</>}{dirty && <Tag color="orange">未保存</Tag>}{compileResult?.valid && <Tag color="cyan">Prompt 已编译</Tag>}{validation?.valid && <Tag color="green">静态校验通过</Tag>}</Space>
      <Space wrap>
        <Button icon={<ArrowLeftOutlined/>} disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>上一步</Button>
        {!readOnly && <Button icon={<SaveOutlined/>} loading={action === 'save'} disabled={!dirty && Boolean(draft)} onClick={() => saveDraft()}>保存草稿</Button>}
        {step < STEP_ITEMS.length - 1 && <Button type="primary" icon={<ArrowRightOutlined/>} loading={action === 'save' || action === 'compile'} onClick={() => changeStep(step + 1)}>下一步</Button>}
        {!readOnly && step === STEP_ITEMS.length - 1 && <Tooltip title={!publishable ? '发布门槛：当前草稿已完成试运行，且没有 REJECT 失败' : ''}><Button type="primary" icon={<CheckCircleOutlined/>} disabled={!publishable} loading={action === 'publish'} onClick={publish}>发布模板</Button></Tooltip>}
      </Space>
    </Flex>
    <Steps current={step} items={STEP_ITEMS} onChange={changeStep} className="template-editor-steps"/>
    <Form disabled={readOnly} form={form} layout="vertical" initialValues={INITIAL_VALUES} onValuesChange={changed => {
      if (Object.prototype.hasOwnProperty.call(changed, 'reviewAcknowledged')) return;
      setDirty(true);
      setCompileResult(null); setValidation(null); setTrialRun(null);
    }}>
      <Card className="main-card conversation-step-card" title={STEP_ITEMS[step].title}>{currentContent}</Card>
    </Form>
  </>;

  if (presentation === 'page') return <div className="template-create-page conversation-template-create-page">
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={requestClose}/><div><Title level={2}>{readOnly ? '对话类模板详情' : draftId || template ? '编辑对话类模板' : '新建对话类模板'}</Title><Paragraph type="secondary">{readOnly ? '以只读方式查看模板的全部配置、合成指令、质检规则和试运行结果' : '按五步完成业务配置、合成指令、质检规则和试运行；只有试运行时才调用所选模型'}</Paragraph></div></Space></Flex>
    {editorContent}
  </div>;
  return <Modal title={draftId ? '继续编辑对话模板草稿' : template ? `编辑对话模板 · ${template.name}` : '新建对话模板'} width="94vw" open={open} onCancel={requestClose} footer={null} destroyOnHidden>{editorContent}</Modal>;
}

export function ConversationTemplateCreatePage({ onBack, onCreated }) {
  return <ConversationTemplateEditor open presentation="page" template={null} onClose={onBack} onSaved={onCreated}/>;
}

export function ConversationTemplateCenter({ onCreate }) {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [open, setOpen] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      const [result, draftResult] = await Promise.all([conversationApi.listTemplates(), conversationApi.listTemplateDrafts()]);
      setItems(result.items || []);
      setDrafts((draftResult.items || []).filter(item => item.status !== 'published'));
    }
    catch (error) { message.error(`对话模板读取失败：${error.message}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  const clone = async item => {
    try { await conversationApi.cloneTemplate(item.template_id, `${item.name} - 副本`); message.success('模板副本已创建'); refresh(); }
    catch (error) { message.error(error.message); }
  };
  const showDetail=(item,isDraft=false)=>Modal.info({title:item.name||'对话模板详情',width:680,okText:'关闭',content:<Descriptions bordered size="small" column={2} className="section-title" items={[
    {key:'id',label:isDraft?'草稿 ID':'模板 ID',span:2,children:<Text copyable>{isDraft?item.draft_id:item.template_id}</Text>},
    ...(!isDraft?[{key:'version',label:'版本',children:item.version}]:[]),
    {key:'status',label:'状态',children:isDraft?(item.trial_status||'尚未试运行'):'已发布'},
    {key:'knowledge',label:'知识配置',children:item.knowledge_name||'未配置'},
    {key:'tools',label:'工具数量',children:item.tool_count??'-'},
  ]}/>});
  const publishDraft=async item=>{try{await conversationApi.publishTemplateDraft(item.draft_id,{expected_revision:item.revision});message.success(`模板“${item.name}”已发布`);refresh();}catch(error){message.error(error.message);}};
  const copyDraft=item=>{const now=Date.now();setDrafts(current=>[{...item,draft_id:`DRAFT-COPY-${now}`,name:`${item.name}（副本）`,revision:1,trial_status:null,updated_at:nowDateTime(),_prototypeCopy:true},...current]);message.success('模板已复制为草稿');};
  const deleteTemplate=(item,isDraft=false)=>Modal.confirm({title:`删除模板“${item.name}”？`,content:'正式产品中删除前需要检查任务引用；当前原型只从列表移除该记录。',okText:'确认删除',okType:'danger',cancelText:'取消',onOk:()=>{if(isDraft)setDrafts(current=>current.filter(value=>value.draft_id!==item.draft_id));else setItems(current=>current.filter(value=>value.template_id!==item.template_id));message.success('模板已删除');}});
  const columns = [
    { title: '模板名称 / ID', dataIndex: 'name', render: (value, row) => <Space direction="vertical" size={1}><Text strong>{value}</Text><Text type="secondary">{row.template_id}</Text></Space> },
    { title: '版本', dataIndex: 'version', render: (value, row) => <Space><Tag color="blue">{value}</Tag><Text type="secondary">共 {row.version_count} 个</Text></Space> },
    { title: '知识卡', render: (_, row) => <Space direction="vertical" size={1}><Text>{row.knowledge_enabled === false ? '未启用' : `${row.rule_card_count || 0} 张知识卡`}</Text><Text type="secondary">{row.knowledge_name}</Text></Space> },
    { title: '工具', render: (_, row) => row.tools_enabled === false || row.tool_mode === 'none' ? <Tag>未启用</Tag> : <Space><Tag color="cyan">{row.tool_mode}</Tag>{row.tool_count != null && <Text type="secondary">{row.tool_count} 个</Text>}</Space> },
    { title: '状态', dataIndex: 'status', render: value => <Badge status={value === 'enabled' ? 'success' : 'default'} text={value === 'enabled' ? '已启用' : '已停用'}/> },
    { title: '更新时间', dataIndex: 'updated_at', render: formatDateTime },
    { title: '操作', width: 300, render: (_, row) => <TemplateActionButtons onDetail={()=>showDetail(row)} onEdit={()=>{setEditing(row);setEditingDraftId(null);setOpen(true);}} onPublish={()=>{}} onCopy={()=>clone(row)} onDelete={()=>deleteTemplate(row)} canPublish={false} publishReason="该版本已经发布"/> },
  ];
  const draftColumns = [
    { title: '草稿名称 / ID', dataIndex: 'name', render: (value, row) => <Space direction="vertical" size={1}><Text strong>{value}</Text><Text type="secondary">{row.draft_id}</Text></Space> },
    { title: '最近试运行', dataIndex: 'trial_status', render: value => value ? <Tag color={value === 'PASS' ? 'green' : value === 'REVIEW' ? 'orange' : 'red'}>{value}</Tag> : <Tag>尚未运行</Tag> },
    { title: '更新时间', dataIndex: 'updated_at', render: formatDateTime },
    { title: '操作', width: 300, render: (_, row) => <TemplateActionButtons onDetail={()=>showDetail(row,true)} onEdit={()=>{setEditing(null);setEditingDraftId(row.draft_id);setOpen(true);}} onPublish={()=>publishDraft(row)} onCopy={()=>copyDraft(row)} onDelete={()=>deleteTemplate(row,true)} canEdit={!row._prototypeCopy} canPublish={['PASS','REVIEW'].includes(row.trial_status)} editReason="内置示例草稿仅用于查看" publishReason="试运行通过后才能发布"/> },
  ];
  return <div className="conversation-template-center">
    <Flex justify="space-between" align="flex-start"><div><Title level={4}>对话类模板</Title><Paragraph type="secondary">用五步引导式配置场景、知识卡与工具、合成 Prompt、质检规则和试运行；业务用户不需要手写 Prompt 或 JSON Schema。</Paragraph></div><Space><Button icon={<ReloadOutlined/>} loading={loading} onClick={refresh}>刷新</Button><Button type="primary" icon={<PlusOutlined/>} onClick={onCreate}>新建对话模板</Button></Space></Flex>
    <Alert type="success" showIcon icon={<FileTextOutlined/>} message="配置过程不调用 AI" description="系统只按固定规则编译模板；进入第四步并主动点击试运行后，才调用所选模型生成少量样本。"/>
    {drafts.length > 0 && <Card className="section-title" title={<Space><EditOutlined/>未发布草稿<Badge count={drafts.length}/></Space>} extra={<Text type="secondary">草稿已保存在本机，刷新页面后仍可继续</Text>} styles={{ body: { padding: 0 } }}><Table rowKey="draft_id" dataSource={drafts} columns={draftColumns} pagination={false}/></Card>}
    <Card className="section-title" styles={{ body: { padding: 0 } }}>{items.length ? <Table rowKey="template_id" dataSource={items} columns={columns} pagination={false}/> : <Empty description="暂无对话模板"/>}</Card>
    <ConversationTemplateEditor open={open} template={editing} draftId={editingDraftId} onClose={() => { setOpen(false); setEditing(null); setEditingDraftId(null); }} onSaved={() => { setOpen(false); setEditing(null); setEditingDraftId(null); refresh(); }}/>
  </div>;
}
