import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Empty, Flex, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Steps, Table, Tag, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, DeleteOutlined,
  ExperimentOutlined, FileProtectOutlined, LeftOutlined, PlusOutlined, SaveOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { syntheticTemplateApi } from '../syntheticTemplateApi';
import {
  DATA_TYPE_OPTIONS, FALLBACK_CATALOG, GENERATOR_OPTIONS, defaultFields,
} from './catalog';
import SyntheticTemplatePreview from './SyntheticTemplatePreview';
import './syntheticTemplate.css';

const { Title, Text, Paragraph } = Typography;

const STEP_ITEMS = [
  { title: '类型与版式', description: '业务语义与结构' },
  { title: '视觉主题', description: '配色与安全 Logo' },
  { title: '字段与规则', description: '内容生成契约' },
  { title: '试运行与发布', description: '生成、质检与发布' },
];

const INITIAL_VALUES = {
  name: '',
  businessType: '',
  description: '',
  documentType: 'customs',
  contentSubtype: 'purchase_agreement',
  layoutPresetId: 'customs_landscape_v1',
  themeId: 'ocean_blue',
  logoId: 'orbit_grid',
  logoPosition: 'top_left',
  primaryColor: '#2457A7',
  accentColor: '#EAF1FB',
  seed: 20260827,
  confirmSynthetic: false,
};

function mergeCatalog(value) {
  if (!value || typeof value !== 'object') return FALLBACK_CATALOG;
  const normalizeDocumentType = item => ({
    ...item,
    value: item.value || item.id || item.document_type,
    label: item.label || item.name || item.value || item.id,
    canvas: item.canvas || (item.width && item.height ? { width:item.width, height:item.height } : undefined),
  });
  const normalizeLayout = item => ({
    ...item,
    id: item.id || item.value || item.preset_id,
    document_type: item.document_type || item.type,
    name: item.name || item.label || item.id,
    columns: item.columns || item.column_count || 1,
  });
  const normalizeTheme = item => ({
    ...item,
    id: item.id || item.value,
    name: item.name || item.label || item.id,
    primary_color: item.primary_color || item.primary,
    accent_color: item.accent_color || item.secondary,
    border_color: item.border_color || item.border || item.primary_color || item.primary,
  });
  const normalizeLogo = item => ({
    ...item,
    id: item.id || item.value,
    name: item.name || item.label || item.id,
    glyph: item.glyph || item.mark || '合',
    safety_text: item.safety_text || (item.id === 'none' ? '' : 'SYNTHETIC'),
  });
  return {
    ...FALLBACK_CATALOG,
    ...value,
    document_types: (value.document_types?.length ? value.document_types : FALLBACK_CATALOG.document_types).map(normalizeDocumentType),
    layout_presets: (value.layout_presets?.length ? value.layout_presets : FALLBACK_CATALOG.layout_presets).map(normalizeLayout),
    themes: (value.themes?.length ? value.themes : FALLBACK_CATALOG.themes).map(normalizeTheme),
    logos: (value.logos?.length ? value.logos : FALLBACK_CATALOG.logos).map(normalizeLogo),
    content_subtypes: { ...FALLBACK_CATALOG.content_subtypes, ...(value.content_subtypes || {}) },
  };
}

function cloneFields(value) {
  return JSON.parse(JSON.stringify(value || []));
}

function documentLabel(catalog, value) {
  return catalog.document_types.find(item => item.value === value)?.label || value;
}

function normalizeTrial(response) {
  const trial = response?.trial || response || {};
  const quality = response?.quality || trial.quality || trial.quality_result || {};
  const urls = { ...(trial.urls || {}), ...(response?.urls || {}) };
  const status = quality.status || quality.quality_status || trial.quality_status || trial.status || 'COMPLETED';
  const image = urls.image || urls.preview || urls.trial_image || trial.image_url || response?.image_url || '';
  const report = urls.quality_report || urls.report || trial.report_url || '';
  return { ...trial, quality, urls, status, image, report };
}

function LogoOption({ item, selected, color, onClick }) {
  return <Card hoverable size="small" onClick={onClick} className={`fictional-choice-card fictional-logo-choice ${selected ? 'is-selected' : ''}`}>
    <div className="fictional-logo-preview" style={{ '--logo-color': color }}><b>{item.glyph || '合'}</b></div>
    <div><Text strong>{item.name}</Text><br/><Text type="secondary">{item.id === 'none' ? '模板不放置品牌图形' : `${item.safety_text || 'SYNTHETIC'} · 安全虚构素材`}</Text></div>
  </Card>;
}

