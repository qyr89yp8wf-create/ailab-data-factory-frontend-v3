import { id, mockResult, now, readStore, textDataUrl, updateStore } from './mockStore';

const STORE = 'customs-jobs';
const previewUrl = `${import.meta.env.BASE_URL}assets/template-mock/orange-waybill-base.png`;

const reportMarkdown = `# 进口报关单质检报告

## 总体结论

- 本批次样本已完成 OCR、版面、隐私与图像可读性检查。
- 数字代码准确率、字段完整率和图片清晰度达到演示阈值。

## 核心指标

| 指标 | 结果 | 参考阈值 | 结论 |
| --- | --- | --- | --- |
| 字段完全一致率 | 96.80% | ≥ 95% | PASS |
| 数字代码准确率 | 99.10% | ≥ 98% | PASS |
| 检测覆盖率 | 98.60% | ≥ 95% | PASS |
| 平均识别置信度 | 0.94 | ≥ 0.90 | PASS |

## 图片与几何质量

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| 输出分辨率 | 2480×1754 | PASS |
| 文字溢出 | 0 | PASS |
| 多边形有效率 | 100% | PASS |
| 隐私残留 | 0 | PASS |
`;

function buildJob(parameters = {}) {
  const jobId = id('CUSTOMS');
  const count = Number(parameters.count || parameters.sample_count || 10);
  const width = Number(parameters.output_width || parameters.scene_output_width || 2480);
  const height = Number(parameters.output_height || parameters.scene_output_height || 1754);
  const qualityEnabled = parameters.run_qc !== false;
  const expansionEnabled = qualityEnabled && Boolean(parameters.enable_expansion);
  const created = now();
  return {
    schema_version: 'customs-job/v1', id: jobId, pipeline: 'customs', status: 'completed', stage: 'completed', progress: 100,
    created_at: created, updated_at: created, message: qualityEnabled?'Mock 模式：报关单任务已完成。':'Mock 模式：报关单数据合成已完成。', parameters,
    result: {
      preview_url: previewUrl,
      generation_summary: { sample_count: count, success_count: count, failed_count: 0 },
      qc_summary: qualityEnabled ? {
        sample_count: count, status_counts: { PASS: Math.max(1, count - 1), REVIEW: count > 1 ? 1 : 0, REJECT: 0 },
        threshold_version: 'mock-threshold/v1', models: { detection: 'DocLayout-YOLO Mock', recognition: 'PP-OCRv5 Mock' },
        ocr_averages: { character_error_rate: 0.018, exact_field_rate: 0.968, numeric_code_accuracy: 0.991, detection_coverage: 0.986, recognition_confidence: 0.94, low_confidence_field_rate: 0.021 },
        privacy: { detected_count: 4, masked_count: 4, residual_count: 0 },
        scene_composition: { document_coverage: 0.72, edge_integrity: 1, perspective_valid_rate: 0.98 },
        readability: { blur_score: 146.2, contrast_score: 0.88 },
      } : null,
      privacy: { enabled_sample_count: count, action_count: 4, residual_count: 0 },
      stamps_enabled: true, stamp_profiles: ['合成企业公章'],
      scene_configuration: { enabled: true, output_size: { width, height }, document_content_scale: Number(parameters.document_content_scale || 0.72) },
      expansion: { enabled: expansionEnabled, message: expansionEnabled ? '已按质检缺口补充 2 张样本' : '未启用定向扩增' },
      expansion_plan: { recommended_new: expansionEnabled ? 2 : 0, items: [] },
      quality_report_url: qualityEnabled ? textDataUrl(reportMarkdown, 'text/markdown;charset=utf-8') : null,
      comparison_report_url: expansionEnabled ? textDataUrl('# 扩增前后对比\n\nMock 演示：覆盖率由 92% 提升至 98%。', 'text/markdown;charset=utf-8') : null,
    },
  };
}

export const customsApi = {
  health: () => mockResult({ ready: true, mode: 'frontend-mock', components: { synthesis: true, ocr: true, models: true, api_key: true } }),
  vlmTags: () => mockResult({ items: ['纸张平整', '办公桌背景', '轻微透视', '自然光照', '扫描件'] }),
  createJob: parameters => {
    const job = buildJob(parameters);
    updateStore(STORE, [], jobs => [job, ...jobs]);
    return mockResult(job, 420);
  },
  getJob: jobId => {
    const job = readStore(STORE, []).find(item => item.id === jobId) || buildJob({ count: 10 });
    job.id = jobId;
    return mockResult(job);
  },
  getText: async url => {
    const response = await fetch(url);
    return response.text();
  },
};
