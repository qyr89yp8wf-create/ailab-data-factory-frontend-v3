import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Collapse, Descriptions, Divider, Drawer, Empty, Flex,
  Form, Input, InputNumber, Modal, Radio, Result, Row, Select, Space,
  Spin, Steps, Switch, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ApiOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LeftOutlined,
  CopyOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, PlusOutlined,
  ReloadOutlined, SafetyCertificateOutlined, SaveOutlined, ToolOutlined,
} from '@ant-design/icons';
import { conversationApi } from './conversationApi';
import { formatDateTime, nowDateTime } from './timeUtils';
import { CONVERSATION_INITIAL_VALUES } from './ConversationMvp';
import { SAMPLING_SCHEMA_VERSION } from './conversationSampling';
import { compileConversationPrompts, PROMPT_COMPILER_VERSION, STAGE_ONE_SYSTEM_PROMPT, STAGE_TWO_SYSTEM_PROMPT } from './conversationPromptCompiler';
import { TemplateActionButtons } from './TemplateActionButtons';

const { Title, Text, Paragraph } = Typography;

const STEP_ITEMS = [
  { title: '模板与对话场景配置', description: '基本信息、角色、目标与约束' },
  { title: '生成空间配置', description: '事件采样维度、知识卡、工具与标签' },
  { title: '合成指令预览', description: '数据格式与 Prompt' },
  { title: '质检规则配置', description: '基础规则与场景规则' },
  { title: '试运行', description: '小批验证后发布' },
];

const PARAM_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object'];

const DEFAULT_EVENT_DIMENSIONS = [
  { dimension_id:'dim_scene', name: '子场景', option_ids:{'物流状态查询':'opt_scene_status','运输时效咨询':'opt_scene_time','运费咨询':'opt_scene_fee','包装要求咨询':'opt_scene_pack'}, description: '本条对话主要处理的业务问题', applicability_conditions: '所有事件', usage_constraints: '', values: ['物流状态查询', '运输时效咨询', '运费咨询', '包装要求咨询'] },
  { dimension_id:'dim_user_identity', name: '用户身份', option_ids:{'寄件人':'opt_user_sender','收件人':'opt_user_receiver','企业客户':'opt_user_enterprise'}, description: '发起咨询的客户身份与业务背景', applicability_conditions: '所有事件', usage_constraints: '', values: ['寄件人', '收件人', '企业客户'] },
  { dimension_id:'dim_user_attitude', name: '用户初始态度', option_ids:{'平静':'opt_attitude_calm','焦急':'opt_attitude_anxious','不满':'opt_attitude_dissatisfied'}, description: '用户进入对话时的情绪，不限定后续情绪变化', applicability_conditions: '所有事件', usage_constraints: '', values: ['平静', '焦急', '不满'] },
  { dimension_id:'dim_first_turn_completeness', name: '首轮信息完整度', option_ids:{'信息完整':'opt_info_complete','缺少必要信息':'opt_info_missing'}, description: '用户首轮是否提供处理当前问题所需的信息', applicability_conditions: '当前子场景存在需要用户提供的必要信息', usage_constraints: '一般规则咨询不得仅因没有运单号而判为信息不完整', values: ['信息完整', '缺少必要信息'] },
  { dimension_id:'dim_business_exception', name: '业务异常事件', option_ids:{'无异常':'opt_exception_none','运输延误':'opt_exception_delay','物流记录停滞':'opt_exception_stalled'}, description: '具体运单的业务异常情况，包括无异常、运输延误、物流记录停滞', applicability_conditions: '物流状态查询子场景', usage_constraints: '一般运费、包装及运输规则咨询不得组合具体运单异常', values: ['无异常', '运输延误', '物流记录停滞'] },
  { dimension_id:'dim_tool_outcome', name: '工具执行结果', option_ids:{}, description: '本次模拟工具调用的返回类型，选项来源于工具配置', applicability_conditions: '本条事件安排调用对应工具', usage_constraints: '未调用工具时不得采样返回类型；同一次调用不得同时选择成功、无记录或失败', values: ['查询成功', '无记录', '调用失败'] },
];

const defaultEventDimensionSampler = () => ({
  algorithm_version: 'dimension-enum/v1',
  dimensions: DEFAULT_EVENT_DIMENSIONS.map(item => ({ ...item, values: [...item.values] })),
});
const stableConfigId = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

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

const DINGO_BASE_RULE_PACKS = [
  { id:'DINGO-STRUCTURE', name:'结构完整性', scope:'both', engine:'Dingo Rule', severity:'BLOCK', metrics:'RuleVerlSftDataFormat · RuleConversationStructure', description:'校验 VERL SFT 字段、角色顺序、轮次以及工具调用/返回配对。' },
  { id:'DINGO-CONTENT-COMPLETE', name:'内容完整性', scope:'final_conversation', engine:'Dingo Rule', severity:'BLOCK', metrics:'RuleContentNull · RuleContentShort', description:'同时检查整段文本及每条 user/assistant 消息的空值和短文本。' },
  { id:'DINGO-INNER-REPEAT', name:'文内重复', scope:'final_conversation', engine:'Dingo Rule', severity:'REVIEW', metrics:'RuleDocRepeat', description:'检查单条对话内部重复 6-gram；不替代跨样本去重。' },
  { id:'DINGO-SAFETY', name:'内容安全', scope:'final_conversation', engine:'Dingo LLM', severity:'BLOCK', metrics:'LLMSecurityProhibition', description:'检查色情、危险及企业安全模型配置的其他内容风险。' },
  { id:'DINGO-READABILITY', name:'训练适用性', scope:'final_conversation', engine:'Dingo LLM', severity:'REVIEW', metrics:'LLMTextQualityV5', description:'综合评估结构完整、可读性、多样性和训练适用性。' },
  { id:'DINGO-CONTEXT-RELEVANCY', name:'上下文相关性', scope:'both', engine:'Dingo LLM', severity:'REVIEW', metrics:'LLMRAGContextRelevancy', threshold:7, description:'判断用户问题/对话目标与冻结事件及召回知识是否相关。' },
];

const DINGO_STAT_RULE_PACKS = [
  { id:'DINGO-STAT-CHAR', name:'有效字符长度', scope:'both', engine:'Dingo Rule', severity:'INFO', metrics:'RuleCharNumber', description:'统计整段、user 和 assistant 的有效字符长度分布。' },
  { id:'DINGO-STAT-WORD', name:'词数范围', scope:'both', engine:'Dingo Rule', severity:'INFO', metrics:'RuleWordNumber', description:'统计词数范围；中文数据使用本地化分词扩展。' },
  { id:'DINGO-STAT-PUNC', name:'标点与超长句', scope:'both', engine:'Dingo Rule', severity:'INFO', metrics:'RuleNoPunc', description:'统计最长无标点片段并给出异常提示，不改变交付状态。' },
];

const DINGO_PRIVACY_RULE_PACKS = [
  { id:'DINGO-PII', name:'标准 PII', scope:'both', engine:'Dingo Rule', severity:'BLOCK', metrics:'RulePIIDetection', description:'检测手机号、身份证、邮箱、信用卡、护照、SSN 和 IPv4。' },
];

const DEPRECATED_SCENARIO_RULE_IDS = new Set(['SCENE_FACT_CONSISTENCY','SCENE_EVIDENCE_EXISTS','SCENE_SEMANTIC_GROUNDED','SCENE_STATE_TRANSITION']);
const isScoredQualityEvaluator = value => ['semantic_quality','dingo_llm','dingo_embedding'].includes(value);

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
  { rule_id: 'DINGO_UNSAFE_WORDS', name: '自定义敏感词', scope: 'both', evaluator: 'dingo_rule', severity: 'REVIEW', rubric: '使用模板配置的敏感词词表检查合成指令与最终对话。', source: 'preset', origin: 'dingo' },
  { rule_id: 'DINGO_HONEST', name: 'Honest（仅 assistant）', scope: 'assistant', evaluator: 'dingo_llm', severity: 'REVIEW', threshold: 1, rubric: '检查 assistant 是否准确表达已知与未知，不捏造或欺骗。', source: 'preset', origin: 'dingo' },
  { rule_id: 'DINGO_HELPFUL', name: 'Helpful（仅 assistant）', scope: 'assistant', evaluator: 'dingo_llm', severity: 'REVIEW', threshold: 1, rubric: '检查 assistant 是否直接回应用户问题并提供有用信息。', source: 'preset', origin: 'dingo' },
  { rule_id: 'DINGO_HARMLESS', name: 'Harmless（仅 assistant）', scope: 'assistant', evaluator: 'dingo_llm', severity: 'BLOCK', threshold: 1, rubric: '检查 assistant 是否避免伤害、歧视和危险协助。', source: 'preset', origin: 'dingo' },
  { rule_id: 'DINGO_TASK_DIFFICULTY', name: '任务难度', scope: 'synthesis_instruction', evaluator: 'dingo_llm', severity: 'INFO', rubric: '对任务难度进行 0～10 分层统计；只有配置目标区间后才告警。', source: 'preset', origin: 'dingo' },
  { rule_id: 'DINGO_ANSWER_RELEVANCY', name: '答案相关性 Answer Relevancy', scope: 'conversation_event', evaluator: 'dingo_embedding', severity: 'REVIEW', threshold: 7, rubric: '检查 user→assistant 回答是否相关，并结合冻结事件判断对话是否围绕目标展开；需要 Embedding 模型。', source: 'preset', origin: 'dingo' },
  { rule_id: 'DINGO_FAITHFULNESS', name: '答案忠实度 Faithfulness', scope: 'conversation_event', evaluator: 'dingo_llm', severity: 'BLOCK', threshold: 7, rubric: 'assistant 的事实、时间、状态和结论必须能由冻结事件、知识或工具结果支持。', source: 'preset', origin: 'dingo' },
  { rule_id: 'SCENE_ACTIONABLE_NEXT_STEP', name: '最终回答提供下一步', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'REVIEW', threshold: 0.80, rubric: '结束前应说明已确认事实、能力边界以及用户可以执行的下一步。', source: 'preset' },
  { rule_id: 'SCENE_ROLE_STABILITY', name: '角色始终保持一致', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'REVIEW', threshold: 0.80, rubric: '各参与角色在多轮交互中保持身份、立场、语气、权限和能力边界一致。', source: 'preset' },
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

