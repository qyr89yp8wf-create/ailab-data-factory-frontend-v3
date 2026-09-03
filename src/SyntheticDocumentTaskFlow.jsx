import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Col, Descriptions, Divider, Empty, Form, Image,
  Input, InputNumber, Progress, Radio, Row, Select, Space, Statistic, Switch,
  Tag, Timeline, Typography,
} from 'antd';
import {
  CheckCircleOutlined, FileImageOutlined, FileProtectOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { syntheticTemplateApi } from './syntheticTemplateApi';
import { formatDateTime } from './timeUtils';
import {
  CUSTOMS_INITIAL_VALUES, CustomsAugmentationFields, CustomsGenerationFields,
  CustomsQualityFields, createCustomsBackendJob, customsStages,
} from './CustomsMvp';

const { Paragraph, Text } = Typography;

const BUSINESS_TYPES = {
  报关单: { documentType: 'customs', label: '报关单' },
  运单: { documentType: 'domestic_waybill', label: '运单' },
  合同: { documentType: 'contract', label: '合同' },
  customs: { documentType: 'customs', label: '报关单' },
  domestic_waybill: { documentType: 'domestic_waybill', label: '运单' },
  contract: { documentType: 'contract', label: '合同' },
};

const STAGE_META = {
  queued: ['排队中', 'default'],
  rendering: ['程序化渲染', 'processing'],
  quality_checking: ['质量检查', 'processing'],
  completed: ['已完成', 'success'],
  failed: ['失败', 'error'],
};

const STATUS_META = {
  queued: ['排队中', 'default'],
  running: ['运行中', 'processing'],
  completed: ['已完成', 'success'],
  failed: ['失败', 'error'],
};

const QUALITY_STATUS_COLORS = {
  PASS: 'green', REVIEW: 'gold', REJECT: 'red', SKIPPED: 'default',
};

const CUSTOMS_PROGRAMMATIC_ENGINE = 'customs_modular_monolith/v1';

export const SYNTHETIC_DOCUMENT_INITIAL_VALUES = {
  syntheticDocumentTemplateId: '',
  syntheticDocumentTemplateVersion: '',
  syntheticDocumentTemplateName: '',
  syntheticDocumentTemplateOrigin: '',
  syntheticDocumentTemplateBuilderMode: '',
  syntheticDocumentExecutionEngine: '',
  syntheticDocumentExecutionAdapter: '',
  syntheticDocumentPipelineVariant: '',
  syntheticDocumentTemplateLegacy: false,
  syntheticDocumentCanvasWidth: undefined,
  syntheticDocumentCanvasHeight: undefined,
  contentSubtype: 'trade_declaration',
  count: 10,
  seed: 20260827,
  outputResolutionMode: 'template',
  outputWidth: undefined,
  outputHeight: undefined,
  enableStamps: true,
  runQc: true,
  enableAugmentation: false,
};

function businessMeta(value) {
  return BUSINESS_TYPES[value] || BUSINESS_TYPES.报关单;
}

function templateSourceTags(template) {
  if (!template) return null;
  const origin = String(template.origin || '').toLowerCase();
  const builderMode = String(template.builder_mode || '').toLowerCase();
  return <Space size={[4, 4]} wrap>
    {origin === 'system' || origin === 'system_builtin'
      ? <Tag color="blue">system</Tag>
      : <Tag color="green">user</Tag>}
    {builderMode === 'seed_parse' && <Tag color="purple">seed</Tag>}
    {template.legacy_layout_only && <Tag color="orange">legacy</Tag>}
    {builderMode === 'fictional' && <Tag color="cyan">虚构合成</Tag>}
    {template.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE && <Tag color="geekblue">原程序化报关单</Tag>}
  </Space>;
}

function normalizeTemplates(catalog) {
  const values = Array.isArray(catalog?.templates)
    ? catalog.templates
    : Array.isArray(catalog?.items) ? catalog.items : [];
  return values.filter(item => item?.template_id && item?.version);
}

function normalizeSubtypes(catalog, documentType) {
  const values = catalog?.content_subtypes?.[documentType];
  return Array.isArray(values)
    ? values.map(item => ({ value: item.value, label: item.label || item.name || item.value }))
    : [];
}

function canvasText(template) {
  const canvas = template?.canvas || {};
  return canvas.width && canvas.height ? `${canvas.width} × ${canvas.height} px` : '-';
}

export function SyntheticDocumentTemplateFields({ form }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const businessType = Form.useWatch('businessType', form) || '报关单';
  const templateId = Form.useWatch('syntheticDocumentTemplateId', form);
  const meta = businessMeta(businessType);
  const templates = useMemo(() => normalizeTemplates(catalog), [catalog]);
  const compatible = useMemo(
    () => templates
      .filter(item => item.document_type === meta.documentType)
      .sort((left, right) => Number(right.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE) - Number(left.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE)),
    [templates, meta.documentType],
  );
  const selected = compatible.find(item => item.template_id === templateId) || null;
  const subtypeOptions = useMemo(
    () => normalizeSubtypes(catalog, meta.documentType),
    [catalog, meta.documentType],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([syntheticTemplateApi.health(), syntheticTemplateApi.catalog()])
      .then(([health, value]) => {
        if (!active) return;
        if (health?.ready === false) throw new Error('虚构文档模板服务尚未就绪');
        setCatalog(value || {});
        setError('');
      })
      .catch(reason => {
        if (!active) return;
        setCatalog(null);
        setError(reason?.message || '无法读取统一模板目录');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    const currentId = form.getFieldValue('syntheticDocumentTemplateId');
    const current = compatible.find(item => item.template_id === currentId);
    const next = current || compatible[0];
    if (!next) {
      form.setFieldsValue({
        syntheticDocumentTemplateId: '', syntheticDocumentTemplateVersion: '',
        syntheticDocumentTemplateName: '', syntheticDocumentTemplateOrigin: '',
        syntheticDocumentTemplateBuilderMode: '', syntheticDocumentExecutionEngine: '',
        syntheticDocumentExecutionAdapter: '', syntheticDocumentPipelineVariant: '',
        syntheticDocumentTemplateLegacy: false,
        syntheticDocumentCanvasWidth: undefined, syntheticDocumentCanvasHeight: undefined,
      });
      return;
    }
    const allowedSubtypes = normalizeSubtypes(catalog, meta.documentType);
    const existingSubtype = form.getFieldValue('contentSubtype');
    const templateSubtype = next.content_subtype;
    const subtype = allowedSubtypes.some(item => item.value === existingSubtype)
      ? existingSubtype
      : allowedSubtypes.find(item => item.value === templateSubtype)?.value || allowedSubtypes[0]?.value || templateSubtype || '';
    const executionDefaults = next.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE
      ? CUSTOMS_INITIAL_VALUES
      : SYNTHETIC_DOCUMENT_INITIAL_VALUES;
    form.setFieldsValue({
      ...executionDefaults,
      businessType,
      syntheticDocumentTemplateId: next.template_id,
      syntheticDocumentTemplateVersion: next.version,
      syntheticDocumentTemplateName: next.name,
      syntheticDocumentTemplateOrigin: next.origin,
      syntheticDocumentTemplateBuilderMode: next.builder_mode,
      syntheticDocumentExecutionEngine: next.execution_engine,
      syntheticDocumentExecutionAdapter: next.execution_adapter,
      syntheticDocumentPipelineVariant: next.pipeline_variant,
      syntheticDocumentTemplateLegacy: Boolean(next.legacy_layout_only),
      syntheticDocumentCanvasWidth: next.canvas?.width,
      syntheticDocumentCanvasHeight: next.canvas?.height,
      contentSubtype: subtype,
    });
  }, [businessType, catalog, compatible, form, meta.documentType]);

  const chooseTemplate = value => {
    const next = compatible.find(item => item.template_id === value);
    if (!next) return;
    const allowedSubtypes = normalizeSubtypes(catalog, meta.documentType);
    const existingSubtype = form.getFieldValue('contentSubtype');
    const subtype = allowedSubtypes.some(item => item.value === existingSubtype)
      ? existingSubtype
      : allowedSubtypes.find(item => item.value === next.content_subtype)?.value || allowedSubtypes[0]?.value || next.content_subtype || '';
    const executionDefaults = next.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE
      ? CUSTOMS_INITIAL_VALUES
      : SYNTHETIC_DOCUMENT_INITIAL_VALUES;
    form.setFieldsValue({
      ...executionDefaults,
      businessType,
      syntheticDocumentTemplateId: next.template_id,
      syntheticDocumentTemplateVersion: next.version,
      syntheticDocumentTemplateName: next.name,
      syntheticDocumentTemplateOrigin: next.origin,
      syntheticDocumentTemplateBuilderMode: next.builder_mode,
      syntheticDocumentExecutionEngine: next.execution_engine,
      syntheticDocumentExecutionAdapter: next.execution_adapter,
      syntheticDocumentPipelineVariant: next.pipeline_variant,
      syntheticDocumentTemplateLegacy: Boolean(next.legacy_layout_only),
      syntheticDocumentCanvasWidth: next.canvas?.width,
      syntheticDocumentCanvasHeight: next.canvas?.height,
      contentSubtype: subtype,
    });
  };

  const options = compatible.map(item => {
    const source = item.origin === 'system' ? 'system' : 'user';
    const seed = item.builder_mode === 'seed_parse' ? ' · seed' : '';
    const legacy = item.legacy_layout_only ? ' · legacy' : '';
    return {
      value: item.template_id,
      label: `${item.name} · ${item.version} · ${source}${seed}${legacy}`,
    };
  });

  return <>
    <Alert
      type="info"
      showIcon
      message={`选择已发布的${meta.label}模板`}
      description="系统内置模板、用户制作的虚构模板和历史种子解析模板来自同一目录；任务提交时锁定模板 ID 与版本。"
    />
    {error && <Alert className="section-title" type="error" showIcon message="统一模板目录读取失败" description={`${error}。请刷新页面以重新加载内置 Mock 数据。`}/>} 
    <Row gutter={16} className="section-title">
      <Col span={18}>
        <Form.Item name="syntheticDocumentTemplateId" label="文档模板" rules={[{ required: true, message: `请选择${meta.label}模板` }]}>
          <Select
            loading={loading}
            showSearch
            optionFilterProp="label"
            options={options}
            placeholder={loading ? '正在读取统一模板目录' : `选择${meta.label}模板`}
            onChange={chooseTemplate}
          />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name="syntheticDocumentTemplateVersion" label="模板版本" rules={[{ required: true }]}>
          <Input readOnly placeholder="选择模板后自动锁定"/>
        </Form.Item>
      </Col>
    </Row>
    {meta.documentType === 'contract' && <Form.Item name="contentSubtype" label="合同内容类型" rules={[{ required: true, message: '请选择合同内容类型' }]}>
      <Select options={subtypeOptions} placeholder="选择本批次合同内容类型"/>
    </Form.Item>}
    {!loading && !error && !compatible.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`统一目录中暂无已发布的${meta.label}模板`}/>} 
    {selected && <Card size="small" title="模板版本快照" extra={templateSourceTags(selected)}>
      <Descriptions size="small" column={2} items={[
        { key: 'id', label: '模板 ID', children: <Text copyable>{selected.template_id}</Text> },
        { key: 'version', label: '不可变版本', children: selected.version },
        { key: 'canvas', label: '模板画布', children: canvasText(selected) },
        { key: 'objects', label: '结构对象', children: selected.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE ? '原程序化 renderer 内置版式' : `${selected.cell_count || 0} 格 / ${selected.text_count || 0} 文字 / ${selected.asset_count || 0} 图案` },
        { key: 'fields', label: '动态字段', children: selected.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE ? `${selected.capability_summary?.content_fields || '50+'} 个业务字段 / 每样本约 ${selected.capability_summary?.sample_annotations || 48} 项标注` : `${selected.field_count || 0} 个` },
        { key: 'schema', label: '数据契约', children: selected.schema_version || '-' },
        { key: 'engine', label: '执行引擎', children: selected.execution_engine || 'fictional_template_renderer/v1' },
        { key: 'pipeline', label: '管线版本', children: selected.pipeline_variant || '-' },
      ]}/>
      {selected.execution_engine === CUSTOMS_PROGRAMMATIC_ENGINE && <Alert className="section-title" type="success" showIcon message="该模板使用程序化报关单 Mock 管线" description="模板作为统一目录入口和版本快照；纯前端模式会生成同结构的任务、阶段日志、质检报告和产物链接。"/>}
      {selected.legacy_layout_only && <Alert className="section-title" type="warning" showIcon message="这是旧版种子解析模板" description="该模板缺少完整字段契约，能够被统一目录选中，但正式质检可能判为 REJECT；建议发布 form-template/v2 版本后再用于批量生成。"/>}
    </Card>}
    <Form.Item name="syntheticDocumentTemplateName" hidden><Input/></Form.Item>
    <Form.Item name="syntheticDocumentTemplateOrigin" hidden><Input/></Form.Item>
    <Form.Item name="syntheticDocumentTemplateBuilderMode" hidden><Input/></Form.Item>
    <Form.Item name="syntheticDocumentExecutionEngine" hidden><Input/></Form.Item>
    <Form.Item name="syntheticDocumentExecutionAdapter" hidden><Input/></Form.Item>
    <Form.Item name="syntheticDocumentPipelineVariant" hidden><Input/></Form.Item>
    <Form.Item name="syntheticDocumentTemplateLegacy" valuePropName="checked" hidden><Switch/></Form.Item>
    <Form.Item name="syntheticDocumentCanvasWidth" hidden><InputNumber/></Form.Item>
    <Form.Item name="syntheticDocumentCanvasHeight" hidden><InputNumber/></Form.Item>
  </>;
}

export function SyntheticDocumentGenerationFields({ form }) {
  const engine = form.getFieldValue('syntheticDocumentExecutionEngine');
  if (engine === CUSTOMS_PROGRAMMATIC_ENGINE) return <CustomsGenerationFields form={form}/>;
  return <GenericSyntheticDocumentGenerationFields form={form}/>;
}

function GenericSyntheticDocumentGenerationFields({ form }) {
  const mode = Form.useWatch('outputResolutionMode', form) || 'template';
  const stamps = Form.useWatch('enableStamps', form);
  const canvasWidth = Number(Form.useWatch('syntheticDocumentCanvasWidth', form) || 0);
  const canvasHeight = Number(Form.useWatch('syntheticDocumentCanvasHeight', form) || 0);
  const count = Number(Form.useWatch('count', form) || 0);

  const useTemplateResolution = () => {
    form.setFieldsValue({ outputWidth: undefined, outputHeight: undefined });
  };

  const useCustomResolution = () => {
    if (!form.getFieldValue('outputWidth') || !form.getFieldValue('outputHeight')) {
      form.setFieldsValue({
        outputWidth: canvasWidth || 2480,
        outputHeight: canvasHeight || 1754,
      });
    }
  };

  return <>
    <Alert type="info" showIcon message="配置本次程序化虚构生成" description="模板负责版式、字段规则和安全图案；此处设置本批次数量、复现种子、成品尺寸和是否绘制模板中的合成章。"/>
    <Row gutter={16} className="section-title">
      <Col span={8}><Form.Item name="count" label="生成样本数" rules={[{ required: true }]}><InputNumber min={1} max={100} precision={0} addonAfter="张" style={{ width: '100%' }}/></Form.Item></Col>
      <Col span={8}><Form.Item name="seed" label="随机种子" tooltip="相同模板版本、参数和随机种子会生成可复现的数据。" rules={[{ required: true }]}><InputNumber min={1} max={2147483647} precision={0} style={{ width: '100%' }}/></Form.Item></Col>
      <Col span={8}><Form.Item name="enableStamps" label="模板内合成章" valuePropName="checked"><Switch checkedChildren="绘制" unCheckedChildren="不绘制"/></Form.Item></Col>
    </Row>
    <Card size="small" title="正式成品尺寸">
      <Form.Item name="outputResolutionMode" label="分辨率来源">
        <Radio.Group optionType="button" buttonStyle="solid" onChange={event => event.target.value === 'template' ? useTemplateResolution() : useCustomResolution()} options={[
          { value: 'template', label: `沿用模板${canvasWidth && canvasHeight ? `（${canvasWidth}×${canvasHeight}）` : ''}` },
          { value: 'custom', label: '自定义成品尺寸' },
        ]}/>
      </Form.Item>
      {mode === 'custom' && <Row gutter={16}>
        <Col span={12}><Form.Item name="outputWidth" label="成品宽度" rules={[{ required: true }, { type: 'number', min: 640, max: 8192 }]}><InputNumber min={640} max={8192} precision={0} addonAfter="px" style={{ width: '100%' }}/></Form.Item></Col>
        <Col span={12}><Form.Item name="outputHeight" label="成品高度" rules={[{ required: true }, { type: 'number', min: 640, max: 8192 }]}><InputNumber min={640} max={8192} precision={0} addonAfter="px" style={{ width: '100%' }}/></Form.Item></Col>
      </Row>}
      <Paragraph type="secondary">系统从模板原始坐标直接投影到成品尺寸，并同步缩放图片、文字、bbox 与 polygon，不经过低分辨率中间图。</Paragraph>
    </Card>
    <Alert className="section-title" type={stamps ? 'success' : 'info'} showIcon message={stamps ? `将生成 ${count || 0} 张带安全合成标识的文档` : `将生成 ${count || 0} 张无章文档`} description="二维码、条形码和印章均使用程序化安全载荷；不会使用真实品牌、官方标识或真实印章。"/>
  </>;
}

export function SyntheticDocumentAugmentationFields({ form }) {
  const engine = form.getFieldValue('syntheticDocumentExecutionEngine');
  if (engine === CUSTOMS_PROGRAMMATIC_ENGINE) return <CustomsAugmentationFields form={form}/>;
  return <GenericSyntheticDocumentAugmentationFields/>;
}

function GenericSyntheticDocumentAugmentationFields() {
  return <>
    <Alert type="info" showIcon message="本批次保持模板原生清晰度" description="当前虚构文档生成服务只执行高分辨率程序化渲染，不会悄悄应用尚未接通的 Augraphy、Albumentations 或扩散背景。"/>
    <Card size="small" className="section-title" title="本次任务实际执行内容">
      <Descriptions size="small" column={1} items={[
        { key: 'render', label: '图像处理', children: '按所选成品尺寸一次渲染，不先缩小再放大' },
        { key: 'annotation', label: '标注同步', children: '文字、图案、bbox 与 polygon 使用同一缩放矩阵' },
        { key: 'lineage', label: '数据血缘', children: '每张图片记录模板 ID、版本、随机种子和 sample_index' },
      ]}/>
    </Card>
  </>;
}

export function SyntheticDocumentQualityFields({ form }) {
  const engine = form.getFieldValue('syntheticDocumentExecutionEngine');
  if (engine === CUSTOMS_PROGRAMMATIC_ENGINE) return <CustomsQualityFields form={form}/>;
  return <GenericSyntheticDocumentQualityFields form={form}/>;
}

function GenericSyntheticDocumentQualityFields({ form }) {
  const enabled = Form.useWatch('runQc', form);
  return <>
    <Alert type="info" showIcon message="质检规则随 form-template/v2 模板执行" description="纯前端 Mock 会返回几何、字段完整性、字段格式和安全契约检查结果，并模拟首张样本 OCR 抽检。"/>
    <Card className="section-title" size="small" title="固定质检" extra={<Form.Item name="runQc" valuePropName="checked" noStyle><Switch checkedChildren="已启用" unCheckedChildren="已关闭"/></Form.Item>}>
      <Row gutter={[12, 12]}>
        {[
          ['坐标重投影', 'bbox / polygon 有效率不低于 99.5%'],
          ['小字段可读性', '字段高度 P10 建议 ≥16px，中位数建议 ≥20px'],
          ['字段契约', '必填值、正则格式和动态字段绑定'],
          ['合成安全', '虚构来源、水印、安全码图和非官方标识'],
          ['OCR 抽检', '首张样本计算 CER、字段完全一致率和数字代码准确率'],
        ].map(([title, description]) => <Col span={12} key={title}><Card size="small"><Text strong>{title}</Text><br/><Text type="secondary">{description}</Text></Card></Col>)}
      </Row>
    </Card>
    {!enabled && <Alert type="warning" showIcon message="本任务将跳过样本级质检" description="图片和标注仍会生成，但数据集质检状态会记录为 SKIPPED。"/>}
    <Divider orientation="left">三类质检结果</Divider>
    <Row gutter={12}>{[
      ['PASS', '硬规则通过且没有质量建议。', 'green'],
      ['REVIEW', '没有硬错误，但存在小字段尺寸等质量建议。', 'gold'],
      ['REJECT', '坐标、必填字段、格式或安全契约存在硬错误。', 'red'],
    ].map(([title, description, color]) => <Col span={8} key={title}><Card size="small"><Tag color={color}>{title}</Tag><Paragraph type="secondary">{description}</Paragraph></Card></Col>)}</Row>
  </>;
}

export function SyntheticDocumentSubmissionSummary({ form }) {
  const values = form.getFieldsValue(true);
  if (values.syntheticDocumentExecutionEngine === CUSTOMS_PROGRAMMATIC_ENGINE) {
    return <>
      <Alert type="success" showIcon message="点击“提交任务”后启动程序化报关单 Mock" description="统一模板 ID、版本和配置会保存在浏览器任务快照中，并生成可查看的模拟结果。"/>
      <Descriptions bordered size="small" column={2} className="section-title" items={[
        { key: 'template', label: '系统模板', children: `${values.syntheticDocumentTemplateName || values.syntheticDocumentTemplateId} / ${values.syntheticDocumentTemplateVersion}` },
        { key: 'engine', label: '执行引擎', children: values.syntheticDocumentExecutionEngine },
        { key: 'variant', label: '管线版本', children: values.syntheticDocumentPipelineVariant || 'stamped_background_mainline/v1' },
        { key: 'count', label: '生成样本', children: `${values.count || 0} 张` },
        { key: 'seed', label: '随机种子', children: values.seed || '-' },
        { key: 'stamps', label: '合成章', children: values.enableStamps ? `启用（${(values.stampProfiles || []).length}类可选）` : '不启用' },
        { key: 'privacy', label: '隐私保护', children: values.enablePrivacy ? `启用（${(values.privacyFields || []).length}个字段）` : '不启用' },
        { key: 'qc', label: '本地质检', children: values.runQc ? 'PP-OCRv5 + 业务/几何/隐私检查' : '跳过' },
      ]}/>
    </>;
  }
  const subtype = values.contentSubtype || '-';
  const resolution = values.outputResolutionMode === 'custom'
    ? `${values.outputWidth || '-'} × ${values.outputHeight || '-'} px`
    : `${values.syntheticDocumentCanvasWidth || '-'} × ${values.syntheticDocumentCanvasHeight || '-'} px（模板）`;
  return <>
    <Alert type="info" showIcon message="点击“提交任务”后创建虚构文档 Mock 任务" description="模板版本、生成参数、图片、标注、manifest 和质检报告均由浏览器 Mock 状态保存。"/>
    <Descriptions bordered size="small" column={2} className="section-title" items={[
      { key: 'template', label: '模板', children: `${values.syntheticDocumentTemplateName || values.syntheticDocumentTemplateId || '-'} / ${values.syntheticDocumentTemplateVersion || '-'}` },
      { key: 'source', label: '模板来源', children: <Space>{values.syntheticDocumentTemplateOrigin && <Tag color={values.syntheticDocumentTemplateOrigin === 'system' ? 'blue' : 'green'}>{values.syntheticDocumentTemplateOrigin}</Tag>}{values.syntheticDocumentTemplateBuilderMode === 'seed_parse' && <Tag color="purple">seed</Tag>}{values.syntheticDocumentTemplateLegacy && <Tag color="orange">legacy</Tag>}</Space> },
      { key: 'business', label: '业务类型', children: values.businessType || '-' },
      { key: 'subtype', label: '内容类型', children: subtype },
      { key: 'count', label: '生成样本', children: `${values.count || 0} 张` },
      { key: 'seed', label: '随机种子', children: values.seed || '-' },
      { key: 'resolution', label: '正式成品尺寸', children: resolution },
      { key: 'stamps', label: '模板内合成章', children: values.enableStamps ? '绘制' : '不绘制' },
      { key: 'qc', label: '固定质检', children: values.runQc ? '执行' : '跳过' },
      { key: 'safety', label: '安全契约', children: '虚构主体 + 合成水印 + 安全码图' },
    ]}/>
  </>;
}

export async function createSyntheticDocumentBackendJob(form) {
  const values = form.getFieldsValue(true);
  const templateId = values.syntheticDocumentTemplateId;
  const version = values.syntheticDocumentTemplateVersion;
  if (!templateId || !version) throw new Error('请选择有效的文档模板版本');
  if (values.syntheticDocumentExecutionEngine === CUSTOMS_PROGRAMMATIC_ENGINE) {
    form.setFieldsValue({ customsTemplateId: 'customs_import_standard_v1' });
    return createCustomsBackendJob(form);
  }
  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('生成样本数必须为 1 至 100 的整数');
  const seed = Number(values.seed);
  if (!Number.isInteger(seed)) throw new Error('随机种子必须为整数');

  const payload = {
    template_id: templateId,
    version,
    content_subtype: values.contentSubtype || '',
    count,
    seed,
    enable_stamps: Boolean(values.enableStamps),
    run_qc: Boolean(values.runQc),
    enable_qc: Boolean(values.runQc),
    enable_augmentation: false,
  };
  if (values.outputResolutionMode === 'custom') {
    const width = Number(values.outputWidth);
    const height = Number(values.outputHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 640 || width > 8192 || height < 640 || height > 8192) {
      throw new Error('自定义成品宽高必须为 640 至 8192 像素的整数');
    }
    payload.output_width = width;
    payload.output_height = height;
  }
  return syntheticTemplateApi.createGenerationJob(payload);
}

export function syntheticDocumentStages(values = {}) {
  if (values.syntheticDocumentExecutionEngine === CUSTOMS_PROGRAMMATIC_ENGINE) return customsStages(values);
  return ['程序化渲染', ...(values.runQc === false ? [] : ['质量评估']), '结果写入'];
}

function artifactUrl(value) {
  return value ? syntheticTemplateApi.artifactUrl(value) : '';
}

function ArtifactButton({ href, children, primary = false }) {
  if (!href) return null;
  return <Button type={primary ? 'primary' : 'default'} href={artifactUrl(href)} target="_blank">{children}</Button>;
}

export function SyntheticDocumentTaskDetail({ job: directJob, task }) {
  const job = directJob || task?.backendJob || task;
  if (!job) return <Alert type="info" showIcon message="任务提交后将在此展示生成与质检结果"/>;
  const result = job.result || {};
  const config = job.config || {};
  const urls = job.artifact_urls || result.artifact_urls || {};
  const images = Array.isArray(urls.images) ? urls.images : [];
  const firstImage = images[0];
  const status = STATUS_META[job.status] || [job.status || '未知', 'default'];
  const stage = STAGE_META[job.stage] || [job.stage || '-', 'default'];
  const qualityStatus = result.quality_status || (job.status === 'completed' && !config.run_qc ? 'SKIPPED' : '-');
  const output = result.output_size || {};
  const events = Array.isArray(job.events) ? job.events : [];

  return <div className="section-title">
    <Alert
      type={job.status === 'failed' ? 'error' : job.status === 'completed' ? 'success' : 'info'}
      showIcon
      icon={job.status === 'completed' ? <CheckCircleOutlined/> : undefined}
      message={job.status === 'completed' ? '虚构文档、标注与质检产物已生成' : `当前执行：${stage[0]}`}
      description={job.status === 'failed' ? job.error : '任务状态、阶段事件和文件地址来自浏览器 Mock 持久化记录。'}
    />
    <Progress className="section-title" percent={Number(job.progress) || 0} status={job.status === 'failed' ? 'exception' : job.status === 'completed' ? 'success' : 'active'}/>
    <Space wrap><Badge status={status[1]} text={status[0]}/><Tag color={stage[1] === 'processing' ? 'blue' : undefined}>{stage[0]}</Tag>{job.id && <Text copyable>{job.id}</Text>}</Space>

    <Row gutter={[12, 12]} className="section-title">
      <Col span={6}><Card size="small"><Statistic title="生成图片" value={result.sample_count ?? config.count ?? 0} suffix="张"/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="标注文件" value={Array.isArray(urls.annotations) ? urls.annotations.length : (result.sample_count ?? 0)} suffix="份"/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="成品宽度" value={output.width ?? config.output_width ?? '-'} suffix={output.width || config.output_width ? 'px' : ''}/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="质检结果" value={qualityStatus} valueStyle={{ color: qualityStatus === 'PASS' ? '#3f8600' : qualityStatus === 'REJECT' ? '#cf1322' : undefined }}/></Card></Col>
    </Row>

    <Divider orientation="left">配置与数据血缘</Divider>
    <Descriptions bordered size="small" column={2} items={[
      { key: 'template', label: '模板 ID / 版本', children: `${result.template_id || config.template_id || '-'} / ${result.version || config.version || '-'}` },
      { key: 'type', label: '文档 / 内容类型', children: `${result.document_type || '-'} / ${result.content_subtype || config.content_subtype || '-'}` },
      { key: 'seed', label: '随机种子', children: config.seed ?? '-' },
      { key: 'size', label: '正式成品尺寸', children: output.width && output.height ? `${output.width} × ${output.height} px` : '沿用模板尺寸' },
      { key: 'stamp', label: '模板内合成章', children: config.enable_stamps ? '已绘制' : '未绘制' },
      { key: 'qc', label: '固定质检', children: <Tag color={QUALITY_STATUS_COLORS[qualityStatus]}>{qualityStatus}</Tag> },
    ]}/>

    {firstImage && <>
      <Divider orientation="left">样本预览</Divider>
      <Card size="small" style={{ textAlign: 'center' }}><Image src={artifactUrl(firstImage)} style={{ maxHeight: 460, objectFit: 'contain' }}/></Card>
    </>}

    <Divider orientation="left">运行日志</Divider>
    {events.length ? <Timeline items={[...events].reverse().map((event, index) => ({
      color: event.stage === 'failed' ? 'red' : event.stage === 'completed' ? 'green' : index === 0 && job.status !== 'completed' ? 'blue' : 'gray',
      children: <div><Text strong>{STAGE_META[event.stage]?.[0] || event.stage || '运行事件'}</Text><div>{event.message}</div><Text type="secondary">{formatDateTime(event.time)}</Text></div>,
    }))}/> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待 Mock 流程写入阶段日志"/>}

    <Divider orientation="left">结果文件</Divider>
    <Space wrap>
      <ArtifactButton href={urls.quality_report} primary><SafetyCertificateOutlined/> 质检报告 MD</ArtifactButton>
      <ArtifactButton href={urls.dataset_summary}><FileProtectOutlined/> 数据集摘要 JSON</ArtifactButton>
      <ArtifactButton href={urls.quality_summary}>质检明细 JSON</ArtifactButton>
      <ArtifactButton href={urls.manifest}>Manifest JSONL</ArtifactButton>
      <ArtifactButton href={firstImage}><FileImageOutlined/> 打开首张图片</ArtifactButton>
    </Space>
    {!Object.keys(urls).length && <Alert className="section-title" type="info" showIcon message="结果文件将在任务完成后出现"/>}
  </div>;
}
