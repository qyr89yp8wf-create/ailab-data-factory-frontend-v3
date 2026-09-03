import { csvDataUrl, id, jsonDataUrl, loadSeed, mockResult, now, readStore, textDataUrl, updateStore } from './mockStore';

const TEMPLATE_STORE = 'coldchain-templates';
const DRAFT_STORE = 'coldchain-drafts';
const JOB_STORE = 'coldchain-jobs';

async function officialTemplate() {
  const raw = await loadSeed('coldchain-template.json');
  const selected = raw.versions?.at(-1) || raw.selected_version || {};
  const configuration = raw.configuration || selected.configuration || selected;
  return {
    ...raw,
    template_id: raw.template_id || 'COLDTPL-REEFER-INTL-MVP',
    name: raw.name || configuration.name || '冷藏集装箱国际运输（MVP）',
    description: raw.description || configuration.description || '冷链运输时序数据模板',
    business_type: raw.business_type || configuration.business_type || '传感器时序',
    status: 'enabled', scope: raw.scope || 'official', version: raw.version || selected.version || 'V1', version_count: raw.versions?.length || 1,
    generation_rule_count: raw.generation_rule_count || (configuration.fields || []).reduce((sum, field) => sum + (field.generation_rules?.length || 0), 0) || 10,
    quality_rule_count: raw.quality_rule_count || (configuration.fields || []).reduce((sum, field) => sum + (field.quality_rules?.length || 0), 0) || 10,
    parameter_count: raw.parameter_count || configuration.fields?.length || 10,
    coverage_profile_count: raw.coverage_profile_count || configuration.coverage?.profiles?.length || 8,
    selected_version: selected, configuration,
  };
}

async function allTemplates() {
  return [await officialTemplate(), ...readStore(TEMPLATE_STORE, [])];
}

const chartSvg = title => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420"><rect width="100%" height="100%" fill="#f7faff"/><text x="44" y="54" font-family="Arial" font-size="24" fill="#1f1f1f">${title}</text><path d="M55 300 C160 290 190 180 300 220 S470 125 590 210 S760 145 840 175" fill="none" stroke="#1677ff" stroke-width="5"/><path d="M55 320 C180 300 250 270 350 285 S520 260 650 270 S770 245 840 250" fill="none" stroke="#52c41a" stroke-width="4"/><line x1="55" y1="340" x2="850" y2="340" stroke="#bfbfbf"/><text x="55" y="380" font-family="Arial" font-size="16" fill="#8c8c8c">前端 Mock 结果预览</text></svg>`)}`;

