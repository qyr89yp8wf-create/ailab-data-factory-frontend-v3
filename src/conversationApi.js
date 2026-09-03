import { id, jsonDataUrl, loadSeed, mockResult, now, readStore, textDataUrl, updateStore } from './mockStore';

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
  return [official, ...custom];
}

function makeTrial(draft, payload = {}) {
  const count = Number(payload.sample_count || payload.instruction_count || 3);
  const items = Array.from({ length: count }, (_, index) => {
    const needsHandoff = index % 2 === 1;
    return {
      instruction_id: `TRIAL-${String(index + 1).padStart(4, '0')}`,
      data_format: payload.output_format || 'verl_sft',
      quality_status: 'PASS',
      scenario: '物流运输延误咨询',
      intent: needsHandoff ? '运输延误投诉并要求转人工' : '查询运输状态与延误原因',
      coverage_labels: {
        business_intent: needsHandoff ? '申请转人工' : '物流状态查询',
        customer_emotion: needsHandoff ? '愤怒' : '焦虑',
        information_completeness: '信息完整',
        tool_path: '查询成功',
      },
      business_facts: {
        shipment_id: `SYN2026090${index + 1}`,
        shipment_status: '运输延误',
        last_update_time: '2026-09-01 16:00:00',
        known_reason: '受强降雨影响，转运中心处理延迟',
      },
      applied_knowledge_card_ids: ['DELIVERY-STATUS-001'],
      state_path: ['collect_information', 'query_status', needsHandoff ? 'human_handoff' : 'resolved'],
      expected_final_state: needsHandoff ? 'human_handoff' : 'resolved',
      tool_context: {
        tool_name: 'query_shipment',
        arguments: { shipment_id: `SYN2026090${index + 1}` },
        result: { status: '运输延误', last_update_time: '2026-09-01 16:00:00', known_reason: '强降雨' },
      },
      synthesis_instruction: '依据给定业务事实、知识卡和工具结果，生成自然、准确的中文客服多轮对话；不得补充未提供的物流节点、赔付金额或送达承诺。',
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
    { key: 'schema', name: 'VERL SFT 结构合法性', target: '最终合成对话', evaluator: 'rule', content: '校验 data_source、prompt、response、ability、extra_info 字段完整且类型正确。', output: true },
    { key: 'label', name: '样本标签枚举合法性', target: '对话合成指令', evaluator: 'rule', content: '标签维度必须完整，且取值只能来自模板配置的枚举值。', output: true },
    { key: 'knowledge', name: '知识卡引用可追溯', target: '指令与最终对话', evaluator: 'rule', content: '知识卡 ID 必须来自当前模板配置的知识卡。', output: true },
    { key: 'state', name: '状态流转合法性', target: '最终合成对话', evaluator: 'rule', content: '状态路径非空且最后一项必须等于预期终态。', output: true },
    { key: 'tool', name: '工具调用契约', target: '对话合成指令', evaluator: 'rule', content: '工具名、参数和返回值必须符合已启用工具 Schema。', output: true },
    { key: 'privacy', name: '隐私与敏感信息', target: '指令与最终对话', evaluator: 'rule', content: '检查姓名、手机号、证件号、地址、业务标识和密钥等敏感信息。', output: true },
    { key: 'duplicate', name: '完全重复检查', target: '最终合成对话', evaluator: 'rule', content: '检查是否存在完全相同的数据样本。', output: true },
  ];
  const scenarioRules = (draft?.configuration?.quality?.scenario_rules || []).filter(rule => rule.enabled !== false);
  const scenarioQualityItems = scenarioRules.map((rule, index) => {
    const semantic = rule.evaluator === 'semantic_quality';
    const threshold = semantic ? Number(rule.threshold ?? 0.8) : null;
    const score = semantic ? Math.min(0.98, Math.max(threshold + 0.07, 0.88)) : true;
    return {
      key: rule.rule_id || `scenario-${index + 1}`,
      name: rule.name || '场景质检规则',
      target: rule.scope === 'synthesis_instruction' ? '对话合成指令' : rule.scope === 'both' ? '指令与最终对话' : '最终合成对话',
      evaluator: semantic ? 'semantic' : 'rule',
      content: rule.rubric || rule.description || rule.prompt || '按模板中配置的规则执行检查。',
      threshold,
      output: semantic ? Number(score.toFixed(2)) : true,
    };
  });
  const qualityItems = [...fixedQualityItems, ...scenarioQualityItems];
  return {
    draft_id: draft.draft_id, revision: draft.revision, status: 'PASS', instruction_count: count, sample_count: count, min_turns: Number(payload.min_turns || 3), max_turns: Number(payload.max_turns || 6),
    model: payload.model || { provider: 'mock', alias: 'mock', display_name: '前端 Mock' },
    generation_parameters: payload.generation_parameters || payload.model?.parameters || {},
    quality_model: payload.quality_model || { provider: 'mock', alias: 'mock', display_name: '前端 Mock' },
    quality_parameters: payload.quality_parameters || {},
    items, preview_instruction: previewInstruction, output_format: payload.output_format || 'verl_sft', quality_items: qualityItems,
    usage: { calls: 2, network_attempts: 0, total_tokens: 3260 },
    quality_summary: {
      status: 'PASS', schema_valid_rate: 1, rule_traceability_rate: 1, state_valid_rate: 1,
      tool_contract_rate: 1, privacy_risk_count: 0, exact_duplicate_count: 0, profile_diversity_rate: 1,
      semantic_judge: { executed: true, simulated: true, status: 'PASS', reason: 'Mock 语义检查通过', results: [] },
      local_rule_evaluation: { status: 'PASS', results: [] }, errors: [], warnings: [],
    },
    preview_dialogue: {
      source_instruction_id: items[0].instruction_id,
      messages: [
        { role: 'user', content: '我的虚构运单 SYN20260001 为什么还没有更新？', state: 'collect_information' },
        { role: 'assistant', content: '我会根据当前提供的合成运单信息核对状态。', state: 'query_status' },
        { role: 'assistant', content: '查询结果显示为运输延误，已为你记录异常并提供后续处理方式。', state: 'resolved' },
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
  return {
    schema_version: 'conversation-job/v1', id: jobId, status: 'completed', progress: 100, message: qualityEnabled||augmentationEnabled||expansionEnabled?'Mock 模式：对话任务已完成。':'Mock 模式：对话数据合成已完成。', created_at: now(), updated_at: now(), parameters,
    result: {
      scenario_name: parameters.template_name || parameters.scenario?.name || '物流智能客服',
      prompt_generation: { prompt_count: count, tool_mode: parameters.prompt_generation?.tool_mode || 'provided_result' },
      planning: { fact_count: count }, knowledge: { snapshot_id: 'MOCK-KB-SNAPSHOT-001', rule_card_count: 12 },
      generation: { provider: 'frontend-mock', initial_count: count, final_count: finalCount },
      initial_quality: qualityEnabled ? { sample_count: count + augmentedCount, status_counts: { PASS: Math.max(1, count + augmentedCount - 2), REVIEW: 2, REJECT: 0 }, profile_pass_counts: { shipment_status_query: 6, human_handoff: 3 }, privacy_risk_count: 2 } : null,
      final_quality: qualityEnabled ? { sample_count: finalCount, status_counts: { PASS: Math.max(1, finalCount - 1), REVIEW: 1, REJECT: 0 }, average_score: 94.6, schema_valid_rate: 1, state_legal_rate: 0.98, tool_accuracy_rate: 0.97, evidence_resolvable_rate: 1, profile_pass_counts: { shipment_status_query: 8, human_handoff: 5 }, privacy_risk_count: 0 } : null,
      privacy: { masked_count: qualityEnabled ? 2 : 0 }, augmentation: { added_count: augmentedCount }, expansion_plan: { recommended_new: expandedCount, items: expansionEnabled ? [{ profile: 'human_handoff', current_pass: 3, target: 5, recommended: expandedCount, reason: '补齐人工转接场景' }] : [] },
      delivery: { pass: qualityEnabled ? Math.max(1, finalCount - 1) : finalCount, review: qualityEnabled ? 1 : 0, reject: 0 }, usage: { calls: 4, total_tokens: 12800 },
      retrieval_preview: [{ rank: 1, rule_id: 'SLA-DELAY-001', title: '运输延误判定', score: 0.96 }, { rank: 2, rule_id: 'HUMAN-001', title: '转人工条件', score: 0.91 }],
      preview_samples: [{ messages: [{ turn: 1, role: 'user', content: '我的虚构运单怎么还没到？' }, { turn: 2, role: 'assistant', content: '我先核对合成运单状态，再为你说明下一步。' }] }],
      artifact_urls: { initial_quality_report: qualityEnabled?report:null, final_quality_report: qualityEnabled?report:null, quality_comparison: qualityEnabled&&expansionEnabled?report:null, prompt_generator: jsonDataUrl({ prompt: 'Mock prompt generator' }), synthesis_prompts: jsonDataUrl({ prompts: count }), augmented_conversations: augmentationEnabled?jsonl:null, train_pass: jsonl, review: qualityEnabled?jsonl:null, manifest: jsonDataUrl({ job_id: jobId, mode: 'frontend-mock' }) },
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