const DEFAULT_MOCK_RETURN_RULES = [
  { outcome_type_id:'outcome_query_success', return_type: '查询成功', output_fields: [{ name: 'shipment_id', type: 'string', required: true, pattern:'^SYN[0-9]{10}$', description: '合成运单号，须与调用参数一致' }, { name: 'status', type: 'string', required: true, enum:['已揽收','运输中','派送中','已签收'], description: '物流状态' }, { name: 'last_update_time', type: 'string', required: true, format:'date-time', description: '最后更新时间，不得晚于事件参考时间' }, { name: 'exception_type', type: 'string', required: true, enum:['无异常','运输延误','物流记录停滞'], description: '异常类型' }, { name: 'known_reason', type: 'string', required: false, description: '已知异常原因（可选）' }], generation_constraint: '运单号须与调用参数一致；状态限定为“已揽收／运输中／派送中／已签收”；异常类型限定为“无异常／运输延误／物流记录停滞”；更新时间不得晚于事件参考时间；原因未知时省略。', example_result: '{\n  "shipment_id": "SYN2026000001",\n  "status": "运输中",\n  "last_update_time": "2026-09-07T10:00:00+08:00",\n  "exception_type": "运输延误",\n  "known_reason": "天气影响"\n}' },
  { outcome_type_id:'outcome_not_found', return_type: '无记录', output_fields: [{ name: 'shipment_id', type: 'string', required: true, pattern:'^SYN[0-9]{10}$', description: '合成运单号，须与调用参数一致' }, { name: 'code', type: 'string', required: true, const:'NOT_FOUND', description: '结果代码' }, { name: 'message', type: 'string', required: true, description: '未找到匹配记录的说明' }], generation_constraint: '运单号须与调用参数一致；code 固定为 NOT_FOUND；不返回物流状态，不将“无记录”解释为包裹丢失。', example_result: '{\n  "shipment_id": "SYN2026000001",\n  "code": "NOT_FOUND",\n  "message": "未找到匹配的运单记录"\n}' },
  { outcome_type_id:'outcome_service_failure', return_type: '调用失败', output_fields: [{ name: 'code', type: 'string', required: true, const:'SERVICE_UNAVAILABLE', description: '错误代码' }, { name: 'message', type: 'string', required: true, description: '服务暂不可用的错误说明' }], generation_constraint: '本示例 code 固定为 SERVICE_UNAVAILABLE；不返回物流状态，不将服务故障解释为运单不存在。', example_result: '{\n  "code": "SERVICE_UNAVAILABLE",\n  "message": "物流查询服务暂时不可用"\n}' },
];
const cloneMockReturnRules = () => DEFAULT_MOCK_RETURN_RULES.map(item => ({ ...item, output_fields: item.output_fields.map(field => ({ ...field })) }));

const DEFAULT_TOOL = {
  name: 'query_shipment',
  description: '根据合成运单号查询物流状态、最后更新时间及已知异常信息。',
  call_condition: '用户需要查询具体运单，且已提供符合格式要求的运单号。缺少运单号时先追问；一般运费、包装及运输规则咨询无需调用。',
  input_fields: [
    { name: 'shipment_id', type: 'string', required: true, pattern:'^SYN[0-9]{10}$', description: '合成运单号；本示例格式为 SYN 加10位数字。' },
  ],
  example_arguments: '{"shipment_id":"SYN2026000001"}',
  mock_return_rules: cloneMockReturnRules(),
};

const DEFAULT_SCENARIO_RULES = [...QUALITY_PRESETS.filter(item => ['DINGO_FAITHFULNESS','SCENE_ACTIONABLE_NEXT_STEP'].includes(item.rule_id)), LABEL_COVERAGE_RULE].map(item => ({ ...item, enabled: true }));

const INITIAL_VALUES = {
  ...CONVERSATION_INITIAL_VALUES,
  name: '物流智能客服对话模板',
  description: '用于合成物流咨询多轮对话，覆盖物流状态查询、运输时效、运费与包装咨询，以及延误、物流停滞等异常问题，训练客服的信息追问、工具调用、结果解释和问题处理能力。',
  businessType: '智能客服多轮对话',
  knowledgeEnabled: true,
  knowledgeUsageInstructions: `根据本条咨询子场景选择适用知识。一般业务规则依据知识卡解释，具体运单状态依据工具查询结果判断。

知识卡未提供的费用、时效承诺、异常原因及办理渠道不得自行补充。知识规则与查询结果用途不同，不得用一般规则推断某个运单的实际状态。`,
  knowledgeText: `[知识卡 DELIVERY-STATUS-001]
知识主题：物流状态及记录更新
适用范围：物流状态查询。
业务规则：运输中表示包裹仍处于运输流程，不代表已到达收件地址。物流记录超过24小时未更新，可以说明记录暂未更新，但不能仅据此认定包裹丢失或确定延误原因。
处理建议：说明已查询到的状态和最后更新时间；原因未知时明确说明无法确认。

[知识卡 DELIVERY-TIME-001]
知识主题：运输时效
适用范围：运输时效咨询及延误解释。
业务规则：运输时效受线路、服务类型及实际运输情况影响。本示例未提供线路时效表，不支持计算具体到达日期。工具返回预计到达时间时，应说明其为预计时间，不保证准时送达。
处理建议：用户询问具体包裹进度时，可在取得运单号后查询；没有预计到达信息时，不自行推算。

[知识卡 DELIVERY-FEE-001]
知识主题：运费计费
适用范围：运费咨询。
业务规则：计费重量取实际重量与体积重量中的较大值。本示例的体积重量计算方式为：长×宽×高÷6000，长宽高单位为厘米，结果单位为千克。本示例未提供线路单价、首重续重及附加费规则，因此不能据此给出最终运费。
处理建议：解释计费方式；需要演示体积重量计算时，先取得必要尺寸。

[知识卡 DELIVERY-PACK-001]
知识主题：包装要求
适用范围：包装要求咨询。
业务规则：普通物品应使用完好且强度适当的外包装，填充空隙并牢固封口。易碎物品应单独缓冲包裹，避免直接接触箱壁。液体、危险品及其他特殊物品需另行核实寄递限制，本示例不提供其可寄承诺。
处理建议：根据物品种类说明适用要求；物品类型不明确且影响判断时，先询问。`,
  toolsEnabled: true,
  toolMode: 'agent_trace',
  toolCatalog: [{ ...DEFAULT_TOOL }],
  fewShotEnabled: true,
  fewShotDialogueJsonl: '{"messages":[{"role":"user","content":"寄陶瓷杯要怎么包装？"},{"role":"assistant","content":"建议将杯子单独用缓冲材料包裹，放入强度适当的纸箱，再填满空隙，避免杯子直接接触箱壁，最后牢固封口。"}]}',
  fewShotKnowledgeJsonl: '',
  fewShotToolJsonl: '{"messages":[{"role":"user","content":"我的快递怎么还没到，能查一下吗？"},{"role":"assistant","content":"请提供运单号，我帮您查询运输情况。"},{"role":"user","content":"SYN2026000001。"},{"role":"assistant","content":null,"tool_calls":[{"id":"call_demo_001","type":"function","function":{"name":"query_shipment","arguments":"{\\"shipment_id\\":\\"SYN2026000001\\"}"}}]},{"role":"tool","tool_call_id":"call_demo_001","content":"{\\"shipment_id\\":\\"SYN2026000001\\",\\"status\\":\\"运输中\\",\\"last_update_time\\":\\"2026-09-07T10:00:00+08:00\\",\\"exception_type\\":\\"运输延误\\",\\"known_reason\\":\\"天气影响\\"}"},{"role":"assistant","content":"查询结果显示，包裹仍在运输中，因天气影响出现延误，最近一次更新时间是9月7日上午10点。目前查询结果没有提供预计送达时间，暂时无法确认哪天到达。"}]}',
  scenarioRules: DEFAULT_SCENARIO_RULES,
  scenarioQualityEnabled: true,
  privacyMethods: DEFAULT_PRIVACY_METHODS,
  sampleLabelsEnabled: true,
  coverageLabelsMarkdown: DEFAULT_COVERAGE_LABELS,
  coverageLabelPrompt: '根据用户意图、情绪、信息完整度及工具调用路径进行打标；每个维度只能选择一个已配置的枚举值，不能新增或改写标签。',
  otherInstructionsEnabled: false,
  otherMarkdown: '',
  outputFormat: 'messages_jsonl',
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
  assistantIdentityMarkdown: '物流企业的在线智能客服，为寄件人、收件人及企业客户提供物流咨询服务，帮助客户了解运输进度、理解业务规则，并找到适合当前问题的处理途径。',
  assistantPermissionMarkdown: `可依据提供的业务知识解答物流规则问题，并在满足调用条件时使用已配置工具查询信息。

订单相关结论须依据已获取的查询结果；客户陈述可以作为排查线索，但不代表系统已核实。

仅可执行已配置工具明确支持的操作。未配置相应能力时，无权修改订单、发起催件、办理退款赔付或实际转接人工，只能说明可用的办理渠道，不能声称已经完成操作。`,
  assistantRoleMarkdown: '物流企业的在线智能客服，依据业务知识和已获取的查询结果提供物流咨询服务，仅执行已配置工具明确支持的操作。',
  userRoleMarkdown: `用户为物流服务的寄件人、收件人或企业客户。

寄件人关注寄送规则、费用、运输进度及寄出后的异常处理；收件人关注包裹位置、到达时间和签收问题；企业客户关注业务寄件的运输情况及异常处理。

用户可能掌握运单号、寄送信息、页面显示的物流记录或个人收货经历，但通常不了解物流系统的内部信息。`,
  sceneMarkdown: `客户通过在线客服入口咨询物流相关问题，包括物流状态查询、运输时效、运费规则、包装要求，以及延误、物流停滞、签收争议等异常情况。

一般规则咨询依据业务知识解答；涉及具体运单的问题，按需要收集必要信息并使用查询工具。客户可能信息不全、对物流记录存在误解，或因问题未解决而表达焦急和不满。

具体咨询子场景、用户初始态度、信息完整度及异常情况由事件采样维度确定。`,
  completionRequirementsMarkdown: `结束前应回应用户的核心问题，处理结果可以是问题已解答，也可以是明确说明当前无法解决的原因。

能够解答时，给出有依据的结论和必要说明；缺少信息、查询失败或权限不足时，说明当前限制，并在有依据且适用的情况下提供下一步。

涉及操作时，明确区分建议办理、已尝试和已成功完成。无需强行以问题解决或用户满意作为结尾，也不必在每次结束时重复权限说明或额外安排下一步。`,
  constraintsMarkdown: `1. 运费、时效、包装及异常处理政策以提供的业务知识为准；无依据时说明无法确认，不自行补充政策或作出保证。
2. 查询具体运单前，应取得工具要求的必要信息；信息不足时先追问，不能猜测运单号或使用其他运单替代。
3. 不得编造物流节点、异常原因、预计送达时间、费用、赔付金额或办理结果。物流记录未更新不等于包裹丢失，预计时间不等于保证送达时间。
4. 查询无记录或调用失败时，应准确说明情况，不得声称查询成功，也不得据此断言包裹丢失。
5. 涉及修改、取消、赔付等操作时，遵守对应业务规则中的身份核验和授权要求；不具备能力时提供有依据的办理指引。
6. 不承诺未具备的主动通知、持续监控、自动提醒或人工跟进服务。
7. 仅收集处理当前问题所必需的信息；本示例不要求用户提供真实姓名、手机号、身份证号或详细住址。
8. 面对投诉或不满，应回应具体诉求，不指责用户，不以安抚为由作出无依据的承诺。`,
  initialInstructionMarkdown: '根据系统分配的合法业务案例构造事件，不改变事实、知识引用和业务流程。',
  language: 'zh-CN',
  defaultMinTurns: 3,
  defaultMaxTurns: 6,
  sampler: defaultEventDimensionSampler(),
};

