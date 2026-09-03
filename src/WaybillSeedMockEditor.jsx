import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Divider, Flex, Form, Input, InputNumber, Row, Select, Space, Steps, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, EyeInvisibleOutlined, EyeOutlined, LeftOutlined, PlusOutlined, PlayCircleOutlined, RedoOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const BASE_IMAGE = '/assets/template-mock/orange-waybill-base.png';

const RAW_FIELDS = [
  ['waybill_no','运单标识','运单号码','Barcode No.'],
  ['sender_name','寄件信息','寄件人姓名','FROM'], ['departure','寄件信息','始发地','DEPARTURE'],
  ['sender_company','寄件信息','单位名称','COMPANY NAME'], ['sender_address','寄件信息','寄件地址','ADDRESS'],
  ['sender_province','寄件信息','省','Province'], ['sender_city','寄件信息','市（县）','City'], ['sender_town','寄件信息','区（镇）','Town'],
  ['sender_mobile','寄件信息','联系手机（非常重要）','MOBILE PHONE (VERY IMPORTANT)'], ['sender_phone','寄件信息','固定电话','PHONE'],
  ['receiver_name','收件信息','收件人姓名','TO'], ['receiver_city_name','收件信息','城市','CITY'],
  ['receiver_company','收件信息','单位名称','COMPANY NAME'], ['receiver_address','收件信息','收件地址','ADDRESS'],
  ['receiver_province','收件信息','省','Province'], ['receiver_city','收件信息','市（县）','City'], ['receiver_town','收件信息','区（镇）','Town'],
  ['receiver_mobile','收件信息','联系手机（非常重要）','MOBILE PHONE (VERY IMPORTANT)'], ['receiver_phone','收件信息','固定电话','PHONE'],
  ['content_document','物品类型','文件','DOCUMENT'], ['content_parcel','物品类型','物品','PARCEL'],
  ['contents_name','内件信息','内件品名','NAME OF CONTENTS'], ['contents_amount','内件信息','数量','AMOUNT'],
  ['weight','重量体积','重量','WEIGHT'], ['weight_unit','重量体积','千克','KG'], ['volume','重量体积','体积','VOLUME'],
  ['dimensions','重量体积','长×宽×高','L×W×H'], ['volume_unit','重量体积','立方厘米','CM³'],
  ['payment_method','结算信息','付款方式','MEANS OF PAYMENT'], ['payment_cash','结算信息','现金','CASH'], ['payment_agreement','结算信息','协议结算','AGREEMENT'],
  ['insurance_amount','费用信息','保价金额','INSURANCE AMOUNT'], ['charge','费用信息','资费','CHARGE'],
  ['insurance_fee','费用信息','保价费','INSURANCE FEE'], ['total_amount','费用信息','费用总计','TOTAL AMOUNT'],
  ['receiver_signature','签收信息','收件人签名',"RECEIVER'S SIGNATURE"], ['receiver_id_no','签收信息','证件号','ID NO.'],
  ['authorized_signature','签收信息','代收人签名','AUTHORIZED SIGNATURE'], ['received_date','签收信息','签收日期','年/月/日，Y/M/D'],
  ['remark','备注','备注','REMARK'], ['sender_signature','揽收信息','寄件人签名',"SENDER'S SIGNATURE"],
  ['pickup_signature','揽收信息','揽件人签名','PICKED UP BY (SIGNATURE)'], ['sent_datetime','揽收信息','寄件日期时间','年/月/日/时'],
  ['track_qr','查询信息','扫码查询','TRACK'], ['address_copy','联次标识','名址联','Address copy'],
];

const SAMPLES = {
  waybill_no:'OT20260901001', sender_name:'林川', departure:'广州', sender_company:'星河合成贸易有限公司', sender_address:'广东省广州市训练路88号',
  sender_province:'广东省', sender_city:'广州市', sender_town:'天河区', sender_mobile:'13800001234', sender_phone:'020-80001234',
  receiver_name:'周宁', receiver_city_name:'上海', receiver_company:'云帆合成供应链有限公司', receiver_address:'上海市浦东新区样本路66号',
  receiver_province:'上海市', receiver_city:'上海市', receiver_town:'浦东新区', receiver_mobile:'13900005678', receiver_phone:'021-80005678',
  content_document:'否', content_parcel:'是', contents_name:'训练用包装材料', contents_amount:'2件', weight:'3.50', weight_unit:'KG', volume:'24000', dimensions:'40×30×20', volume_unit:'CM³',
  payment_method:'协议结算', payment_cash:'否', payment_agreement:'是', insurance_amount:'1000.00', charge:'36.00', insurance_fee:'5.00', total_amount:'41.00',
  receiver_signature:'合成收件人', receiver_id_no:'SYN-ID-260901-01', authorized_signature:'—', received_date:'2026/09/01', remark:'请轻放',
  sender_signature:'合成寄件人', pickup_signature:'合成揽件员', sent_datetime:'2026-09-01 10:00:00', track_qr:'SYNTHETIC:OT20260901001', address_copy:'名址联',
};

