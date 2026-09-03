import { id, loadSeed, mockResult, now, readStore, textDataUrl, updateStore } from './mockStore';

const JOB_STORE = 'document-template-jobs';
const DRAFT_STORE = 'document-template-drafts';
const TEMPLATE_STORE = 'document-templates';
const base = import.meta.env.BASE_URL;
const seedImage = `${base}mock-data/document-seed.jpg`;
const trialImage = `${base}mock-data/document-trial.png`;

async function seedPair() {
  const [job, draft] = await Promise.all([loadSeed('document-job.json'), loadSeed('document-draft.json')]);
  job.artifact_urls = { ...(job.artifact_urls || {}), input: seedImage, layout_overlay: seedImage, structure_overlay: seedImage };
  job.result = { ...(job.result || {}), draft_status: 'ready_for_trial', semantic_status: 'completed', trial_quality_status: null, published_template: null };
  draft.validation = { valid: true, checked_revision: draft.revision, summary: { errors: 0, warnings: 0 }, issues: [] };
  draft.trial_run = null;
  return { job, draft };
}

async function jobById(jobId) {
  const stored = readStore(JOB_STORE, []).find(item => item.id === jobId);
  if (stored) return stored;
  const { job } = await seedPair();
  if (job.id === jobId) return job;
  throw new Error('没有找到该文档模板任务');
}

async function draftById(jobId) {
  const stored = readStore(DRAFT_STORE, {})[jobId];
  if (stored) return stored;
  const { job, draft } = await seedPair();
  if (job.id === jobId) return draft;
  throw new Error('没有找到该模板草稿');
}

function saveJob(job) {
  updateStore(JOB_STORE, [], values => [job, ...values.filter(item => item.id !== job.id)]);
  return job;
}

function saveDraft(jobId, draft) {
  updateStore(DRAFT_STORE, {}, values => ({ ...values, [jobId]: draft }));
  return draft;
}

function artifact(value) {
  if (!value) return '';
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  const text = String(value);
  if (text.includes('trial') && /\.(png|jpe?g)$/i.test(text)) return trialImage;
  if (/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(text) || text.includes('/artifacts/') || text.includes('/input')) return seedImage;
  if (text.endsWith('.md')) return textDataUrl('# 文档模板质检报告\n\n前端 Mock 校验与试运行已通过。', 'text/markdown;charset=utf-8');
  return text;
}