function ruleIds(text = '') {
  return [...String(text).matchAll(/^\s*\[(?:知识卡|规则)\s+([^\]]+)\]\s*$/gm)].map(match => match[1].trim());
}

function compactJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
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

function validateFewShotJsonl(value, { requireToolTrace = false } = {}) {
  const lines = String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return Promise.reject(new Error('请至少粘贴一条 JSONL 对话'));
  for (let index = 0; index < lines.length; index += 1) {
    let item;
    try { item = JSON.parse(lines[index]); } catch { return Promise.reject(new Error(`第 ${index + 1} 行不是合法 JSON`)); }
    const messages = item?.messages;
    if (!Array.isArray(messages) || !messages.length) return Promise.reject(new Error(`第 ${index + 1} 行缺少非空 messages 数组`));
    if (!messages.some(message => message?.role === 'user') || !messages.some(message => message?.role === 'assistant')) return Promise.reject(new Error(`第 ${index + 1} 行必须包含 user 和 assistant 消息`));
    if (messages.some(message => !['system', 'user', 'assistant', 'tool'].includes(message?.role))) return Promise.reject(new Error(`第 ${index + 1} 行包含不支持的 role`));
    if (messages.some(message => !String(message?.content ?? '').trim() && !(message?.role === 'assistant' && message?.tool_calls?.length))) return Promise.reject(new Error(`第 ${index + 1} 行存在空 content 消息`));
    if (requireToolTrace) {
      const callIds = messages.flatMap(message => message?.role === 'assistant' ? (message.tool_calls || []).map(call => call?.id).filter(Boolean) : []);
      const resultIds = messages.filter(message => message?.role === 'tool').map(message => message?.tool_call_id).filter(Boolean);
      if (!callIds.length || !callIds.every(id => resultIds.includes(id))) return Promise.reject(new Error(`第 ${index + 1} 行必须包含配对的 assistant tool_calls 和 tool 返回`));
    }
  }
  return Promise.resolve();
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

function configurationFromValues(values) {
  const toolsEnabled = Boolean(values.toolsEnabled);
  const knowledgeEnabled = Boolean(values.knowledgeEnabled);
  const sampleLabelsEnabled = Boolean(values.sampleLabelsEnabled);
  const otherInstructionsEnabled = Boolean(values.otherInstructionsEnabled);
  const sampler = { ...(values.sampler || defaultEventDimensionSampler()), dimensions: (values.sampler?.dimensions || []).map(dimension => ({ ...dimension, dimension_id: dimension.dimension_id || stableConfigId('dim'), option_ids: Object.fromEntries((dimension.values || []).map(value => [value, dimension.option_ids?.[value] || stableConfigId('opt')])) })) };
  const toolCatalog = (values.toolCatalog || []).map(tool => ({
    name: tool.name,
    description: tool.description,
    call_condition: tool.call_condition,
    input_fields: tool.input_fields || tool.input_schema || [],
    example_arguments: jsonObject(tool.example_arguments),
    mock_return_rules: (tool.mock_return_rules || []).map(rule => ({
      outcome_type_id: rule.outcome_type_id || stableConfigId('outcome'),
      return_type: rule.return_type,
      output_fields: rule.output_fields || [],
      generation_constraint: rule.generation_constraint || '',
      ...(String(rule.example_result || '').trim() ? { example_result: jsonObject(rule.example_result) } : {}),
    })),
  }));
  return {
    sampling_schema_version: SAMPLING_SCHEMA_VERSION,
    identity: {
      name: values.name,
      description: values.description || '',
      business_type: values.businessType,
    },
    scenario: {
      scene_markdown: values.sceneMarkdown,
      completion_requirements_markdown: values.completionRequirementsMarkdown,
      constraints_markdown: values.constraintsMarkdown,
      sample_labels_enabled: sampleLabelsEnabled,
      coverage_labels_markdown: sampleLabelsEnabled ? values.coverageLabelsMarkdown : '',
      coverage_label_prompt: sampleLabelsEnabled ? values.coverageLabelPrompt || '' : '',
      other_instructions_enabled: otherInstructionsEnabled,
      other_markdown: otherInstructionsEnabled ? values.otherMarkdown || '' : '',
      assistant_identity_markdown: values.assistantIdentityMarkdown,
      assistant_permission_markdown: values.assistantPermissionMarkdown,
      assistant_role_markdown: [values.assistantIdentityMarkdown, values.assistantPermissionMarkdown].filter(Boolean).join('\n\n'),
      user_role_markdown: values.userRoleMarkdown,
    },
    sampler,
    knowledge: knowledgeEnabled ? {
      enabled: true,
      mode: 'knowledge_cards',
      text: values.knowledgeText || '',
      usage_instructions: values.knowledgeUsageInstructions || '',
    } : { enabled: false, mode: 'none' },
    tools: toolsEnabled ? {
      enabled: true,
      mode: 'agent_trace',
      catalog: toolCatalog,
    } : { enabled: false, mode: 'none', catalog: [] },
    few_shot: values.fewShotEnabled ? {
      enabled: true,
      dialogue_jsonl: values.fewShotDialogueJsonl || '',
      knowledge_jsonl: knowledgeEnabled ? values.fewShotKnowledgeJsonl || '' : '',
      tool_jsonl: toolsEnabled ? values.fewShotToolJsonl || '' : '',
    } : { enabled: false },
    prompt_template: {
      version: PROMPT_COMPILER_VERSION,
      output_format: 'messages_jsonl',
      stages: {
        event_generation: { system: STAGE_ONE_SYSTEM_PROMPT, input_keys: ['business_config','dimension_definitions','assignment','knowledge_context','tool_catalog','runtime','event_schema'] },
        dialogue_generation: { system: STAGE_TWO_SYSTEM_PROMPT, input_keys: ['business_config','frozen_event','knowledge_context','tool_catalog','reference_dialogues','dialogue_schema'] },
      },
      user_editable: false,
    },
    quality: {
      fixed_policy_ref: 'conversation-fixed-quality/v1',
      fixed_rules_locked: true,
      custom_enabled: values.scenarioQualityEnabled !== false,
      label_coverage_enabled: sampleLabelsEnabled && (values.scenarioRules || []).some(rule => rule.rule_id === LABEL_COVERAGE_RULE.rule_id),
      scenario_rules: (values.scenarioRules || []).filter(rule => sampleLabelsEnabled || rule.rule_id !== LABEL_COVERAGE_RULE.rule_id).map(rule => {
        return ({
        ...rule,
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
  const fewShot = config.few_shot || {};
  const quality = config.quality || {};
  const trial = config.trial_config || {};
  const coverageLabelsMarkdown = scenario.coverage_labels_markdown || legacyPrompt.coverage_labels_markdown || INITIAL_VALUES.coverageLabelsMarkdown;
  const coverageLabelPrompt = scenario.coverage_label_prompt || INITIAL_VALUES.coverageLabelPrompt;
  const sampleLabelsEnabled = scenario.sample_labels_enabled ?? Boolean(String(coverageLabelsMarkdown).trim());
  const otherMarkdown = scenario.other_markdown || legacyPrompt.other_markdown || '';
  const otherInstructionsEnabled = scenario.other_instructions_enabled ?? Boolean(otherMarkdown.trim());
  const rawStoredRules = quality.scenario_rules || [];
  const shouldMigrateFaithfulness = rawStoredRules.some(rule => ['SCENE_FACT_CONSISTENCY','SCENE_SEMANTIC_GROUNDED'].includes(rule.rule_id));
  const migratedRules = rawStoredRules.filter(rule => !DEPRECATED_SCENARIO_RULE_IDS.has(rule.rule_id));
  if (shouldMigrateFaithfulness && !migratedRules.some(rule => rule.rule_id === 'DINGO_FAITHFULNESS')) {
    migratedRules.unshift({ ...QUALITY_PRESETS.find(rule => rule.rule_id === 'DINGO_FAITHFULNESS'), enabled: true });
  }
  const storedScenarioRules = migratedRules.length ? migratedRules.map(rule => ({
      ...rule,
      ...(['DINGO_HONEST','DINGO_HELPFUL','DINGO_HARMLESS'].includes(rule.rule_id) ? { scope: 'assistant' } : {}),
      ...(['DINGO_ANSWER_RELEVANCY','DINGO_FAITHFULNESS'].includes(rule.rule_id) ? { scope: 'conversation_event' } : {}),
      ...(QUALITY_PRESETS.find(item => item.rule_id === rule.rule_id)?.severity && !rule.severity ? { severity: QUALITY_PRESETS.find(item => item.rule_id === rule.rule_id).severity } : {}),
      rubric: rule.rubric || rule.description || '',
      ...(Array.isArray(rule.expected_values) ? { expected_values: compactJson(rule.expected_values) } : {}),
      ...(Array.isArray(rule.phrases) ? { phrases: compactJson(rule.phrases) } : {}),
    })) : DEFAULT_SCENARIO_RULES;
  const labelCoverageEnabled = quality.label_coverage_enabled ?? sampleLabelsEnabled;
  const storedKnowledgeText = knowledge.text || '';
  const isLegacySingleKnowledgeExample = ruleIds(storedKnowledgeText).length === 1 && storedKnowledgeText.includes('[知识卡 DELIVERY-STATUS-001]') && storedKnowledgeText.includes('运输状态长时间未更新');
  const scenarioRules = sampleLabelsEnabled && labelCoverageEnabled && !storedScenarioRules.some(rule => rule.rule_id === LABEL_COVERAGE_RULE.rule_id)
    ? [...storedScenarioRules, { ...LABEL_COVERAGE_RULE, enabled: true }]
    : storedScenarioRules.filter(rule => sampleLabelsEnabled || rule.rule_id !== LABEL_COVERAGE_RULE.rule_id);
  return {
    ...INITIAL_VALUES,
    name: identity.name || detail?.name || INITIAL_VALUES.name,
    description: identity.description ?? detail?.description ?? INITIAL_VALUES.description,
    businessType: identity.business_type || detail?.business_type || INITIAL_VALUES.businessType,
    sceneMarkdown: scenario.scene_markdown || legacyPrompt.scene_markdown || INITIAL_VALUES.sceneMarkdown,
    completionRequirementsMarkdown: scenario.completion_requirements_markdown || INITIAL_VALUES.completionRequirementsMarkdown,
    rolesMarkdown: scenario.roles_markdown || legacyPrompt.roles_markdown || INITIAL_VALUES.rolesMarkdown,
    goalsMarkdown: scenario.goals_markdown || legacyPrompt.goals_markdown || INITIAL_VALUES.goalsMarkdown,
    constraintsMarkdown: scenario.constraints_markdown || legacyPrompt.constraints_markdown || INITIAL_VALUES.constraintsMarkdown,
    factStateMarkdown: scenario.fact_state_markdown || legacyPrompt.fact_state_markdown || INITIAL_VALUES.factStateMarkdown,
    assistantIdentityMarkdown: scenario.assistant_identity_markdown || scenario.assistant_role_markdown || INITIAL_VALUES.assistantIdentityMarkdown,
    assistantPermissionMarkdown: scenario.assistant_permission_markdown || INITIAL_VALUES.assistantPermissionMarkdown,
    assistantRoleMarkdown: scenario.assistant_role_markdown || INITIAL_VALUES.assistantRoleMarkdown,
    userRoleMarkdown: scenario.user_role_markdown || INITIAL_VALUES.userRoleMarkdown,
    initialInstructionMarkdown: scenario.initial_instruction_markdown || INITIAL_VALUES.initialInstructionMarkdown,
    language: scenario.language || 'zh-CN',
    defaultMinTurns: scenario.turn_range?.[0] || 3,
    defaultMaxTurns: scenario.turn_range?.[1] || 6,
    sampler: config.sampler?.dimensions?.length ? config.sampler : defaultEventDimensionSampler(),
    sampleLabelsEnabled,
    coverageLabelsMarkdown,
    coverageLabelPrompt,
    otherInstructionsEnabled,
    otherMarkdown,
    knowledgeEnabled: knowledge.enabled !== false && knowledge.mode !== 'none',
    knowledgeText: isLegacySingleKnowledgeExample ? INITIAL_VALUES.knowledgeText : storedKnowledgeText,
    knowledgeUsageInstructions: knowledge.usage_instructions || INITIAL_VALUES.knowledgeUsageInstructions,
    toolsEnabled: tools.enabled ?? (legacyPrompt.tool_mode && legacyPrompt.tool_mode !== 'none'),
    toolMode: 'agent_trace',
    toolCatalog: tools.catalog?.length ? tools.catalog.map(tool => ({
      ...tool,
      input_fields: tool.input_fields || tool.parameters || tool.input_schema || [],
      example_arguments: compactJson(tool.example_arguments || {}),
      mock_return_rules: (tool.mock_return_rules?.length ? tool.mock_return_rules : cloneMockReturnRules()).map(rule => {
        const preset = DEFAULT_MOCK_RETURN_RULES.find(item => item.return_type === rule.return_type);
        return {
          ...rule,
          output_fields: rule.output_fields?.length ? rule.output_fields : (rule.return_type === '查询成功' && (tool.output_fields || tool.returns || tool.output_schema)?.length ? (tool.output_fields || tool.returns || tool.output_schema) : preset?.output_fields || []),
          generation_constraint: rule.generation_constraint || preset?.generation_constraint || '',
          example_result: rule.example_result ? compactJson(rule.example_result) : '',
        };
      }),
    })) : [{ ...DEFAULT_TOOL }],
    fewShotEnabled: fewShot.enabled === true,
    fewShotDialogueJsonl: fewShot.dialogue_jsonl || '',
    fewShotKnowledgeJsonl: fewShot.knowledge_jsonl || '',
    fewShotToolJsonl: fewShot.tool_jsonl || '',
    scenarioRules,
    scenarioQualityEnabled: quality.custom_enabled ?? (!(quality.scenario_rules || []).length || (quality.scenario_rules || []).some(rule => rule.enabled !== false)),
    outputFormat: 'messages_jsonl',
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

function SampleLabelsCard({ form, onManualChange }) {
  const sampleLabelsEnabled = Form.useWatch('sampleLabelsEnabled', form);
  const changeSampleLabels = enabled => {
    const currentRules = form.getFieldValue('scenarioRules') || [];
    const withoutCoverage = currentRules.filter(rule => rule?.rule_id !== LABEL_COVERAGE_RULE.rule_id);
    form.setFieldValue('scenarioRules', enabled ? [...withoutCoverage, { ...LABEL_COVERAGE_RULE, enabled: true }] : withoutCoverage);
    onManualChange?.();
  };
  return <Card size="small" className="conversation-config-card" title="样本标签配置（可选）" extra={<Form.Item name="sampleLabelsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="需要" unCheckedChildren="不需要" onChange={changeSampleLabels}/></Form.Item>}>
      {!sampleLabelsEnabled ? <Alert type="info" showIcon message="本模板不需要样本标签" description="合成时不会生成标签，也不会执行标签覆盖率统计。"/> : <>
        <Paragraph type="secondary">标签枚举值定义允许使用的标签范围，打标依据提示词说明模型应如何判断每个样本的标签。</Paragraph>
        <Row gutter={16}>
          <Col span={12}><MarkdownField name="coverageLabelsMarkdown" label="标签枚举值" rows={12} description="每个标题使用“英文维度ID | 中文名称”，下面用列表填写允许取值。例如：## customer_emotion | 用户情绪；下一行填写 - 平静。"/></Col>
          <Col span={12}><MarkdownField name="coverageLabelPrompt" label="打标依据提示词" rows={12} description="说明每个标签维度的判断依据、优先级和冲突处理方式；模型只能从左侧枚举值中选择。"/></Col>
        </Row>
      </>}
    </Card>;
}

function SceneStep({ form }) {
  const otherInstructionsEnabled = Form.useWatch('otherInstructionsEnabled', form);
  return <>
    <Card className="conversation-config-card" title="模板基本信息">
      <Row gutter={16}>
        <Col span={12}><Form.Item name="name" label="模板名称" rules={[{ required: true }, { max: 80 }]}><Input placeholder="例如：物流运输延误智能客服"/></Form.Item></Col>
        <Col span={12}><Form.Item name="businessType" label="业务类型" rules={[{ required: true }]}><Input placeholder="例如：智能客服多轮对话"/></Form.Item></Col>
      </Row>
      <Form.Item name="description" label="模板描述"><Input.TextArea rows={3} maxLength={500} showCount placeholder="说明模板覆盖的业务范围和主要用途"/></Form.Item>
    </Card>
    <Card className="conversation-config-card" title="对话场景配置">
      <Alert type="info" showIcon message="配置参与角色和业务场景" description="模板定义角色身份、权限、目标与约束；对话轮数等批次参数在创建数据合成任务时配置。"/>
      <Row gutter={16} className="section-title">
        <Col span={12}><MarkdownField name="assistantIdentityMarkdown" label="服务（assistant）角色身份说明" description="说明服务方的身份、职责和服务对象。"/></Col>
        <Col span={12}><MarkdownField name="assistantPermissionMarkdown" label="服务（assistant）角色权限说明" description="说明可以回答和执行的事项，以及不可承诺、不可访问的边界。"/></Col>
      </Row>
      <MarkdownField name="userRoleMarkdown" label="用户（user）角色身份说明" description="说明用户身份、目标、已知信息和自然表达方式。"/>
      <Divider orientation="left">对话场景</Divider>
      <Row gutter={16}>
        <Col span={24}><MarkdownField name="sceneMarkdown" label="场景说明" description="说明服务对象、业务范围和典型问题。"/></Col>
        <Col span={24}><MarkdownField name="completionRequirementsMarkdown" label="对话完成要求" description="说明满足哪些条件后可以结束对话，以及结束前必须给出的结果、边界或下一步。"/></Col>
        <Col span={24}><MarkdownField name="constraintsMarkdown" label="场景约束（包括禁止行为）" description="写清不能编造、不能承诺和必须遵守的业务边界。"/></Col>
      </Row>
      <Card size="small" className="conversation-config-card" title="其它说明（可选）" extra={<Form.Item name="otherInstructionsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="需要" unCheckedChildren="不需要"/></Form.Item>}>
        {!otherInstructionsEnabled ? <Alert type="info" showIcon message="本模板不需要其它说明"/> : <Form.Item name="otherMarkdown" extra="需要补充但不属于以上字段的信息可写在这里；系统会验证其已进入最终合成指令。" rules={[{ required: true, whitespace: true, message: '请填写其它说明' }]}>
          <Input.TextArea rows={5} showCount placeholder="可使用 Markdown"/>
        </Form.Item>}
      </Card>
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
      <Button icon={<PlusOutlined/>} onClick={() => add({ name: '', description: '', call_condition: '', input_fields: [], example_arguments: '{}', mock_return_rules: cloneMockReturnRules() })}>添加工具</Button>
    </Flex>
    {fields.length ? fields.map((field, index) => <Card key={field.key} size="small" className="conversation-tool-card" title={<Space><ToolOutlined/>工具 {index + 1}</Space>} extra={<Button type="link" danger icon={<DeleteOutlined/>} onClick={() => remove(field.name)}>删除</Button>}>
      <Row gutter={16}>
        <Col span={8}><Form.Item name={[field.name, 'name']} label="工具名称" rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_]*$/, message: '例如 query_order' }]}><Input placeholder="query_order"/></Form.Item></Col>
        <Col span={16}><Form.Item name={[field.name, 'description']} label="工具说明" rules={[{ required: true }]}><Input placeholder="说明工具能查询或执行什么"/></Form.Item></Col>
      </Row>
      <Form.Item name={[field.name, 'call_condition']} label="调用条件" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="满足什么事实和状态时才允许使用该工具"/></Form.Item>
      <SchemaFields fieldName={[field.name, 'input_fields']} title="输入参数"/>
      <Form.Item className="section-title" name={[field.name, 'example_arguments']} label="合成参数示例" rules={[{ required: true }, { validator: (_, value) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('请输入 JSON 对象')); } catch { return Promise.reject(new Error('JSON 格式不正确')); } } }]}><Input.TextArea rows={3} placeholder='{"order_id":"SYN001"}'/></Form.Item>
      <Form.List name={[field.name, 'mock_return_rules']} rules={[{ validator: (_, rules) => rules?.length ? Promise.resolve() : Promise.reject(new Error('请至少配置一条模拟返回规则')) }]}>{(ruleFields, { add: addRule, remove: removeRule }, { errors }) => <div className="section-title">
        <Flex justify="space-between" align="center">
          <div><Text strong>模拟返回配置</Text><br/><Text type="secondary">每种返回类型分别维护返回字段、生成约束和可选 JSON 示例，避免成功与失败共用同一套字段。</Text></div>
          <Button size="small" icon={<PlusOutlined/>} onClick={() => addRule({ outcome_type_id: stableConfigId('outcome'), return_type: '', output_fields: [], generation_constraint: '', example_result: '' })}>添加返回类型</Button>
        </Flex>
        {ruleFields.map((ruleField, ruleIndex) => <Card key={ruleField.key} size="small" className="conversation-mock-return-card" title={`返回类型 ${ruleIndex + 1}`} extra={<Button type="link" danger icon={<DeleteOutlined/>} onClick={() => removeRule(ruleField.name)}>删除</Button>}>
          <Form.Item name={[ruleField.name, 'return_type']} label="返回类型" rules={[{ required: true, whitespace: true, message: '请输入返回类型' }]}><Input placeholder="例如：查询成功、无记录、调用失败"/></Form.Item>
          <SchemaFields fieldName={[ruleField.name, 'output_fields']} title="返回字段"/>
          <Form.Item className="section-title" name={[ruleField.name, 'generation_constraint']} label="生成约束" rules={[{ required: true, whitespace: true, message: '请输入生成约束' }]}><Input.TextArea rows={3} placeholder="说明该返回类型允许和禁止生成的内容"/></Form.Item>
          <Form.Item name={[ruleField.name, 'example_result']} label="JSON 示例（可选）" rules={[{ validator: (_, value) => { if (!String(value || '').trim()) return Promise.resolve(); try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('请输入 JSON 对象')); } catch { return Promise.reject(new Error('JSON 格式不正确')); } } }]}><Input.TextArea rows={3} placeholder='{"result_code":"NOT_FOUND","message":"无匹配记录"}'/></Form.Item>
        </Card>)}
        {!ruleFields.length && <Alert type="warning" showIcon message="请至少配置一条模拟返回规则"/>}
        <Form.ErrorList errors={errors}/>
      </div>}</Form.List>
    </Card>) : <Alert type="warning" showIcon message="工具已开启，请至少添加一个工具"/>}
  </>}</Form.List>;
}

function SamplerEditor({ form, onManualChange, readOnly = false }) {
  const [advancedForm] = Form.useForm();
  const [advancedIndex, setAdvancedIndex] = useState(null);
  const toolsEnabled = Form.useWatch('toolsEnabled', form);
  const toolCatalog = Form.useWatch('toolCatalog', form) || [];
  const toolOutcomes = useMemo(() => toolCatalog.flatMap(tool => (tool.mock_return_rules || []).map(rule => ({ name:String(rule?.return_type || '').trim(), id:rule.outcome_type_id, tool_name:tool.name })).filter(item=>item.name)), [toolCatalog]);
  const toolReturnTypes = useMemo(() => [...new Set(toolOutcomes.map(item=>item.name))], [toolOutcomes]);
  useEffect(() => {
    const dimensions = form.getFieldValue(['sampler', 'dimensions']) || [];
    const index = dimensions.findIndex(item => item?.name === '工具执行结果');
    if (index < 0) return;
    const current = dimensions[index];
    const next = { ...current, values: toolReturnTypes, option_ids:Object.fromEntries(toolOutcomes.map(item=>[item.name,item.id])), enabled: Boolean(toolsEnabled) };
    if (JSON.stringify(current.values || []) !== JSON.stringify(next.values) || JSON.stringify(current.option_ids||{}) !== JSON.stringify(next.option_ids) || current.enabled !== next.enabled) form.setFieldValue(['sampler', 'dimensions', index], next);
  }, [form, toolOutcomes, toolReturnTypes, toolsEnabled]);
  const openAdvanced = index => {
    const dimension = form.getFieldValue(['sampler', 'dimensions', index]) || {};
    advancedForm.setFieldsValue({ description: dimension.description || '', applicability_conditions: dimension.applicability_conditions || '', usage_constraints: dimension.usage_constraints || '' });
    setAdvancedIndex(index);
  };
  const saveAdvanced = async () => {
    const values = await advancedForm.validateFields();
    form.setFieldValue(['sampler', 'dimensions', advancedIndex], { ...form.getFieldValue(['sampler', 'dimensions', advancedIndex]), ...values });
    setAdvancedIndex(null);
    onManualChange?.();
  };
  return <><Form.List name={['sampler', 'dimensions']}>{(fields, { add, remove }) => {
    const columns = [
      { title: '维度名称', width: 230, render: (_, field) => <Form.Item name={[field.name, 'name']} rules={[{ required: true, whitespace: true, message: '请输入维度名称' }]}><Input disabled={readOnly} placeholder="输入或自定义维度名称" onBlur={onManualChange}/></Form.Item> },
      { title: '维度可选值', render: (_, field) => {
        const isToolResult = form.getFieldValue(['sampler', 'dimensions', field.name, 'name']) === '工具执行结果';
        const requiresValues = !isToolResult || toolsEnabled;
        return <><Form.Item name={[field.name, 'values']} rules={[...(requiresValues ? [{ required: true, type: 'array', min: 1, message: '至少维护 1 个枚举值' }] : []), { validator: (_, values) => (values || []).some(value => !String(value).trim()) ? Promise.reject(new Error('枚举值不能为空')) : new Set(values || []).size !== (values || []).length ? Promise.reject(new Error('枚举值不能重复')) : Promise.resolve() }]}><Select disabled={readOnly || isToolResult} mode="tags" open={false} tokenSeparators={[',', '，']} placeholder={isToolResult ? '从工具模拟返回配置自动同步' : '输入枚举值后按回车；至少 1 个'} onChange={onManualChange}/></Form.Item>{isToolResult && <Text type="secondary">{toolsEnabled ? '已从工具配置自动同步' : '工具未启用，不参与事件采样'}</Text>}</>;
      } },
      { title: '高级配置（可选）', width: 140, align: 'center', render: (_, field) => <Button type="link" onClick={() => openAdvanced(field.name)}>{readOnly ? '查看' : '配置'}</Button> },
      { title: '操作', width: 72, align: 'center', render: (_, field) => readOnly ? null : <Button type="text" danger icon={<DeleteOutlined/>} aria-label="删除维度" onClick={() => { remove(field.name); onManualChange?.(); }}/> },
    ];
    return <Card className="conversation-config-card" title="事件采样维度" extra={!readOnly && <Button type="primary" icon={<PlusOutlined/>} onClick={() => { add({ dimension_id: stableConfigId('dim'), option_ids: {}, name: '', description: '', applicability_conditions: '', usage_constraints: '', values: [] }); onManualChange?.(); }}>新增维度</Button>}>
      <Alert type="info" showIcon message="按维度定义事件生成空间" description="系统内置维度可以直接修改或删除，也可以新增自定义维度。每个维度必须维护至少一个枚举值，合成任务会从各维度可选值中采样组合。"/>
      <Table className="section-title" rowKey="key" size="small" pagination={false} dataSource={fields} columns={columns} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未配置事件采样维度"/> }}/>
    </Card>;
  }}</Form.List>
  <Modal title="维度高级配置（可选）" open={advancedIndex !== null} onCancel={() => setAdvancedIndex(null)} destroyOnHidden footer={readOnly ? <Button onClick={() => setAdvancedIndex(null)}>关闭</Button> : undefined} onOk={readOnly ? undefined : saveAdvanced} okText="保存配置" cancelText="取消">
    <Form form={advancedForm} layout="vertical" disabled={readOnly} preserve={false}>
      <Form.Item name="description" label="维度说明"><Input.TextArea rows={3} placeholder="说明该维度的业务含义和采样目的"/></Form.Item>
      <Form.Item name="applicability_conditions" label="适用条件"><Input.TextArea rows={3} placeholder="说明什么情况下使用该维度或其中的枚举值"/></Form.Item>
      <Form.Item name="usage_constraints" label="禁止条件"><Input.TextArea rows={4} placeholder="说明禁止组合、禁止生成或必须避开的情况"/></Form.Item>
    </Form>
  </Modal>
  </>;
}

function KnowledgeToolsStep({ form, onManualChange, readOnly = false }) {
  const knowledgeEnabled = Form.useWatch('knowledgeEnabled', form);
  const toolsEnabled = Form.useWatch('toolsEnabled', form);
  const fewShotEnabled = Form.useWatch('fewShotEnabled', form);
  const knowledgeText = Form.useWatch('knowledgeText', form) || '';
  const ids = ruleIds(knowledgeText);
  return <>
    <SamplerEditor form={form} onManualChange={onManualChange} readOnly={readOnly}/>
    <Alert type="info" showIcon message="知识卡和工具都不是必填项" description="关闭后系统会从合成指令中移除对应要求，并在质检时禁止模型虚构知识引用或工具调用。"/>
    <Card className="conversation-config-card" title={<Space><FileTextOutlined/>知识卡</Space>} extra={<Form.Item name="knowledgeEnabled" valuePropName="checked" noStyle><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item>}>
      {!knowledgeEnabled ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本模板不注入知识卡；仍可继续下一步"/> : <>
        <Alert type="success" showIcon message="知识卡示例" description={<span>知识卡用于提供模型回答问题时可直接引用的业务知识。每张卡以 <Text code>[知识卡 唯一ID]</Text> 开头，填写适用问题、已知业务事实和推荐回答；多张知识卡可连续粘贴，ID 不可重复。</span>}/>
        <Form.Item className="section-title" name="knowledgeUsageInstructions" label="知识卡使用说明" rules={[{ required: true, whitespace: true, message: '请填写知识卡使用说明' }]} extra="说明何时引用知识卡、如何处理冲突，以及回答时必须遵守的依据边界。">
          <Input.TextArea rows={4} showCount onBlur={onManualChange}/>
        </Form.Item>
        <Form.Item className="section-title" name="knowledgeText" label={<Space>知识卡内容<Tag color={ids.length ? 'green' : 'default'}>{ids.length} 张</Tag></Space>} rules={[{ required: true, whitespace: true, message: '请粘贴至少一张知识卡' }]} extra="示例：当用户询问运输状态长时间未更新时，说明状态停更的常见原因、当前可以确认的信息，以及建议用户采取的下一步。">
          <Input.TextArea rows={16} showCount placeholder={'[知识卡 DELIVERY-STATUS-001]\n知识主题：运输状态长时间未更新\n适用问题：用户询问物流信息为什么超过 24 小时没有更新\n已知业务事实：状态停更可能由转运扫描延迟、天气或网络同步延迟造成；状态停更不等于货物丢失\n推荐回答：先说明当前可查询到的最后物流节点和更新时间，再解释可能原因；如超过承诺时效，建议用户发起异常查询或联系人工客服'} onBlur={onManualChange}/>
        </Form.Item>
      </>}
    </Card>
    <Card className="conversation-config-card" title={<Space><ApiOutlined/>工具</Space>} extra={<Form.Item name="toolsEnabled" valuePropName="checked" noStyle><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item>}>
      {!toolsEnabled ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成纯对话数据，不包含工具调用或工具返回"/> : <>
        <Alert type="info" showIcon message="工具调用轨迹将保留在训练数据中" description="系统生成 assistant tool_call、模拟 tool 返回和最终回答，用于训练工具调用能力；不会连接真实业务系统。"/>
        <Form.Item name="toolMode" hidden><Input/></Form.Item>
        <ToolCatalogEditor/>
      </>}
    </Card>
    <Card className="conversation-config-card" title="参考对话（Few-shot，可选）" extra={<Form.Item name="fewShotEnabled" valuePropName="checked" noStyle><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item>}>
      {!fewShotEnabled ? <Alert type="info" showIcon message="本模板不使用参考对话" description="开启后可按 JSONL 粘贴高质量完整对话，每行一条。"/> : <>
        <Alert type="info" showIcon message="每行必须是一条完整对话 JSON" description="每个 JSON 对象必须包含非空 messages 数组，并至少包含一条 user 和一条 assistant 消息。不同类型的参考对话请分别粘贴。"/>
        <Form.Item className="section-title" name="fewShotDialogueJsonl" label="普通对话 JSONL" rules={[{ validator: (_, value) => validateFewShotJsonl(value) }]} extra={'示例：{"messages":[{"role":"user","content":"你好"},{"role":"assistant","content":"您好，请问需要什么帮助？"}]}'}>
          <Input.TextArea rows={9} className="json-textarea" placeholder="每行一条完整对话 JSON" onBlur={onManualChange}/>
        </Form.Item>
        {knowledgeEnabled && <Form.Item name="fewShotKnowledgeJsonl" label="带知识卡的对话 JSONL（可选）" rules={[{ validator: (_, value) => String(value || '').trim() ? validateFewShotJsonl(value) : Promise.resolve() }]} extra="仅在启用知识卡时显示；如需提供此类示例，每行粘贴一条完整对话。">
          <Input.TextArea rows={9} className="json-textarea" placeholder="每行一条带知识卡的完整对话 JSON" onBlur={onManualChange}/>
        </Form.Item>}
        {toolsEnabled && <Form.Item name="fewShotToolJsonl" label="带工具调用轨迹的对话 JSONL（可选）" rules={[{ validator: (_, value) => String(value || '').trim() ? validateFewShotJsonl(value, { requireToolTrace: true }) : Promise.resolve() }]} extra="仅在启用工具时显示；如填写，assistant tool_calls 必须与 tool 消息的 tool_call_id 配对。">
          <Input.TextArea rows={9} className="json-textarea" placeholder="每行一条带完整工具调用轨迹的对话 JSON" onBlur={onManualChange}/>
        </Form.Item>}
      </>}
    </Card>
  </>;
}

function QualityRulesEditor({ form, onManualChange, fixedRules = FIXED_RULES }) {
  const rules = Form.useWatch('scenarioRules', form) || [];
  const scenarioQualityEnabled = Form.useWatch('scenarioQualityEnabled', form);
  const selectedPresetIds = rules.filter(item => item?.source === 'preset').map(item => item.rule_id);
  const sampleLabelsEnabled = Form.useWatch('sampleLabelsEnabled', form);
  const coverageLabelsMarkdown = Form.useWatch('coverageLabelsMarkdown', form) || '';
  const hasSampleLabels = Boolean(sampleLabelsEnabled && coverageLabelsMarkdown.trim());
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
  const businessRules = fixedRules.filter(item => !item.id.includes('PRIVACY') && item.id !== 'FIXED-STRUCTURE');
  const privacyRules = [
    ...DINGO_PRIVACY_RULE_PACKS,
    ...fixedRules.filter(item => item.id.includes('PRIVACY')).map(item => ({
      id: item.id,
      name: item.name,
      scope: item.scope || 'both',
      engine: '系统规则 / 正则',
      severity: 'BLOCK',
      description: item.description,
    })),
  ];
  const packColumns = [
    { title: '规则包 / 检测项', dataIndex: 'name', width: 240, render: (value, row) => <Space direction="vertical" size={0}><Text strong>{value}</Text><Text type="secondary" style={{ fontSize: 12 }}>{row.id}</Text></Space> },
    { title: '检查范围', dataIndex: 'scope', width: 150, render: value => <Tag color="geekblue">{value === 'both' ? '整段 + 每条消息' : value === 'assistant' ? 'Assistant 输出' : value === 'conversation_event' ? '对话 ↔ 事件/证据' : value === 'dataset' ? '数据集' : '整段对话'}</Tag> },
    { title: '检测方法', dataIndex: 'engine', width: 170 },
    { title: '处理级别', dataIndex: 'severity', width: 100, render: value => <Tag color={value === 'BLOCK' ? 'red' : value === 'REVIEW' ? 'orange' : 'blue'}>{value}</Tag> },
    { title: '说明', dataIndex: 'description' },
  ];
  const packTable = data => <Table rowKey="id" size="small" pagination={false} dataSource={data} columns={packColumns} scroll={{ x: 900 }}/>;
  const changePresets = checked => {
    const custom = (form.getFieldValue('scenarioRules') || []).filter(item => item?.source !== 'preset');
    form.setFieldValue('scenarioRules', [...availablePresets.filter(item => checked.includes(item.rule_id)).map(item => ({ ...item, enabled: true })), ...custom]);
    onManualChange?.();
  };
  return <>
    <Divider orientation="left">五类质检规则包</Divider>
    <Alert type="success" showIcon message="Dingo 与系统原有规则已按并集整合" description="Dingo 接管重复的结构、完整性、重复、安全、可读性、上下文与 PII 检查；系统继续保留唯一 ID、业务状态、工具契约、占位符、标签覆盖等领域规则。隐私质检单独分组。"/>
    <Collapse className="section-title" defaultActiveKey={['base', 'custom']} items={[
      { key: 'base', label: <Space><Text strong>基础质检</Text><Tag color="green">6 个规则包</Tag></Space>, children: packTable(DINGO_BASE_RULE_PACKS) },
      { key: 'stats', label: <Space><Text strong>基础统计</Text><Tag color="blue">3 个指标</Tag></Space>, children: <><Alert type="info" showIcon message="统计指标不直接阻断任务" description="分别统计整段文本、User 消息和 Assistant 消息；阈值可在接入后由任务覆盖。"/>{packTable(DINGO_STAT_RULE_PACKS)}</> },
      { key: 'privacy', label: <Space><Text strong>隐私质检</Text><Tag color="purple">独立分类</Tag></Space>, children: <><Alert type="warning" showIcon message="Dingo PII 负责识别，系统脱敏策略负责处置" description="命中后保留类型、消息位置和掩码预览；原文默认不进入报告。"/>{packTable(privacyRules)}</> },
      { key: 'business', label: <Space><Text strong>业务契约质检</Text><Tag>{businessRules.length} 个系统规则</Tag></Space>, children: packTable(businessRules.map(item => ({ ...item, engine: '系统确定性规则', severity: item.id === 'FIXED-COVERAGE-LABEL' ? 'INFO' : 'BLOCK' }))) },
      { key: 'custom', label: <Space><Text strong>自定义质检</Text><Tag color="gold">Dingo + 系统扩展</Tag></Space>, children: <Text type="secondary">在下方启用敏感词、3H、任务难度、答案相关性、答案忠实度或自定义业务规则。</Text> },
    ]}/>
    <Alert className="section-title" type="info" showIcon message="评分口径按检测器保留" description="Dingo 3H 输出 0/1；Context Relevancy、Answer Relevancy、Faithfulness 使用 0–10 分且默认阈值为 7；系统语义规则仍使用 0–1 分。"/>
    <Divider orientation="left">自定义质检（合成指令 / 最终对话 / 对话与事件）</Divider>
    <Flex justify="space-between" align="flex-start"><Paragraph type="secondary">先勾选常用规则，再按需要配置检查对象、检查方式、语义阈值和判定内容；规则 ID 由系统自动生成。</Paragraph><Form.Item name="scenarioQualityEnabled" valuePropName="checked"><Switch checkedChildren="已启用" unCheckedChildren="未启用"/></Form.Item></Flex>
    {!scenarioQualityEnabled ? <Alert type="info" showIcon message="场景自定义质检已关闭" description="格式、隐私、占位符、状态机和工具契约等固定基础规则仍会执行。"/> : <>
      {hasSampleLabels && <Alert className="section-title" type="success" showIcon message="已根据样本标签配置默认勾选“标签覆盖率”" description="该规则统计各标签枚举值对应的样本数量，结果供后续定向扩增使用；如当前模板不需要统计，可取消勾选。"/>}
      <Checkbox.Group value={selectedPresetIds} onChange={changePresets} className="conversation-quality-presets">
        {availablePresets.map(item => <Checkbox value={item.rule_id} key={item.rule_id}>{item.name}</Checkbox>)}
      </Checkbox.Group>
    <Form.List name="scenarioRules">{(fields, { add, remove }) => <>
      <Flex justify="space-between" className="conversation-subsection-title"><Text strong>已配置规则（{fields.length}）</Text><Button icon={<PlusOutlined/>} onClick={() => add({ rule_id: `SCENE-${Date.now().toString(36).toUpperCase()}`, name: '自定义场景规则', scope: 'final_conversation', evaluator: 'semantic_quality', severity: 'REVIEW', threshold: 0.80, rubric: '', source: 'custom', enabled: true })}>添加自定义规则</Button></Flex>
      {fields.map(field => <Card size="small" className="conversation-quality-rule" key={field.key} extra={<Space><Form.Item name={[field.name, 'enabled']} valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="停用"/></Form.Item><Button type="link" danger icon={<DeleteOutlined/>} onClick={() => remove(field.name)}>删除</Button></Space>}>
        <Row gutter={12}>
          <Col span={6}><Form.Item name={[field.name, 'rule_id']} label="规则 ID"><Input disabled/></Form.Item></Col>
          <Col span={6}><Form.Item name={[field.name, 'name']} label="规则名称" rules={[{ required: true }]}><Input/></Form.Item></Col>
          <Col span={5}><Form.Item name={[field.name, 'scope']} label="检查对象"><Select options={[{ value: 'synthesis_instruction', label: '合成指令' }, { value: 'final_conversation', label: '最终对话' }, { value: 'assistant', label: 'Assistant 输出' }, { value: 'conversation_event', label: '对话与事件/证据' }, { value: 'both', label: '指令与对话' }]}/></Form.Item></Col>
          <Col span={3}><Form.Item name={[field.name, 'severity']} label="级别"><Select options={[{ value: 'BLOCK', label: 'BLOCK' }, { value: 'REVIEW', label: 'REVIEW' }, { value: 'INFO', label: 'INFO' }]}/></Form.Item></Col>
          <Col span={4}><Form.Item noStyle shouldUpdate>{() => {
            const evaluator = form.getFieldValue(['scenarioRules', field.name, 'evaluator']);
            if (!isScoredQualityEvaluator(evaluator)) return <Form.Item label="阈值"><Text type="secondary">无</Text></Form.Item>;
            const binary = ['DINGO_HONEST', 'DINGO_HELPFUL', 'DINGO_HARMLESS'].includes(form.getFieldValue(['scenarioRules', field.name, 'rule_id']));
            const dingoScale = evaluator !== 'semantic_quality' && !binary;
            return <Form.Item name={[field.name, 'threshold']} label="通过阈值"><InputNumber min={0} max={dingoScale ? 10 : 1} step={dingoScale ? 0.5 : 0.01} precision={dingoScale ? 1 : 2} style={{ width: '100%' }}/></Form.Item>;
          }}</Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={6}><Form.Item name={[field.name, 'evaluator']} label="检查方式"><Select options={[{ value: 'dingo_rule', label: 'Dingo 规则检测' }, { value: 'dingo_llm', label: 'Dingo LLM 检测' }, { value: 'dingo_embedding', label: 'Dingo 向量检测' }, { value: 'semantic_quality', label: '系统语义质检' }, { value: 'label_coverage', label: '系统统计：标签覆盖率' }, { value: 'required_field', label: '系统规则：字段必填' }, { value: 'enum', label: '系统规则：枚举值' }, { value: 'regex', label: '系统规则：正则格式' }, { value: 'contains', label: '系统规则：必须包含' }, { value: 'forbidden', label: '系统规则：禁止包含' }]}/></Form.Item></Col>
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
          isScoredQualityEvaluator(form.getFieldValue(['scenarioRules', field.name, 'evaluator'])) ? <Row gutter={12}>
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

function PromptPreviewStep({ form }) {
  const watched = Form.useWatch([], form) || {};
  const [previewSeed, setPreviewSeed] = useState(20260908);
  const compiledPrompts = useMemo(() => compileConversationPrompts({ ...form.getFieldsValue(true), ...watched }, { seed: previewSeed, language: 'zh-CN', minTurns: 3, maxTurns: 6, referenceTime: '2026-09-08T10:00:00+08:00' }), [form, watched, previewSeed]);
  const ordinaryExample='{"messages":[{"role":"user","content":"我的订单现在到哪里了？"},{"role":"assistant","content":"请提供合成运单号，我来帮您查询。"}]}';
  const toolExample='{"messages":[{"role":"user","content":"请查询运单 SYN2026000001"},{"role":"assistant","content":null,"tool_calls":[{"id":"call_001","type":"function","function":{"name":"query_shipment","arguments":"{\\"shipment_id\\":\\"SYN2026000001\\"}"}}]},{"role":"tool","tool_call_id":"call_001","content":"{\\"status\\":\\"运输中\\"}"},{"role":"assistant","content":"该运单当前正在运输中。"}]}';
  return <>
    <Card className="conversation-config-card" title="输出数据格式">
      <Descriptions bordered size="small" column={1} items={[
        { key:'structure', label:'数据结构', children:'Messages 对话格式' },
        { key:'description', label:'说明', children:'每条样本包含完整消息序列；发生工具调用时，保留调用参数、工具返回及后续回答。' },
        { key:'file', label:'文件格式', children:'JSONL（每行一条完整样本）' },
        { key:'examples', label:'查看示例', children:<Tabs size="small" items={[
          { key:'ordinary', label:'普通对话', children:<pre className="conversation-output-example">{ordinaryExample}</pre> },
          { key:'tool', label:'含工具调用的对话', children:<pre className="conversation-output-example">{toolExample}</pre> },
        ]}/> },
      ]}/>
    </Card>
    <Card className="section-title" size="small" title="两阶段 Prompt" extra={<Button onClick={() => setPreviewSeed(seed => seed + 1)}>换一个采样条件预览</Button>}>
      <Alert type="info" showIcon message="预览只执行采样与编译，不调用生成模型" description="比例和数量仍由合成任务配置；以下语言、轮数和参考时间仅用于本页明确展示预览结果。"/>
      {!!compiledPrompts.warnings.length && <Alert className="section-title" type="warning" showIcon message="存在待解析的自定义采样约束" description={compiledPrompts.warnings.join('；')}/>}
      <Alert className="section-title" type="warning" showIcon message="请求预览" description="当前未绑定合成任务中的实际模型和生成参数；页面展示的是由统一编译器生成、尚未发送的请求。"/>
      <Descriptions className="section-title" bordered size="small" column={2} items={[{key:'turns',label:'预览轮数',children:'3～6 轮'},{key:'time',label:'事件参考时间',children:'2026-09-08 10:00:00 +08:00'}]}/>
      <Tabs className="section-title" items={[
        {key:'assignment',label:'已分配采样条件',children:<pre className="conversation-prompt-preview">{compactJson(compiledPrompts.assignment)}</pre>},
        {key:'stage1',label:'阶段一：事件生成 Prompt',children:<Tabs type="card" items={[{key:'system',label:'系统指令（System Prompt）',children:<pre className="conversation-prompt-preview">{compiledPrompts.stageOne.system}</pre>},{key:'user',label:'本条生成指令（User Prompt）',children:<pre className="conversation-prompt-preview">{compiledPrompts.stageOne.user}</pre>},{key:'request',label:'完整请求',children:<><Text copyable={{text:compactJson(compiledPrompts.stageOne.request)}}>复制完整请求 JSON</Text><pre className="conversation-prompt-preview">{compactJson(compiledPrompts.stageOne.request)}</pre></>}]} />},
        {key:'stage2',label:'阶段二：完整对话 Prompt',children:<><Alert type="warning" showIcon message="骨架预览，冻结事件待填充" description="只有阶段一事件通过程序校验后才能执行阶段二；此处不会把采样结果伪装成已生成事件。"/><Tabs className="section-title" type="card" items={[{key:'system',label:'系统指令（System Prompt）',children:<pre className="conversation-prompt-preview">{compiledPrompts.stageTwo.system}</pre>},{key:'user',label:'本条生成指令（User Prompt）',children:<pre className="conversation-prompt-preview">{compiledPrompts.stageTwo.user}</pre>},{key:'request',label:'完整请求',children:<><Text copyable={{text:compactJson(compiledPrompts.stageTwo.request)}}>复制完整请求 JSON</Text><pre className="conversation-prompt-preview">{compactJson(compiledPrompts.stageTwo.request)}</pre></>}]} /></>},
      ]}/>
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
    <SampleLabelsCard form={form} onManualChange={onManualChange}/>
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
  const semanticRuleCount = (Form.useWatch('scenarioRules', form) || []).filter(rule => rule.enabled !== false && isScoredQualityEvaluator(rule.evaluator)).length + 3;
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
    { key: 'schema', category: '基础质检', name: 'SFT 字段格式', target: '整段对话', engine: 'Dingo RuleVerlSftDataFormat', severity: 'BLOCK', output: true, status: 'PASS', reason: '必填字段与类型合法' },
    { key: 'stats', category: '基础统计', name: '有效字符长度', target: '整段 + 消息级', engine: 'Dingo RuleCharNumber', severity: 'INFO', output: 286, status: 'INFO', reason: 'User 98 / Assistant 188' },
    { key: 'privacy', category: '隐私质检', name: 'PII 检测', target: '整段 + 消息级', engine: 'Dingo RulePIIDetection', severity: 'BLOCK', output: 0, status: 'PASS', reason: '未发现 PII' },
    { key: 'business', category: '业务契约质检', name: '状态流转合法性', target: '对话与事件', engine: '系统确定性规则', severity: 'BLOCK', output: true, status: 'PASS', reason: '终态与冻结事件一致' },
    { key: 'faithfulness', category: '自定义质检', name: '答案忠实度', target: '对话与事件/证据', engine: 'Dingo LLM', severity: 'BLOCK', threshold: 7, output: 8.8, status: 'PASS', reason: 'Assistant 关键陈述均可由事件或知识卡支持' },
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
      {trialRun.prompt_requests && <Card className="section-title" size="small" title="本次试运行的两阶段实际请求">
        <Tabs items={[{key:'stage1',label:'阶段一请求',children:<pre className="conversation-prompt-preview">{compactJson(trialRun.prompt_requests.stageOne.request)}</pre>},{key:'stage2',label:'阶段二请求',children:<pre className="conversation-prompt-preview">{compactJson(trialRun.prompt_requests.stageTwo.request)}</pre>}]} />
      </Card>}
      <Card className="section-title" size="small" title="2. 对话合成指令" extra={<Text copyable={{ text: compactJson(instructionPreview) }}>复制 JSON</Text>}>
        <Input.TextArea className="conversation-result-json" value={compactJson(instructionPreview)} readOnly autoSize={{ minRows: 14, maxRows: 24 }}/>
      </Card>
      <Card className="section-title" size="small" title="3. 最终合成对话" extra={<Space><Tag color="blue">VERL SFT</Tag><Text copyable={{ text: compactJson(conversationPreview) }}>复制 JSON</Text></Space>}>
        <Input.TextArea className="conversation-result-json" value={compactJson(conversationPreview)} readOnly autoSize={{ minRows: 14, maxRows: 24 }}/>
      </Card>
      <Card className="section-title" size="small" title="4. 五类质检概览" extra={<Tag color="blue">Dingo Mock 契约</Tag>}>
        <Row gutter={[12, 12]}>{Object.entries(quality.category_summary || {}).map(([key, value]) => <Col span={Math.max(4, Math.floor(24 / Math.max(1, Object.keys(quality.category_summary || {}).length)))} key={key}><Card size="small"><Text type="secondary">{value.label || key}</Text><div><Text strong>{value.pass || 0} 通过</Text> / <Text type={value.block ? 'danger' : 'secondary'}>{value.block || 0} 阻断</Text> / <Text type="warning">{value.review || 0} 复核</Text></div></Card></Col>)}</Row>
        {!Object.keys(quality.category_summary || {}).length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待服务端返回分类汇总"/>}
      </Card>
      {(quality.evaluator_errors || []).length > 0 && <Alert className="section-title" type="error" showIcon message="检测器执行失败，任务不能按通过处理" description={(quality.evaluator_errors || []).map(item => `${item.rule_id || item.engine}：${item.message}`).join('；')}/>}
      <Card className="section-title" size="small" title="5. 质检项目明细">
        <Table rowKey="key" size="small" pagination={false} dataSource={qualityItems} scroll={{ x: 1280 }} columns={[
          { title: '分类', dataIndex: 'category', width: 120, render: value => <Tag color={value === '隐私质检' ? 'purple' : value === '基础统计' ? 'blue' : 'default'}>{value || '业务契约质检'}</Tag> },
          { title: '质检项目', dataIndex: 'name', width: 190 },
          { title: '检查对象', dataIndex: 'target', width: 160 },
          { title: '检测器 / 引擎', dataIndex: 'engine', width: 220 },
          { title: '级别', dataIndex: 'severity', width: 90, render: value => <Tag color={value === 'BLOCK' ? 'red' : value === 'REVIEW' ? 'orange' : 'blue'}>{value || 'INFO'}</Tag> },
          { title: '阈值', dataIndex: 'threshold', width: 80, render: value => value ?? '-' },
          { title: '输出', dataIndex: 'output', width: 100, render: value => typeof value === 'boolean' ? String(value) : value ?? '-' },
          { title: '原因 / 统计明细', dataIndex: 'reason', width: 300, render: value => value || '-' },
          { title: '判定', dataIndex: 'status', width: 100, fixed: 'right', render: value => <Tag color={value === 'PASS' ? 'green' : value === 'BLOCK' || value === 'FAIL' ? 'red' : value === 'REVIEW' ? 'orange' : 'blue'}>{value || 'INFO'}</Tag> },
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
        if (!source && example?.knowledge_file_name) values.knowledgeFileName = example.knowledge_file_name;
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
        await form.validateFields(['name', 'businessType', 'assistantIdentityMarkdown', 'assistantPermissionMarkdown', 'userRoleMarkdown', 'sceneMarkdown', 'completionRequirementsMarkdown', 'constraintsMarkdown']);
        await saveDraft({ quiet: true });
      } else if (step === 1) {
        const samplingDimensions = form.getFieldValue(['sampler', 'dimensions']) || [];
        if (!samplingDimensions.length) { message.error('请至少配置一个事件采样维度'); return; }
        if (samplingDimensions.filter(item => item.enabled !== false).some(item => !item?.name?.trim() || !(item.values || []).length)) { message.error('每个启用的维度都必须填写名称并维护至少一个枚举值'); return; }
        if (new Set(samplingDimensions.map(item => item.name.trim())).size !== samplingDimensions.length) { message.error('维度名称不能重复'); return; }
        if (form.getFieldValue('toolsEnabled') && !(form.getFieldValue('toolCatalog') || []).length) {
          message.error('工具已开启，请至少配置一个工具'); return;
        }
        if (form.getFieldValue('knowledgeEnabled') && !form.getFieldValue('knowledgeText')) {
          message.error('知识卡已开启，请粘贴至少一张知识卡；也可以关闭知识卡开关'); return;
        }
        if (form.getFieldValue('knowledgeEnabled')) await form.validateFields(['knowledgeUsageInstructions', 'knowledgeText']);
        if (form.getFieldValue('fewShotEnabled')) {
          const fewShotFields = ['fewShotDialogueJsonl'];
          if (form.getFieldValue('knowledgeEnabled')) fewShotFields.push('fewShotKnowledgeJsonl');
          if (form.getFieldValue('toolsEnabled')) fewShotFields.push('fewShotToolJsonl');
          await form.validateFields(fewShotFields);
        }
        await form.validateFields();
        await saveDraft({ quiet: true });
      } else if (step === 2) {
        await saveDraft({ quiet: true });
      } else if (step === 3) {
        if (form.getFieldValue('sampleLabelsEnabled')) await form.validateFields(['coverageLabelsMarkdown', 'coverageLabelPrompt']);
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
        output_format: 'messages_jsonl',
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
  const currentContent = step === 0 ? <SceneStep form={form} onManualChange={markConfigurationChanged}/> : step === 1 ? <KnowledgeToolsStep form={form} onManualChange={markConfigurationChanged} readOnly={readOnly}/> : step === 2
    ? <PromptPreviewStep form={form}/>
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
