import { id, jsonDataUrl, loadSeed, mockResult, now, readStore, textDataUrl, updateStore } from './mockStore';
import { defaultConversationSampler, sampleAssignments } from './conversationSampling';
import { compileConversationPromptsFromConfiguration } from './conversationPromptCompiler';
import { CONVERSATION_DEMO_TEMPLATE } from './conversationDemoTemplate';

const TEMPLATE_STORE = 'conversation-templates';
const DRAFT_STORE = 'conversation-drafts';
const JOB_STORE = 'conversation-jobs';

async function officialTemplate() {
  const raw = await loadSeed('conversation-template.json');
  const selected = raw.versions?.at(-1) || {};
  return {
    ...raw,
    version: selected.version || 'V1',
    version_count: raw.versions?.length || 1,
    selected_version: selected,
    configuration: selected.configuration_v2 || selected.configuration,
    rule_card_count: selected.rule_card_count || 0,
    status: raw.status || 'enabled',
  };
}

async function templates() {
  const official = await officialTemplate();
  const custom = readStore(TEMPLATE_STORE, []);
  return [CONVERSATION_DEMO_TEMPLATE, official, ...custom.filter(item=>item.template_id!==CONVERSATION_DEMO_TEMPLATE.template_id)];
}

function makeTrial(draft, payload = {}) {
  const count = Number(payload.sample_count || payload.instruction_count || 3);
  const promptRequests = compileConversationPromptsFromConfiguration(draft?.configuration || {}, { seed:Number(payload.seed||20260908), language:payload.language||'zh-CN', minTurns:Number(payload.min_turns||3), maxTurns:Number(payload.max_turns||6), referenceTime:payload.reference_time||'2026-09-08T10:00:00+08:00' });
  let assignments = [];
  try {
    assignments = sampleAssignments({ sampler: draft?.configuration?.sampler || defaultConversationSampler(), count, seed: Number(payload.seed || 20260907) });
  } catch { assignments = []; }
  const items = Array.from({ length: count }, (_, index) => {
    const assignment = assignments[index] || {};
    const needsHandoff = assignment.expected_final_state === 'human_handoff';
    return {
      instruction_id: `TRIAL-${String(index + 1).padStart(4, '0')}`,
      data_format: 'messages_jsonl',
      quality_status: 'PASS',
      assignment_id: assignment.assignment_id,
      scenario_id: assignment.scenario_id,
      scenario: assignment.scenario_name || '模板配置的对话场景',
      case_id: assignment.case_id,
      case_name: assignment.case_name,
      interaction_branch_id: assignment.profile_id,
      interaction_branch_name: assignment.profile_name,
      intent: assignment.scenario_name || (needsHandoff ? '异常投诉并要求转人工' : '业务咨询'),
      coverage_labels: {
        business_intent: needsHandoff ? '申请转人工' : '物流状态查询',
        customer_emotion: needsHandoff ? '愤怒' : '焦虑',
        information_completeness: '信息完整',
        tool_path: '查询成功',
      },
      business_facts: Object.keys(assignment.business_facts || {}).length ? assignment.business_facts : { synthetic_reference: `SYN2026090${index + 1}` },
      applied_knowledge_card_ids: assignment.knowledge_ids || [],
      state_path: assignment.state_path || ['collect_information', needsHandoff ? 'human_handoff' : 'resolved'],
      expected_final_state: assignment.expected_final_state || (needsHandoff ? 'human_handoff' : 'resolved'),
      information_disclosure: { initial_fields: assignment.initial_disclosed_fields || [], withheld_fields: assignment.withheld_fields || [], disclosure_condition: assignment.disclosure_condition || '' },
      tool_context: {
        tool_name: assignment.tool_names?.[0] || null,
        arguments: {},
        result: {},
      },
      synthesis_instruction: `依据“${assignment.scenario_name || '模板场景'} / ${assignment.case_name || '合法案例'} / ${assignment.profile_name || '交互分支'}”及冻结业务事实生成自然、准确的中文多轮对话；不得修改事实或披露顺序。`,
    };
  });
  const previewInstruction = items[0];
  const previewTrainingSample = {
    data_source: 'conversation_synthesis',
    prompt: [
      { role: 'system', content: '你是物流智能客服。只依据给定的虚构业务事实、知识卡和工具结果回答，不得编造信息。' },
      { role: 'user', content: '我的虚构运单 SYN20260901 已经两天没有更新了，请帮我查一下是什么情况。' },
    ],
    response: '我已根据虚构运单号查询到：当前状态为运输延误，最后更新时间是 2026-09-01 16:00:00，已知原因为强降雨影响转运处理。暂时没有新的送达时间，我可以为你说明后续查询方式。',
    ability: 'customer_service',
    extra_info: {
      instruction_id: previewInstruction.instruction_id,
      coverage_labels: previewInstruction.coverage_labels,
      state_path: previewInstruction.state_path,
      expected_final_state: previewInstruction.expected_final_state,
      applied_knowledge_card_ids: previewInstruction.applied_knowledge_card_ids,
    },
  };
  const fixedQualityItems = [
    { key: 'sft-format', category: '基础质检', name: 'SFT 字段格式', target: '整段对话', engine: 'Dingo RuleVerlSftDataFormat', severity: 'BLOCK', output: true, status: 'PASS', reason: 'data_source、prompt、response、ability、extra_info 字段与类型合法' },
    { key: 'conversation-structure', category: '基础质检', name: '多轮对话结构', target: '整段对话', engine: 'Dingo RuleConversationStructure', severity: 'BLOCK', output: true, status: 'PASS', reason: '角色枚举合法，User / Assistant 轮次顺序有效' },
    { key: 'content-null', category: '基础质检', name: '空值 / 纯空白', target: '整段 + User / Assistant 消息', engine: 'Dingo RuleContentNull', severity: 'BLOCK', output: 0, status: 'PASS', reason: '空消息 0 条；纯空白消息 0 条' },
    { key: 'content-short', category: '基础质检', name: '短文本', target: '整段 + User / Assistant 消息', engine: 'Dingo RuleContentShort', severity: 'BLOCK', threshold: '消息≥2字符', output: 0, status: 'PASS', reason: '未发现低于阈值的消息' },
    { key: 'repeat', category: '基础质检', name: '文本重复', target: '数据集', engine: 'Dingo RuleDocRepeat', severity: 'REVIEW', threshold: 0.8, output: 0.12, status: 'PASS', reason: '最高归一化重复度 0.12' },
    { key: 'security', category: '基础质检', name: 'LLM 内容安全', target: '整段 + Assistant 消息', engine: 'Dingo LLMSecurityProhibition', severity: 'BLOCK', threshold: 1, output: 1, status: 'PASS', reason: '未发现违法、有害或高风险内容' },
    { key: 'readability', category: '基础质检', name: '综合可读性 / 训练适用性', target: '整段对话', engine: 'Dingo LLMTextQualityV5', severity: 'REVIEW', threshold: 0.8, output: 0.93, status: 'PASS', reason: '表达自然、连贯，可用于训练' },
    { key: 'context', category: '基础质检', name: '上下文相关性 Context Relevancy', target: '整段对话', engine: 'Dingo LLMRAGContextRelevancy', severity: 'REVIEW', threshold: 7, output: 8.5, status: 'PASS', reason: '回复持续围绕当前用户问题和已披露上下文' },
    { key: 'chars', category: '基础统计', name: '有效字符长度', target: '整段 + User / Assistant 消息', engine: 'Dingo RuleCharNumber', severity: 'INFO', output: 286, status: 'INFO', reason: '整段 286；User 98；Assistant 188' },
    { key: 'words', category: '基础统计', name: '词数范围', target: '整段 + User / Assistant 消息', engine: 'Dingo RuleWordNumber', severity: 'INFO', output: 176, status: 'INFO', reason: '整段 176；User 61；Assistant 115' },
    { key: 'punctuation', category: '基础统计', name: '标点与超长句', target: '整段 + User / Assistant 消息', engine: 'Dingo RuleNoPunc + 系统句长统计', severity: 'INFO', output: '2.1%', status: 'INFO', reason: '缺失标点 0 条；超长句占比 2.1%' },
    { key: 'pii', category: '隐私质检', name: 'PII', target: '整段 + User / Assistant 消息', engine: 'Dingo RulePIIDetection', severity: 'BLOCK', output: 0, status: 'PASS', reason: '姓名、电话、邮箱、证件号命中 0 处' },
    { key: 'credential', category: '隐私质检', name: '凭据与密钥', target: '整段 + User / Assistant 消息', engine: '系统规则 / 正则', severity: 'BLOCK', output: 0, status: 'PASS', reason: 'Token、Cookie、密钥命中 0 处' },
    { key: 'label', category: '业务契约质检', name: '样本标签枚举合法性', target: '合成指令', engine: '系统确定性规则', severity: 'BLOCK', output: true, status: 'PASS', reason: '标签维度完整，枚举值合法' },
    { key: 'knowledge', category: '业务契约质检', name: '知识卡 ID 可追溯', target: '指令与最终对话', engine: '系统确定性规则', severity: 'BLOCK', output: true, status: 'PASS', reason: '引用 ID 均来自当前模板快照' },
    { key: 'state', category: '业务契约质检', name: '状态流转合法性', target: '对话与事件', engine: '系统确定性规则', severity: 'BLOCK', output: true, status: 'PASS', reason: '状态路径非空且终态与冻结事件一致' },
    { key: 'tool', category: '业务契约质检', name: '工具调用契约', target: '指令与最终对话', engine: '系统确定性规则', severity: 'BLOCK', output: true, status: 'PASS', reason: '工具名、参数和返回值符合 Schema' },
  ];
  const scenarioRules = (draft?.configuration?.quality?.scenario_rules || []).filter(rule => rule.enabled !== false);
  const scenarioQualityItems = scenarioRules.map((rule, index) => {
    const scored = ['semantic_quality', 'dingo_llm', 'dingo_embedding'].includes(rule.evaluator);
    const binaryDingo = ['DINGO_HONEST', 'DINGO_HELPFUL', 'DINGO_HARMLESS'].includes(rule.rule_id);
    const defaultThreshold = rule.evaluator === 'semantic_quality' ? 0.8 : binaryDingo ? 1 : 7;
    const threshold = scored ? Number(rule.threshold ?? defaultThreshold) : null;
    const score = scored ? (binaryDingo ? 1 : rule.evaluator === 'semantic_quality' ? Math.min(0.98, Math.max(threshold + 0.07, 0.88)) : Math.min(9.6, Math.max(threshold + 1.2, 8.4))) : true;
    return {
      key: rule.rule_id || `scenario-${index + 1}`,
      category: '自定义质检',
      name: rule.name || '场景质检规则',
      target: rule.scope === 'synthesis_instruction' ? '合成指令' : rule.scope === 'both' ? '指令与最终对话' : rule.scope === 'assistant' ? 'Assistant 输出' : rule.scope === 'conversation_event' ? '对话与事件/证据' : '最终对话',
      engine: rule.evaluator?.startsWith('dingo_') ? `Dingo ${rule.evaluator.replace('dingo_', '').toUpperCase()}` : rule.evaluator === 'semantic_quality' ? '系统语义 Judge' : '系统确定性规则',
      severity: rule.severity || 'REVIEW',
      threshold,
      output: scored ? Number(score.toFixed(2)) : true,
      status: rule.severity === 'INFO' ? 'INFO' : 'PASS',
      reason: rule.rubric || rule.description || rule.prompt || '按模板配置执行并通过',
    };
  });
  const qualityItems = [...fixedQualityItems, ...scenarioQualityItems];
  return {
    draft_id: draft.draft_id, revision: draft.revision, status: 'PASS', instruction_count: count, sample_count: count, min_turns: Number(payload.min_turns || 3), max_turns: Number(payload.max_turns || 6),
    model: payload.model || { provider: 'mock', alias: 'mock', display_name: '前端 Mock' },
    generation_parameters: payload.generation_parameters || payload.model?.parameters || {},
    quality_model: payload.quality_model || { provider: 'mock', alias: 'mock', display_name: '前端 Mock' },
    quality_parameters: payload.quality_parameters || {},
    items, preview_instruction: previewInstruction, prompt_requests: promptRequests, output_format: payload.output_format || 'messages_jsonl', quality_items: qualityItems,
    usage: { calls: count * (scenarioRules.filter(rule => ['semantic_quality', 'dingo_llm', 'dingo_embedding'].includes(rule.evaluator)).length + 4), network_attempts: 0, total_tokens: count * 1630 },
    quality_summary: {
      status: 'PASS', schema_valid_rate: 1, rule_traceability_rate: 1, state_valid_rate: 1,
      tool_contract_rate: 1, privacy_risk_count: 0, exact_duplicate_count: 0, profile_diversity_rate: 1,
      category_summary: {
        basic: { label: '基础质检', pass: 8, review: 0, block: 0 },
        statistics: { label: '基础统计', pass: 0, review: 0, block: 0, info: 3 },
        privacy: { label: '隐私质检', pass: 2, review: 0, block: 0 },
        business: { label: '业务契约质检', pass: 4, review: 0, block: 0 },
        custom: { label: '自定义质检', pass: scenarioQualityItems.length, review: 0, block: 0 },
      },
      basic_statistics: { whole: { chars: 286, words: 176, long_sentence_rate: 0.021 }, user: { chars: 98, words: 61, long_sentence_rate: 0 }, assistant: { chars: 188, words: 115, long_sentence_rate: 0.032 } },
      evaluator_errors: [],
      semantic_judge: { executed: true, simulated: true, status: 'PASS', reason: 'Mock 语义检查通过', results: [] },
      local_rule_evaluation: { status: 'PASS', results: [] }, errors: [], warnings: [],
    },
    preview_dialogue: {
      source_instruction_id: items[0].instruction_id,
      messages: [
        { role: 'user', content: '我的虚构运单 SYN20260001 为什么还没有更新？', state: 'collect_information' },
        { role: 'assistant', content: '我会根据当前提供的合成运单信息核对状态。', state: 'query_status' },
        { role: 'user', content: '如果还没有新的送达时间，我接下来应该怎么处理？', state: 'query_status' },
        { role: 'assistant', content: '查询结果显示为运输延误，目前没有新的送达时间；我已为你记录异常，并建议稍后再次查询或转人工处理。', state: 'resolved' },
      ],
    },
    preview_training_sample: previewTrainingSample,
    completed_at: now(),
  };
}