export const templateApi = {
  baseUrl: '',
  health: () => mockResult({ ready: true, mode: 'frontend-mock', layout_engine: 'DocLayout-YOLO Mock', structure_engine: 'OpenCV Mock', ocr_engine: 'PP-OCRv5 Mock' }),
  semanticConfig: () => mockResult({ prompt_version: 'document-template-semantic/mock-v1', system_prompt: '结合整张单据的阅读顺序、空间位置、标签—值关系和跨字段关系，识别固定文字、动态字段与图案，并生成字段规则和质检规则。', rule_catalog: { data_types: ['text', 'code', 'date', 'amount', 'company_name'].map(value => ({ value, label: value })), dictionaries: [{ name: 'synthetic_company', label: '虚构企业名称', available: true }, { name: 'synthetic_person', label: '虚构姓名', available: true }] } }),
  listJobs: async () => {
    const { job } = await seedPair();
    const stored = readStore(JOB_STORE, []);
    return mockResult({ items: [job, ...stored.filter(item => item.id !== job.id)] });
  },
  getJob: async jobId => mockResult(await jobById(jobId)),
  getDraft: async jobId => mockResult(await draftById(jobId)),
  uploadAsset: async (_jobId, file) => mockResult({ asset_reference: { asset_path: seedImage, width: 320, height: 120, mime_type: file.type || 'image/png' } }, 180),
  saveDraft: async (jobId, value) => {
    const draft = { ...value, revision: Number(value.revision || 0) + 1, updated_at: now(), validation: null, trial_run: null, workflow_state: 'draft_saved' };
    const job = { ...(await jobById(jobId)), updated_at: now(), result: { ...(await jobById(jobId)).result, draft_revision: draft.revision, draft_status: 'ready_for_validation', trial_quality_status: null } };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job });
  },
  validate: async jobId => {
    const current = await draftById(jobId);
    const validation = { schema_version: 'template-validation/mock-v1', valid: true, checked_at: now(), checked_revision: current.revision, summary: { errors: 0, warnings: 0 }, issues: [] };
    const draft = { ...current, validation, workflow_state: 'validated', updated_at: now() };
    const existing = await jobById(jobId);
    const job = { ...existing, updated_at: now(), result: { ...existing.result, draft_status: 'ready_for_trial', draft_revision: draft.revision } };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job, validation }, 240);
  },
  extractLayers: async (jobId, targets = ['text', 'asset']) => {
    const draft = { ...(await draftById(jobId)), updated_at: now(), extraction: { ...(await draftById(jobId)).extraction, mock_refresh_targets: targets } };
    const job = { ...(await jobById(jobId)), updated_at: now() };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job, semantic: { status: 'completed', engine: 'frontend-mock' } }, 260);
  },
  reextractText: async (jobId, textId) => {
    const current = await draftById(jobId);
    const draft = { ...current, texts: current.texts.map(item => item.id === textId ? { ...item, confidence: 0.98, source: { kind: 'automatic', engine: 'PP-OCRv5 Mock', confidence: 0.98 } } : item), revision: Number(current.revision || 0) + 1, updated_at: now() };
    const job = { ...(await jobById(jobId)), updated_at: now() };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job, semantic: { status: 'completed' } }, 220);
  },
  extractTable: async jobId => {
    const draft = { ...(await draftById(jobId)), updated_at: now() };
    const job = { ...(await jobById(jobId)), updated_at: now() };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job, report: { raw_cell_count: draft.cells.length + 4, output_cell_count: draft.cells.length, overlaps_after: 0 } }, 260);
  },
  rebuild: async jobId => {
    const draft = await draftById(jobId);
    return mockResult({ draft, proposal: { proposal_id: id('REBUILD'), can_apply: true, cells: draft.cells, report: { input_cells: draft.cells.length, output_cells: draft.cells.length, overlaps_before: 2, overlaps_after: 0, unresolved_locked_overlaps: 0 } } }, 220);
  },
  discardRebuild: async jobId => mockResult({ draft: await draftById(jobId) }),
  applyRebuild: async jobId => {
    const draft = { ...(await draftById(jobId)), revision: Number((await draftById(jobId)).revision || 0) + 1, rebuild_candidate: null, updated_at: now() };
    const job = { ...(await jobById(jobId)), updated_at: now() };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job });
  },
  restoreSystemDraft: async jobId => {
    const { draft: seedDraft } = await seedPair();
    const draft = { ...seedDraft, source: { ...seedDraft.source, job_id: jobId }, updated_at: now() };
    const job = { ...(await jobById(jobId)), updated_at: now() };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job });
  },
  trialRun: async jobId => {
    const current = await draftById(jobId);
    const trial = { revision: current.revision, created_at: now(), image: trialImage, quality_report: textDataUrl('# 模板试运行质检\n\n所有阻断项均已通过。', 'text/markdown;charset=utf-8'), quality_status: 'PASS', quality_summary: { checks: 36, passed: 36, review: 0, rejected: 0 }, quality_metrics: { polygon_valid_rate: 1, dynamic_field_height_median: 24, text_overflow_count: 0 }, output_size: { width: 2480, height: 1754 }, transform: { scale: 1, mode: 'uniform_fit' }, field_generation: { status: 'completed', model: 'frontend-mock', field_count: current.fields.length, model_calls: 1, usage: { total_tokens: 2680 } } };
    const draft = { ...current, trial_run: trial, validation: current.validation?.valid ? current.validation : { valid: true, checked_revision: current.revision }, workflow_state: 'trial_completed', updated_at: now() };
    const existing = await jobById(jobId);
    const job = { ...existing, updated_at: now(), last_trial: { status: 'PASS', created_at: now() }, result: { ...existing.result, draft_status: 'trial_completed', trial_quality_status: 'PASS', draft_revision: draft.revision } };
    saveDraft(jobId, draft); saveJob(job);
    return mockResult({ draft, job, quality: { status: 'PASS' } }, 520);
  },
  listTemplates: () => mockResult({ items: [{ template_id: 'DOC-TPL-SYS-CUSTOMS-MOCK', name: '进口货物报关单模板', business_type: '报关单', status: 'enabled', version: 'V1', version_count: 1, source_job_id: 'TEMPLATE-DOC-20260831-181911-99CC', cell_count: 35, field_count: 72, scope: 'official', created_at: '2026-08-31 10:00:00', updated_at: '2026-08-31 10:00:00' }, ...readStore(TEMPLATE_STORE, [])] }),
  createJob: async ({ file, name, taskType, businessType, imgsz, conf, semanticModel }) => {
    const { job: seedJob, draft: seedDraft } = await seedPair();
    const jobId = id('TEMPLATE-DOC');
    const objectUrl = seedImage;
    const job = { ...seedJob, id: jobId, name, task_type: taskType, business_type: businessType, status: 'completed', progress: 100, created_at: now(), updated_at: now(), parameters: { imgsz, conf, semantic_model: semanticModel, semantic_prompt_version: 'document-template-semantic/mock-v1' }, input: { ...(seedJob.input || {}), original_filename: file?.name || 'mock-seed.jpg' }, artifact_urls: { ...(seedJob.artifact_urls || {}), input: objectUrl }, result: { ...(seedJob.result || {}), semantic_status: 'completed', draft_status: 'ready_for_trial', published_template: null } };
    const draft = { ...seedDraft, source: { ...(seedDraft.source || {}), job_id: jobId, original_filename: file?.name || 'mock-seed.jpg' }, validation: null, trial_run: null, workflow_state: 'draft_saved', updated_at: now() };
    saveJob(job); saveDraft(jobId, draft);
    return mockResult(job, 620);
  },
  publish: async jobId => {
    const existing = await jobById(jobId);
    const template = { template_id: id('DOC-TPL'), name: existing.name, business_type: existing.business_type, version: 'V1', version_count: 1, source_job_id: jobId, cell_count: existing.result?.cell_count || 0, field_count: existing.result?.field_count || 0, scope: 'custom', created_at: now(), updated_at: now() };
    const job = { ...existing, updated_at: now(), result: { ...existing.result, published_template: template, draft_status: 'published' } };
    saveJob(job); updateStore(TEMPLATE_STORE, [], values => [template, ...values]);
    return mockResult({ job, template }, 260);
  },
  artifactUrl: artifact,
  artifactJson: () => mockResult({ mode: 'frontend-mock' }),
};
