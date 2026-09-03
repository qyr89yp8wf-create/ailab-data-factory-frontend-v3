import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Descriptions, Divider, Flex, Form,
  Image, InputNumber, Progress, Row, Select, Space, Spin, Statistic, Steps,
  Switch, Tag, Typography, message,
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloudServerOutlined, FileImageOutlined,
  PlayCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { customsApi } from './customsApi';

const { Text, Paragraph, Title } = Typography;

const DEFAULT_VLM_VISUAL_TAGS = [
  'camera_photo', 'scan_copy', 'document_shadow', 'paper_fold', 'paper_stain',
  'complex_background', 'stamp_occlusion', 'text_render_artifact',
  'perspective_distortion', 'low_readability',
];

export const CUSTOMS_INITIAL_VALUES = {
  customsTemplateId: 'customs_import_standard_v1',
  count: 1,
  seed: 20260821,
  enableStamps: true,
  stampProfiles: ['customs_review', 'broker_declaration', 'broker_company'],
  enablePrivacy: false,
  privacyFields: [
    'domestic_receiver', 'overseas_sender', 'consumer_unit', 'declaration_company',
    'declarant', 'declarant_cert', 'declarant_phone', 'storage_place',
    'business_identifiers', 'machine_codes', 'stamps',
  ],
  privacyStrategies: {
    domestic_receiver: 'random_replace', overseas_sender: 'random_replace',
    consumer_unit: 'random_replace', declaration_company: 'random_replace',
    declarant: 'random_replace', declarant_cert: 'random_replace',
    declarant_phone: 'random_replace', storage_place: 'random_replace',
    business_identifiers: 'random_replace', machine_codes: 'random_replace',
    stamps: 'random_replace',
  },
  enableQwenText: false,
  enableBackgroundDiffusion: false,
  outputResolutionMode: 'standard',
  outputWidth: 2480,
  outputHeight: 1754,
  lockAspectRatio: true,
  documentScaleMode: 'close',
  documentContentPercent: 94,
  runQc: true,
  enableVlmReview: false,
  vlmVisualTags: DEFAULT_VLM_VISUAL_TAGS,
  enableExpansion: false,
  maxNewImages: 0,
};

const STAMP_OPTIONS = [
  { label: '海关审核合成章', value: 'customs_review' },
  { label: '报关公司报关合成章', value: 'broker_declaration' },
  { label: '报关公司企业合成公章', value: 'broker_company' },
];

const PRIVACY_FIELDS = [
  ['domestic_receiver', '境内收货人'], ['overseas_sender', '境外发货人'],
  ['consumer_unit', '消费使用单位'], ['declaration_company', '申报单位'],
  ['declarant', '报关人员'], ['declarant_cert', '报关人员证号'],
  ['declarant_phone', '电话'], ['storage_place', '货物存放地点'],
  ['business_identifiers', '业务唯一编号'], ['machine_codes', '条形码和二维码'],
  ['stamps', '印章'],
];

const PRIVACY_STRATEGIES = [
  ['random_replace', '随机替换'], ['synthetic_replace', '虚构替换（含合成词）'],
  ['generalize', '泛化'], ['partial_mask', '部分掩码'],
  ['full_mask', '完全掩码'], ['delete', '删除'], ['color_block', '色块覆盖'],
].map(([value, label]) => ({ value, label }));

const OUTPUT_RESOLUTION_OPTIONS = [
  { value: 'standard', label: '标准精度 · 2480×1754' },
  { value: 'high', label: '高精度 · 3508×2480' },
  { value: 'custom', label: '自定义' },
];

const DOCUMENT_SCALE_OPTIONS = [
  { value: 'close', label: '近景清晰 · 94%' },
  { value: 'standard', label: '标准场景 · 86%' },
  { value: 'distant', label: '环境远景 · 76%' },
  { value: 'custom', label: '自定义' },
];

const CUSTOMS_TEMPLATE_OPTIONS = [
  {
    value: 'customs_import_standard_v1',
    label: '进口报关单标准模板 V1',
    description: '2480×1754 标准版式，支持海关图标、Code 128、二维码、合成章及字段级 polygon/bbox 标注。',
  },
];

const CONTRACT_TERMS = [
  ['15类代码表', '国家地区、币制、口岸关区、运输方式、监管方式、成交方式、包装、计量单位和 HS 编码等取自本地代码表，避免编造代码。'],
  ['28条业务规则', '校验必填项、代码格式、日期、数量金额及国家—口岸等字段关系，拦截业务上不成立的报关单。'],
  ['Augraphy 白名单', '只使用批准的折痕、扫描、复印、污渍等文档退化算子，避免不可控增强破坏文字和标签。'],
  ['Albumentations 标注同步', '旋转、透视、裁剪时同步更新 bbox 与 polygon，让变换后的 Ground Truth 仍然对齐。'],
  ['海关图标', '按模板固定在左上角的合成视觉元素，用于覆盖真实报关单常见版式。'],
  ['Code 128', '右上角的一维条形码，编码内容与样本字段保持一致，可用于码区检测和识别训练。'],
  ['二维码', '右上角的合成二维码，与版式和标注一起生成，用于二维码区域识别场景。'],
  ['合成章安全契约', '启用合成章时，所有章都带“合成、训练或 SYNTHETIC”等不可关闭的可见文字，防止被误当成真实印章。'],
];