function trialFor(draft, payload = {}) {
  const count = Number(payload.sample_count || 2);
  const stepCount = Math.max(2, Number(payload.step_count || 100));
  const intervalMinutes = Math.max(1, Number(payload.interval_minutes || 10));
  const fields = (draft.configuration?.fields || []).filter(field => field.enabled !== false);
  const numericFields = fields.filter(field => ['number', 'integer'].includes(field.type));
  const baseValues = { temperature_setpoint: -18, supply_air_temperature: -19.2, return_air_temperature: -17.4, cargo_temperature: -17.8, ambient_temperature: 24, relative_humidity: 68 };
  const startAt = new Date('2026-09-01T08:00:00+08:00');
  const series = Array.from({ length: stepCount }, (_, index) => {
    const timestamp = new Date(startAt.getTime() + index * intervalMinutes * 60000).toISOString().replace('T', ' ').slice(0, 19);
    const ratio = index / Math.max(1, stepCount - 1);
    const row = { timestamp };
    numericFields.forEach((field, fieldIndex) => {
      const base = baseValues[field.field_id] ?? (fieldIndex + 1) * 8;
      const wave = Math.sin(index / (5 + fieldIndex)) * (field.field_id === 'relative_humidity' ? 3.2 : 0.65 + fieldIndex * 0.08);
      const eventPulse = ratio > 0.54 && ratio < 0.7 ? Math.sin((ratio - 0.54) / 0.16 * Math.PI) * (field.field_id === 'relative_humidity' ? 5 : 2.4) : 0;
      row[field.field_id] = Number((base + wave + eventPulse).toFixed(2));
    });
    return row;
  });
  const gpsTrack = Array.from({ length: stepCount }, (_, index) => {
    const ratio = index / Math.max(1, stepCount - 1);
    return { timestamp: series[index].timestamp, longitude: Number((121.47 - ratio * 116.98 + Math.sin(index / 8) * 0.35).toFixed(5)), latitude: Number((31.23 + ratio * 20.69 + Math.sin(index / 11) * 0.22).toFixed(5)) };
  });
  const modelInput = {
    task: '生成冷链运输时序事件与字段语义约束',
    sample_count: count,
    step_count: stepCount,
    interval_minutes: intervalMinutes,
    event_generation: draft.configuration?.event_generation || {},
    output_fields: fields.map(field => ({ field_id: field.field_id, label: field.label, type: field.type, generation_rule: field.generation_rules?.[0] || null })),
    generation_parameters: payload.generation_parameters,
  };
  if (modelInput.generation_parameters === undefined) delete modelInput.generation_parameters;
  const fieldQualityItems = fields.map((field, index) => {
    const rule = field.quality_rules?.[0] || {};
    const semantic = rule.mode === 'semantic';
    const threshold = semantic ? Number(rule.threshold ?? 0.8) : null;
    return { key: field.field_id || `field-${index}`, name: `${field.label || field.field_id}质检`, target: field.label || field.field_id, evaluator: semantic ? 'semantic' : 'rule', content: rule.prompt || rule.python_code || '检查字段值是否存在且符合字段类型。', threshold, output: semantic ? Number(Math.min(0.98, threshold + 0.11).toFixed(2)) : true };
  });
  const globalQualityItems = (draft.configuration?.quality?.rules || []).filter(rule=>rule.enabled!==false).map((rule, index) => {
    const semantic = rule.mode === 'semantic';
    const threshold = semantic ? Number(rule.threshold ?? 0.8) : null;
    const targets = { semantic_event: '语义事件', temporal_parameters: '时序参数', both: '两者' };
    return { key: rule.rule_id || `global-${index}`, name: rule.name || '整体质检规则', target: targets[rule.target] || rule.target, evaluator: semantic ? 'semantic' : 'rule', content: rule.prompt || rule.python_code || '', threshold, output: semantic ? Number(Math.min(0.98, threshold + 0.1).toFixed(2)) : true };
  });
  const baseQualityItems=(draft.configuration?.quality?.base_rules||[]).map((rule,index)=>({key:rule.rule_id||`base-${index}`,name:rule.name,target:rule.target==='semantic_event'?'语义事件':rule.target==='temporal_parameters'?'时序参数':'两者',evaluator:'rule',content:rule.description||'',threshold:null,output:true}));
  const qualityItems = [...baseQualityItems, ...fieldQualityItems, ...globalQualityItems];
  return {
    draft_id: draft.draft_id, revision: draft.revision, status: 'PASS', model_alias: payload.model_alias || 'frontend-mock', quality_model_alias: payload.quality_model_alias || 'frontend-mock', sample_count: count, step_count: stepCount, interval_minutes: intervalMinutes, seed: 20260901,
    generation_parameters: payload.generation_parameters || {}, quality_parameters: payload.quality_parameters || {},
    model_input: modelInput, output_series: series, gps_track: gpsTrack, numeric_fields: numericFields.map(field => ({ field_id: field.field_id, label: field.label || field.field_id })), quality_items: qualityItems,
    qwen: { status: 'mocked', call_count: 1 },
    quality: { status_counts: { PASS: count, REVIEW: 0, REJECT: 0 }, average_score: 96.4, local_rule_pass: true, qwen_pass: true },
    visualization: {
      preview_image_data_url: chartSvg('冷链试运行：温度曲线与运输路线'),
      shipments: Array.from({ length: count }, (_, index) => ({ shipment_id: `SYN-SHIP-${index + 1}`, container_id: `SYN-CONT-${index + 1}`, origin: '上海', destination: '鹿特丹', primary_event: index ? 'door_open' : 'normal', event_stage: index ? 'destination_terminal' : 'ocean', event_start_time: '2026-09-01 08:00:00', event_end_time: '2026-09-01 09:00:00', duration_minutes: 60, summary: index ? '目的港短时开门，温度轻微波动后恢复' : '运输状态稳定', operational_note: '全部数据为虚构样例' })),
    },
    completed_at: now(),
  };
}