export function SyntheticDocumentTemplateCreatePage({ onBack, onPublished }) {
  const [form] = Form.useForm();
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [serviceReady, setServiceReady] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [fields, setFields] = useState(() => defaultFields('customs'));
  const [draftId, setDraftId] = useState('');
  const [draftRevision, setDraftRevision] = useState(null);
  const [dirty, setDirty] = useState(true);
  const [action, setAction] = useState('');
  const [trial, setTrial] = useState(null);
  const [published, setPublished] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([syntheticTemplateApi.health(), syntheticTemplateApi.catalog()]).then(([healthResult, catalogResult]) => {
      if (!active) return;
      if (catalogResult.status === 'fulfilled') {
        const nextCatalog = mergeCatalog(catalogResult.value);
        setCatalog(nextCatalog);
        const selectedType = form.getFieldValue('documentType') || INITIAL_VALUES.documentType;
        const selectedPreset = nextCatalog.layout_presets.find(item => item.document_type === selectedType);
        const selectedTheme = nextCatalog.themes.find(item => item.id === form.getFieldValue('themeId')) || nextCatalog.themes[0];
        const selectedLogo = nextCatalog.logos.find(item => item.id === form.getFieldValue('logoId')) || nextCatalog.logos[0];
        const patch = {
          layoutPresetId: selectedPreset?.id,
          themeId: selectedTheme?.id,
          logoId: selectedLogo?.id,
          primaryColor: selectedTheme?.primary_color,
          accentColor: selectedTheme?.accent_color,
        };
        form.setFieldsValue(patch);
        setValues(current => ({ ...current, ...patch }));
      }
      if (healthResult.status === 'fulfilled' && healthResult.value?.ready !== false) {
        setServiceReady(true);
        setServiceError('');
      } else {
        const reason = healthResult.status === 'rejected' ? healthResult.reason?.message : '服务尚未就绪';
        setServiceError(reason || '服务尚未就绪');
      }
    });
    return () => { active = false; };
  }, []);

  const documentType = values.documentType;
  const contentSubtype = values.contentSubtype;
  const currentType = catalog.document_types.find(item => item.value === documentType) || catalog.document_types[0];
  const currentTheme = catalog.themes.find(item => item.id === values.themeId) || catalog.themes[0];
  const layoutOptions = useMemo(() => catalog.layout_presets.filter(item => item.document_type === documentType), [catalog, documentType]);
  const subtypeOptions = catalog.content_subtypes?.contract || [];
  const trialImageUrl = trial?.image ? syntheticTemplateApi.artifactUrl(trial.image) : '';

  const markChanged = () => {
    setDirty(true);
    setTrial(null);
    setPublished(null);
  };

  const changeDocumentType = value => {
    const nextType = catalog.document_types.find(item => item.value === value) || FALLBACK_CATALOG.document_types[0];
    const nextPreset = catalog.layout_presets.find(item => item.document_type === value);
    const nextSubtype = catalog.content_subtypes?.[value]?.[0]?.value || (value === 'contract' ? 'purchase_agreement' : '');
    const patch = { documentType: value, layoutPresetId: nextPreset?.id, contentSubtype: nextSubtype };
    form.setFieldsValue(patch);
    setValues(current => ({ ...current, ...patch }));
    setFields(defaultFields(value, nextSubtype));
    markChanged();
  };

  const changeSubtype = value => {
    form.setFieldValue('contentSubtype', value);
    setValues(current => ({ ...current, contentSubtype: value }));
    setFields(defaultFields('contract', value));
    markChanged();
  };

  const changeTheme = theme => {
    const patch = { themeId: theme.id, primaryColor: theme.primary_color, accentColor: theme.accent_color };
    form.setFieldsValue(patch);
    setValues(current => ({ ...current, ...patch }));
    markChanged();
  };

  const changeField = (id, patch) => {
    setFields(items => items.map(item => item.id === id ? {
      ...item,
      ...patch,
      generator: patch.generator ? { ...item.generator, ...patch.generator } : item.generator,
    } : item));
    markChanged();
  };

  const addField = () => {
    const id = `field_${Date.now()}`;
    setFields(items => [...items, {
      id, name: '新字段', data_type: 'text', required: true, sample_text: '示例内容',
      generator: { type: 'llm_prompt', rule: '生成明确虚构且符合字段语义的内容', prompt: '生成明确虚构且符合字段语义的内容', dictionary: '' },
      quality_rule: { version: 'field-quality-rule/v1', required: true, checks: [{ type: 'required', message: '字段不能为空' }], cross_field_checks: [] },
    }]);
    markChanged();
  };

  const removeField = id => {
    setFields(items => items.filter(item => item.id !== id));
    markChanged();
  };

  const configuration = () => {
    const currentValues = { ...values, ...form.getFieldsValue(true) };
    const type = catalog.document_types.find(item => item.value === currentValues.documentType) || currentType;
    return {
      schema_version: 'fictional-template-draft/v1',
      name: currentValues.name,
      document_type: currentValues.documentType,
      business_type: type?.label || currentValues.documentType,
      content_subtype: currentValues.documentType === 'contract' ? currentValues.contentSubtype : null,
      layout_preset_id: currentValues.layoutPresetId,
      theme_id: currentValues.themeId,
      logo_id: currentValues.logoId,
      seed: Number(currentValues.seed),
      canvas: type?.canvas,
      fields: cloneFields(fields),
      design: {
        primary_color: currentValues.primaryColor,
        accent_color: currentValues.accentColor,
        logo_position: currentValues.logoPosition,
      },
      safety: {
        fictional_only: true,
        synthetic_watermark_required: true,
        official_marks_forbidden: true,
        real_entity_data_forbidden: true,
        machine_code_prefix: 'SYNTHETIC:',
      },
    };
  };

  const persist = async () => {
    const payload = configuration();
    const response = draftId
      ? await syntheticTemplateApi.saveDraft(draftId, { ...payload, expected_revision: draftRevision })
      : await syntheticTemplateApi.createDraft(payload);
    const record = response?.draft || response?.template || response;
    const nextId = response?.job_id || response?.job?.id || response?.id || record?.job_id || record?.id || draftId;
    if (!nextId) throw new Error('Mock 服务未返回模板制作任务 ID，无法继续试运行');
    setDraftId(nextId);
    setDraftRevision(response?.revision ?? record?.revision ?? draftRevision);
    setDirty(false);
    return { response, draftId: nextId };
  };

  const save = async () => {
    setAction('save');
    try {
      await form.validateFields(['name', 'documentType', 'layoutPresetId']);
      await persist();
      setServiceReady(true); setServiceError('');
      message.success('虚构模板草稿已保存');
    } catch (error) {
      if (!error?.errorFields) {
        setServiceError(error.message);
        message.error(`草稿保存失败：${error.message}`);
      }
    } finally { setAction(''); }
  };

  const runTrial = async () => {
    setAction('trial');
    try {
      await form.validateFields();
      if (!fields.length || fields.some(item => !item.name?.trim() || !item.generator?.rule?.trim())) throw new Error('请补全所有字段名称和生成规则');
      const saved = await persist();
      const response = await syntheticTemplateApi.trial(saved.draftId);
      const normalized = normalizeTrial(response);
      setTrial(normalized); setServiceReady(true); setServiceError('');
      message[normalized.status === 'REJECT' ? 'warning' : 'success'](`试运行完成：${normalized.status}`);
    } catch (error) {
      if (!error?.errorFields) {
        setServiceError(error.message);
        message.error(`试运行生成或质检失败：${error.message}`);
      }
    } finally { setAction(''); }
  };

  const publish = async () => {
    if (!draftId || dirty || !trial || trial.status === 'REJECT') return;
    setAction('publish');
    try {
      const response = await syntheticTemplateApi.publish(draftId);
      const result = response?.template || response;
      const publishedValue = {
        template_id: response?.template_id || result?.template_id,
        version: response?.version || result?.version || 'V1',
        template: result,
        urls: response?.urls || {},
      };
      setPublished(publishedValue);
      message.success(`${publishedValue.template_id || '虚构模板'} / ${publishedValue.version} 已发布`);
      onPublished?.(publishedValue);
    } catch (error) {
      setServiceError(error.message);
      message.error(`模板发布失败：${error.message}`);
    } finally { setAction(''); }
  };

  const next = async () => {
    try {
      if (step === 0) await form.validateFields(['name', 'businessType', 'description', 'documentType', 'contentSubtype', 'layoutPresetId', 'seed']);
      if (step === 1) await form.validateFields(['themeId', 'logoId', 'logoPosition', 'primaryColor', 'accentColor']);
      if (step === 2 && (!fields.length || fields.some(item => !item.name?.trim() || !item.generator?.rule?.trim()))) throw new Error('请补全所有字段名称和生成规则');
      setStep(value => Math.min(STEP_ITEMS.length - 1, value + 1));
    } catch (error) {
      message.warning(error.message || '请完成当前步骤的必填配置');
    }
  };

  const fieldColumns = [
    { title: '字段名称', width: 150, render: (_, row) => <Input value={row.name} maxLength={40} onChange={event => changeField(row.id, { name: event.target.value })}/> },
    { title: '数据类型', width: 132, render: (_, row) => <Select showSearch optionFilterProp="label" value={row.data_type} options={DATA_TYPE_OPTIONS} onChange={value => changeField(row.id, { data_type: value })}/> },
    { title: '生成方式', width: 132, render: (_, row) => <Select value={row.generator?.type} options={GENERATOR_OPTIONS} onChange={value => changeField(row.id, { generator: { type: value } })}/> },
    { title: '示例值', width: 180, render: (_, row) => <Input value={row.sample_text} onChange={event => changeField(row.id, { sample_text: event.target.value })}/> },
    { title: '生成规则 / Prompt', render: (_, row) => <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} value={row.generator?.rule} onChange={event => changeField(row.id, { generator: { rule: event.target.value, prompt: row.generator?.type === 'llm_prompt' ? event.target.value : row.generator?.prompt } })}/> },
    { title: '必填', width: 66, align: 'center', render: (_, row) => <Switch size="small" checked={row.required} onChange={checked => changeField(row.id, { required: checked, quality_rule: { ...row.quality_rule, required: checked } })}/> },
    { title: '', width: 44, render: (_, row) => <Popconfirm title="删除字段？" description="删除后可通过重新选择文档类型恢复系统默认字段。" onConfirm={() => removeField(row.id)}><Button type="text" danger icon={<DeleteOutlined/>}/></Popconfirm> },
  ];

  const typeAndLayout = <Row gutter={18}>
    <Col span={13}>
      <Card size="small" title="基本信息" className="fictional-config-card">
        <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }, { max: 80 }]}><Input placeholder="例如：国内运单虚构训练模板 V1"/></Form.Item>
        <Form.Item name="businessType" label="业务类型" rules={[{required:true,whitespace:true,message:'请输入业务类型'}]}><Input placeholder="例如：物流运单"/></Form.Item>
        <Form.Item name="description" label="模板说明" rules={[{max:500}]}><Input.TextArea rows={2} maxLength={500} showCount/></Form.Item>
        <div className="fictional-field-label">文档类型</div>
        <div className="fictional-type-grid">{catalog.document_types.map(item => <Card key={item.value} hoverable size="small" onClick={() => changeDocumentType(item.value)} className={`fictional-choice-card ${documentType === item.value ? 'is-selected' : ''}`}><Text strong>{item.label}</Text><Paragraph type="secondary">{item.description}</Paragraph><Tag>{item.canvas?.width}×{item.canvas?.height}</Tag></Card>)}</div>
        {documentType === 'contract' && <Form.Item name="contentSubtype" label="合同内容类型" rules={[{ required: true }]}><Select options={subtypeOptions} onChange={changeSubtype}/></Form.Item>}
        <div className="fictional-field-label">默认版式</div>
        <div>{layoutOptions.map(item => <Card key={item.id} hoverable size="small" onClick={() => { form.setFieldValue('layoutPresetId', item.id); setValues(current => ({ ...current, layoutPresetId: item.id })); markChanged(); }} className={`fictional-choice-card fictional-layout-card ${values.layoutPresetId === item.id ? 'is-selected' : ''}`}><Flex justify="space-between"><div><Text strong>{item.name}</Text><Paragraph type="secondary">{item.description}</Paragraph></div><Tag color="blue">{item.columns} 栏</Tag></Flex></Card>)}</div>
        <Form.Item name="seed" label="模板随机种子" tooltip="控制系统初始布局细节，使用相同种子可复现" rules={[{ required: true }]}><InputNumber min={1} max={2147483647} precision={0} style={{ width: '100%' }}/></Form.Item>
      </Card>
    </Col>
    <Col span={11}><Card size="small" title="实时预览" className="fictional-preview-card"><SyntheticTemplatePreview config={values} fields={fields} catalog={catalog}/></Card></Col>
  </Row>;

  const themeStep = <Row gutter={18}>
    <Col span={13}>
      <Card size="small" title="配色主题" className="fictional-config-card"><div className="fictional-theme-grid">{catalog.themes.map(item => <Card key={item.id} hoverable size="small" onClick={() => changeTheme(item)} className={`fictional-choice-card ${values.themeId === item.id ? 'is-selected' : ''}`}><div className="fictional-theme-swatch"><i style={{ background:item.primary_color }}/><i style={{ background:item.accent_color }}/><i style={{ background:item.border_color }}/></div><Text strong>{item.name}</Text></Card>)}</div><Row gutter={12} className="fictional-color-row"><Col span={12}><Form.Item name="primaryColor" label="主色"><Input type="color"/></Form.Item></Col><Col span={12}><Form.Item name="accentColor" label="浅色背景"><Input type="color"/></Form.Item></Col></Row></Card>
      <Card size="small" title="安全虚构 Logo" className="fictional-config-card"><Alert type="info" showIcon message="仅提供平台自有抽象图形" description="素材不含真实商标、官方徽标或真实机构名称；正式输出会保留 SYNTHETIC 标识。"/><div className="fictional-logo-grid">{catalog.logos.map(item => <LogoOption key={item.id} item={item} selected={values.logoId === item.id} color={values.primaryColor} onClick={() => { form.setFieldValue('logoId', item.id); setValues(current => ({ ...current, logoId: item.id })); markChanged(); }}/>)}</div><Form.Item name="logoPosition" label="Logo 槽位" rules={[{ required: true }]} className="section-title"><Select options={[{value:'top_left',label:'左上角（推荐）'},{value:'top_center',label:'顶部居中'},{value:'top_right',label:'右上角'}]}/></Form.Item></Card>
    </Col>
    <Col span={11}><Card size="small" title="实时预览" className="fictional-preview-card"><SyntheticTemplatePreview config={values} fields={fields} catalog={catalog}/></Card></Col>
  </Row>;

  const fieldStep = <Card className="fictional-fields-card" title={<Space><span>业务字段与生成规则</span><Tag color="blue">{fields.length} 个字段</Tag></Space>} extra={<Button icon={<PlusOutlined/>} onClick={addField}>新增字段</Button>}>
    <Alert type="success" showIcon message="字段语义来自真实业务要求，示例值和主体均为虚构数据" description="字典字段保持代码与名称同源；计算字段保留格式和跨字段关系；模型字段必须提示生成虚构内容。用户可直接修改系统初稿。"/>
    <Table className="fictional-field-table" rowKey="id" size="small" pagination={false} dataSource={fields} columns={fieldColumns} scroll={{ x: 1120, y: 470 }}/>
  </Card>;

  const finalStep = <Row gutter={18}>
    <Col span={10}>
      <Card size="small" title="模板摘要" className="fictional-config-card"><Descriptions bordered size="small" column={1} items={[
        { key:'name', label:'模板名称', children:values.name || '-' },
        { key:'type', label:'文档类型', children:documentLabel(catalog, documentType) },
        { key:'layout', label:'版式', children:layoutOptions.find(item => item.id === values.layoutPresetId)?.name || values.layoutPresetId },
        { key:'theme', label:'视觉主题', children:currentTheme?.name || values.themeId },
        { key:'fields', label:'动态字段', children:`${fields.length} 个` },
        { key:'draft', label:'制作任务 ID', children:draftId ? <Text copyable>{draftId}</Text> : '尚未保存' },
      ]}/></Card>
      <Card size="small" title={<Space><FileProtectOutlined/>发布安全契约</Space>} className="fictional-config-card">
        <Space direction="vertical"><Text>✓ 禁止真实商标、官方标识和真实印章</Text><Text>✓ 企业、人员、地址与编号全部虚构</Text><Text>✓ 条形码/二维码使用 SYNTHETIC 安全载荷</Text><Text>✓ 图片和 manifest 强制标记“合成数据”</Text></Space>
        <Form.Item name="confirmSynthetic" valuePropName="checked" rules={[{ validator:(_, value) => value ? Promise.resolve() : Promise.reject(new Error('请确认合成数据用途')) }]} className="section-title"><Checkbox>我确认模板仅用于模型训练和测试</Checkbox></Form.Item>
      </Card>
      {trial && <Alert className="fictional-result-alert" type={trial.status === 'REJECT' ? 'error' : trial.status === 'REVIEW' ? 'warning' : 'success'} showIcon message={`试运行质检：${trial.status}`} description={`字段 ${trial.quality?.field_count ?? fields.length} 个；检查 ${trial.quality?.summary?.checks ?? trial.quality?.check_count ?? '-'} 项；低质 ${trial.quality?.summary?.rejected ?? trial.quality?.low_quality_count ?? 0} 项。`}/>} 
      {published && <Alert className="fictional-result-alert" type="success" showIcon icon={<CheckCircleOutlined/>} message="模板已发布并进入统一模板目录" description={`${published.template_id} / ${published.version}；数据生成任务可按业务类型选择该不可变版本。`}/>} 
    </Col>
    <Col span={14}><Card size="small" title={trialImageUrl ? '试运行正式结果' : '配置预览'} className="fictional-preview-card is-large"><SyntheticTemplatePreview config={values} fields={fields} catalog={catalog} trialImageUrl={trialImageUrl}/></Card></Col>
  </Row>;

  return <div className="template-create-page fictional-template-page">
    <Flex className="page-header" justify="space-between" align="flex-start">
      <Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={onBack}/><div><Title level={2}>新建文档类图像模板</Title><Paragraph type="secondary">底图生成法：使用平台生成的安全底图、虚构视觉资产和业务字段制作模板</Paragraph></div></Space>
      <Space>{draftId && <Tag color="blue">{draftId}</Tag>}<Button icon={<SaveOutlined/>} loading={action === 'save'} disabled={!dirty || Boolean(published)} onClick={save}>保存草稿</Button></Space>
    </Flex>
    {serviceError && <Alert className="fictional-service-alert" type="warning" showIcon message="本地 Mock 数据读取失败" description={`${serviceError}。刷新页面可重新加载内置示例。`}/>} 
    {serviceReady && <Alert className="fictional-service-alert" type="success" showIcon message="纯前端 Mock 模式已就绪" description="版式、字段规则、试运行图片、Ground Truth 与质检结果保存在当前浏览器。"/>}
    <Card className="main-card fictional-workflow-card">
      <Flex justify="space-between" align="center" className="template-editor-step-actions template-editor-step-actions-top">
        <Button icon={<ArrowLeftOutlined/>} disabled={step === 0 || Boolean(published)} onClick={() => setStep(value => Math.max(0, value - 1))}>返回上一步</Button>
        {step < STEP_ITEMS.length - 1
          ? <Button type="primary" icon={<ArrowRightOutlined/>} onClick={next}>下一步</Button>
          : <Space>
            <Button icon={<ExperimentOutlined/>} loading={action === 'trial'} disabled={Boolean(published)} onClick={runTrial}>试运行 1 张并质检</Button>
            <Button type="primary" icon={<SafetyCertificateOutlined/>} loading={action === 'publish'} disabled={!trial || dirty || trial.status === 'REJECT' || Boolean(published)} onClick={publish}>发布模板</Button>
          </Space>}
      </Flex>
      <Steps current={step} items={STEP_ITEMS} onChange={value => value <= step && setStep(value)} className="template-editor-steps"/>
      <Form form={form} layout="vertical" initialValues={INITIAL_VALUES} onValuesChange={(_, allValues) => { setValues(current => ({ ...current, ...allValues })); markChanged(); }}>
        <Form.Item name="documentType" hidden rules={[{ required:true }]}><Input/></Form.Item>
        <Form.Item name="layoutPresetId" hidden rules={[{ required:true }]}><Input/></Form.Item>
        <Form.Item name="themeId" hidden rules={[{ required:true }]}><Input/></Form.Item>
        <Form.Item name="logoId" hidden rules={[{ required:true }]}><Input/></Form.Item>
        {step === 0 && typeAndLayout}
        {step === 1 && themeStep}
        {step === 2 && fieldStep}
        {step === 3 && finalStep}
      </Form>
    </Card>
  </div>;
}

export default SyntheticDocumentTemplateCreatePage;
