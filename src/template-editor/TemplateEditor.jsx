import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Divider, Drawer, Empty, Flex,
  Dropdown, Image, Input, InputNumber, List, Modal, Progress, Row, Select, Slider, Space,
  Spin, Steps, Switch, Table, Tag, Tooltip, Typography, Upload, message,
} from 'antd';
import {
  AppstoreAddOutlined, ArrowLeftOutlined, ArrowRightOutlined, DeleteOutlined,
  EyeInvisibleOutlined, EyeOutlined, FileImageOutlined, MoreOutlined, RedoOutlined,
  LeftOutlined, LockOutlined, ReloadOutlined, SaveOutlined, ScissorOutlined, SearchOutlined, SafetyCertificateOutlined,
  SplitCellsOutlined, SyncOutlined, UndoOutlined, UploadOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import TemplateCanvas from './TemplateCanvas';
import { nextId } from './templateGeometry';
import { templateApi } from '../templateApi';
import { formatDateTime } from '../timeUtils';

const { Text, Title, Paragraph } = Typography;

const stepItems = [
  { title: '结构校准', description: '单元格与边框' },
  { title: '语义与字段规则', description: '文字、字段与图案' },
  { title: '质检规则配置', description: '基础规则与场景规则' },
  { title: '校验试运行', description: '确认后发布' },
];

const kindLabels = { cell: '单元格', text: '文字', asset: '印章/图案', field: '字段' };
const assetLabels = { stamp: '印章', qrcode: '二维码', barcode: '条形码', fixed_image: '固定图案' };
const generatorLabels = { dictionary_rule: '字典 + 规则', computed: '计算值', llm_prompt: '模型 + Prompt' };
const fallbackDataTypes = ['text','code','serial_number','company_name','person_name','address','date','amount','quantity','integer','decimal','enum','country_region','currency','domestic_region','customs_district','port','transport_mode','supervision_mode','levy_nature','trade_term','package_type','hs_code','unit'];

const newField = (draft, name = '新字段') => ({
  id: nextId(draft.fields, 'field'), name, data_type: 'text', required: true,
  generator: { type: 'llm_prompt', dictionary: '', candidates: [], rule: '按字段语义生成虚构业务值', prompt: `生成一个虚构但业务合理的“${name}”值，只输出字段值。`, expression: '' },
  quality_rule: { version: 'field-quality-rule/v1', required: true, checks: [{ type:'required', message:'字段必须生成非空值' }], cross_field_checks: [] },
});

const defaultStampGenerator = () => ({
  type: 'procedural', asset_source: '', asset_path: '', recognized_asset_path: '', original_filename: '',
  stamp: {
    preset: 'official_circle', symbol: 'hexagram', safety_text: '合成 / 仅供模型训练',
    organization: { mode: 'fixed', field_id: '', value: '示例数据有限公司', dictionary: '', candidates: [], expression: '' },
    purpose: { mode: 'fixed', field_id: '', value: '业务专用章', dictionary: '', candidates: [], expression: '' },
    serial_number: { mode: 'none', field_id: '', value: '', digits: 8 },
  },
});

const defaultCodeGenerator = () => ({
  type: 'procedural', asset_source: '', asset_path: '', recognized_asset_path: '', original_filename: '',
  code: { safe_prefix: 'SYNTHETIC:', content_mode: 'random_alnum', field_id: '', digits: 16 },
});

const defaultFixedAssetGenerator = () => ({
  type: 'fixed_asset', asset_source: '', asset_path: '', recognized_asset_path: '', original_filename: '',
});

function LayerToolbar({ draft, onChange, lockedLayers = {} }) {
  const labels = { background: '原始底图', table: '表格', text: '文字', asset: '印章/图案' };
  return <Card size="small" title="图层" className="template-editor-card">
    <Space direction="vertical" style={{ width: '100%' }}>
      {Object.entries(labels).map(([key, label]) => {
        const visible = draft.layers?.[key]?.visible !== false;
        return <Flex key={key} justify="space-between" align="center">
          <Space size={6}><Text>{label}</Text>{lockedLayers[key] && <Tooltip title="语义配置阶段锁定，不能选择、拖动或缩放表格对象"><LockOutlined style={{ color:'#8c8c8c' }}/></Tooltip>}</Space>
          <Button size="small" type={visible ? 'primary' : 'default'} ghost={visible}
            icon={visible ? <EyeOutlined/> : <EyeInvisibleOutlined/>}
            onClick={() => onChange({ ...draft, layers: { ...draft.layers, [key]: { ...draft.layers[key], visible: !visible } } })}>
            {visible ? '显示' : '隐藏'}
          </Button>
        </Flex>;
      })}
    </Space>
  </Card>;
}

function ObjectList({ title, items, kind, selection, onSelection, searchable = false }) {
  const [query, setQuery] = useState('');
  const filtered = query.trim() ? items.filter(item => String(item.id || '').toLowerCase().includes(query.trim().toLowerCase())) : items;
  return <Card size="small" title={`${title}（${items.length}）`} className="template-editor-card template-object-list">
    {searchable && <Input allowClear size="small" prefix={<SearchOutlined/>} placeholder="模糊搜索 ID" value={query} onChange={event => setQuery(event.target.value)} suffix={query ? `${filtered.length} 项` : null} style={{ marginBottom:8 }}/>} 
    {filtered.length ? <List size="small" dataSource={filtered} renderItem={item => <List.Item
      className={selection?.kind === kind && selection.id === item.id ? 'is-selected' : ''}
      onClick={() => onSelection({ kind, id: item.id })}>
      <div style={{ minWidth: 0 }}><Text ellipsis>{item.id}{item.name ? ` · ${item.name}` : item.sample_text ? ` · ${item.sample_text}` : item.asset_type ? ` · ${assetLabels[item.asset_type] || item.asset_type}` : ''}</Text>
        {item.source?.confidence != null && <div><Text type="secondary">置信度 {Math.round(item.source.confidence * 100)}%{item.cell_id ? ` · ${item.cell_id}` : ''}</Text></div>}
      </div>
    </List.Item>}/> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={items.length ? '没有匹配的 ID' : '暂无对象'}/>} 
  </Card>;
}

function StructureTools({ draft, selection, onDraftChange, onSelection, onRebuild, rebuilding, onReextract, reextracting }) {
  const selected = selection?.kind === 'cell' ? draft.cells.find(item => item.id === selection.id) : null;
  const addCell = () => {
    const { width, height } = draft.canvas;
    const id = nextId(draft.cells, 'cell');
    const cell = {
      id, bbox_px: [width * .38, height * .42, width * .62, height * .50], cell_type: 'blank',
      locked: true, source: { kind: 'manual', reason: 'user_add' },
      data_type: 'text', field_name: null,
      borders: { top: true, right: true, bottom: true, left: true },
    };
    onDraftChange({ ...draft, cells: [...draft.cells, cell] });
    onSelection({ kind: 'cell', id });
  };
  const split = direction => {
    if (!selected) return;
    const [x1, y1, x2, y2] = selected.bbox_px;
    const first = { ...selected, locked: true, source: { kind: 'manual', reason: 'user_split' } };
    const second = { ...selected, id: nextId(draft.cells, 'cell'), locked: true, source: { kind: 'manual', reason: 'user_split' } };
    if (direction === 'vertical') {
      const middle = (x1 + x2) / 2;
      first.bbox_px = [x1, y1, middle, y2];
      second.bbox_px = [middle, y1, x2, y2];
    } else {
      const middle = (y1 + y2) / 2;
      first.bbox_px = [x1, y1, x2, middle];
      second.bbox_px = [x1, middle, x2, y2];
    }
    onDraftChange({ ...draft, cells: draft.cells.flatMap(item => item.id === selected.id ? [first, second] : [item]) });
    onSelection({ kind: 'cell', id: second.id });
  };
  const remove = () => {
    if (!selected) return;
    onDraftChange({ ...draft, cells: draft.cells.filter(item => item.id !== selected.id) });
    onSelection(null);
  };
  return <>
    <Card size="small" title="结构工具" className="template-editor-card">
      <Paragraph type="secondary" className="template-help-text">拖动顶点时只修改当前单元格；靠近邻格边缘仍会自动吸附，但不会带动邻格。系统重建会保留手工锁定框，再清理容器框、重复框和面积重叠。</Paragraph>
    </Card>
    <ObjectList searchable title="单元格" items={draft.cells} kind="cell" selection={selection} onSelection={onSelection}/>
    <Card size="small" title="结构操作" className="template-editor-card">
      <Space wrap>
        <Button icon={<ReloadOutlined/>} loading={reextracting} onClick={onReextract}>重新识别最小单元格</Button>
        <Button type="primary" icon={<SyncOutlined/>} loading={rebuilding} onClick={onRebuild}>自动整理并重建表格</Button>
        <Button icon={<AppstoreAddOutlined/>} onClick={addCell}>新增格</Button>
        <Tooltip title="把选中单元格分成左右两个"><Button disabled={!selected} icon={<SplitCellsOutlined/>} onClick={() => split('vertical')}>左右拆分</Button></Tooltip>
        <Tooltip title="把选中单元格分成上下两个"><Button disabled={!selected} icon={<ScissorOutlined/>} onClick={() => split('horizontal')}>上下拆分</Button></Tooltip>
        <Button danger disabled={!selected} icon={<DeleteOutlined/>} onClick={remove}>删除</Button>
      </Space>
    </Card>
  </>;
}

function SemanticTools({ draft, selection, onDraftChange, onSelection, onExtract, onReextractText, extracting }) {
  const addText = () => {
    const { width, height } = draft.canvas;
    const id = nextId(draft.texts, 'text');
    const item = { id, bbox_px: [width * .12, height * .15, width * .36, height * .20], kind: 'fixed_label', sample_text: '示例文字', field_id: null, locked: true, source: { kind: 'manual', reason: 'user_add' }, style: { font_size: 18, color: '#111111', align: 'left', wrap: false } };
    onDraftChange({ ...draft, texts: [...draft.texts, item] });
    onSelection({ kind: 'text', id });
  };
  const addAsset = () => {
    const { width, height } = draft.canvas;
    const id = nextId(draft.assets, 'asset');
    const item = { id, bbox_px: [width * .72, height * .72, width * .88, height * .90], asset_type: 'stamp', locked: true, source: { kind: 'manual', reason: 'user_add' }, generator: defaultStampGenerator() };
    onDraftChange({ ...draft, assets: [...draft.assets, item] });
    onSelection({ kind: 'asset', id });
  };
  const remove = () => {
    if (!selection || !['text', 'asset'].includes(selection.kind)) return;
    const key = selection.kind === 'text' ? 'texts' : 'assets';
    const selectedText = selection.kind === 'text' ? draft.texts.find(item => item.id === selection.id) : null;
    const remainingTexts = selection.kind === 'text' ? draft.texts.filter(item => item.id !== selection.id) : draft.texts;
    const fields = selectedText?.field_id && !remainingTexts.some(item => item.field_id === selectedText.field_id)
      ? draft.fields.filter(item => item.id !== selectedText.field_id)
      : draft.fields;
    onDraftChange({ ...draft, [key]: draft[key].filter(item => item.id !== selection.id), fields });
    onSelection(null);
  };
  return <>
    <Card size="small" title="语义工具" className="template-editor-card">
      <Space wrap>
        <Button icon={<ReloadOutlined/>} disabled={selection?.kind !== 'text'} loading={extracting === 'text'} onClick={onReextractText}>重新提取选中文字</Button>
        <Button icon={<ReloadOutlined/>} loading={extracting === 'asset'} onClick={() => onExtract(['asset'])}>重新提取图案</Button>
        <Button onClick={addText}>新增文字区</Button>
        <Button onClick={addAsset}>新增图案区</Button>
        <Button danger icon={<DeleteOutlined/>} disabled={!['text', 'asset'].includes(selection?.kind)} onClick={remove}>删除</Button>
      </Space>
      <Paragraph type="secondary" className="template-help-text">绿色框表示文字，红色框表示印章/码类/固定图案。文字只分固定文字与动态字段；动态文字和字段规则是一体对象，内部绑定由系统维护。</Paragraph>
    </Card>
    {!draft.texts.length && <Alert className="template-editor-card" type="warning" showIcon message="尚未提取到文字对象" description="请返回第一步重新创建，或手工新增文字区。"/>}
    {!draft.assets.length && <Alert className="template-editor-card" type="warning" showIcon message="尚未提取到印章/图案对象" description="可点击“重新提取图案”，或手工新增图案区。"/>}
    {(draft.texts.length > 0 || draft.assets.length > 0) && <Alert className="template-editor-card" type="info" showIcon message={`自动解析结果：文字 ${draft.texts.length} 个，印章/图案 ${draft.assets.length} 个`} description="自动结果均为候选对象；请将文字分类为固定文字或动态字段，并检查图案类型与素材规则。"/>}
    <ObjectList searchable title="文字" items={draft.texts} kind="text" selection={selection} onSelection={onSelection}/>
    <ObjectList title="印章/图案" items={draft.assets} kind="asset" selection={selection} onSelection={onSelection}/>
  </>;
}

function FieldRuleEditor({ field, onChange, compact = false, semanticConfig }) {
  if (!field) return <Alert type="warning" showIcon message="动态文字尚无字段规则" description="重新执行该文字的语义提取，或切换一次文字类型以自动创建规则。"/>;
  const updateGenerator = patch => onChange({ generator: { ...field.generator, ...patch } });
  const dataTypeOptions = (semanticConfig?.rule_catalog?.data_types || fallbackDataTypes.map(value => ({ value, label:value }))).map(item => ({ value:item.value, label:item.label || item.value }));
  const dictionaryOptions = (semanticConfig?.rule_catalog?.dictionaries || []).filter(item => item.available !== false).map(item => ({ value:item.name, label:item.label }));
  const qualityChecks = field.quality_rule?.checks || [];
  const crossChecks = field.quality_rule?.cross_field_checks || [];
  return <Space direction="vertical" size={8} style={{ width: '100%' }}>
    {!compact && <><Text type="secondary">字段名称</Text><Input value={field.name} onChange={event => onChange({ name: event.target.value })}/></>}
    {field.source?.engine && <Space wrap><Tag color="blue">{field.source.engine}</Tag>{field.source.confidence != null && <Tag color={field.source.confidence >= .72 ? 'green' : 'orange'}>语义置信度 {Math.round(field.source.confidence * 100)}%</Tag>}{field.source.review_required && <Tag color="orange">待复核</Tag>}</Space>}
    <Text type="secondary">数据类型</Text><Select showSearch optionFilterProp="label" value={field.data_type} onChange={value => onChange({ data_type: value })} options={dataTypeOptions}/>
    <Flex justify="space-between"><Text type="secondary">必填</Text><Switch checked={field.required} onChange={value => onChange({ required: value })}/></Flex>
    <Text type="secondary">生成方式</Text><Select value={field.generator?.type} onChange={value => updateGenerator({ type: value })} options={Object.entries(generatorLabels).map(([value,label]) => ({value,label}))}/>
    {field.generator?.type === 'dictionary_rule' && <><Text type="secondary">本地字典</Text><Select showSearch allowClear optionFilterProp="label" value={field.generator.dictionary || undefined} placeholder="选择字典" onChange={dictionary => updateGenerator({ dictionary: dictionary || '' })} options={dictionaryOptions}/><Text type="secondary">字典抽取与格式规则</Text><Input.TextArea rows={3} value={field.generator.rule} onChange={event => updateGenerator({ rule: event.target.value })}/><Text type="secondary">试运行候选值（每行一个）</Text><Input.TextArea rows={4} value={(field.generator.candidates || []).join('\n')} onChange={event => updateGenerator({ candidates: event.target.value.split('\n').map(value => value.trim()).filter(Boolean) })}/></>}
    {field.generator?.type === 'llm_prompt' && <><Text type="secondary">Prompt</Text><Input.TextArea rows={5} value={field.generator.prompt} onChange={event => updateGenerator({ prompt: event.target.value })}/></>}
    {field.generator?.type === 'computed' && <><Text type="secondary">计算表达式 / 说明</Text><Input.TextArea value={field.generator.expression} onChange={event => updateGenerator({ expression: event.target.value })}/></>}
    <Divider orientation="left" plain>自动质检规则</Divider>
    <Card size="small" className="template-stamp-rule-card">
      <Space direction="vertical" size={6} style={{ width:'100%' }}>
        {qualityChecks.length ? qualityChecks.map((rule, index) => <Flex key={`${rule.type}-${index}`} gap={6} align="flex-start"><Tag color="cyan">{rule.type}</Tag><Text type="secondary" style={{ fontSize:12, wordBreak:'break-all' }}>{rule.message || JSON.stringify(Object.fromEntries(Object.entries(rule).filter(([key]) => key !== 'type')))}</Text></Flex>) : <Text type="warning">尚无字段质检规则</Text>}
        {crossChecks.map((rule, index) => <Flex key={`cross-${index}`} gap={6} align="flex-start"><Tag color="purple">跨字段</Tag><Text type="secondary" style={{ fontSize:12 }}>{rule.rule}</Text></Flex>)}
      </Space>
    </Card>
  </Space>;
}

function StampContentRule({ label, rule = {}, fields, onChange }) {
  const options = [
    { value: 'fixed', label: '固定内容' },
    { value: 'bind_field', label: '绑定动态字段' },
    { value: 'dictionary_rule', label: '字典 + 规则' },
  ];
  const patch = value => onChange({ ...rule, ...value });
  return <Card size="small" title={label} className="template-stamp-rule-card">
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Select value={rule.mode || 'fixed'} onChange={mode => patch({ mode })} options={options}/>
      {rule.mode === 'fixed' && <Input value={rule.value} placeholder={`请输入${label}`} onChange={event => patch({ value: event.target.value })}/>} 
      {rule.mode === 'bind_field' && <Select showSearch value={rule.field_id || undefined} placeholder="选择字段" onChange={field_id => patch({ field_id })} options={fields.map(field => ({ value: field.id, label: `${field.name}（${field.id}）` }))}/>} 
      {rule.mode === 'dictionary_rule' && <><Input value={rule.dictionary} placeholder="字典名称" onChange={event => patch({ dictionary: event.target.value })}/><Input.TextArea rows={3} value={(rule.candidates || []).join('\n')} placeholder="试运行候选值，每行一个" onChange={event => patch({ candidates: event.target.value.split('\n').map(value => value.trim()).filter(Boolean) })}/></>}
    </Space>
  </Card>;
}

function StampSerialRule({ rule = {}, fields, onChange }) {
  const patch = value => onChange({ ...rule, ...value });
  const options = [
    { value:'none', label:'不生成' },
    { value:'fixed', label:'固定编号' },
    { value:'bind_field', label:'绑定动态字段' },
    { value:'random_digits', label:'按指定位数随机生成数字' },
  ];
  return <Card size="small" title="编号" className="template-stamp-rule-card">
    <Space direction="vertical" size={8} style={{ width:'100%' }}>
      <Select value={rule.mode || 'none'} onChange={mode => patch({ mode })} options={options}/>
      {rule.mode === 'fixed' && <Input value={rule.value} placeholder="请输入固定编号" onChange={event => patch({ value:event.target.value })}/>} 
      {rule.mode === 'bind_field' && <Select showSearch value={rule.field_id || undefined} placeholder="选择动态字段" onChange={field_id => patch({ field_id })} options={fields.map(field => ({ value:field.id, label:`${field.name}（${field.id}）` }))}/>} 
      {rule.mode === 'random_digits' && <><Text type="secondary">随机数字位数</Text><InputNumber min={1} max={20} value={rule.digits || 8} onChange={digits => patch({ digits })} style={{ width:'100%' }}/></>}
    </Space>
  </Card>;
}

function PropertyPanel({ draft, selection, onDraftChange, jobId, onAssetUpload, uploadingAssetId, semanticConfig }) {
  const [stampPreviewOpen,setStampPreviewOpen]=useState(false);
  const [materialOpen,setMaterialOpen]=useState(false);
  const [materialProgress,setMaterialProgress]=useState(0);
  const [materialPrompt,setMaterialPrompt]=useState('生成一个不包含真实品牌、机构名称或官方标志的抽象文档装饰图案，透明背景，适合合成训练数据。');
  const [materialReady,setMaterialReady]=useState(false);
  if (!selection) return <Card size="small" title="对象属性" className="template-editor-card"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请在画布或左侧列表选择对象"/></Card>;
  const key = selection.kind === 'cell' ? 'cells' : selection.kind === 'text' ? 'texts' : selection.kind === 'asset' ? 'assets' : 'fields';
  const item = draft[key].find(value => value.id === selection.id);
  if (!item) return null;
  const update = patch => onDraftChange({ ...draft, [key]: draft[key].map(value => value.id === item.id ? {
    ...value, ...patch,
    ...(selection.kind === 'field' ? {} : { locked: true, source: { kind: 'manual', reason: 'property_edit' } }),
  } : value) });
  const updateField = (fieldId, patch) => onDraftChange({ ...draft, fields: draft.fields.map(field => field.id === fieldId ? { ...field, ...patch } : field) });
  const selectTextKind = value => {
    if (value !== 'dynamic_field') {
      const oldFieldId = item.field_id;
      const texts = draft.texts.map(text => text.id === item.id ? { ...text, kind:'fixed_label', field_id:null, locked:true, source:{ kind:'manual', reason:'property_edit' } } : text);
      const fields = oldFieldId && !texts.some(text => text.field_id === oldFieldId) ? draft.fields.filter(field => field.id !== oldFieldId) : draft.fields;
      return onDraftChange({ ...draft, texts, fields });
    }
    if (item.field_id && draft.fields.some(field => field.id === item.field_id)) return update({ kind: value });
    const field = newField(draft, String(item.sample_text || '新字段').trim().slice(0, 40) || '新字段');
    onDraftChange({
      ...draft,
      fields: [...draft.fields, field],
      texts: draft.texts.map(text => text.id === item.id ? { ...text, kind: value, field_id: field.id, locked: true, source: { kind: 'manual', reason: 'property_edit' } } : text),
    });
  };
  const changeAssetType = asset_type => {
    const reference = {
      asset_source:item.generator?.asset_source || '', asset_path:item.generator?.asset_path || '',
      recognized_asset_path:item.generator?.recognized_asset_path || '', original_filename:item.generator?.original_filename || '',
    };
    const generator = asset_type === 'stamp'
      ? { ...defaultStampGenerator(), ...reference }
      : ['qrcode','barcode'].includes(asset_type)
        ? { ...defaultCodeGenerator(), ...reference }
        : { ...defaultFixedAssetGenerator(), ...reference };
    update({ asset_type, generator });
  };
  const updateAssetGenerator = patch => update({ generator: { ...item.generator, ...patch } });
  const updateStamp = patch => updateAssetGenerator({ stamp: { ...(item.generator?.stamp || defaultStampGenerator().stamp), ...patch, safety_text: '合成 / 仅供模型训练' } });
  const materialUrl = item.generator?.asset_path && jobId
    ? templateApi.artifactUrl(item.generator.asset_path)
    : '';
  return <><Card size="small" title={`${kindLabels[selection.kind]}属性`} className="template-editor-card template-property-panel">
    <Text type="secondary">对象 ID</Text><Input value={item.id} disabled/>
    {selection.kind === 'cell' && <>
      <Text type="secondary">单元格类型</Text><Select value={item.cell_type || 'text'} onChange={value => update({ cell_type: value })} options={[{value:'text',label:'文字单元格'},{value:'blank',label:'空白单元格'}]}/>
      <Text type="secondary">边框显示</Text>
      <Checkbox.Group value={Object.entries(item.borders || {}).filter(([, value]) => value).map(([name]) => name)}
        onChange={values => update({ borders: Object.fromEntries(['top','right','bottom','left'].map(name => [name, values.includes(name)])) })}
        options={[{label:'上',value:'top'},{label:'右',value:'right'},{label:'下',value:'bottom'},{label:'左',value:'left'}]}/>
      <Text type="secondary">像素坐标</Text><Input value={item.bbox_px.map(value => Math.round(value)).join(', ')} disabled/>
    </>}
    {selection.kind === 'text' && <>
      <Text type="secondary">文字类型</Text><Select value={['fixed_label','dynamic_field'].includes(item.kind) ? item.kind : undefined} placeholder="请选择固定或动态" onChange={selectTextKind} options={[{value:'fixed_label',label:'固定文字'},{value:'dynamic_field',label:'动态字段'}]}/>
      <Text type="secondary">示例文字</Text><Input.TextArea value={item.sample_text} onChange={event => update({ sample_text: event.target.value })}/>
      <Tooltip title="固定文字作为 Key、动态文字作为 Value，通过绑定对象 ID 建立对应关系。"><Text type="secondary">绑定对象 ID</Text></Tooltip><Input value={item.binding_object_id||item.field_id||`BIND-${item.id}`} onChange={event=>update({binding_object_id:event.target.value})}/>
      {item.semantic && <Alert type={item.semantic.review_required ? 'warning' : 'success'} showIcon message={item.semantic.review_required ? '该字段建议人工复核' : '整单语义判断已完成'} description={item.semantic.reason}/>} 
      {item.kind === 'dynamic_field' && <><Divider orientation="left" plain>字段生成与质检规则</Divider><FieldRuleEditor compact semanticConfig={semanticConfig} field={draft.fields.find(field => field.id === item.field_id)} onChange={patch => updateField(item.field_id, patch)}/></>}
      <Text type="secondary">字号</Text><InputNumber min={8} max={96} value={item.style?.font_size || 18} onChange={value => update({ style: { ...item.style, font_size: value } })}/>
    </>}
    {selection.kind === 'asset' && <>
      <Text type="secondary">图案类型</Text><Select value={item.asset_type} onChange={changeAssetType} options={Object.entries(assetLabels).map(([value,label]) => ({value,label}))}/>
      <Text type="secondary">生成方式</Text><Select value={item.asset_type==='stamp'?'procedural':item.generator?.type||'fixed_asset'} onChange={type => updateAssetGenerator({ type })} options={item.asset_type === 'stamp' ? [{value:'procedural',label:'程序生成安全印章'}] : ['qrcode','barcode'].includes(item.asset_type) ? [{value:'procedural',label:'程序安全生成'},{value:'fixed_asset',label:'固定合成素材'}] : [{value:'fixed_asset',label:'固定合成素材'}]}/>
      {item.generator?.type === 'procedural' && item.asset_type === 'stamp' && <>
        <Alert type="info" showIcon message="模板只定义章型和内容规则" description="是否出现、出现比例及扩散增强在数据生成任务中配置，不写入模板。程序章会强制带有“合成 / 仅供模型训练”标识。"/>
        <Text type="secondary">印章类型</Text><Select value={item.generator?.stamp?.preset || 'official_circle'} onChange={preset => updateStamp({ preset })} options={[{value:'official_circle',label:'圆形公章'},{value:'special_circle',label:'圆形专用章'},{value:'special_ellipse',label:'椭圆形专用章'}]}/>
        <Flex justify="space-between"><Tooltip title="为控制风险不使用真实印章的五角星形状"><Text type="secondary">中心六角星</Text></Tooltip><Switch checked={(item.generator?.stamp?.symbol || 'hexagram') === 'hexagram'} onChange={checked => updateStamp({ symbol: checked ? 'hexagram' : 'none' })}/></Flex>
        <StampContentRule label="机构名称" fields={draft.fields} rule={item.generator?.stamp?.organization} onChange={organization => updateStamp({ organization })}/>
        <StampContentRule label="专用章文字" fields={draft.fields} rule={item.generator?.stamp?.purpose} onChange={purpose => updateStamp({ purpose })}/>
        <StampSerialRule fields={draft.fields} rule={item.generator?.stamp?.serial_number} onChange={serial_number => updateStamp({ serial_number })}/>
        <Text type="secondary">强制安全标识</Text><Input value="合成 / 仅供模型训练" disabled/>
        <Button block type="primary" ghost onClick={()=>setStampPreviewOpen(true)}>生成示例</Button>
      </>}
      {item.generator?.type === 'procedural' && ['qrcode','barcode'].includes(item.asset_type) && <>
        <Alert type="info" showIcon message="程序安全生成" description="所有码内容强制以 SYNTHETIC: 开头；条形码同时显示 SYNTHETIC 标记，避免被误用为真实业务码。"/>
        <Text type="secondary">安全前缀</Text><Input value="SYNTHETIC:" disabled/>
        <Text type="secondary">内容生成规则</Text><Select value={item.generator?.code?.content_mode || 'random_alnum'} onChange={content_mode => updateAssetGenerator({ code:{ ...(item.generator?.code || {}), content_mode, safe_prefix:'SYNTHETIC:' } })} options={[{value:'random_digits',label:'随机数字'},{value:'random_alnum',label:'随机字母数字'},{value:'bind_field',label:'绑定动态字段'}]}/>
        {item.generator?.code?.content_mode === 'bind_field' ? <Select showSearch value={item.generator?.code?.field_id || undefined} placeholder="选择动态字段" onChange={field_id => updateAssetGenerator({ code:{ ...(item.generator?.code || {}), field_id, safe_prefix:'SYNTHETIC:' } })} options={draft.fields.map(field => ({ value:field.id, label:`${field.name}（${field.id}）` }))}/> : <><Text type="secondary">随机内容位数</Text><InputNumber min={4} max={64} value={item.generator?.code?.digits || 16} onChange={digits => updateAssetGenerator({ code:{ ...(item.generator?.code || {}), digits, safe_prefix:'SYNTHETIC:' } })} style={{ width:'100%' }}/></>}
      </>}
      {item.generator?.type === 'fixed_asset' && <>
        <Alert type="info" showIcon message="固定合成素材" description="可以使用视觉模型模拟生成安全素材，也可以上传透明背景 PNG。"/>
        <Button block onClick={()=>{setMaterialOpen(true);setMaterialProgress(0);setMaterialReady(false);}}>模拟合成素材</Button>
        <Upload accept="image/png,.png" showUploadList={false} beforeUpload={file => { onAssetUpload?.(item.id, file); return false; }}><Button block icon={<UploadOutlined/>} loading={uploadingAssetId === item.id}>上传 PNG 素材</Button></Upload>
        {item.generator?.asset_path ? <><Text type="secondary">当前素材：{item.generator.asset_source === 'recognized_crop' ? '识别抠图' : '上传 PNG'}</Text><Image src={materialUrl} width="100%" style={{ maxHeight: 180, objectFit: 'contain', background: '#f5f5f5' }}/></> : <Alert type="warning" showIcon message="尚未选择固定素材"/>}
      </>}
    </>}
    {selection.kind === 'field' && <FieldRuleEditor semanticConfig={semanticConfig} field={item} onChange={update}/>} 
  </Card><Modal title="安全印章示例" open={stampPreviewOpen} onCancel={()=>setStampPreviewOpen(false)} footer={<Button type="primary" onClick={()=>setStampPreviewOpen(false)}>确认</Button>}><div style={{height:280,display:'grid',placeItems:'center',background:'#fafafa'}}><div style={{width:210,height:210,border:'8px double #d4380d',borderRadius:'50%',display:'grid',placeItems:'center',color:'#d4380d',fontWeight:700,textAlign:'center',transform:'rotate(-8deg)'}}>合成示例机构<br/><span style={{fontSize:58}}>✡</span><br/>仅供模型训练</div></div></Modal><Modal title="模拟合成素材" open={materialOpen} onCancel={()=>setMaterialOpen(false)} footer={materialReady?<Space><Button onClick={()=>setMaterialOpen(false)}>取消</Button><Button type="primary" onClick={()=>{updateAssetGenerator({asset_source:'synthetic_visual_model',asset_path:'mock://synthetic-asset',original_filename:'synthetic-asset.png'});setMaterialOpen(false);message.success('已作为固定合成素材使用');}}>确认使用</Button></Space>:null}><Text type="secondary">视觉模型</Text><Select value="qwen-image" style={{width:'100%',marginBottom:12}} options={[{value:'qwen-image',label:'Qwen Image'}]}/><Text type="secondary">生成 Prompt</Text><Input.TextArea rows={5} value={materialPrompt} onChange={event=>setMaterialPrompt(event.target.value)}/><Button className="section-title" type="primary" onClick={()=>{setMaterialProgress(10);setMaterialReady(false);let value=10;const timer=setInterval(()=>{value=Math.min(100,value+18);setMaterialProgress(value);if(value>=100){clearInterval(timer);setMaterialReady(true);}},120);}}>生成</Button>{materialProgress>0&&<Progress percent={materialProgress} status={materialProgress<100?'active':'success'}/>} {materialReady&&<div style={{height:180,display:'grid',placeItems:'center',background:'linear-gradient(135deg,#e6f4ff,#f9f0ff)',borderRadius:8,fontSize:64}}>◈</div>}</Modal></>;
}

function DocumentQualityPanel({ draft, onDraftChange }) {
  const baseRules=[
    {id:'BASE-STRUCTURE',name:'输出内容结构检查',description:'检查画布、图层、单元格、固定文字、动态字段和图案对象是否齐全。'},
    {id:'BASE-PRIVACY',name:'隐私与敏感信息检查',description:'检查种子内容及模板对象是否残留真实姓名、联系方式、地址、业务标识和密钥。',privacy:true},
    {id:'BASE-DUPLICATE',name:'重复检查',description:'检查字段 ID、固定文字、单元格和图案对象是否存在完全重复。'},
    {id:'BASE-FIELD-ID',name:'字段 ID 唯一性检查',description:'检查每个动态字段 ID 唯一、非空，并符合系统命名规则。'},
    {id:'BASE-REQUIRED',name:'必填字段检查',description:'检查模板定义的必填字段、生成规则和绑定关系是否完整。'},
    {id:'BASE-TYPE-FORMAT',name:'字段类型与格式检查',description:'检查日期、金额、数字、代码和枚举等字段类型及格式约束。'},
    {id:'BASE-GEOMETRY',name:'几何与越界检查',description:'检查单元格、文字框、图案和隐私区域坐标有效且没有超出画布。'},
    {id:'BASE-ASSET',name:'图案素材有效性检查',description:'检查印章、图标、二维码等素材引用有效，透明度及安全前缀配置完整。'},
  ];
  const defaultSceneRules=[
    {rule_id:'SCENE-LAYOUT-FIELD',name:'版面与字段绑定一致性',target:'两者',mode:'semantic',threshold:0.85,prompt:'判断字段位置、字段标签、字段值与绑定关系是否符合整张文档的版面语义。',enabled:true},
    {rule_id:'SCENE-CROSS-FIELD',name:'跨字段业务一致性',target:'字段内容',mode:'semantic',threshold:0.85,prompt:'判断日期、主体、地点、数量、重量、金额、代码等关联字段之间是否符合当前业务单据的约束关系。',enabled:true},
    {rule_id:'SCENE-BUSINESS-SEMANTIC',name:'业务内容语义合理性',target:'字段内容',mode:'semantic',threshold:0.82,prompt:'判断生成字段的业务含义、上下文和组合关系是否符合该类文档的真实填写逻辑。',enabled:true},
    {rule_id:'SCENE-TABLE-INTEGRITY',name:'表格与单元格完整性',target:'版面结构',mode:'function',python_code:'def validate(document, context):\n    return check_table_cells_and_borders(document)',enabled:true},
    {rule_id:'SCENE-CONTENT-FIT',name:'文字适配与溢出检查',target:'两者',mode:'function',python_code:'def validate(document, context):\n    return check_text_overflow_and_clipping(document)',enabled:true},
    {rule_id:'SCENE-VISUAL-READABILITY',name:'视觉清晰度与可读性',target:'版面结构',mode:'function',python_code:'def validate(image, context):\n    return check_blur_contrast_and_text_size(image)',enabled:true},
    {rule_id:'SCENE-OCR-RECOVERABILITY',name:'OCR 可识别性检查',target:'两者',mode:'function',python_code:'def validate(image, ground_truth):\n    return check_ocr_coverage_confidence_and_cer(image, ground_truth)',enabled:true},
    {rule_id:'SCENE-ASSET-OCCLUSION',name:'印章与图案遮挡检查',target:'版面结构',mode:'function',python_code:'def validate(document, context):\n    return check_asset_occlusion(document)',enabled:true},
    {rule_id:'SCENE-OVERALL-VISUAL',name:'整体版式自然度',target:'两者',mode:'semantic',threshold:0.82,prompt:'综合判断留白、对齐、层级、字体、表格、印章及图案组合是否自然，是否符合该类文档的视觉习惯。',enabled:true},
  ];
  const storedRules=draft.quality_rules?.scene_rules||[];
  const rules=defaultSceneRules.map(item=>({...item,...(storedRules.find(rule=>rule.rule_id===item.rule_id)||{})})).concat(storedRules.filter(rule=>!defaultSceneRules.some(item=>item.rule_id===rule.rule_id)));
  const updateRules=scene_rules=>onDraftChange({...draft,quality_rules:{base_rules:baseRules,scene_rules}});
  const patch=(index,value)=>updateRules(rules.map((rule,i)=>i===index?{...rule,...value}:rule));
  return <Space direction="vertical" size={16} style={{width:'100%'}}>
    <Alert type="info" showIcon message={`共配置 ${baseRules.length} 条基础规则和 ${rules.length} 条场景规则`} description="基础规则由系统维护且始终执行；场景规则可按模板需要开关和调整。函数判断统一返回 true / false，语义判断返回 0–1 分数。"/>
    <Divider orientation="left">基础规则</Divider>
    <Row gutter={[12,12]}>{baseRules.map(rule=><Col span={6} key={rule.id}><Card size="small" className={`conversation-fixed-rule ${rule.privacy?'conversation-fixed-rule-privacy':'conversation-fixed-rule-other'}`} style={{height:'100%'}}><Space direction="vertical"><Space><Text strong>{rule.name}</Text><Tag color={rule.privacy?'blue':'green'}>{rule.privacy?'隐私检查':'基础规则'}</Tag></Space><Text type="secondary">{rule.description}</Text><Tag>{rule.id}</Tag></Space></Card></Col>)}</Row>
    <Divider orientation="left">场景规则</Divider>
    {rules.map((rule,index)=><Card key={rule.rule_id} size="small" className="conversation-quality-rule" extra={<Switch checked={rule.enabled!==false} onChange={enabled=>patch(index,{enabled})}/>}><Row gutter={12}><Col span={7}><Text type="secondary">规则名称</Text><Input value={rule.name} onChange={event=>patch(index,{name:event.target.value})}/></Col><Col span={6}><Text type="secondary">规则 ID</Text><Input value={rule.rule_id} disabled/></Col><Col span={5}><Text type="secondary">检查对象</Text><Select value={rule.target} onChange={target=>patch(index,{target})} style={{width:'100%'}} options={['版面结构','字段内容','两者'].map(value=>({value,label:value}))}/></Col><Col span={6}><Text type="secondary">检查方式</Text><Select value={rule.mode} onChange={mode=>patch(index,{mode})} style={{width:'100%'}} options={[{value:'function',label:'函数判断'},{value:'semantic',label:'语义判断'}]}/></Col></Row>{rule.mode==='semantic'?<><Text type="secondary">语义阈值</Text><InputNumber min={0} max={1} step={0.01} value={rule.threshold} onChange={threshold=>patch(index,{threshold})}/><Text type="secondary">语义判断 Prompt</Text><Input.TextArea rows={4} value={rule.prompt} onChange={event=>patch(index,{prompt:event.target.value})}/><Row gutter={12}><Col span={12}><Text type="secondary">通过示例（可选）</Text><Input.TextArea rows={2} value={rule.positive_example} onChange={event=>patch(index,{positive_example:event.target.value})}/></Col><Col span={12}><Text type="secondary">不通过示例（可选）</Text><Input.TextArea rows={2} value={rule.negative_example} onChange={event=>patch(index,{negative_example:event.target.value})}/></Col></Row></>:<><Text type="secondary">Python 判断函数</Text><Input.TextArea className="coldchain-code-textarea" rows={6} value={rule.python_code||'def validate(data, context):\n    return True'} onChange={event=>patch(index,{python_code:event.target.value})}/></>}</Card>)}
    <Button type="dashed" block icon={<AppstoreAddOutlined/>} onClick={()=>updateRules([...rules,{rule_id:`SCENE-${Date.now().toString(36).toUpperCase()}`,name:'自定义场景规则',target:'两者',mode:'semantic',threshold:0.8,prompt:'',enabled:true}])}>添加自定义质检规则</Button>
  </Space>;
}

function ValidationPanel({ draft, job, onDraftChange, onTrial, trialRunning }) {
  const validation = draft.validation;
  const trialUrl = job?.artifact_urls?.trial_image;
  const reportUrl = job?.artifact_urls?.trial_quality_report;
  const sourceWidth = draft.canvas.width;
  const sourceHeight = draft.canvas.height;
  const profile = draft.render_profile || { scale_mode:'uniform_fit', output_size:{ width:sourceWidth, height:sourceHeight }, lock_aspect_ratio:true };
  const outputWidth = profile.output_size?.width || sourceWidth;
  const outputHeight = profile.output_size?.height || sourceHeight;
  const locked = true;
  const updateProfile = (width, height, lock = locked) => onDraftChange({ ...draft, render_profile:{ scale_mode:'uniform_fit', output_size:{ width, height }, lock_aspect_ratio:lock } });
  const updateWidth = value => { const width = value || sourceWidth; updateProfile(width, locked ? Math.round(width * sourceHeight / sourceWidth) : outputHeight); };
  const updateHeight = value => { const height = value || sourceHeight; updateProfile(locked ? Math.round(height * sourceWidth / sourceHeight) : outputWidth, height); };
  const uniformScale = Math.min(outputWidth / sourceWidth, outputHeight / sourceHeight);
  const quality = draft.trial_run || {};
  const qualityColor = quality.quality_status === 'PASS' ? 'green' : quality.quality_status === 'REJECT' ? 'red' : 'orange';
  const reportRows=[...(draft.quality_rules?.base_rules||[]).map((rule,index)=>({id:rule.id||rule.rule_id||`BASE-${index+1}`,name:rule.name||'基础规则',type:rule.privacy?'隐私检查':'基础规则',result:'通过'})),...(draft.quality_rules?.scene_rules||[]).filter(rule=>rule.enabled!==false).map(rule=>({id:rule.rule_id,name:rule.name,type:'场景规则',result:rule.mode==='semantic'?'0.91':'通过'}))];
  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Alert type="info" showIcon message="发布门槛" description="先保存草稿，再执行校验；没有阻断错误后试生成 1 张图。草稿修改后旧试运行自动失效。"/>
    <Card size="small" title="试运行输出像素" extra={<Space><Tag color="blue">统一缩放 {uniformScale.toFixed(3)}×</Tag><Button type="primary" icon={<PlayCircleOutlined/>} loading={trialRunning} onClick={onTrial}>开始试运行</Button></Space>}>
      <Space direction="vertical" style={{ width:'100%' }}>
        <Space wrap>
          <Button onClick={() => updateProfile(sourceWidth, sourceHeight)}>原始 {sourceWidth}×{sourceHeight}</Button>
          <Button onClick={() => updateProfile(2480, Math.round(2480 * sourceHeight / sourceWidth))}>标准宽度 2480px</Button>
          <Button onClick={() => updateProfile(3508, Math.round(3508 * sourceHeight / sourceWidth))}>高精度宽度 3508px</Button>
        </Space>
        <Row gutter={12}>
          <Col span={10}><Text type="secondary">输出宽度</Text><InputNumber min={320} max={8192} value={outputWidth} onChange={updateWidth} addonAfter="px" style={{ width:'100%' }}/></Col>
          <Col span={10}><Text type="secondary">输出高度</Text><InputNumber min={240} max={8192} value={outputHeight} onChange={updateHeight} addonAfter="px" style={{ width:'100%' }}/></Col>
          <Col span={4}><Text type="secondary">锁定比例</Text><div><Tooltip title="试运行强制保持原始宽高比"><Switch checked disabled/></Tooltip></div></Col>
        </Row>
        <Divider orientation="left">试运行配置</Divider>
        <Row gutter={12}><Col span={8}><Text type="secondary">试运行样本数</Text><InputNumber min={1} max={10} value={draft.trial_config?.sample_count||1} onChange={sample_count=>onDraftChange({...draft,trial_config:{...draft.trial_config,sample_count}})} style={{width:'100%'}}/></Col><Col span={8}><Text type="secondary">语义模型</Text><Select value={draft.trial_config?.semantic_model||'qwen3-vl-8b-instruct'} onChange={semantic_model=>onDraftChange({...draft,trial_config:{...draft.trial_config,semantic_model}})} style={{width:'100%'}} options={[{value:'qwen3-vl-8b-instruct',label:'Qwen-8B'}]}/></Col><Col span={8}><Text type="secondary">API 调用次数预估</Text><Input value={`${(draft.trial_config?.sample_count||1)*2} 次`} disabled/></Col></Row>
        <Flex justify="space-between"><Text>自定义生成参数（可选）</Text><Switch checked={Boolean(draft.trial_config?.parameters_enabled)} onChange={parameters_enabled=>onDraftChange({...draft,trial_config:{...draft.trial_config,parameters_enabled}})}/></Flex>
        {draft.trial_config?.parameters_enabled&&<Input.TextArea className="coldchain-json-textarea" rows={5} value={draft.trial_config?.parameters_json||'{\n  "temperature": 0.2\n}'} onChange={event=>onDraftChange({...draft,trial_config:{...draft.trial_config,parameters_json:event.target.value}})}/>} 
        <Alert type="success" showIcon message="高分辨率直接重绘" description="字号、边框、印章/图案、polygon 与 bbox 使用同一个统一缩放矩阵投影到最终画布，不会先生成低清图再放大。"/>
        <Alert type="info" showIcon message="试运行会真实执行三类字段生成器" description="字典 + 规则和计算值在本地执行；所有“模型 + Prompt”字段会合并成一次 Qwen-8B 调用，并在试运行结果中显示字段数和调用次数。"/>
      </Space>
    </Card>
    {validation ? <Card size="small" title="校验结果" extra={<Space><Tag color={validation.valid ? 'green' : 'red'}>{validation.valid ? '通过' : '未通过'}</Tag><Tag>{validation.summary?.errors||0} 错误</Tag><Tag>{validation.summary?.warnings||0} 警告</Tag></Space>}>
      <List size="small" dataSource={validation.issues || []} locale={{emptyText:'没有发现问题'}} renderItem={issue => <List.Item><Space align="start"><Tag color={issue.level === 'error' ? 'red' : 'orange'}>{issue.level === 'error' ? '错误' : '警告'}</Tag><div><Text>{issue.message}</Text>{issue.object_id && <div><Text type="secondary">{issue.object_id}</Text></div>}</div></Space></List.Item>}/>
    </Card> : <Empty description="尚未执行校验"/>}
    {trialUrl ? <><Card size="small" title="试运行样例图" extra={<Tag color={qualityColor}>{quality.quality_status || '已完成'}</Tag>}><Image src={templateApi.artifactUrl(trialUrl)} className="template-trial-image"/>{quality.field_generation?.status === 'local_fallback' && <Alert className="section-title" type="warning" showIcon message="百炼调用失败，本次已使用本地安全兜底完成试运行" description={`模型+Prompt字段使用确定性虚构值生成；图片和质检结果仍有效。原因：${quality.field_generation?.warning || '网络或模型响应异常'}`}/>}</Card><Card size="small" title="质检报告" extra={<Space><Tag color={qualityColor}>{quality.quality_status||'PASS'}</Tag>{reportUrl&&<Button type="link" href={templateApi.artifactUrl(reportUrl)} target="_blank">打开 Markdown 报告</Button>}</Space>}><Alert type={quality.quality_status==='REJECT'?'error':quality.quality_status==='REVIEW'?'warning':'success'} showIcon message="试运行样例已完成质检" description={`输出 ${quality.output_size?.width||'-'}×${quality.output_size?.height||'-'}；检查 ${quality.quality_summary?.checks??reportRows.length} 项，阻断 ${quality.quality_summary?.rejected??0} 项，复核 ${quality.quality_summary?.review??0} 项。`}/><Descriptions className="section-title" bordered size="small" column={4} items={[{key:'scale',label:'统一缩放',children:`${Number(quality.transform?.scale||0).toFixed(3)}×`},{key:'polygon',label:'polygon 有效率',children:quality.quality_metrics?.polygon_valid_rate!=null?`${(quality.quality_metrics.polygon_valid_rate*100).toFixed(2)}%`:'-'},{key:'height',label:'字段高度中位数',children:quality.quality_metrics?.dynamic_field_height_median!=null?`${quality.quality_metrics.dynamic_field_height_median}px`:'N/A'},{key:'field-model',label:'模型字段/API调用',children:`${quality.field_generation?.field_count||0} 个 / ${quality.field_generation?.model_calls||0} 次`}]}/><Table className="section-title" size="small" pagination={false} rowKey="id" dataSource={reportRows} columns={[{title:'规则名称',dataIndex:'name'},{title:'规则 ID',dataIndex:'id',render:value=><Text code>{value}</Text>},{title:'规则类型',dataIndex:'type',width:120},{title:'检查结果',dataIndex:'result',width:110,render:value=><Tag color="green">{value}</Tag>}]}/></Card></>:<Empty description="点击“开始试运行”生成样例图和质检报告"/>}
  </Space>;
}

function AnalysisSummary({ job, analysisInfo, sourceUrl, onContinue }) {
  const completedByModel = job?.result?.semantic_status === 'completed';
  return <Card className="main-card template-analysis-summary" title="版面分析与语义提取" extra={<Tag color="green">分析完成</Tag>}>
    <Alert type={completedByModel ? 'success' : 'warning'} showIcon message={completedByModel ? '种子图片已完成版面分析、OCR 与整单语义 workflow' : '版面与 OCR 已完成，Qwen 语义 workflow 使用了本地兜底'} description={completedByModel ? '动态字段已自动生成数据类型、生成规则和质检规则；低置信度结果会在属性面板标记待复核。' : '草稿不会丢失，但所有兜底字段都会标记待复核；可选中单个文字后重新提取与复核。'}/>
    <Row gutter={20} className="section-title">
      <Col span={9}><Image src={sourceUrl} width="100%" style={{ maxHeight: 480, objectFit: 'contain', background: '#f5f5f5' }}/></Col>
      <Col span={15}><Descriptions bordered column={1} items={[
        { key:'name', label:'模板名称', children:analysisInfo?.name || job?.name },
        { key:'business', label:'业务类型', children:analysisInfo?.businessType || job?.business_type },
        { key:'file', label:'种子图片', children:analysisInfo?.fileName || job?.input?.filename || '-' },
        { key:'imgsz', label:'版面推理尺寸', children:`${analysisInfo?.imgsz || job?.parameters?.imgsz || '-'}px` },
        { key:'conf', label:'置信度阈值', children:analysisInfo?.conf ?? job?.parameters?.conf ?? '-' },
        { key:'model', label:'语义模型', children:analysisInfo?.semanticModel || job?.parameters?.semantic_model || '-' },
        { key:'prompt', label:'Prompt 版本', children:analysisInfo?.promptVersion || job?.parameters?.semantic_prompt_version || '-' },
        { key:'result', label:'分析结果', children:`${job?.result?.cell_count || 0} 个单元格，${job?.result?.text_count || 0} 个文字对象，${job?.result?.field_count || 0} 个动态字段，${job?.result?.semantic_counts?.review_required || 0} 个待复核` },
      ]}/><Button className="section-title" type="primary" icon={<ArrowRightOutlined/>} onClick={onContinue}>继续结构校准</Button></Col>
    </Row>
  </Card>;
}

export default function TemplateEditor({ job, open, onClose, onUpdated, presentation = 'drawer', analysisInfo = null, readOnly = false }) {
  const [draft, setDraft] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [rebuildProposal, setRebuildProposal] = useState(null);
  const [currentJob, setCurrentJob] = useState(job);
  const [step, setStep] = useState(analysisInfo ? 1 : 0);
  const [selection, setSelection] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [zoom, setZoom] = useState(1);
  const [privacyVisible,setPrivacyVisible]=useState(true);
  const [semanticConfig, setSemanticConfig] = useState(null);
  const activeJob = currentJob?.id === job?.id ? currentJob : job;
  const editorReady = Boolean(draft && currentJob?.id === job?.id);
  const published = Boolean(activeJob?.result?.published_template);
  const hasAnalysisStep = Boolean(analysisInfo);
  const editorStep = hasAnalysisStep ? step - 1 : step;
  const visibleStepItems = hasAnalysisStep ? [{ title: '版面分析与语义提取', description: 'OCR + Qwen 整单推理' }, ...stepItems] : stepItems;
  const maxStep = visibleStepItems.length - 1;

  useEffect(() => {
    if (!open || !job?.id) {
      setDraft(null); setCurrentJob(null); setSelection(null); setDirty(false);
      setSavedDraft(null); setHistory([]); setFuture([]); setRebuildProposal(null);
      setLoading(false); setAction('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true); setDraft(null); setSavedDraft(null); setHistory([]); setFuture([]); setRebuildProposal(null); setCurrentJob(job); setSelection(null); setDirty(false); setStep(analysisInfo ? 1 : 0);
    Promise.all([templateApi.getDraft(job.id), templateApi.getJob(job.id), templateApi.semanticConfig().catch(() => null)])
      .then(([draftValue, jobValue, semanticValue]) => {
        if (!cancelled) { const normalized={...draftValue,texts:(draftValue.texts||[]).map((item,index)=>({...item,binding_object_id:item.binding_object_id||item.field_id||`BIND-${String(index+1).padStart(4,'0')}`}))}; setDraft(normalized); setSavedDraft(normalized); setCurrentJob(jobValue); setSemanticConfig(semanticValue); }
      })
      .catch(error => { if (!cancelled) message.error(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, job?.id, hasAnalysisStep]);

  const updateDraft = value => {
    if (published || !draft) return;
    setHistory(items => [...items, draft].slice(-50));
    setFuture([]);
    setDraft(value);
    setDirty(true);
  };
  const undo = () => {
    if (!history.length || published) return;
    const previous = history[history.length - 1];
    setHistory(items => items.slice(0, -1));
    setFuture(items => [draft, ...items].slice(0, 50));
    setDraft(previous); setSelection(null); setDirty(true);
  };
  const redo = () => {
    if (!future.length || published) return;
    const next = future[0];
    setFuture(items => items.slice(1));
    setHistory(items => [...items, draft].slice(-50));
    setDraft(next); setSelection(null); setDirty(true);
  };
  useEffect(() => {
    if (!open || !editorReady || published) return undefined;
    const handleHistoryShortcut = event => {
      const target = event.target;
      const tagName = String(target?.tagName || '').toLowerCase();
      const editingText = target?.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
      if (editingText || !(event.ctrlKey || event.metaKey) || event.altKey || String(event.key).toLowerCase() !== 'z') return;
      if (event.shiftKey) {
        if (!future.length) return;
        event.preventDefault();
        redo();
        return;
      }
      if (!history.length) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [open, editorReady, published, history, future, draft]);
  const visibility = useMemo(() => ({
    background: draft?.layers?.background?.visible !== false,
    table: draft?.layers?.table?.visible !== false,
    text: draft?.layers?.text?.visible !== false,
    asset: draft?.layers?.asset?.visible !== false,
  }), [draft?.layers]);

  const save = async () => {
    if (!draft || published) return draft;
    setAction('save');
    try {
      const payload = await templateApi.saveDraft(job.id, draft);
      setDraft(payload.draft); setSavedDraft(payload.draft); setCurrentJob(payload.job); setDirty(false); setHistory([]); setFuture([]); onUpdated?.(payload.job);
      message.success('草稿已保存');
      return payload.draft;
    } catch (error) { message.error(error.message); throw error; }
    finally { setAction(''); }
  };
  const ensureSaved = async () => dirty ? save() : draft;
  const extractLayers = async targets => {
    setAction(targets[0] === 'text' ? 'extract-text' : 'extract-asset');
    try {
      await ensureSaved();
      const payload = await templateApi.extractLayers(job.id, targets);
      setDraft(payload.draft); setSavedDraft(payload.draft); setCurrentJob(payload.job);
      setDirty(false); setHistory([]); setFuture([]); setSelection(null); onUpdated?.(payload.job);
      const count = targets.includes('text') ? payload.draft.texts.length : payload.draft.assets.length;
      message[count ? 'success' : 'warning'](count ? `重新提取完成，共 ${count} 个候选对象` : '重新提取完成，但尚未提取到对象');
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const reextractSelectedText = () => {
    if (selection?.kind !== 'text') return;
    const textId = selection.id;
    Modal.confirm({
      title: `重新提取 ${textId}？`,
      content: '系统只会在该文字框内重新执行 PP-OCRv5，并覆盖当前文字内容及其字段生成/质检配置；随后再调用一次 Qwen-8B，并参考整单其他字段关系重新判断。该操作不会新增文字对象。',
      okText: '确认覆盖并重新提取', cancelText: '取消',
      onOk: async () => {
        setAction('extract-text');
        try {
          const saved = await ensureSaved();
          const payload = await templateApi.reextractText(job.id, textId, { revision:saved.revision, semanticModel:activeJob?.parameters?.semantic_model || 'qwen3-vl-8b-instruct' });
          setDraft(payload.draft); setSavedDraft(payload.draft); setCurrentJob(payload.job);
          setDirty(false); setHistory([]); setFuture([]); setSelection({ kind:'text', id:textId }); onUpdated?.(payload.job);
          message[payload.semantic?.status === 'completed' ? 'success' : 'warning'](payload.semantic?.status === 'completed' ? `${textId} 已覆盖并完成整单关系复核` : `${textId} 已覆盖；模型不可用，当前规则标记为待复核`);
        } catch (error) { message.error(error.message); throw error; }
        finally { setAction(''); }
      },
    });
  };
  const uploadAsset = async (assetId, file) => {
    setAction(`upload-asset-${assetId}`);
    try {
      const payload = await templateApi.uploadAsset(job.id, file);
      const reference = payload.asset_reference;
      updateDraft({
        ...draft,
        assets: draft.assets.map(asset => asset.id === assetId ? {
          ...asset,
          locked: true,
          source: { kind: 'manual', reason: 'asset_upload' },
          generator: { ...asset.generator, ...reference, type: 'fixed_asset' },
        } : asset),
      });
      message.success(`PNG 素材已上传：${reference.width}×${reference.height}`);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const reextractTable = () => {
    Modal.confirm({
      title: '重新识别最小单元格？',
      content: '系统会保留已经手工修改并锁定的单元格，替换其余自动识别框，然后重新执行最小行拆分和非重叠整理。',
      okText: '开始重新识别', cancelText: '取消',
      onOk: async () => {
        setAction('extract-table');
        try {
          await ensureSaved();
          const payload = await templateApi.extractTable(job.id);
          setDraft(payload.draft); setSavedDraft(payload.draft); setCurrentJob(payload.job);
          setDirty(false); setHistory([]); setFuture([]); setSelection(null); onUpdated?.(payload.job);
          const report = payload.report || {};
          message.success(`重新识别完成：原始 ${report.raw_cell_count ?? '-'} 个，最终 ${payload.draft.cells.length} 个，面积重叠 0`);
        } catch (error) { message.error(error.message); throw error; }
        finally { setAction(''); }
      },
    });
  };
  const rebuild = async () => {
    setAction('rebuild');
    try {
      await ensureSaved();
      const payload = await templateApi.rebuild(job.id);
      setDraft(payload.draft); setSavedDraft(payload.draft); setDirty(false); setHistory([]); setFuture([]);
      setRebuildProposal(payload.proposal);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const applyRebuild = async () => {
    if (!rebuildProposal) return;
    setAction('apply-rebuild');
    try {
      const payload = await templateApi.applyRebuild(job.id, rebuildProposal.proposal_id);
      setDraft(payload.draft); setSavedDraft(payload.draft); setCurrentJob(payload.job);
      setDirty(false); setHistory([]); setFuture([]); setSelection(null); setRebuildProposal(null); onUpdated?.(payload.job);
      message.success('已应用重建候选，当前为正式草稿');
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const discardRebuild = async () => {
    setAction('discard-rebuild');
    try {
      const payload = await templateApi.discardRebuild(job.id);
      setDraft(payload.draft); setSavedDraft(payload.draft); setRebuildProposal(null);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const resetStep = () => {
    if (!savedDraft || published) return;
    const keysByStep = [['cells'], ['texts', 'assets', 'fields'], ['quality_rules'], []];
    const labels = ['结构校准', '语义与字段规则', '校验试运行'];
    if (editorStep < 0) return;
    Modal.confirm({
      title: `重置“${labels[editorStep]}”步骤？`,
      content: '本步骤尚未保存的修改将恢复为最近一次已保存草稿，其他步骤不变。',
      okText: '确认重置', cancelText: '取消',
      onOk: () => {
        const restored = { ...draft };
        keysByStep[editorStep].forEach(key => { restored[key] = savedDraft[key]; });
        if (editorStep === 0) restored.layers = { ...draft.layers, table: savedDraft.layers.table };
        if (editorStep === 1) restored.layers = { ...draft.layers, text: savedDraft.layers.text, asset: savedDraft.layers.asset };
        updateDraft(restored); setSelection(null);
      },
    });
  };
  const restoreSystemDraft = () => {
    if (published) return;
    Modal.confirm({
      title: '恢复系统初稿？',
      content: '此操作会覆盖全部未发布编辑，并恢复为系统生成的初始草稿。该操作适合在当前编辑不可恢复时使用。',
      okText: '恢复系统初稿', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        setAction('restore-system');
        try {
          const payload = await templateApi.restoreSystemDraft(job.id);
          setDraft(payload.draft); setSavedDraft(payload.draft); setCurrentJob(payload.job);
          setDirty(false); setHistory([]); setFuture([]); setSelection(null); onUpdated?.(payload.job);
          message.success('已恢复系统初稿');
        } catch (error) { message.error(error.message); }
        finally { setAction(''); }
      },
    });
  };
  const validate = async () => {
    setAction('validate');
    try {
      await ensureSaved();
      const payload = await templateApi.validate(job.id);
      setDraft(payload.draft); setCurrentJob(payload.job); onUpdated?.(payload.job);
      message[payload.validation.valid ? 'success' : 'warning'](payload.validation.valid ? '校验通过，可以试运行' : '存在阻断错误，请按问题列表修正');
      setStep(hasAnalysisStep ? 3 : 2);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const trial = async () => {
    setAction('trial');
    try {
      await ensureSaved();
      const payload = await templateApi.trialRun(job.id);
      setDraft(payload.draft); setCurrentJob(payload.job); onUpdated?.(payload.job);
      message[payload.quality?.status === 'REJECT' ? 'warning' : 'success'](`已生成 1 张图片并完成质检：${payload.quality?.status || '完成'}`); setStep(hasAnalysisStep ? 3 : 2);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const publish = async () => {
    setAction('publish');
    try {
      const payload = await templateApi.publish(job.id);
      setCurrentJob(payload.job); onUpdated?.(payload.job); message.success(`${payload.template.template_id} 已发布`);
    } catch (error) { message.error(error.message); }
    finally { setAction(''); }
  };
  const changeStep = async value => {
    if (value > step && dirty) {
      try { await save(); } catch { return; }
    }
    setStep(Math.max(0, Math.min(maxStep, value))); setSelection(null);
  };
  const requestClose = () => {
    if (!dirty) return onClose();
    Modal.confirm({ title: '草稿尚未保存', content: '关闭后本次修改会丢失。', okText: '放弃修改并关闭', okButtonProps: { danger: true }, cancelText: '继续编辑', onOk: onClose });
  };
  if (!job) return null;
  const sourceUrl = activeJob?.artifact_urls?.input ? templateApi.artifactUrl(activeJob.artifact_urls.input) : '';

  const stateLabels = { system_draft: '系统初稿', user_draft: '用户草稿', rebuild_candidate: '重建候选', formal_draft: '正式草稿' };
  const rebuildReport = rebuildProposal?.report || {};
  const currentTrialReady = draft?.trial_run?.revision === draft?.revision
    && ['PASS','REVIEW'].includes(draft?.trial_run?.quality_status);
  const advanceOrFinish = () => {
    if (step < maxStep) return changeStep(step + 1);
    if (currentTrialReady) return publish();
    return trial();
  };
  const finalActionLabel = published
    ? '已发布'
    : currentTrialReady
      ? '发布模板'
      : draft?.trial_run?.quality_status === 'REJECT'
        ? '修正后重新试运行'
        : '保存、试运行并质检';

  const editorStatus = <Space wrap>{draft?.workflow_state && <Tag color="cyan">{stateLabels[draft.workflow_state] || draft.workflow_state}</Tag>}{dirty && <Tag color="orange">未保存</Tag>}{published && <Tag color="green">已发布</Tag>}</Space>;
  const editorContent = <>
    {loading || !editorReady ? <div className="template-editor-loading"><Spin tip="正在读取模板草稿"/></div> : <>
      <Flex justify="space-between" align="center" className="template-editor-header template-editor-step-actions-top"><div><Title level={4}>{activeJob.name}</Title><Space><Tag>文档类图像</Tag><Tag>{activeJob.business_type}</Tag><Text type="secondary">{activeJob.id}</Text></Space></div><Space>{editorStatus}<Button icon={<ArrowLeftOutlined/>} disabled={step === 0} onClick={() => { setStep(value => Math.max(0, value - 1)); setSelection(null); }}>上一步</Button>{readOnly?<Button type="primary" icon={<ArrowRightOutlined/>} disabled={step===maxStep} onClick={()=>{setStep(value=>Math.min(maxStep,value+1));setSelection(null);}}>下一步</Button>:<><Button icon={<SaveOutlined/>} disabled={!editorReady || !dirty || published} loading={action === 'save'} onClick={save}>保存草稿</Button><Button type="primary" icon={step === maxStep && currentTrialReady ? <SafetyCertificateOutlined/> : <ArrowRightOutlined/>} disabled={published} loading={step === maxStep ? ['save','trial','publish'].includes(action) : action === 'save'} onClick={advanceOrFinish}>{step === maxStep ? finalActionLabel : '下一步'}</Button></>}</Space></Flex>
      <Steps current={step} items={visibleStepItems} onChange={changeStep} className="template-editor-steps"/>
      {published && <Alert type="success" showIcon message="模板已经发布" description="当前页面以只读方式展示已发布内容。"/>}
      {hasAnalysisStep && step === 0 ? <AnalysisSummary job={activeJob} analysisInfo={analysisInfo} sourceUrl={sourceUrl} onContinue={() => changeStep(1)}/> : editorStep === 2 ? <Card className="template-editor-quality-page" title="质检规则配置"><DocumentQualityPanel draft={draft} onDraftChange={updateDraft}/></Card> : editorStep === 3 ? <Card className="template-editor-quality-page" title="试运行与发布"><ValidationPanel draft={draft} job={activeJob} onDraftChange={updateDraft} onTrial={trial} trialRunning={action==='trial'}/></Card> : <Row gutter={12} className="template-editor-workspace">
        <Col flex="250px">
          <LayerToolbar draft={draft} onChange={updateDraft} lockedLayers={editorStep === 1 ? { table:true } : {}}/>
          {editorStep === 0 && <StructureTools draft={draft} selection={selection} onDraftChange={updateDraft} onSelection={setSelection} onRebuild={rebuild} rebuilding={action === 'rebuild'} onReextract={reextractTable} reextracting={action === 'extract-table'}/>} 
          {editorStep === 1 && <SemanticTools draft={draft} selection={selection} onDraftChange={updateDraft} onSelection={setSelection} onExtract={extractLayers} onReextractText={reextractSelectedText} extracting={action === 'extract-text' ? 'text' : action === 'extract-asset' ? 'asset' : ''}/>} 
          {editorStep === 3 && <Card size="small" title="当前门槛" className="template-editor-card"><Progress percent={draft.trial_run?.revision === draft.revision && draft.validation?.valid ? 100 : draft.validation?.valid ? 70 : 30} status={draft.validation?.valid ? 'active' : 'normal'}/><Text type="secondary">保存 → 校验 → 试运行 → 发布</Text></Card>}
        </Col>
        <Col flex="auto" className="template-canvas-column">
          <Flex justify="space-between" align="center" className="template-canvas-toolbar"><Space wrap><FileImageOutlined/><Text strong>模板画布</Text><Text type="secondary">蓝=单元格，绿=文字，红=图案</Text><Tooltip title="撤销（Ctrl+Z）"><Button size="small" aria-keyshortcuts="Control+Z" icon={<UndoOutlined/>} disabled={!editorReady || !history.length || published} onClick={undo}>撤销</Button></Tooltip><Tooltip title="重做（Ctrl+Shift+Z）"><Button size="small" aria-keyshortcuts="Control+Shift+Z" icon={<RedoOutlined/>} disabled={!editorReady || !future.length || published} onClick={redo}>重做</Button></Tooltip><Button size="small" icon={<ReloadOutlined/>} disabled={published} onClick={restoreSystemDraft}>恢复系统初稿</Button></Space><Space><Tooltip title={privacyVisible?'关闭后查看原始底图':'打开隐私保护层'}><Button icon={privacyVisible?<EyeOutlined/>:<EyeInvisibleOutlined/>} type={privacyVisible?'primary':'default'} onClick={()=>setPrivacyVisible(value=>!value)}>隐私保护层</Button></Tooltip><Text type="secondary">缩放</Text><Slider min={0.65} max={1.35} step={0.05} value={zoom} onChange={setZoom} style={{ width: 130 }}/><Text>{Math.round(zoom * 100)}%</Text></Space></Flex>
          <TemplateCanvas draft={draft} sourceUrl={sourceUrl} visibility={visibility} privacyVisible={privacyVisible} selection={selection} onSelection={setSelection} onDraftChange={updateDraft} zoom={zoom} interactionLocks={editorStep === 1 ? { table:true } : {}}/>
        </Col>
        <Col flex="340px"><PropertyPanel draft={draft} selection={selection} onDraftChange={updateDraft} jobId={job.id} onAssetUpload={uploadAsset} uploadingAssetId={action.startsWith('upload-asset-') ? action.replace('upload-asset-', '') : ''} semanticConfig={semanticConfig}/></Col>
      </Row>}
    </>}
    <Modal title="表格重建候选" width={760} open={Boolean(rebuildProposal)} onCancel={discardRebuild} footer={<Space><Button loading={action === 'discard-rebuild'} onClick={discardRebuild}>保留当前草稿</Button><Button type="primary" disabled={!rebuildProposal?.can_apply} loading={action === 'apply-rebuild'} onClick={applyRebuild}>应用新表格</Button></Space>}>
      {rebuildProposal && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type={rebuildProposal.can_apply ? 'success' : 'warning'} showIcon message={rebuildProposal.can_apply ? '候选表格已消除面积重叠，可确认应用' : '锁定单元格仍有冲突，请取消后调整锁定框'} description="生成候选不会覆盖当前草稿；只有点击“应用新表格”才会写入正式草稿。"/>
        <Descriptions bordered size="small" column={2} items={[
          { key: 'cells', label: '单元格数量', children: `${rebuildReport.input_cells ?? '-'} → ${rebuildReport.output_cells ?? '-'}` },
          { key: 'overlaps', label: '面积重叠', children: `${rebuildReport.overlaps_before ?? '-'} → ${rebuildReport.overlaps_after ?? '-'}` },
          { key: 'duplicates', label: '删除重复框', children: rebuildReport.removed_duplicates ?? 0 },
          { key: 'containers', label: '删除容器框', children: rebuildReport.removed_containers ?? 0 },
          { key: 'snap', label: '吸附边缘', children: rebuildReport.snapped_edges ?? 0 },
          { key: 'gaps', label: '补齐空隙', children: rebuildReport.filled_gaps ?? 0 },
          { key: 'fixed', label: '消除重叠操作', children: rebuildReport.eliminated_overlaps ?? 0 },
          { key: 'locked', label: '未解决锁定冲突', children: rebuildReport.unresolved_locked_overlaps ?? 0 },
        ]}/>
      </Space>}
    </Modal>
  </>;
  if (presentation === 'page') return <div className="template-editor-page">
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={requestClose}/><div><Title level={2}>{readOnly?'文档类图像模板详情':'编辑文档类图像模板'}</Title><Paragraph type="secondary">{readOnly?'只读查看模板内容，可使用上一步和下一步浏览全部配置。':'修改模板草稿内容并完成试运行与发布。'}</Paragraph></div></Space></Flex>
    {editorContent}
  </div>;
  return <Drawer className={`template-editor-drawer${readOnly ? ' template-editor-readonly' : ''}`} title="表格类模板编辑器" size="96vw" open={open} onClose={requestClose}>{editorContent}</Drawer>;
}