function qualityData(count, expansionEnabled) {
  const total = count + (expansionEnabled ? 2 : 0);
  const shipments = Array.from({ length: total }, (_, index) => ({ shipment_id: `SYN-SHIP-${String(index + 1).padStart(3, '0')}`, status: index === total - 1 ? 'REVIEW' : 'PASS', score: index === total - 1 ? 82 : 96, low_quality: index === total - 1, coverage_labels: { primary_event: index % 2 ? 'door_open' : 'normal' }, dimension_scores: { contract: 100, temporal: 96, physical: 94, geospatial: 98, ground_truth: 95, privacy: 100, template_rules: 97, coverage_labels: 96 }, findings: index === total - 1 ? [{ message: '短时温度变化建议人工复核' }] : [] }));
  return {
    expansion_enabled: expansionEnabled, privacy_check_enabled: true,
    initial: { shipment_count: count, status_counts: { PASS: Math.max(1, count - 2), REVIEW: 2, REJECT: 0 } },
    final: {
      shipment_count: total, status_counts: { PASS: Math.max(1, total - 1), REVIEW: 1, REJECT: 0 }, average_score: 95.2, low_quality_count: 1, coverage_score: 96,
      units: { sample_interval_minutes: 60 }, privacy: { engine: 'frontend-mock/privacy', checked_sample_count: total, failed_sample_count: 0, status_counts: { PASS: total } }, shipments,
      coverage: { met: true, rows: [{ dimension_id: 'primary_event', dimension_name: '主要事件', label: 'normal', target_count: 2, generated_count: Math.ceil(total / 2), pass_count: Math.ceil(total / 2), review_count: 0, reject_count: 0, effective_gap: 0, coverage_rate: 1 }, { dimension_id: 'primary_event', dimension_name: '主要事件', label: 'door_open', target_count: 2, generated_count: Math.floor(total / 2), pass_count: Math.max(1, Math.floor(total / 2) - 1), review_count: 1, reject_count: 0, effective_gap: 0, coverage_rate: 1 }] },
    },
    expansion_plan: { enabled: expansionEnabled, recommended_new: expansionEnabled ? 2 : 0, requested_max_new: 5, low_quality_source_count: 1, target_events: expansionEnabled ? ['door_open'] : [], source_policy: '低质原样本仅标记；新增样本由规则引擎独立生成。', reason: expansionEnabled ? '补齐开门事件覆盖' : '未启用扩增', items: expansionEnabled ? [{ profile_id: 'door-open', profile_name: '开门事件', target: 3, current_pass: 1, recommended: 2, labels: { primary_event: 'door_open' } }] : [] },
  };
}

function makeJob(parameters = {}) {
  const count = Number(parameters.count || 10);
  const qualityEnabled = parameters.enable_quality !== false;
  const expansionEnabled = qualityEnabled && Boolean(parameters.enable_expansion);
  const report = qualityData(count, expansionEnabled);
  const markdown = textDataUrl('# 冷链时序质量报告\n\n前端 Mock 已完成字段契约、物理规则、GPS、隐私和标签覆盖检查。', 'text/markdown;charset=utf-8');
  return {
    schema_version: 'coldchain-job/v1', id: id('COLDCHAIN'), status: 'completed', progress: 100, message: qualityEnabled?'Mock 模式：时序数据合成与质量检查已完成。':'Mock 模式：时序数据合成已完成。', created_at: now(), updated_at: now(), parameters,
    result: {
      quality_enabled: qualityEnabled, generation_summary: { shipment_count: count, row_count: count * 168 },
      initial_qc: qualityEnabled?report.initial:null, final_qc: qualityEnabled?report.final:null, expansion_plan: qualityEnabled?report.expansion_plan:{enabled:false,recommended_new:0,items:[]},
      qwen_call_count: 1, qwen_status: 'frontend-mock', privacy: { enabled: Boolean(parameters.enable_privacy), masked_count: 2 },
      generation_preview_url: chartSvg('冷链温度变化与运输路线'), comparison_preview_url: chartSvg('扩增前后质检结果对比'),
      quality_report_data_url: qualityEnabled?jsonDataUrl(report):null, initial_report_url: qualityEnabled?markdown:null, comparison_report_url: qualityEnabled&&expansionEnabled?markdown:null,
      final_delivery_url: csvDataUrl([['shipment_id', 'timestamp', 'temperature_setpoint', 'return_air_temperature', 'primary_event'], ['SYN-SHIP-001', '2026-09-01 08:00:00', '-18', '-17.8', 'normal'], ['SYN-SHIP-002', '2026-09-01 09:00:00', '-18', '-16.9', 'door_open']]),
    },
  };
}