const REGION_POSITIONS = {
  运单标识:[48,15,27,5], 寄件信息:[9,24,34,5], 收件信息:[49,24,34,5], 物品类型:[10,51,18,4],
  内件信息:[10,59,31,5], 重量体积:[49,51,34,4], 结算信息:[49,59,34,4], 费用信息:[49,66,34,4],
  签收信息:[49,72,34,5], 备注:[49,84,34,4], 揽收信息:[10,72,34,5], 查询信息:[85,5,8,8], 联次标识:[94,23,4,16],
};

function initialFields() {
  const counters = {};
  return RAW_FIELDS.map(([key, region, zh, en]) => {
    const index = counters[region] || 0; counters[region] = index + 1;
    const [x,y,w,h] = REGION_POSITIONS[region];
    const columns = region === '寄件信息' || region === '收件信息' ? 3 : 2;
    return {
      key, boundKey:key, region, zh, en, sample:SAMPLES[key] || `合成${zh}`,
      x:Math.min(94, x + (index % columns) * (w / columns)), y:Math.min(91, y + Math.floor(index / columns) * 5),
      w:Math.max(7, w / columns - 1), h, dataType:/日期|时间/.test(zh)?'date':/金额|资费|费|重量|体积|数量/.test(zh)?'number':/电话|手机/.test(zh)?'phone':/号码|证件/.test(zh)?'code':'text',
      fontSize:12, generation:'dictionary_rule', rule:`生成虚构${zh}；保持同一张运单内语义一致`, quality:`必填；格式符合${en}；不得包含真实可追踪信息`,
    };
  });
}

function initialFixedTexts(fields) {
  return fields.slice(0,18).map((field,index)=>({id:`fixed_${field.key}`,text:field.zh,x:Math.max(1,field.x-2),y:Math.max(1,field.y-3),w:Math.max(7,field.w),h:3,fontSize:10,color:'#262626',index}));
}

const WORKFLOW_STEPS=[
  {title:'基础信息与种子图片',description:'选择底图生成法'},
  {title:'字段解析与在线编辑',description:'字段、位置与生成规则'},
  {title:'质检规则配置',description:'基础规则与场景规则'},
  {title:'试运行与发布',description:'预览并确认模板'},
];
const BASE_QUALITY_RULES=[
  ['BASE-STRUCTURE','输出内容结构检查','检查画布、图层、单元格、固定文字、动态字段和图案对象是否齐全'],['BASE-PRIVACY','隐私与敏感信息检查','检查是否残留真实姓名、联系方式、地址、业务标识和密钥'],['BASE-DUPLICATE','重复检查','检查字段 ID、固定文字、单元格和图案对象是否完全重复'],['BASE-FIELD-ID','字段 ID 唯一性检查','检查动态字段 ID 唯一、非空并符合命名规则'],['BASE-REQUIRED','必填字段检查','检查必填字段、生成规则和绑定关系完整'],['BASE-TYPE-FORMAT','字段类型与格式检查','检查日期、金额、数字、代码和枚举等类型与格式'],['BASE-GEOMETRY','几何与越界检查','检查文字框、图案和隐私区域坐标有效且未超出画布'],['BASE-ASSET','图案素材有效性检查','检查印章、图标和二维码等素材引用及安全配置'],
];