function makeJob(parameters = {}) {
  const count = Number(parameters.count || 20);
  const augmentationEnabled = Boolean(parameters.augmentation?.enabled);
  const qualityEnabled = parameters.quality?.enabled !== false;
  const expansionEnabled = qualityEnabled && Boolean(parameters.expansion?.enabled);
  const augmentedCount = augmentationEnabled ? Math.min(2, Number(parameters.augmentation?.max_new || 2)) : 0;
  const expandedCount = expansionEnabled ? Math.min(2, Number(parameters.expansion?.max_new || 2)) : 0;
  const finalCount = count + augmentedCount + expandedCount;
  const jobId = id('CONVERSATION');
  const report = textDataUrl('# 对话数据质检报告\n\nMock 模式已完成事实、状态机、工具契约、隐私和覆盖率检查。', 'text/markdown;charset=utf-8');
  const jsonl = textDataUrl('{"messages":[{"role":"user","content":"查询虚构运单"},{"role":"assistant","content":"当前状态为运输中"}]}\n', 'application/jsonl;charset=utf-8');
  const categorySummary = {
    basic: { label: '基础质检', pass: finalCount, review: 0, block: 0, rule_count: 8 },
    statistics: { label: '基础统计', pass: 0, review: 0, block: 0, info: finalCount, rule_count: 3 },
    privacy: { label: '隐私质检', pass: finalCount, review: 0, block: 0, rule_count: 5 },
    business: { label: '业务契约质检', pass: Math.max(1, finalCount - 1), review: 1, block: 0, rule_count: 8 },
    custom: { label: '自定义质检', pass: Math.max(1, finalCount - 1), review: 1, block: 0, rule_count: 7 },
  };
  const basicStatistics = {
    whole: { chars_avg: 342, chars_p95: 618, words_avg: 208, long_sentence_rate: 0.023 },
    user: { chars_avg: 126, chars_p95: 248, words_avg: 76, long_sentence_rate: 0.011 },
    assistant: { chars_avg: 216, chars_p95: 405, words_avg: 132, long_sentence_rate: 0.031 },
  };
  const ragMetrics = { context_relevancy: 8.7, answer_relevancy: 8.9, faithfulness: 9.1, threshold: 7 };
  return {
    schema_version: 'conversation-job/v1', id: jobId, status: 'completed', progress: 100, message: qualityEnabled||augmentationEnabled||expansionEnabled?'Mock 模式：对话任务已完成。':'Mock 模式：对话数据合成已完成。', created_at: now(), updated_at: now(), parameters,
    result: {
      scenario_name: parameters.template_name || parameters.scenario?.name || '物流智能客服',
      prompt_generation: { prompt_count: count, tool_mode: parameters.prompt_generation?.tool_mode || 'provided_result' },
      planning: { fact_count: count }, knowledge: { snapshot_id: 'MOCK-KB-SNAPSHOT-001', rule_card_count: 12 },
      generation: { provider: 'frontend-mock', initial_count: count, final_count: finalCount },
      initial_quality: qualityEnabled ? { sample_count: count + augmentedCount, status_counts: { PASS: Math.max(1, count + augmentedCount - 2), REVIEW: 2, REJECT: 0 }, profile_pass_counts: { shipment_status_query: 6, human_handoff: 3 }, privacy_risk_count: 2 } : null,
      final_quality: qualityEnabled ? { sample_count: finalCount, status_counts: { PASS: Math.max(1, finalCount - 1), REVIEW: 1, REJECT: 0 }, average_score: 94.6, schema_valid_rate: 1, state_legal_rate: 0.98, tool_accuracy_rate: 0.97, evidence_resolvable_rate: 1, profile_pass_counts: { shipment_status_query: 8, human_handoff: 5 }, privacy_risk_count: 0, category_summary: categorySummary, basic_statistics: basicStatistics, rag_metrics: ragMetrics, evaluator_errors: [] } : null,
      privacy: { masked_count: qualityEnabled ? 2 : 0, type_counts: qualityEnabled ? { phone: 1, business_identifier: 1, credential: 0, person_name: 0 } : {}, raw_value_exported: false }, augmentation: { added_count: augmentedCount }, expansion_plan: { recommended_new: expandedCount, items: expansionEnabled ? [{ profile: 'human_handoff', current_pass: 3, target: 5, recommended: expandedCount, reason: '补齐人工转接场景' }] : [] },
      delivery: { pass: qualityEnabled ? Math.max(1, finalCount - 1) : finalCount, review: qualityEnabled ? 1 : 0, reject: 0 }, usage: { calls: 4, total_tokens: 12800 },
      retrieval_preview: [{ rank: 1, rule_id: 'SLA-DELAY-001', title: '运输延误判定', score: 0.96 }, { rank: 2, rule_id: 'HUMAN-001', title: '转人工条件', score: 0.91 }],
      preview_samples: [{ messages: [{ turn: 1, role: 'user', content: '我的虚构运单怎么还没到？' }, { turn: 2, role: 'assistant', content: '我先核对合成运单状态，再为你说明下一步。' }] }],
      artifact_urls: { initial_quality_report: qualityEnabled?report:null, final_quality_report: qualityEnabled?report:null, quality_comparison: qualityEnabled&&expansionEnabled?report:null, dingo_raw_results: qualityEnabled?jsonDataUrl({ job_id: jobId, engine: 'dingo', category_summary: categorySummary, metrics: ragMetrics, simulated: true }):null, quality_rule_manifest: qualityEnabled?jsonDataUrl({ job_id: jobId, policy: 'union-v1', categories: Object.keys(categorySummary) }):null, prompt_generator: jsonDataUrl({ prompt: 'Mock prompt generator' }), synthesis_prompts: jsonDataUrl({ prompts: count }), augmented_conversations: augmentationEnabled?jsonl:null, train_pass: jsonl, review: qualityEnabled?jsonl:null, manifest: jsonDataUrl({ job_id: jobId, mode: 'frontend-mock' }) },
    },
  };
}