const OCR_TERMS = [
  ['Ground Truth', '生成报关单时同步保存的标准文字、字段值和位置标注，是判断 OCR 是否识别正确的参考答案。'],
  ['PP-OCRv5 本地质检', '在本机 CPU 上检测文字区域并识别文字，不上传图片，也不产生模型 API 费用。'],
  ['CER', '字符错误率；OCR 结果相对 Ground Truth 的字符增删改比例，越低越好。'],
  ['字段完全一致率', '逐字段比较 OCR 与 Ground Truth，整段文字完全相同才算该字段正确。'],
  ['数字代码准确率', '专门检查报关单号、HS 编码、金额等数字和代码字段，避免总体指标掩盖关键错误。'],
  ['检测覆盖率', '应识别字段中实际被 OCR 检测到的比例，用来发现漏检区域。'],
  ['图片质量分档', '根据亮度、对比度和清晰度将图片分档，区分可用扫描件与过度退化样本。'],
  ['bbox/polygon 重投影', '检查几何变换后的框和多边形能否准确投回图片，防止图像与标注错位。'],
  ['隐私检查', '检查所选字段是否已处理，以及图片、Ground Truth、JSON、条码载荷和印章是否同步；失败样本统一标为低质。'],
  ['PASS / REVIEW / REJECT 与低质', 'PASS 为合格；任一项目得到 REVIEW 或 REJECT 都统一标记为低质，不返工原样本。'],
];

function TermGrid({ items }) {
  return <div className="customs-term-grid">{items.map(([title, description]) => <div className="customs-term-item" key={title}><Text strong>{title}</Text><Text type="secondary">{description}</Text></div>)}</div>;
}

const statusMeta = {
  queued: ['排队中', 'default'],
  generating: ['生成中', 'processing'],
  quality_checking: ['质检中', 'processing'],
  expanding: ['扩增中', 'processing'],
  rechecking: ['复检中', 'processing'],
  completed: ['已完成', 'success'],
  failed: ['失败', 'error'],
};

const stageOrder = ['queued', 'generating', 'quality_checking', 'expanding', 'rechecking', 'completed'];

export function customsQualityReportPageUrl(job) {
  return job?.id ? `/reports/customs/${encodeURIComponent(job.id)}/quality` : '';
}