export const coldchainApi = {
  health: () => mockResult({ ready: true, mode: 'frontend-mock', engine: 'coldchain-physics-mock/v1' }),
  listTemplates: async () => mockResult({ items: await allTemplates() }),
  getTemplate: async templateId => {
    const item = (await allTemplates()).find(value => value.template_id === templateId);
    if (!item) throw new Error('没有找到该时序模板');
    return mockResult(item);
  },
  validateTemplate: configuration => mockResult({ valid: true, configuration, errors: [], warnings: [] }),
  createTemplate: configuration => {
    const item = { template_id: id('COLDTPL'), name: configuration.name, description: configuration.description, business_type: configuration.business_type || '传感器时序', status: 'enabled', scope: 'custom', version: 'V1', version_count: 1, parameter_count: configuration.fields?.length || 0, generation_rule_count: (configuration.fields || []).reduce((sum, field) => sum + (field.generation_rules?.length || 0), 0), quality_rule_count: (configuration.fields || []).reduce((sum, field) => sum + (field.quality_rules?.length || 0), 0), coverage_profile_count: configuration.coverage?.profiles?.length || 0, configuration, created_at: now(), updated_at: now() };
    updateStore(TEMPLATE_STORE, [], values => [item, ...values]);
    return mockResult(item);
  },
  listTemplateDrafts: async () => {
    let drafts = readStore(DRAFT_STORE, []);
    if (!drafts.length) {
      const seed = await officialTemplate();
      const configuration = { ...seed.configuration, name:'冷链运输异常事件模板（草稿）', description:'用于配置异常事件、输出参数及质检规则的时序模板草稿', business_type:'传感器时序', scope:'custom' };
      const draft = { draft_id:'COLDDRAFT-20260903-A81C2F', status:'draft', revision:3, configuration, name:configuration.name, description:configuration.description, business_type:configuration.business_type, field_count:configuration.fields?.length||10, coverage_profile_count:configuration.coverage?.profiles?.length||6, trial_status:'PASS', validation:{valid:true}, trial_run:{status:'PASS'}, created_at:'2026-09-03 09:00:00', updated_at:'2026-09-03 09:30:00' };
      updateStore(DRAFT_STORE, [], () => [draft]);
      drafts = [draft];
    }
    return mockResult({ items:drafts });
  },
  getTemplateDraft: draftId => mockResult(readStore(DRAFT_STORE, []).find(item => item.draft_id === draftId)),
  createTemplateDraft: async payload => {
    const seed = await officialTemplate();
    const configuration = payload?.configuration || { ...seed.configuration, name: '新建冷链时序模板', description: '基于前端 Mock 的冷链时序模板草稿', scope: 'custom' };
    const draft = { draft_id: id('COLDDRAFT'), status: 'draft', revision: 1, configuration, name: configuration.name, description: configuration.description, business_type: configuration.business_type, created_at: now(), updated_at: now(), validation: null, trial_run: null };
    updateStore(DRAFT_STORE, [], values => [draft, ...values]);
    return mockResult(draft);
  },
  saveTemplateDraft: (draftId, configuration) => {
    let saved;
    updateStore(DRAFT_STORE, [], values => values.map(item => {
      if (item.draft_id !== draftId) return item;
      saved = { ...item, configuration, name: configuration.name, description: configuration.description, business_type: configuration.business_type || item.business_type || '传感器时序', revision: Number(item.revision || 0) + 1, validation: null, trial_run: null, updated_at: now() };
      return saved;
    }));
    return mockResult(saved);
  },
  validateTemplateDraft: draftId => mockResult({ draft_id: draftId, valid: true, errors: [], warnings: [], checked_at: now() }),
  trialTemplateDraft: (draftId, payload) => {
    const draft = readStore(DRAFT_STORE, []).find(item => item.draft_id === draftId);
    const trial = trialFor(draft, payload);
    updateStore(DRAFT_STORE, [], values => values.map(item => item.draft_id === draftId ? { ...item, trial_run: trial, validation: { valid: true }, updated_at: now() } : item));
    return mockResult(trial, 520);
  },
  publishTemplateDraft: draftId => {
    const draft = readStore(DRAFT_STORE, []).find(item => item.draft_id === draftId);
    const config = draft?.configuration || {};
    const item = { template_id: id('COLDTPL'), name: config.name || '新建时序模板', description: config.description || '', business_type: config.business_type || '传感器时序', status: 'enabled', scope: 'custom', version: 'V1', version_count: 1, parameter_count: config.fields?.length || 0, generation_rule_count: (config.fields || []).reduce((sum, field) => sum + (field.generation_rules?.length || 0), 0), quality_rule_count: (config.fields || []).reduce((sum, field) => sum + (field.quality_rules?.length || 0), 0), coverage_profile_count: config.coverage?.profiles?.length || 0, configuration: config, trial_status: draft?.trial_run?.status || 'PASS', created_at: now(), updated_at: now() };
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
    const job = readStore(JOB_STORE, []).find(item => item.id === jobId) || makeJob({ count: 10 });
    job.id = jobId;
    return mockResult(job);
  },
};
