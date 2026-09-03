import { FALLBACK_CATALOG, defaultFields } from './synthetic-template/catalog';
import { id, jsonDataUrl, mockResult, now, readStore, textDataUrl, updateStore } from './mockStore';

const DRAFT_STORE = 'fictional-template-jobs';
const TEMPLATE_STORE = 'fictional-templates';
const GENERATION_STORE = 'fictional-generation-jobs';
const previewImage = `${import.meta.env.BASE_URL}assets/template-mock/orange-waybill-base.png`;

function baseTemplates() {
  return [{ template_id: 'DOC-TPL-FICT-CUSTOMS-MOCK', version: 'V1', name: '虚构贸易申报单模板', document_type: 'customs', business_type: '报关单', status: 'enabled', scope: 'official', execution_engine: 'fictional-template-builder/mock-v1', field_count: defaultFields('customs').length, cell_count: 24, updated_at: '2026-09-01 09:00:00' }, ...readStore(TEMPLATE_STORE, [])];
}

function normalizeDraft(payload, current = null) {
  const revision = Number(current?.revision || 0) + 1;
  return {
    id: current?.id || id('FICTIONAL-TPL'), job_id: current?.id || undefined, schema_version: 'fictional-template-job/v1', status: current?.status || 'draft', revision,
    created_at: current?.created_at || now(), updated_at: now(), template: { ...payload, fields: payload.fields?.length ? payload.fields : defaultFields(payload.document_type, payload.content_subtype) },
    validation: null, last_trial: null, published_template_id: current?.published_template_id || null, published_version: current?.published_version || null,
  };
}

function trialFor(item) {
  const fields = item.template?.fields || [];
  return {
    job_id: item.id, revision: item.revision, status: 'PASS',
    quality: { status: 'PASS', field_count: fields.length, check_count: fields.length + 8, summary: { checks: fields.length + 8, passed: fields.length + 8, review: 0, rejected: 0 }, low_quality_count: 0 },
    urls: { image: previewImage, preview: previewImage, quality_report: textDataUrl('# 虚构文档模板试运行质检\n\n版式、字段规则、安全标识与图像质量检查均已通过。', 'text/markdown;charset=utf-8'), report: textDataUrl('# Mock 质检报告\n\nPASS', 'text/markdown;charset=utf-8') },
    image_url: previewImage, completed_at: now(),
  };
}

function makeGenerationJob(payload = {}) {
  const count = Number(payload.count || 10);
  const width = Number(payload.output_width || 2480);
  const height = Number(payload.output_height || 1754);
  const jobId = id('FICTIONAL-GEN');
  const qualityEnabled = payload.run_qc !== false;
  const report = textDataUrl('# 虚构文档数据质检报告\n\n所有样本均带 SYNTHETIC 标识，字段和版式检查通过。', 'text/markdown;charset=utf-8');
  const summary = jsonDataUrl({ job_id: jobId, sample_count: count, quality_status: 'PASS', mode: 'frontend-mock' });
  return {
    id: jobId, schema_version: 'fictional-generation-job/v1', status: 'completed', stage: 'completed', progress: 100, created_at: now(), updated_at: now(), config: payload,
    events: [{ stage: 'queued', message: '任务已进入前端 Mock 队列', time: now() }, { stage: 'rendering', message: `已渲染 ${count} 张虚构文档`, time: now() }, ...(qualityEnabled?[{ stage: 'quality_checking', message: '固定质量检查已完成', time: now() }]:[]), { stage: 'completed', message: '数据和标注文件已写入 Mock 结果', time: now() }],
    result: { template_id: payload.template_id, version: payload.version || 'V1', document_type: 'customs', content_subtype: payload.content_subtype || 'trade_declaration', sample_count: count, quality_status: payload.run_qc === false ? 'SKIPPED' : 'PASS', output_size: { width, height } },
    artifact_urls: { images: Array.from({ length: Math.min(count, 3) }, () => previewImage), annotations: Array.from({ length: count }, (_, index) => jsonDataUrl({ image: `mock-${index + 1}.png`, fields: [] })), quality_report: qualityEnabled?report:null, dataset_summary: summary, quality_summary: qualityEnabled?summary:null, manifest: textDataUrl(Array.from({ length: count }, (_, index) => JSON.stringify({ id: index + 1, image: `mock-${index + 1}.png` })).join('\n'), 'application/jsonl;charset=utf-8') },
  };
}

export const syntheticTemplateApi = {
  baseUrl: '', prefix: '',
  health: () => mockResult({ ready: true, mode: 'frontend-mock', render_engine: 'svg-canvas-mock/v1' }),
  catalog: () => mockResult({ ...FALLBACK_CATALOG, templates: baseTemplates() }),
  listJobs: () => mockResult({ items: readStore(DRAFT_STORE, []) }),
  createDraft: payload => {
    const item = normalizeDraft(payload);
    item.job_id = item.id;
    updateStore(DRAFT_STORE, [], values => [item, ...values]);
    return mockResult(item, 180);
  },
  getJob: jobId => mockResult(readStore(DRAFT_STORE, []).find(item => item.id === jobId)),
  getDraft: jobId => mockResult(readStore(DRAFT_STORE, []).find(item => item.id === jobId)),
  saveDraft: (jobId, payload) => {
    let saved;
    updateStore(DRAFT_STORE, [], values => values.map(item => {
      if (item.id !== jobId) return item;
      const { expected_revision: _ignored, ...configuration } = payload;
      saved = normalizeDraft(configuration, item);
      saved.job_id = saved.id;
      return saved;
    }));
    return mockResult(saved, 160);
  },
  validateDraft: jobId => {
    const validation = { valid: true, checked_at: now(), errors: [], warnings: [], summary: { errors: 0, warnings: 0 } };
    updateStore(DRAFT_STORE, [], values => values.map(item => item.id === jobId ? { ...item, validation, updated_at: now() } : item));
    return mockResult({ validation });
  },
  trial: jobId => {
    const item = readStore(DRAFT_STORE, []).find(value => value.id === jobId);
    const trial = trialFor(item);
    updateStore(DRAFT_STORE, [], values => values.map(value => value.id === jobId ? { ...value, last_trial: trial, updated_at: now() } : value));
    return mockResult(trial, 480);
  },
  publish: jobId => {
    const item = readStore(DRAFT_STORE, []).find(value => value.id === jobId);
    const template = { ...item.template, template_id: id('DOC-TPL-FICT'), version: 'V1', version_count: 1, status: 'enabled', scope: 'custom', execution_engine: 'fictional-template-builder/mock-v1', field_count: item.template?.fields?.length || 0, cell_count: item.template?.cells?.length || 0, source_job_id: jobId, created_at: now(), updated_at: now() };
    updateStore(TEMPLATE_STORE, [], values => [template, ...values]);
    const updated = { ...item, status: 'published', published_template_id: template.template_id, published_version: 'V1', updated_at: now() };
    updateStore(DRAFT_STORE, [], values => values.map(value => value.id === jobId ? updated : value));
    return mockResult({ ...updated, template_id: template.template_id, version: 'V1', template, urls: { preview: previewImage } }, 220);
  },
  createGenerationJob: payload => {
    const job = makeGenerationJob(payload);
    updateStore(GENERATION_STORE, [], values => [job, ...values]);
    return mockResult(job, 520);
  },
  getGenerationJob: jobId => {
    const job = readStore(GENERATION_STORE, []).find(item => item.id === jobId) || makeGenerationJob({ count: 10 });
    job.id = jobId;
    return mockResult(job);
  },
  artifactUrl: value => value || '',
};