function percent(value) {
  if (value === null || value === undefined) return '-';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

export function customsStages(values = {}) {
  return [
    '生成',
    ...(values.enablePrivacy ? ['隐私处理'] : []),
    '增强',
    ...(values.runQc ? ['质量评估'] : []),
    ...(values.enableExpansion ? ['定向扩增'] : []),
  ];
}

function PrivacyFields({ form }) {
  const enabled = Form.useWatch('enablePrivacy', form);
  const selected = Form.useWatch('privacyFields', form) || [];
  const strategies = Form.useWatch('privacyStrategies', form) || {};
  const toggle = (field, checked) => {
    const next = checked ? [...new Set([...selected, field])] : selected.filter(item => item !== field);
    form.setFieldValue('privacyFields', next);
  };
  const changeStrategy = (field, strategy) => {
    form.setFieldValue('privacyStrategies', { ...strategies, [field]: strategy });
  };
  return <Card
    size="small"
    title="隐私保护（可选）"
    className={`customs-privacy-card ${enabled ? 'enabled' : ''}`}
    extra={<Form.Item name="enablePrivacy" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="关闭"/></Form.Item>}
  >
    <Paragraph type="secondary">开启后选择需要保护的字段，并逐项配置策略；默认全部选择“随机替换”。单张样本内正文、印章、码、Ground Truth 和 JSON 强制保持一致，不做批次级一致映射。</Paragraph>
    <Form.Item name="privacyFields" hidden><input type="hidden"/></Form.Item>
    <Form.Item name="privacyStrategies" hidden><input type="hidden"/></Form.Item>
    <div className="customs-privacy-grid">
      {PRIVACY_FIELDS.map(([field, label]) => {
        const checked = selected.includes(field);
        return <div className="customs-privacy-row" key={field}>
          <Checkbox disabled={!enabled} checked={checked} onChange={event => toggle(field, event.target.checked)}>{label}</Checkbox>
          <Select
            disabled={!enabled || !checked}
            value={strategies[field] || 'random_replace'}
            options={PRIVACY_STRATEGIES}
            onChange={value => changeStrategy(field, value)}
          />
        </div>;
      })}
    </div>
    <Alert className="section-title" type="info" showIcon message="质检处置" description="隐私检查或其他质检项目未通过时统一标记为低质；原样本不重新处理、不作为扩增源，扩增阶段重新生成独立样本补量。"/>
  </Card>;
}

export function CustomsTemplateFields() {
  return <>
    <Alert
      type="info"
      showIcon
      message="选择本次合成使用的报关单模板"
      description="模板决定版式、字段位置和 Ground Truth 坐标；提交任务后会把模板版本写入参数快照。"
    />
    <Form.Item name="customsTemplateId" label="报关单模板" rules={[{ required: true, message: '请选择报关单模板' }]} className="section-title">
      <Select
        size="large"
        options={CUSTOMS_TEMPLATE_OPTIONS.map(item => ({ label: item.label, value: item.value }))}
      />
    </Form.Item>
    {CUSTOMS_TEMPLATE_OPTIONS.map(item => <Card size="small" className="customs-template-card" key={item.value}>
      <Flex justify="space-between" align="flex-start">
        <div><Text strong>{item.label}</Text><Paragraph type="secondary">{item.description}</Paragraph></div>
        <Tag color="blue">当前可用</Tag>
      </Flex>
      <Space size={[8, 8]} wrap>
        <Tag>标准进口报关单</Tag><Tag>表格字段</Tag><Tag>合成章可选</Tag><Tag>码图标注</Tag><Tag>高分辨率输出</Tag>
      </Space>
    </Card>)}
  </>;
}

export function CustomsGenerationFields({ form }) {
  const stampsEnabled = Form.useWatch('enableStamps', form);
  const textEnabled = Form.useWatch('enableQwenText', form);
  const count = Form.useWatch('count', form) || 1;
  return <>
    <Alert
      type="success"
      showIcon
      message="报关单统一 Mock 管线已就绪"
      description="纯前端模式按同一任务契约模拟合成、隐私检查、PP-OCRv5 质检和定向扩增；海关图标、Code 128、二维码、代码表、业务规则及 polygon/bbox 标注固定启用。"
    />
    <Row gutter={16} className="section-title">
      <Col span={12}>
        <Form.Item name="count" label="生成图片数" rules={[{ required: true, message: '请输入生成图片数' }]}>
          <InputNumber min={1} max={10} precision={0} style={{ width: '100%' }}/>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="seed" label="随机种子" extra="同一配置使用同一种子可复现相同结果；更换种子会生成新的内容、退化和印章选择。随机种子不会显示在图片中。" rules={[{ required: true, message: '请输入随机种子' }]}>
          <InputNumber min={1} max={2147483647} precision={0} style={{ width: '100%' }}/>
        </Form.Item>
      </Col>
    </Row>
    <PrivacyFields form={form}/>
    <Card size="small" title="合成章（可选）" className={`customs-stamp-card ${stampsEnabled ? 'enabled' : ''}`} extra={<Form.Item name="enableStamps" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="关闭"/></Form.Item>}>
      <Paragraph type="secondary">可同时勾选一种或多种。系统为每张报关单从已选类型中随机取一种；报关公司两类章位置会在右下签章区轻微变化，海关审核章使用固定位置和视觉。</Paragraph>
      <Form.Item name="stampProfiles" label="允许随机出现的章" rules={[{ validator: (_, value) => !stampsEnabled || value?.length ? Promise.resolve() : Promise.reject(new Error('启用合成章时至少选择一种章')) }]}>
        <Checkbox.Group className="customs-stamp-options" options={STAMP_OPTIONS} disabled={!stampsEnabled}/>
      </Form.Item>
      <Alert type="warning" showIcon message="安全约束" description="这里只生成带永久合成标识的训练章，不提供真实机构名称、真实印模或去除安全文字的选项。"/>
    </Card>
    <Card
      className={`customs-option-card section-title ${textEnabled ? 'enabled' : ''}`}
      title={<Space><ApiOutlined/>Qwen3-14B 受控文本（可选）</Space>}
      extra={<Form.Item name="enableQwenText" valuePropName="checked" noStyle><Switch/></Form.Item>}
    >
      <Paragraph type="secondary">只生成企业名称、存放地点、合同号、唛码和商品规格；代码、日期、金额、证件号等仍由规则生成并校验。</Paragraph>
      <Text strong>预计付费调用：{textEnabled ? count : 0} 次</Text>
    </Card>
    <Card size="small" title="固定数据契约" className="customs-contract-card">
      <Paragraph type="secondary">“固定”表示每次任务都会执行，用户无需重复配置；它定义了生成数据必须遵守的值域、业务关系、版式元素和标注方式。</Paragraph>
      <TermGrid items={CONTRACT_TERMS}/>
    </Card>
  </>;
}

export function CustomsAugmentationFields({ form }) {
  const backgroundEnabled = Form.useWatch('enableBackgroundDiffusion', form);
  const count = Form.useWatch('count', form) || 1;
  const resolutionMode = Form.useWatch('outputResolutionMode', form) || 'standard';
  const outputWidth = Form.useWatch('outputWidth', form) || 2480;
  const lockAspectRatio = Form.useWatch('lockAspectRatio', form) !== false;
  const documentScaleMode = Form.useWatch('documentScaleMode', form) || 'close';

  const applyResolutionMode = value => {
    if (value === 'standard') form.setFieldsValue({ outputWidth: 2480, outputHeight: 1754 });
    if (value === 'high') form.setFieldsValue({ outputWidth: 3508, outputHeight: 2480 });
  };
  const changeCustomWidth = value => {
    if (lockAspectRatio && value) form.setFieldValue('outputHeight', Math.round(Number(value) * 1754 / 2480));
  };
  const applyScaleMode = value => {
    const preset = { close: 94, standard: 86, distant: 76 }[value];
    if (preset) form.setFieldValue('documentContentPercent', preset);
  };
  return <>
    <Row gutter={18}>
      <Col span={12}>
        <Card className="customs-option-card enabled" title="本地文档退化与几何增强" extra={<Tag color="green">固定启用</Tag>}>
          <Paragraph type="secondary">Augraphy 模拟折痕、扫描、纸张和污渍；Albumentations 执行轻微旋转、透视及亮度变化，并同步更新 bbox/polygon。</Paragraph>
          <Space size={[6, 6]} wrap><Tag>安全算子白名单</Tag><Tag>标注同步</Tag><Tag>随机种子可复现</Tag></Space>
        </Card>
      </Col>
      <Col span={12}>
        <Card
          className={`customs-option-card ${backgroundEnabled ? 'enabled' : ''}`}
          title={<Space><FileImageOutlined/>Qwen-Image-Edit 拍照背景</Space>}
          extra={<Form.Item name="enableBackgroundDiffusion" valuePropName="checked" noStyle><Switch/></Form.Item>}
        >
          <Paragraph type="secondary">模型只接收“桌面＋空白纸张”占位图。完整报关单在本地透视贴回，模型无法改写文字、码或印章。</Paragraph>
          <Text strong>预计付费调用：{backgroundEnabled ? count : 0} 次</Text>
        </Card>
      </Col>
    </Row>
    <Card className="section-title" size="small" title="扩散成品精度与内容占比">
      <Paragraph type="secondary">扩散模型只生成背景。背景先适配到正式画布，原始 2480×1754 报关单再以高分辨率一次投影；模型返回的小背景不会作为训练成品。</Paragraph>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="outputResolutionMode" label="输出精度">
            <Select disabled={!backgroundEnabled} options={OUTPUT_RESOLUTION_OPTIONS} onChange={applyResolutionMode}/>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="documentScaleMode" label="原始内容占比">
            <Select disabled={!backgroundEnabled} options={DOCUMENT_SCALE_OPTIONS} onChange={applyScaleMode}/>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="lockAspectRatio" label="模板宽高比" valuePropName="checked">
            <Switch disabled={!backgroundEnabled || resolutionMode !== 'custom'} checkedChildren="已锁定" unCheckedChildren="未锁定" onChange={checked => {
              if (checked) form.setFieldValue('outputHeight', Math.round(Number(form.getFieldValue('outputWidth') || 2480) * 1754 / 2480));
            }}/>
          </Form.Item>
        </Col>
      </Row>
      {resolutionMode === 'custom' && <Row gutter={16}>
        <Col span={12}><Form.Item name="outputWidth" label="自定义宽度" rules={[{ type: 'number', min: 1600, max: 4096, message: '宽度必须在1600～4096px之间' }]}><InputNumber disabled={!backgroundEnabled} min={1600} max={4096} precision={0} addonAfter="px" style={{ width: '100%' }} onChange={changeCustomWidth}/></Form.Item></Col>
        <Col span={12}><Form.Item name="outputHeight" label="自定义高度" rules={[{ type: 'number', min: 1000, max: 4096, message: '高度必须在1000～4096px之间' }]}><InputNumber disabled={!backgroundEnabled || lockAspectRatio} min={1000} max={4096} precision={0} addonAfter="px" style={{ width: '100%' }}/></Form.Item></Col>
      </Row>}
      {documentScaleMode === 'custom' && <Form.Item name="documentContentPercent" label="自定义原始内容线性占比" rules={[{ type: 'number', min: 70, max: 96, message: '占比必须在70%～96%之间' }]}><InputNumber disabled={!backgroundEnabled} min={70} max={96} precision={0} addonAfter="%"/></Form.Item>}
      {backgroundEnabled && Number(outputWidth) < 2480 && <Alert type="warning" showIcon message="小字段识别精度可能下降" description="当前输出宽度低于2480px，建议使用标准精度或提高原始内容占比。"/>}
      <Alert type="info" showIcon message="正式成品与预览分离" description="1216×864 等模型返回尺寸仅作为背景审计或页面预览参考；训练图片以这里选择的最终尺寸为准。"/>
    </Card>
    {backgroundEnabled && <Alert className="section-title" type="warning" showIcon message={`纯前端模式会模拟最多 ${count} 次背景生成调用；不会发送 API 请求或读取真实 API Key。`}/>} 
  </>;
}

export function CustomsQualityFields({ form }) {
  const runQc = Form.useWatch('runQc', form);
  const enableVlm = Form.useWatch('enableVlmReview', form);
  const enableExpansion = Form.useWatch('enableExpansion', form);
  const count = Form.useWatch('count', form) || 1;
  const selectedVlmTags = Form.useWatch('vlmVisualTags', form) || [];
  const [vlmTagCatalog, setVlmTagCatalog] = useState([]);
  useEffect(() => {
    let active = true;
    customsApi.vlmTags().then(value => {
      if (!active) return;
      setVlmTagCatalog(value.items || []);
      if (form.getFieldValue('vlmVisualTags') == null) {
        form.setFieldValue('vlmVisualTags', value.default_selected || []);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [form]);
  return <>
    <Card size="small" title="PP-OCRv5 本地质检" extra={<Form.Item name="runQc" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Paragraph type="secondary">把 Ground Truth 与 OCR 结果逐字段对照，同时检查隐私处理、图像质量和标注几何；任一项目未通过都标为低质。</Paragraph>
      <Tag color={runQc ? 'green' : 'default'}>{runQc ? '已启用 · CPU本地运行' : '未启用'}</Tag>
      <TermGrid items={OCR_TERMS}/>
    </Card>
    <Row gutter={18} className="section-title">
      <Col span={12}>
        <Card
          className={`customs-option-card ${enableVlm ? 'enabled' : ''}`}
          title="Qwen3-VL-8B 第二路复核"
          extra={<Form.Item name="enableVlmReview" valuePropName="checked" noStyle><Switch disabled={!runQc}/></Form.Item>}
        >
          <Paragraph type="secondary">只能降级本地判定，不能把 REVIEW/REJECT 升为 PASS，也不用于鉴定真实印章。</Paragraph>
          <Text strong>预计付费调用：{runQc && enableVlm ? count : 0} 次</Text>
        </Card>
      </Col>
      <Col span={12}>
        <Card
          className={`customs-option-card ${enableExpansion ? 'enabled' : ''}`}
          title="质检驱动安全扩增"
          extra={<Form.Item name="enableExpansion" valuePropName="checked" noStyle><Switch disabled={!runQc}/></Form.Item>}
        >
          <Paragraph type="secondary">隐私或其他质检失败时隔离低质样本并重新合成新样本补量；全部合格时才从 PASS 样本选择安全 Profile 增加受控难度覆盖。</Paragraph>
          <div className="customs-expansion-flow"><Tag color="blue">1 定位弱项</Tag><span>→</span><Tag color="orange">2 白名单扩增</Tag><span>→</span><Tag color="green">3 重新质检</Tag></div>
          <Alert type="info" showIcon message="低质不返工" description="低质样本不会继续加噪或重新脱敏；系统生成独立替代样本。新样本不会继承原图结论，必须重新走 OCR、隐私、几何和图片质量检查。"/>
          <Form.Item
            name="maxNewImages"
            label="最大新增图片数"
            rules={[{
              validator: (_, value) => Number(count) + Number(value || 0) <= 20
                ? Promise.resolve()
                : Promise.reject(new Error('原始图片与新增图片合计不得超过20张')),
            }]}
          >
            <InputNumber min={0} max={10} disabled={!runQc || !enableExpansion}/>
          </Form.Item>
        </Card>
      </Col>
    </Row>
    <Card size="small" className="section-title" title="VLM 视觉标签">
      <Paragraph type="secondary">
        Qwen-VL 只判断已勾选标签；取消的标签不进入模型提示词，也不参与后续覆盖统计。可按本批文档需要取舍。
      </Paragraph>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
        <Text>已选择 {selectedVlmTags.length} / {vlmTagCatalog.length || DEFAULT_VLM_VISUAL_TAGS.length} 项</Text>
        <Space>
          <Button size="small" disabled={!runQc || !enableVlm} onClick={() => form.setFieldValue('vlmVisualTags', vlmTagCatalog.map(item => item.id))}>全选</Button>
          <Button size="small" disabled={!runQc || !enableVlm} onClick={() => form.setFieldValue('vlmVisualTags', [])}>清空</Button>
        </Space>
      </Flex>
      <Form.Item name="vlmVisualTags" noStyle>
        <Checkbox.Group disabled={!runQc || !enableVlm} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            {vlmTagCatalog.map(item => <Col xs={24} md={12} lg={8} key={item.id}>
              <Checkbox value={item.id}>
                <Text strong>{item.name}</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text></div>
              </Checkbox>
            </Col>)}
          </Row>
        </Checkbox.Group>
      </Form.Item>
      {!enableVlm && <Alert style={{ marginTop: 12 }} type="info" showIcon message="开启 Qwen3-VL-8B 第二路复核后可配置标签"/>}
    </Card>
  </>;
}

function buildPayload(form) {
  const values = form.getFieldsValue(true);
  return {
    template_id: values.syntheticDocumentTemplateId || values.customsTemplateId || 'customs_import_standard_v1',
    template_version: values.syntheticDocumentTemplateVersion || 'V1',
    count: Number(values.count),
    seed: Number(values.seed),
    enable_stamps: Boolean(values.enableStamps),
    stamp_profiles: values.enableStamps ? (values.stampProfiles || []) : [],
    enable_privacy: Boolean(values.enablePrivacy),
    privacy_field_strategies: values.enablePrivacy
      ? Object.fromEntries((values.privacyFields || []).map(field => [field, values.privacyStrategies?.[field] || 'random_replace']))
      : {},
    enable_qwen_text: Boolean(values.enableQwenText),
    enable_background_diffusion: Boolean(values.enableBackgroundDiffusion),
    output_resolution_mode: values.outputResolutionMode || 'standard',
    output_width: Number(values.outputWidth || 2480),
    output_height: Number(values.outputHeight || 1754),
    lock_aspect_ratio: values.lockAspectRatio !== false,
    document_scale_mode: values.documentScaleMode || 'close',
    document_content_scale: Number(values.documentContentPercent || 94) / 100,
    run_qc: Boolean(values.runQc),
    enable_vlm_review: Boolean(values.runQc && values.enableVlmReview),
    vlm_visual_tags: values.vlmVisualTags || [],
    enable_expansion: Boolean(values.runQc && values.enableExpansion),
    max_new_images: values.runQc && values.enableExpansion ? Number(values.maxNewImages || 0) : 0,
  };
}

export async function createCustomsBackendJob(form) {
  await form.validateFields([
    'count', 'seed', 'stampProfiles', 'maxNewImages',
    'outputWidth', 'outputHeight', 'documentContentPercent',
  ]);
  const values = form.getFieldsValue(true);
  if (values.enablePrivacy && !(values.privacyFields || []).length) {
    throw new Error('开启隐私保护后至少选择一个字段');
  }
  return customsApi.createJob(buildPayload(form));
}

function JobMetrics({ job }) {
  const qc = job?.result?.qc_summary;
  const generation = job?.result?.generation_summary;
  const statusCounts = qc?.status_counts || {};
  const privacy = qc?.privacy || {};
  return <>
    <Row gutter={[12, 12]} className="customs-result-metrics">
      <Col span={6}><Card size="small"><Statistic title="生成样本" value={generation?.sample_count ?? '-'} suffix="张"/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="合格样本" value={statusCounts.PASS ?? 0}/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="低质样本" value={qc?.low_quality_count ?? 0}/></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="隐私失败" value={privacy.failed_sample_count ?? 0}/></Card></Col>
    </Row>
    {qc && <Descriptions bordered size="small" column={4} items={[
      { key: 'cer', label: 'CER', children: qc.ocr_averages?.cer?.toFixed?.(4) ?? '-' },
      { key: 'exact', label: '字段完全一致率', children: percent(qc.ocr_averages?.field_exact_rate) },
      { key: 'numeric', label: '数字代码准确率', children: percent(qc.ocr_averages?.numeric_code_accuracy) },
      { key: 'coverage', label: '检测覆盖率', children: percent(qc.ocr_averages?.detection_coverage) },
    ]}/>} 
  </>;
}

export function CustomsRunPanel({ form, job, setJob }) {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState('');
  const terminal = job?.status === 'completed' || job?.status === 'failed';

  useEffect(() => {
    let active = true;
    customsApi.health().then(value => { if (active) { setHealth(value); setHealthError(''); } })
      .catch(error => { if (active) setHealthError(error.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!job?.id || terminal) return undefined;
    const timer = window.setTimeout(() => {
      customsApi.getJob(job.id).then(setJob).catch(error => {
        setJob(current => ({ ...current, status: 'failed', error: error.message }));
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [job, setJob, terminal]);

  const start = async () => {
    try {
      const created = await createCustomsBackendJob(form);
      setJob(created);
      message.success('报关单 MVP 任务已提交');
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || '任务提交失败');
    }
  };

  const stageIndex = useMemo(() => {
    if (!job) return -1;
    if (job.status === 'failed') return Math.max(0, stageOrder.indexOf(job.stage));
    return Math.max(0, stageOrder.indexOf(job.status));
  }, [job]);
  const [statusLabel, badgeStatus] = statusMeta[job?.status] || ['未启动', 'default'];
  const textFallbacks = job?.result?.generation_summary?.bailian?.text_generation?.fallbacks || 0;
  const imageFallbacks = job?.result?.generation_summary?.bailian?.image_edit?.fallbacks || 0;
  const modelFallbacks = textFallbacks + imageFallbacks;
  const scene = job?.result?.scene_configuration;
  const readability = job?.result?.qc_summary?.readability;
  const readabilityWarnings = readability?.affected_sample_count || 0;

  return <>
    {health ? <Alert
      type={health.ready ? 'success' : 'warning'}
      showIcon
      message={health.ready ? '本地报关单 Mock 可用' : 'Mock 已连接，但样例环境不完整'}
      description={<Space size={[8, 8]} wrap>
        <Tag color={health.components?.synthesis ? 'green' : 'red'}>合成环境</Tag>
        <Tag color={health.components?.ocr ? 'green' : 'red'}>PP-OCRv5</Tag>
        <Tag color={health.components?.models ? 'green' : 'red'}>OCR模型</Tag>
        <Tag color={health.components?.api_key ? 'green' : 'default'}>百炼密钥</Tag>
        <Text type="secondary">{health.pipeline_variant}</Text>
      </Space>}
    /> : healthError ? <Alert type="error" showIcon message="无法加载本地 Mock" description={healthError}/> : <Spin tip="正在检查本地 Mock"><div className="health-loading"/></Spin>}

    <Flex justify="space-between" align="center" className="customs-run-toolbar">
      <div>
        <Title level={5}>运行验证</Title>
        <Text type="secondary">真实执行当前配置；重复点击会创建新的独立任务。</Text>
      </div>
      <Button type="primary" size="large" icon={<PlayCircleOutlined/>} disabled={!health?.ready || (job && !terminal)} onClick={start}>
        {job && !terminal ? '执行中' : job ? '重新运行' : '启动 MVP'}
      </Button>
    </Flex>

    {job && <Card className="customs-job-card" title={<Space><CloudServerOutlined/><Text strong>{job.id}</Text><Badge status={badgeStatus} text={statusLabel}/></Space>}>
      <Progress percent={job.progress || 0} status={job.status === 'failed' ? 'exception' : job.status === 'completed' ? 'success' : 'active'}/>
      <Steps size="small" current={stageIndex} status={job.status === 'failed' ? 'error' : 'process'} items={[
        { title: '排队' }, { title: '生成' }, { title: '质检' }, { title: '扩增' }, { title: '复检' }, { title: '完成' },
      ]}/>
      {job.message && <Alert className="section-title" type="info" showIcon message={job.message}/>} 
      {job.error && <Alert className="section-title" type="error" showIcon message="任务执行失败" description={job.error}/>} 
      {job.status === 'completed' && <>
        <Divider/>
        {modelFallbacks > 0 && <Alert
          className="section-title"
          type="warning"
          showIcon
          message="可选百炼增强已安全回退"
          description={`文本回退 ${textFallbacks} 次，背景扩散回退 ${imageFallbacks} 次；本地合成、隐私处理和后续质检仍正常完成。`}
        />}
        {(scene?.warnings?.length > 0 || readabilityWarnings > 0) && <Alert
          className="section-title"
          type="warning"
          showIcon
          message="分辨率或字段高度需要关注"
          description={[...(scene?.warnings || []), readabilityWarnings ? `${readabilityWarnings} 张图片的字段高度建议值未满足，请提高分辨率或内容占比。` : ''].filter(Boolean).join('；')}
        />}
        <JobMetrics job={job}/>
        <Row gutter={20} className="section-title">
          <Col span={12}>
            {job.result?.preview_url ? <Image className="customs-preview-image" src={job.result.preview_url} alt="生成的进口报关单"/> : <Alert message="没有可用预览图"/>}
          </Col>
          <Col span={12}>
            <Descriptions bordered size="small" column={1} items={[
              { key: 'variant', label: '管线版本', children: health?.pipeline_variant || 'customs_modular_monolith/v1' },
              { key: 'privacy', label: '隐私保护', children: job.result?.privacy?.enabled_sample_count ? `已启用 · ${job.result.privacy.action_count || 0} 项处理` : '未启用' },
              { key: 'stamp', label: '合成章', children: job.result?.stamps_enabled === false ? '未启用' : job.result?.stamp_profiles?.join('、') || '未记录' },
              { key: 'resolution', label: '正式成品尺寸', children: scene?.enabled ? `${scene.output_size?.width}×${scene.output_size?.height}` : '未启用拍照背景' },
              { key: 'scale', label: '原始内容占比', children: scene?.enabled ? `${Math.round(Number(scene.document_content_scale || 0) * 100)}%` : '-' },
              { key: 'background', label: '背景原始尺寸', children: scene?.enabled ? Object.keys(scene.runtime_summary?.background_source_size_counts || {}).join('、') || '未记录' : '-' },
              { key: 'expansion', label: '扩增', children: job.result?.expansion?.message || '未执行' },
              { key: 'report', label: '质检报告', children: job.result?.quality_report_url ? <a href={customsQualityReportPageUrl(job)} target="_blank" rel="noreferrer">打开可视化报告</a> : '未生成' },
            ]}/>
          </Col>
        </Row>
      </>}
    </Card>}
  </>;
}

export function CustomsResultSummary({ job }) {
  if (!job) return <Alert type="warning" showIcon message="尚未运行报关单 MVP，请返回上一步启动任务。"/>;
  if (job.status !== 'completed') return <Alert type={job.status === 'failed' ? 'error' : 'info'} showIcon message={`当前任务状态：${statusMeta[job.status]?.[0] || job.status}`} description={job.error || job.message}/>;
  return <Card className="customs-result-summary" title={<Space><CheckCircleOutlined className="success"/>Mock 任务产物</Space>}>
    <JobMetrics job={job}/>
    <Descriptions bordered size="small" column={2} className="section-title" items={[
      { key: 'job', label: 'Mock 任务 ID', children: job.id },
      { key: 'samples', label: '生成样本', children: `${job.result?.generation_summary?.sample_count || 0} 张` },
      { key: 'qc', label: '质检', children: job.result?.qc_summary ? '已完成' : '未执行' },
      { key: 'resolution', label: '正式成品尺寸', children: job.result?.scene_configuration?.enabled ? `${job.result.scene_configuration.output_size?.width}×${job.result.scene_configuration.output_size?.height}` : '未启用拍照背景' },
      { key: 'scale', label: '原始内容占比', children: job.result?.scene_configuration?.enabled ? `${Math.round(Number(job.result.scene_configuration.document_content_scale || 0) * 100)}%` : '-' },
      { key: 'expand', label: '扩增', children: job.result?.expansion?.message || '未执行' },
    ]}/>
  </Card>;
}

export function CustomsTaskDetail({ job }) {
  if (!job) return null;
  const scene = job.result?.scene_configuration;
  const result = job.result || {};
  const generation = result.generation_summary;
  const qc = result.qc_summary;
  const hasActualResult = Boolean(generation || qc || result.preview_url);
  const [statusLabel] = statusMeta[job.status] || [job.status || '未知状态'];
  const statusType = job.status === 'failed' ? 'error' : job.status === 'completed' ? 'success' : 'info';
  const textFallbacks = generation?.bailian?.text_generation?.fallbacks || 0;
  const imageFallbacks = generation?.bailian?.image_edit?.fallbacks || 0;
  return <>
    <Alert
      type={statusType}
      showIcon
      message={`Mock 任务${statusLabel}`}
      description={job.error || job.message || '等待 Mock 返回执行结果'}
    />
    {!hasActualResult ? <Alert className="section-title" type="info" showIcon message="运行结果将在对应阶段完成后自动出现" description="数据合成完成后先展示预览和生成统计；质检、扩增及复检完成后继续补充指标和报告。"/> : <>
      {(textFallbacks > 0 || imageFallbacks > 0) && <Alert className="section-title" type="warning" showIcon message="可选百炼能力已安全回退" description={`文本回退 ${textFallbacks} 次，背景扩散回退 ${imageFallbacks} 次；本地结果继续执行。`}/>} 
      <Divider orientation="left">实际指标</Divider>
      <JobMetrics job={job}/>
      <Row gutter={20} className="section-title">
        <Col span={11}>
          {result.preview_url ? <Image className="customs-drawer-preview" src={result.preview_url} alt="报关单任务预览"/> : <Alert message="生成阶段尚未提供预览图"/>}
        </Col>
        <Col span={13}>
          <Descriptions bordered size="small" column={1} items={[
            { key: 'job', label: 'Mock 任务 ID', children: job.id },
            { key: 'variant', label: '管线版本', children: 'customs_modular_monolith/v1' },
            { key: 'samples', label: '生成样本', children: generation ? `${generation.sample_count || 0} 张` : '生成中' },
            { key: 'qc', label: '质检', children: qc ? '已完成' : job.parameters?.run_qc ? '执行中或等待中' : '未启用' },
            { key: 'privacy', label: '隐私保护', children: result.privacy?.enabled_sample_count ? `已启用 · ${result.privacy.action_count || 0} 项处理` : '未启用' },
            { key: 'stamp', label: '合成章', children: result.stamps_enabled === false ? '未启用' : result.stamp_profiles?.join('、') || '生成中或未记录' },
            { key: 'resolution', label: '正式成品尺寸', children: scene?.enabled ? `${scene.output_size?.width}×${scene.output_size?.height}` : '未启用拍照背景' },
            { key: 'scale', label: '原始内容占比', children: scene?.enabled ? `${Math.round(Number(scene.document_content_scale || 0) * 100)}%` : '-' },
            { key: 'background', label: '背景原始尺寸', children: scene?.enabled ? Object.keys(scene.runtime_summary?.background_source_size_counts || {}).join('、') || '未记录' : '-' },
            { key: 'expansion', label: '扩增', children: result.expansion?.message || (job.parameters?.enable_expansion ? '等待质检结论' : '未启用定向扩增') },
            { key: 'report', label: '质检报告', children: result.quality_report_url ? <a href={customsQualityReportPageUrl(job)} target="_blank" rel="noreferrer">打开可视化报告</a> : '未生成' },
          ]}/>
        </Col>
      </Row>
      <Space wrap>
        {result.quality_report_url && <Button href={customsQualityReportPageUrl(job)} target="_blank" icon={<SafetyCertificateOutlined/>}>查看可视化质检报告</Button>}
        {result.comparison_report_url && <Button href={result.comparison_report_url} target="_blank">查看扩增前后对比</Button>}
      </Space>
    </>}
  </>;
}