function OverlayCanvas({ fields, fixedTexts=[], visibility={}, selectedKey, selectedFixedId, onSelect, onSelectFixed, onMove, trial=false, readOnly=false }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const pointerDown = (event, item, kind='dynamic') => {
    if (trial || readOnly) return;
    event.preventDefault(); event.stopPropagation();
    if(kind==='fixed') onSelectFixed?.(item.id); else onSelect?.(item.key);
    dragRef.current = { key:kind==='fixed'?item.id:item.key, kind, startX:event.clientX, startY:event.clientY, x:item.x, y:item.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = event => {
    if (!dragRef.current || trial || readOnly) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onMove(dragRef.current.key, Math.max(0, Math.min(96, dragRef.current.x + (event.clientX-dragRef.current.startX)/rect.width*100)), Math.max(0, Math.min(95, dragRef.current.y + (event.clientY-dragRef.current.startY)/rect.height*100)), dragRef.current.kind);
  };
  return <div className="waybill-layer-canvas" ref={canvasRef} onPointerMove={pointerMove} onPointerUp={()=>{dragRef.current=null}}>
    {visibility.pattern!==false&&<img src={BASE_IMAGE} alt="虚拟运单原始底图"/>}
    {visibility.pattern===false&&<div style={{aspectRatio:'1.77',background:'#fff'}}/>}
    <div className="waybill-layer-badge"><Tag color="orange">图案层</Tag><Tag color="green">固定文字层</Tag><Tag color="blue">动态文字层</Tag><Tag color="purple">隐私保护层</Tag></div>
    {visibility.fixed!==false&&fixedTexts.map(item=><div key={item.id} onPointerDown={event=>pointerDown(event,item,'fixed')} onClick={()=>onSelectFixed?.(item.id)} className={`waybill-fixed-text ${selectedFixedId===item.id?'selected':''}`} style={{left:`${item.x}%`,top:`${item.y}%`,width:`${item.w}%`,minHeight:`${item.h}%`,fontSize:item.fontSize,color:item.color}}>{item.text}</div>)}
    {visibility.dynamic!==false&&fields.map(field=>{const bound=fields.find(item=>item.key===(field.boundKey||field.key))||field;return <div key={field.key} title={`${field.zh} / 绑定 ${bound.key}`} onPointerDown={event=>pointerDown(event,field)} onClick={()=>onSelect?.(field.key)} className={`waybill-field-box ${selectedKey===field.key?'selected':''} ${trial?'trial':''}`} style={{left:`${field.x}%`,top:`${field.y}%`,width:`${field.w}%`,minHeight:`${field.h}%`,fontSize:`${field.fontSize || 12}px`,color:field.color||'#0958d9'}}>{bound.sample}</div>;})}
    {visibility.privacy!==false&&<div className="waybill-privacy-watermark">仅供合成训练数据使用　仅供合成训练数据使用　仅供合成训练数据使用</div>}
    {visibility.privacy!==false&&fields.filter(field=>['phone','address','code'].includes(field.dataType)).slice(0,10).map(field=><div key={`privacy-${field.key}`} className="waybill-privacy-mask" style={{left:`${field.x}%`,top:`${field.y}%`,width:`${field.w}%`,minHeight:`${field.h}%`}}>模糊处理</div>)}
  </div>;
}

function WaybillEditorWorkspace({ fields, fixedTexts, visibility, setVisibility, fieldTypeFilter, setFieldTypeFilter, selected, selectedFixed, selectedKey, selectedFixedId, selectDynamic, selectFixed, update, updateFixed, move, undo, redo, canUndo, canRedo, restore, readOnly }) {
  const layerItems=[['pattern','图案层'],['fixed','固定文字层'],['dynamic','动态文字层'],['privacy','隐私保护层']];
  const listItems=fieldTypeFilter==='fixed'?fixedTexts:fields;
  const isFixed=Boolean(selectedFixedId);
  return <Row gutter={16} className="section-title waybill-editor-workspace">
    <Col span={5}>
      <Card size="small" title="图层"><Space direction="vertical" style={{width:'100%'}}>{layerItems.map(([key,label])=><Flex key={key} justify="space-between" align="center"><Text>{label}</Text><Button className={`waybill-layer-toggle ${visibility[key]?'active':''}`} type={visibility[key]?'primary':'default'} ghost={visibility[key]} icon={visibility[key]?<EyeOutlined/>:<EyeInvisibleOutlined/>} onClick={()=>setVisibility(current=>({...current,[key]:!current[key]}))}>{visibility[key]?'显示':'隐藏'}</Button></Flex>)}</Space></Card>
      <Card size="small" className="section-title" title="字段列表">
        <Tabs size="small" activeKey={fieldTypeFilter} onChange={setFieldTypeFilter} items={[{key:'fixed',label:`固定文字（${fixedTexts.length}）`},{key:'dynamic',label:`动态文字（${fields.length}）`}]}/>
        <div className="waybill-field-list">{listItems.map(item=>{const key=fieldTypeFilter==='fixed'?item.id:item.key;const active=fieldTypeFilter==='fixed'?selectedFixedId===key:selectedKey===key;return <button type="button" className={active?'active':''} key={key} onClick={()=>fieldTypeFilter==='fixed'?selectFixed(key):selectDynamic(key)}><Text code>{key}</Text><span>{fieldTypeFilter==='fixed'?item.text:item.zh}</span></button>;})}</div>
      </Card>
    </Col>
    <Col span={13}><Card size="small" title="四图层在线编辑器" extra={!readOnly&&<Space><Button size="small" icon={<UndoOutlined/>} disabled={!canUndo} onClick={undo}>撤销</Button><Button size="small" icon={<RedoOutlined/>} disabled={!canRedo} onClick={redo}>重做</Button><Button size="small" icon={<ReloadOutlined/>} onClick={restore}>恢复系统初稿</Button></Space>}><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={visibility} selectedKey={selectedKey} selectedFixedId={selectedFixedId} onSelect={selectDynamic} onSelectFixed={selectFixed} onMove={move} readOnly={readOnly}/></Card></Col>
    <Col span={6}><Card size="small" title={isFixed?'固定文字属性':'动态字段属性'}>{isFixed?<Form layout="vertical"><Form.Item label="固定文字 ID"><Input value={selectedFixed.id} disabled/></Form.Item><Form.Item label="固定文字"><Input value={selectedFixed.text} disabled={readOnly} onChange={e=>updateFixed('text',e.target.value)}/></Form.Item><Row gutter={8}><Col span={12}><Form.Item label="X 位置"><InputNumber value={selectedFixed.x} disabled style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item label="Y 位置"><InputNumber value={selectedFixed.y} disabled style={{width:'100%'}}/></Form.Item></Col></Row><Text type="secondary">坐标只能在画布中拖拽文字框调整。</Text><Form.Item className="section-title" label="字号"><InputNumber min={6} max={48} value={selectedFixed.fontSize} disabled={readOnly} onChange={v=>updateFixed('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input type="color" value={selectedFixed.color} disabled={readOnly} onChange={e=>updateFixed('color',e.target.value)}/></Form.Item></Form>:<Form layout="vertical"><Form.Item label="绑定字段 Key"><Select showSearch optionFilterProp="label" value={selected.boundKey||selected.key} disabled={readOnly} options={fields.map(item=>({value:item.key,label:`${item.key} · ${item.zh}`}))} onChange={value=>update('boundKey',value)}/></Form.Item><Descriptions size="small" column={1} items={[{key:'box',label:'文字框 Key',children:<Text code>{selected.key}</Text>},{key:'region',label:'区域',children:selected.region}]}/><Divider/><Form.Item label="示例 Value"><Input value={selected.sample} disabled={readOnly} onChange={e=>update('sample',e.target.value)}/></Form.Item><Form.Item label="字符大小"><InputNumber min={8} max={36} value={selected.fontSize||12} disabled={readOnly} onChange={v=>update('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input type="color" value={selected.color||'#0958d9'} disabled={readOnly} onChange={e=>update('color',e.target.value)}/></Form.Item><Form.Item label="数据类型"><Select value={selected.dataType} disabled={readOnly} onChange={v=>update('dataType',v)} options={['text','code','phone','date','number','address','company_name'].map(value=>({value,label:value}))}/></Form.Item><Form.Item label="生成方式"><Select value={selected.generation} disabled={readOnly} onChange={v=>update('generation',v)} options={[{value:'dictionary_rule',label:'字典+规则'},{value:'computed',label:'计算值'},{value:'llm_prompt',label:'模型+Prompt'}]}/></Form.Item><Form.Item label="语义与生成约束"><Input.TextArea rows={3} value={selected.rule} disabled={readOnly} onChange={e=>update('rule',e.target.value)}/></Form.Item></Form>}</Card></Col>
  </Row>;
}

function WaybillTrialPanel({ trialConfig, setTrialConfig, runTrial, trialRunning, trialRan, fields, fixedTexts, qualityRules }) {
  const reportRows=[...BASE_QUALITY_RULES.map(([id,name])=>({id,name,type:id==='BASE-PRIVACY'?'隐私检查':'基础规则',result:'通过'})),...qualityRules.filter(item=>item.enabled!==false).map(item=>({id:item.ruleId,name:item.name,type:'场景规则',result:item.mode==='semantic'?'0.91':'通过'}))];
  const semanticRuleCount=qualityRules.filter(item=>item.enabled!==false&&item.mode==='semantic').length;
  const estimatedCalls=trialConfig.sampleCount*(1+semanticRuleCount);
  return <div className="waybill-trial-panel section-title">
    <Card size="small" title="试运行配置" extra={<Button type="primary" icon={<PlayCircleOutlined/>} loading={trialRunning} onClick={runTrial}>开始试运行</Button>}><Row gutter={12}><Col span={12}><Form.Item label="生成模型"><Select value={trialConfig.model} onChange={model=>setTrialConfig(current=>({...current,model}))} options={[{value:'qwen3-vl-8b-instruct',label:'Qwen-8B'}]}/></Form.Item></Col><Col span={12}><Form.Item label="试运行样本数量"><InputNumber min={1} max={10} value={trialConfig.sampleCount} onChange={sampleCount=>setTrialConfig(current=>({...current,sampleCount}))} style={{width:'100%'}}/></Form.Item></Col></Row><Flex justify="space-between"><Text>生成参数（可选）</Text><Switch checked={trialConfig.paramsEnabled} onChange={paramsEnabled=>setTrialConfig(current=>({...current,paramsEnabled}))}/></Flex>{trialConfig.paramsEnabled&&<Input.TextArea className="coldchain-json-textarea" rows={5} value={trialConfig.paramsJson} onChange={e=>setTrialConfig(current=>({...current,paramsJson:e.target.value}))}/>}<Descriptions className="section-title" bordered size="small" column={3} items={[{key:'generation',label:'样例生成调用',children:`${trialConfig.sampleCount} 次`},{key:'quality',label:'语义质检调用',children:`${trialConfig.sampleCount*semanticRuleCount} 次`},{key:'calls',label:'API 调用次数预估',children:`${estimatedCalls} 次`} ]}/></Card>
    {!trialRan?<Card className="section-title"><Alert type="info" showIcon message="尚未执行试运行" description="点击“开始试运行”后，系统才会生成样例并按模板中启用的质检规则输出报告。"/></Card>:<><Card className="section-title" size="small" title="试运行样例"><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={{pattern:true,fixed:true,dynamic:true,privacy:true}} trial/></Card><Card className="section-title" size="small" title="质检报告" extra={<Tag color="success">PASS</Tag>}><Descriptions bordered size="small" column={4} items={[{key:'samples',label:'样例数',children:trialConfig.sampleCount},{key:'rules',label:'执行规则',children:reportRows.length},{key:'passed',label:'通过',children:reportRows.length},{key:'failed',label:'未通过',children:0}]}/><Table className="section-title" size="small" pagination={false} rowKey="id" dataSource={reportRows} columns={[{title:'规则名称',dataIndex:'name'},{title:'规则 ID',dataIndex:'id',render:value=><Text code>{value}</Text>},{title:'规则类型',dataIndex:'type',width:120},{title:'检查结果',dataIndex:'result',width:110,render:value=><Tag color="green">{value}</Tag>}]}/></Card></>}
  </div>;
}

function WaybillQualityPanel({ qualityRules, patchQuality, setQualityRules }) {
  return <div className="waybill-quality-panel section-title"><Alert type="info" showIcon message={`共配置 ${BASE_QUALITY_RULES.length} 条基础规则和 ${qualityRules.length} 条场景规则`} description="基础规则由系统维护且始终执行；场景规则可开关和调整。函数判断统一返回 true / false，语义判断返回 0–1 分数。"/><Divider orientation="left">基础规则</Divider><Row gutter={[12,12]}>{BASE_QUALITY_RULES.map(([id,name,desc])=><Col span={6} key={id}><Card size="small" style={{height:'100%'}} className={`conversation-fixed-rule ${id==='BASE-PRIVACY'?'conversation-fixed-rule-privacy':'conversation-fixed-rule-other'}`}><Space direction="vertical"><Space><Text strong>{name}</Text><Tag color={id==='BASE-PRIVACY'?'blue':'green'}>{id==='BASE-PRIVACY'?'隐私检查':'基础规则'}</Tag></Space><Text type="secondary">{desc}</Text><Tag>{id}</Tag></Space></Card></Col>)}</Row><Divider orientation="left">场景规则</Divider>{qualityRules.map((rule,index)=><Card key={rule.ruleId} className="section-title conversation-quality-rule" size="small" extra={<Switch checked={rule.enabled} onChange={enabled=>patchQuality(index,{enabled})}/>}><Row gutter={12}><Col span={7}><Form.Item label="规则名称"><Input value={rule.name} onChange={e=>patchQuality(index,{name:e.target.value})}/></Form.Item></Col><Col span={6}><Form.Item label="规则 ID"><Input value={rule.ruleId} disabled/></Form.Item></Col><Col span={5}><Form.Item label="检查对象"><Select value={rule.target} onChange={target=>patchQuality(index,{target})} options={['版面结构','字段内容','两者'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={6}><Form.Item label="检查方式"><Select value={rule.mode} onChange={mode=>patchQuality(index,{mode})} options={[{value:'function',label:'函数判断'},{value:'semantic',label:'语义判断'}]}/></Form.Item></Col></Row>{rule.mode==='semantic'?<><Form.Item label="语义阈值"><InputNumber min={0} max={1} step={0.01} value={rule.threshold} onChange={threshold=>patchQuality(index,{threshold})}/></Form.Item><Form.Item label="语义判断 Prompt"><Input.TextArea rows={4} value={rule.prompt} onChange={e=>patchQuality(index,{prompt:e.target.value})}/></Form.Item><Row gutter={12}><Col span={12}><Form.Item label="通过示例（可选）"><Input.TextArea rows={2} value={rule.positiveExample} onChange={e=>patchQuality(index,{positiveExample:e.target.value})}/></Form.Item></Col><Col span={12}><Form.Item label="不通过示例（可选）"><Input.TextArea rows={2} value={rule.negativeExample} onChange={e=>patchQuality(index,{negativeExample:e.target.value})}/></Form.Item></Col></Row></>:<Form.Item label="Python 判断函数"><Input.TextArea className="coldchain-code-textarea" rows={6} value={rule.pythonCode||'def validate(data, context):\n    return True'} onChange={e=>patchQuality(index,{pythonCode:e.target.value})}/></Form.Item>}</Card>)}<Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>setQualityRules(current=>[...current,{ruleId:`SCENE-${Date.now().toString(36).toUpperCase()}`,name:'自定义场景规则',target:'两者',mode:'semantic',threshold:0.8,prompt:'',positiveExample:'',negativeExample:'',enabled:true}])}>添加自定义质检规则</Button></div>;
}

export default function WaybillSeedMockEditor({ fileName, templateName, businessType, description, onBack, readOnly=false }) {
  const [step,setStep]=useState(readOnly?1:1); const [fields,setFields]=useState(initialFields); const [selectedKey,setSelectedKey]=useState('waybill_no'); const [saved,setSaved]=useState(false);
  const [fieldTypeFilter,setFieldTypeFilter]=useState('dynamic');const [visibility,setVisibility]=useState({pattern:true,fixed:true,dynamic:true,privacy:true});
  const [fixedTexts,setFixedTexts]=useState(()=>initialFixedTexts(initialFields()));const [selectedFixedId,setSelectedFixedId]=useState(null);
  const [history,setHistory]=useState([]);const [future,setFuture]=useState([]);const [trialRan,setTrialRan]=useState(false);const [trialRunning,setTrialRunning]=useState(false);
  const [qualityRules,setQualityRules]=useState([
    {ruleId:'SCENE-LAYOUT-FIELD',name:'版面与字段绑定一致性',target:'两者',mode:'semantic',threshold:0.85,prompt:'判断字段位置、字段标签、字段值与绑定关系是否符合整张文档的版面语义。',enabled:true},
    {ruleId:'SCENE-CROSS-FIELD',name:'跨字段业务一致性',target:'字段内容',mode:'semantic',threshold:0.85,prompt:'判断日期、主体、地点、数量、重量、金额、代码等关联字段之间是否符合业务约束。',enabled:true},
    {ruleId:'SCENE-BUSINESS-SEMANTIC',name:'业务内容语义合理性',target:'字段内容',mode:'semantic',threshold:0.82,prompt:'判断生成字段的业务含义、上下文和组合关系是否符合文档填写逻辑。',enabled:true},
    {ruleId:'SCENE-TABLE-INTEGRITY',name:'表格与单元格完整性',target:'版面结构',mode:'function',pythonCode:'def validate(document, context):\n    return check_table_cells_and_borders(document)',enabled:true},
    {ruleId:'SCENE-CONTENT-FIT',name:'文字适配与溢出检查',target:'两者',mode:'function',pythonCode:'def validate(document, context):\n    return check_text_overflow_and_clipping(document)',enabled:true},
    {ruleId:'SCENE-VISUAL-READABILITY',name:'视觉清晰度与可读性',target:'版面结构',mode:'function',pythonCode:'def validate(image, context):\n    return check_blur_contrast_and_text_size(image)',enabled:true},
    {ruleId:'SCENE-OCR-RECOVERABILITY',name:'OCR 可识别性检查',target:'两者',mode:'function',pythonCode:'def validate(image, ground_truth):\n    return check_ocr_coverage_confidence_and_cer(image, ground_truth)',enabled:true},
    {ruleId:'SCENE-ASSET-OCCLUSION',name:'印章与图案遮挡检查',target:'版面结构',mode:'function',pythonCode:'def validate(document, context):\n    return check_asset_occlusion(document)',enabled:true},
    {ruleId:'SCENE-OVERALL-VISUAL',name:'整体版式自然度',target:'两者',mode:'semantic',threshold:0.82,prompt:'综合判断留白、对齐、层级、字体、表格、印章及图案组合是否自然。',enabled:true},
  ]);
  const [trialConfig,setTrialConfig]=useState({model:'qwen3-vl-8b-instruct',paramsEnabled:false,paramsJson:'{\n  "temperature": 0.2\n}',sampleCount:1});
  const selected=useMemo(()=>fields.find(item=>item.key===selectedKey)||fields[0],[fields,selectedKey]);
  const selectedFixed=useMemo(()=>fixedTexts.find(item=>item.id===selectedFixedId)||fixedTexts[0],[fixedTexts,selectedFixedId]);
  const snapshot=()=>({fields,fixedTexts,visibility});
  const commit=change=>{setHistory(current=>[...current,snapshot()]);setFuture([]);change();};
  const update=(key,value)=>commit(()=>setFields(current=>current.map(item=>item.key===selectedKey?{...item,[key]:value}:item)));
  const updateFixed=(key,value)=>commit(()=>setFixedTexts(current=>current.map(item=>item.id===selectedFixed.id?{...item,[key]:value}:item)));
  const move=(key,x,y,kind='dynamic')=>commit(()=>kind==='fixed'?setFixedTexts(current=>current.map(item=>item.id===key?{...item,x,y}:item)):setFields(current=>current.map(item=>item.key===key?{...item,x,y}:item)));
  const changeVisibility=updater=>commit(()=>setVisibility(updater));
  const applySnapshot=value=>{setFields(value.fields);setFixedTexts(value.fixedTexts);setVisibility(value.visibility);};
  const undo=()=>setHistory(current=>{if(!current.length)return current;const previous=current[current.length-1];setFuture(items=>[snapshot(),...items]);applySnapshot(previous);return current.slice(0,-1);});
  const redo=()=>setFuture(current=>{if(!current.length)return current;const nextState=current[0];setHistory(items=>[...items,snapshot()]);applySnapshot(nextState);return current.slice(1);});
  const restore=()=>{commit(()=>{const nextFields=initialFields();setFields(nextFields);setFixedTexts(initialFixedTexts(nextFields));setVisibility({pattern:true,fixed:true,dynamic:true,privacy:true});setSelectedKey('waybill_no');setSelectedFixedId(null);});message.success('已恢复系统初稿');};
  const runTrial=()=>{setTrialRunning(true);setTrialRan(false);window.setTimeout(()=>{setTrialRunning(false);setTrialRan(true);message.success('试运行样例与质检报告已生成');},500);};
  const save=()=>{setSaved(true);message.success('运单模板 Mock 已发布');};
  const goBack=()=>step===1?onBack():setStep(value=>Math.max(1,value-1));
  const next=()=>setStep(value=>Math.min(3,value+1));
  const layerItems=[['pattern','图案层'],['fixed','固定文字层'],['dynamic','动态文字层'],['privacy','隐私保护层']];
  const patchQuality=(index,patch)=>setQualityRules(current=>current.map((item,i)=>i===index?{...item,...patch}:item));
  return <div className="template-create-page document-template-create-page">
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={onBack}/><div><Title level={2}>{readOnly?'文档类图像模板详情':templateName||'新建文档类图像模板'}</Title><Paragraph type="secondary">{businessType||'底图生成法'} · {description||'字段解析与在线编辑'} · {fileName}</Paragraph></div></Space></Flex>
    <Flex justify="space-between" align="center" className="conversation-template-statusbar template-editor-step-actions-top"><Button icon={<ArrowLeftOutlined/>} disabled={readOnly&&step===1} onClick={goBack}>上一步</Button>{step<3?<Button type="primary" icon={<ArrowRightOutlined/>} onClick={next}>下一步</Button>:readOnly?<Button disabled>已到最后一步</Button>:<Button type="primary" icon={<CheckCircleOutlined/>} disabled={saved} onClick={save}>{saved?'已发布':'发布模板'}</Button>}</Flex>
    <Card className="main-card"><Steps current={step} items={WORKFLOW_STEPS} onChange={value=>(readOnly||value<=step)&&setStep(Math.max(1,value))}/>
      <Alert className="section-title" type="info" showIcon message="固定安全底图策略" description="无论上传什么图片或怎样配置解析参数，Mock均返回同一套虚构运单底图和45个字段Key；上传内容不复制到模板。"/>
      {step===2&&<WaybillQualityPanel qualityRules={qualityRules} patchQuality={patchQuality} setQualityRules={setQualityRules}/>} 
      {step===3&&<WaybillTrialPanel trialConfig={trialConfig} setTrialConfig={setTrialConfig} runTrial={runTrial} trialRunning={trialRunning} trialRan={trialRan} fields={fields} fixedTexts={fixedTexts} qualityRules={qualityRules}/>} 
      {step===1&&<WaybillEditorWorkspace fields={fields} fixedTexts={fixedTexts} visibility={visibility} setVisibility={changeVisibility} fieldTypeFilter={fieldTypeFilter} setFieldTypeFilter={setFieldTypeFilter} selected={selected} selectedFixed={selectedFixed} selectedKey={selectedKey} selectedFixedId={selectedFixedId} selectDynamic={key=>{setSelectedKey(key);setSelectedFixedId(null);setFieldTypeFilter('dynamic')}} selectFixed={id=>{setSelectedFixedId(id);setFieldTypeFilter('fixed')}} update={update} updateFixed={updateFixed} move={move} undo={undo} redo={redo} canUndo={history.length>0} canRedo={future.length>0} restore={restore} readOnly={readOnly}/>} 
      {step===1&&<Row gutter={16} className="section-title"><Col span={5}><Card size="small" title="图层"><Space direction="vertical" style={{width:'100%'}}>{layerItems.map(([key,label])=><Flex key={key} justify="space-between" align="center"><Text>{label}</Text><Button type="text" icon={visibility[key]?<EyeOutlined/>:<EyeInvisibleOutlined/>} onClick={()=>setVisibility(current=>({...current,[key]:!current[key]}))}>{visibility[key]?'显示':'隐藏'}</Button></Flex>)}</Space><Button className="section-title" block onClick={()=>setFieldDrawer(true)}>查看解析字段 Key（{fields.length}）</Button></Card><Card size="small" className="section-title" title="固定文字属性"><Form layout="vertical"><Form.Item label="固定文字"><Input value={selectedFixed.text} onChange={e=>updateFixed('text',e.target.value)}/></Form.Item><Row gutter={8}><Col span={12}><Form.Item label="X 位置"><InputNumber min={0} max={100} value={selectedFixed.x} onChange={v=>updateFixed('x',v)} style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item label="Y 位置"><InputNumber min={0} max={100} value={selectedFixed.y} onChange={v=>updateFixed('y',v)} style={{width:'100%'}}/></Form.Item></Col></Row><Form.Item label="字号"><InputNumber min={6} max={48} value={selectedFixed.fontSize} onChange={v=>updateFixed('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input type="color" value={selectedFixed.color} onChange={e=>updateFixed('color',e.target.value)}/></Form.Item></Form></Card></Col><Col span={13}><Card size="small" title="四图层在线编辑器"><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={visibility} selectedKey={selectedKey} selectedFixedId={selectedFixedId} onSelect={key=>{setSelectedKey(key);setSelectedFixedId(null)}} onSelectFixed={id=>setSelectedFixedId(id)} onMove={move} readOnly={readOnly}/></Card></Col><Col span={6}><Card size="small" title="动态字段属性"><Form layout="vertical"><Form.Item label="绑定字段 Key"><Select showSearch optionFilterProp="label" value={selected.boundKey||selected.key} options={fields.map(item=>({value:item.key,label:`${item.key} · ${item.zh}`}))} onChange={value=>update('boundKey',value)}/></Form.Item><Descriptions size="small" column={1} items={[{key:'box',label:'文字框 Key',children:<Text code>{selected.key}</Text>},{key:'region',label:'区域',children:selected.region}]}/><Divider/><Form.Item label="示例 Value"><Input value={selected.sample} onChange={e=>update('sample',e.target.value)}/></Form.Item><Form.Item label="字符大小"><InputNumber min={8} max={36} value={selected.fontSize||12} onChange={v=>update('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input type="color" value={selected.color||'#0958d9'} onChange={e=>update('color',e.target.value)}/></Form.Item><Form.Item label="数据类型"><Select value={selected.dataType} onChange={v=>update('dataType',v)} options={['text','code','phone','date','number','address','company_name'].map(value=>({value,label:value}))}/></Form.Item><Form.Item label="生成方式"><Select value={selected.generation} onChange={v=>update('generation',v)} options={[{value:'dictionary_rule',label:'字典+规则'},{value:'computed',label:'计算值'},{value:'llm_prompt',label:'模型+Prompt'}]}/></Form.Item><Form.Item label="语义与生成约束"><Input.TextArea rows={3} value={selected.rule} onChange={e=>update('rule',e.target.value)}/></Form.Item></Form></Card></Col></Row>}
      {step===2&&<><Divider orientation="left">基础规则</Divider><Row gutter={[12,12]}>{BASE_QUALITY_RULES.map(([id,name,desc])=><Col span={8} key={id}><Card size="small" className={`conversation-fixed-rule ${id==='BASE-PRIVACY'?'conversation-fixed-rule-privacy':'conversation-fixed-rule-other'}`}><Text strong>{name}</Text><Paragraph type="secondary">{desc}</Paragraph><Tag>{id}</Tag></Card></Col>)}</Row><Divider orientation="left">场景规则</Divider>{qualityRules.map((rule,index)=><Card key={rule.ruleId} className="section-title conversation-quality-rule" size="small" extra={<Switch checked={rule.enabled} onChange={enabled=>patchQuality(index,{enabled})}/>}><Row gutter={12}><Col span={7}><Form.Item label="规则名称"><Input value={rule.name} onChange={e=>patchQuality(index,{name:e.target.value})}/></Form.Item></Col><Col span={6}><Form.Item label="规则 ID"><Input value={rule.ruleId} disabled/></Form.Item></Col><Col span={5}><Form.Item label="检查对象"><Select value={rule.target} onChange={target=>patchQuality(index,{target})} options={['版面结构','字段内容','两者'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={6}><Form.Item label="检查方式"><Select value={rule.mode} onChange={mode=>patchQuality(index,{mode})} options={[{value:'function',label:'函数判断'},{value:'semantic',label:'语义判断'}]}/></Form.Item></Col></Row>{rule.mode==='semantic'?<><Form.Item label="语义阈值"><InputNumber min={0} max={1} step={0.01} value={rule.threshold} onChange={threshold=>patchQuality(index,{threshold})}/></Form.Item><Form.Item label="语义判断 Prompt"><Input.TextArea rows={4} value={rule.prompt} onChange={e=>patchQuality(index,{prompt:e.target.value})}/></Form.Item><Row gutter={12}><Col span={12}><Form.Item label="通过示例（可选）"><Input.TextArea rows={2} value={rule.positiveExample} onChange={e=>patchQuality(index,{positiveExample:e.target.value})}/></Form.Item></Col><Col span={12}><Form.Item label="不通过示例（可选）"><Input.TextArea rows={2} value={rule.negativeExample} onChange={e=>patchQuality(index,{negativeExample:e.target.value})}/></Form.Item></Col></Row></>:<Form.Item label="Python 判断函数"><Input.TextArea className="coldchain-code-textarea" rows={6} value={rule.pythonCode||'def validate(data, context):\n    return True'} onChange={e=>patchQuality(index,{pythonCode:e.target.value})}/></Form.Item>}</Card>)}<Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>setQualityRules(current=>[...current,{ruleId:`SCENE-${Date.now().toString(36).toUpperCase()}`,name:'自定义场景规则',target:'两者',mode:'semantic',threshold:0.8,prompt:'',positiveExample:'',negativeExample:'',enabled:true}])}>添加自定义质检规则</Button></>}
      {step===3&&<><Card size="small" title="试运行配置"><Row gutter={12}><Col span={12}><Form.Item label="生成模型"><Select value={trialConfig.model} onChange={model=>setTrialConfig(current=>({...current,model}))} options={[{value:'qwen3-vl-8b-instruct',label:'Qwen-8B'}]}/></Form.Item></Col><Col span={12}><Form.Item label="试运行样本数量"><InputNumber min={1} max={10} value={trialConfig.sampleCount} onChange={sampleCount=>setTrialConfig(current=>({...current,sampleCount}))} style={{width:'100%'}}/></Form.Item></Col></Row><Flex justify="space-between"><Text>生成参数（可选）</Text><Switch checked={trialConfig.paramsEnabled} onChange={paramsEnabled=>setTrialConfig(current=>({...current,paramsEnabled}))}/></Flex>{trialConfig.paramsEnabled&&<Input.TextArea className="coldchain-json-textarea" rows={5} value={trialConfig.paramsJson} onChange={e=>setTrialConfig(current=>({...current,paramsJson:e.target.value}))}/>}<Descriptions className="section-title" bordered size="small" items={[{key:'calls',label:'API 调用次数预估',children:`${trialConfig.sampleCount} 次`}]}/></Card><Row gutter={16} className="section-title"><Col span={18}><Card size="small" title="Mock试运行成品"><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={{pattern:true,fixed:true,dynamic:true,privacy:false}} trial/></Card></Col><Col span={6}><Card size="small" title="Mock质检结果"><Space direction="vertical"><Tag color="green">PASS</Tag><Text>字段覆盖：45 / 45</Text><Text>字段Key唯一：通过</Text><Text>文本框越界：0</Text><Text>隐私检查：通过</Text></Space></Card></Col>{saved&&<Col span={24}><Alert type="success" showIcon message="运单模板已发布" description="版式、四类图层、字段绑定和质检规则已纳入模板定义。"/></Col>}</Row></>}
    </Card>
  </div>;
}