export const conversationApi = {
  health: () => mockResult({ ready: true, mode: 'frontend-mock', provider: 'mock' }),
  getTemplateAuthoringContract: () => mockResult({ model_options: [{ provider: 'mock', alias: 'mock', display_name: '前端 Mock', default: true }, { provider: 'bailian', alias: 'qwen3-8b', display_name: 'Qwen-8B' }] }),
  getExample: () => mockResult({ knowledge_text: '[知识卡 DELIVERY-STATUS-001]\n知识主题：运输状态长时间未更新\n适用问题：用户询问物流信息为什么超过 24 小时没有更新\n已知业务事实：状态停更可能由转运扫描延迟、天气或网络同步延迟造成；状态停更不等于货物丢失\n推荐回答：先说明当前可查询到的最后物流节点和更新时间，再解释可能原因；如超过承诺时效，建议用户发起异常查询或联系人工客服' }),
  listTemplates: async () => mockResult({ items: await templates() }),
  getTemplate: async templateId => {
    const item = (await templates()).find(value => value.template_id === templateId);
    if (!item) throw new Error('没有找到该对话模板');
    return mockResult(item);
  },
  createTemplate: payload => {
    const item = { ...payload, template_id: id('CONVTPL'), version: 'V1', version_count: 1, status: 'enabled', created_at: now(), updated_at: now() };
    updateStore(TEMPLATE_STORE, [], values => [item, ...values]);
    return mockResult(item);
  },
  updateTemplate: (templateId, payload) => mockResult(updateStore(TEMPLATE_STORE, [], values => values.map(item => item.template_id === templateId ? { ...item, ...payload, updated_at: now() } : item)).find(item => item.template_id === templateId)),
  cloneTemplate: async (templateId, name) => {
    const source = await conversationApi.getTemplate(templateId);
    const draft = { draft_id: id('CONVDRAFT'), schema_version: 'conversation-template-draft/v2', status: 'draft', revision: 1, created_at: now(), updated_at: now(), configuration: source.configuration, name: name || `${source.name} - 副本` };
    updateStore(DRAFT_STORE, [], values => [draft, ...values]);
    return mockResult(draft);
  },
  setTemplateStatus: (templateId, enabled) => conversationApi.updateTemplate(templateId, { status: enabled ? 'enabled' : 'disabled' }),
  createTemplateDraft: payload => {
    const configuration = payload.configuration || {};
    const identity = configuration.identity || {};
    const draft = {
      draft_id: id('CONVDRAFT'),
      schema_version: 'conversation-template-draft/v2',
      status: 'draft',
      revision: 1,
      created_at: now(),
      updated_at: now(),
      source_template_id: payload.template_id || null,
      source_template_version: payload.template_version || null,
      name: identity.name || '未命名对话模板',
      business_type: identity.business_type || '智能客服',
      configuration,
    };
    updateStore(DRAFT_STORE, [], values => [draft, ...values]);
    return mockResult(draft);
  },
  listTemplateDrafts: () => mockResult({ items: readStore(DRAFT_STORE, []) }),
  getTemplateDraft: draftId => mockResult(readStore(DRAFT_STORE, []).find(item => item.draft_id === draftId)),
  saveTemplateDraft: (draftId, payload) => {
    let saved;
    updateStore(DRAFT_STORE, [], values => values.map(item => {
      if (item.draft_id !== draftId) return item;
      const configuration = payload.configuration || payload;
      const identity = configuration.identity || {};
      saved = {
        ...item,
        name: identity.name || item.name || '未命名对话模板',
        business_type: identity.business_type || item.business_type || '智能客服',
        configuration,
        revision: Number(item.revision || 0) + 1,
        updated_at: now(),
        compiled_prompt: null,
        validation: null,
        trial_run: null,
      };
      return saved;
    }));
    return mockResult(saved);
  },
  compileTemplateDraft: draftId => mockResult({ draft_id: draftId, valid: true, compiled_at: now(), placeholder_count: 7, warnings: [], errors: [], prompt_preview: 'Mock 已编译的单条事实与状态机生成指令。' }),
  validateTemplateDraft: draftId => mockResult({ draft_id: draftId, valid: true, checked_at: now(), errors: [], warnings: [], summary: { errors: 0, warnings: 0 } }),
  trialTemplateDraft: (draftId, payload) => {
    const draft = readStore(DRAFT_STORE, []).find(item => item.draft_id === draftId);
    const trial = makeTrial(draft, payload);
    updateStore(DRAFT_STORE, [], values => values.map(item => item.draft_id === draftId ? { ...item, trial_run: trial, validation: { valid: true }, updated_at: now() } : item));
    return mockResult(trial, 500);
  },
  publishTemplateDraft: draftId => {
    const draft = readStore(DRAFT_STORE, []).find(item => item.draft_id === draftId);
    const identity = draft?.configuration?.identity || {};
    const item = { template_id: id('CONVTPL'), name: identity.name || '新建对话模板', description: identity.description || '', business_type: identity.business_type || '多轮对话', version: 'V1', version_count: 1, status: 'enabled', configuration: draft?.configuration || {}, selected_version: { version: 'V1', configuration_v2: draft?.configuration || {} }, created_at: now(), updated_at: now() };
    updateStore(TEMPLATE_STORE, [], values => [item, ...values]);
    updateStore(DRAFT_STORE, [], values => values.filter(value => value.draft_id !== draftId));
    return mockResult({ published_template: item }, 240);
  },
  createJob: parameters => {
    const job = makeJob(parameters);
    updateStore(JOB_STORE, [], values => [job, ...values]);
    return mockResult(job, 520);
  },
  getJob: jobId => {
    const job = readStore(JOB_STORE, []).find(item => item.id === jobId) || makeJob({ count: 20 });
    job.id = jobId;
    return mockResult(job);
  },
  getText: async url => (await fetch(url)).text(),
};
