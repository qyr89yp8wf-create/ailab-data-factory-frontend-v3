import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Divider, Flex, Form, Input, Row, Select, Space, Steps, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const FIELD_ROWS = [
  ['contract_no','合同基础信息','合同编号','SYN-PO-20260901-001','code'], ['sign_place','合同基础信息','签订地点','广州市','address'], ['sign_date','合同基础信息','签订日期','2026年09月01日','date'],
  ['party_a_name','合同主体','甲方名称','星河合成采购有限公司','company_name'], ['party_b_name','合同主体','乙方名称','云帆合成供应有限公司','company_name'],
  ['party_a_address','合同主体','甲方地址','广州市训练路88号','address'], ['party_a_contact','合同主体','甲方联系人','林川','person_name'],
  ['party_b_address','合同主体','乙方地址','上海市样本路66号','address'], ['party_b_contact','合同主体','乙方联系人','周宁','person_name'], ['bank_account','合同主体','结算账户','SYN-BANK-260901-01','code'],
  ['product_spec','采购标的','商品名称/规格型号','训练用包装材料 / 40×30cm','text'], ['quantity','采购标的','数量','1200件','number'], ['unit_price','采购标的','含税单价','18.50','amount'], ['total_price','采购标的','合同总价','22200.00','amount'], ['tax_rate','采购标的','税率','13%','number'],
  ['order_confirm_days','订单与交付','订单确认天数','3','number'], ['delivery_place','订单与交付','交付地点','甲方指定合成仓库','address'], ['freight_payer','订单与交付','运输及保险承担方','乙方','enum'], ['risk_transfer','订单与交付','风险转移节点','验收','enum'],
  ['inspection_days','验收与质量','验收天数','5','number'], ['invoice_type','价格与结算','发票类型','增值税专用发票','enum'], ['payment_basis','价格与结算','付款条件','验收','enum'], ['payment_days','价格与结算','付款天数','30','number'],
  ['penalty_rate','违约与解除','每日违约比例','0.05','number'], ['jurisdiction','争议解决','管辖选择','甲方所在地','enum'],
  ['attachment_1','附件','附件1','合成货物明细表','text'], ['attachment_2','附件','附件2','合成交付验收单','text'], ['attachment_3','附件','附件3','合规授权清单','text'],
  ['party_a_seal','签署信息','甲方盖章','合成甲方专用章','asset'], ['party_b_seal','签署信息','乙方盖章','合成乙方专用章','asset'],
  ['party_a_rep','签署信息','甲方代表','林川','person_name'], ['party_b_rep','签署信息','乙方代表','周宁','person_name'],
  ['party_a_uscc','签署信息','甲方统一社会信用代码','SYN-USCC-A-260901','code'], ['party_b_uscc','签署信息','乙方统一社会信用代码','SYN-USCC-B-260901','code'],
  ['party_a_date','签署信息','甲方签署日期','2026年09月01日','date'], ['party_b_date','签署信息','乙方签署日期','2026年09月01日','date'],
];

const POSITIONS = [
  [20,8,20],[48,8,15],[70,8,20],[27,14,28],[27,17,28],[27,20,22],[49,20,13],[27,23,22],[49,23,13],[27,26,36],
  [29,36,30],[61,36,9],[72,36,9],[40,39,15],[60,39,8],[52,45,8],[30,47,24],[63,47,8],[76,47,9],[45,54,8],
  [33,61,24],[59,61,10],[39,64,10],[54,64,8],[39,75,18],[22,82,30],[22,85,30],[22,88,30],
  [17,85,28],[58,85,28],[22,88,20],[63,88,20],[22,91,27],[63,91,27],[22,94,22],[63,94,22],
];

function initialFields(){return FIELD_ROWS.map(([key,section,name,sample,dataType],index)=>({key,section,name,sample,dataType,x:POSITIONS[index][0],y:POSITIONS[index][1],w:POSITIONS[index][2],generation:['amount','number','date','code'].includes(dataType)?'computed':['enum'].includes(dataType)?'dictionary_rule':'llm_prompt',rule:`生成虚构${name}；保持合同全文引用一致，不复用真实主体或账号`,quality:`必填；${name}格式与语义正确；跨条款引用保持一致`}));}

function ContractBase(){return <div className="contract-base-document">
  <header><h1>采购协议模板</h1><p className="contract-subtitle">（示范模板｜种子数据版本｜签署前请结合交易事实及最新法律法规审核）</p><p className="contract-meta">合同编号：　　　　　　　签订地点：　　　　　　　签订日期：</p></header>
  <section><h2>前言与定义</h2><p>双方确认具备签订及履行本合同所需的民事权利能力和行为能力，遵循平等、自愿、公平、诚信原则。本模板不构成对具体项目的法律意见。</p><table><tbody><tr><td>甲方（名称）</td><td></td></tr><tr><td>乙方（名称）</td><td></td></tr><tr><td>甲方地址/联系人</td><td></td></tr><tr><td>乙方地址/联系人</td><td></td></tr><tr><td>结算账户</td><td></td></tr></tbody></table></section>
  <section><h2>第一条 采购标的</h2><p>甲方向乙方采购　　　　　　　，数量　　　　，含税单价　　　　元，合同总价暂定　　　　元（税率　　　）。质量标准、包装、批次、品牌及随附文件以附件1为准。</p></section>
  <section><h2>第二条 订单与交付</h2><p>乙方应在收到甲方书面订单后　　日内确认并按订单交付。交付地点为　　　　　　　　，运输及保险由　　　承担，风险转移以　　　　为准。</p></section>
  <section><h2>第三条 验收与质量责任</h2><p>甲方应在到货后　　日内完成外观及数量检验，隐蔽瑕疵在发现后及时通知。乙方保证标的合法来源、权属清晰、符合强制性标准及约定。</p></section>
  <section><h2>第四条 价格与结算</h2><p>乙方开具合法有效的　　　　　　　发票。甲方在　　　　后　　日内支付；争议金额不影响无争议部分支付。</p></section>
  <section><h2>第五条 合规与知识产权</h2><p>乙方不得侵犯第三方知识产权，不得商业贿赂或提供虚假单据；涉及进口、出口、报关、原产地、许可证的，责任方应保证申报真实、准确、完整。</p></section>
  <section><h2>第六条 违约与解除</h2><p>逾期交付/付款违约金按未履行部分每日　　　%计；一方严重违约、资信恶化或发生违法经营，守约方可书面通知解除并追究损失。</p></section>
  <section><h2>第七条 争议解决</h2><p>本合同适用中华人民共和国法律。争议提交　　　　　　　有管辖权的人民法院诉讼解决。</p></section>
  <section><h2>附件清单</h2><p>附件1：标的/服务/货物明细表（　　　　　　　　　）<br/>附件2：交付、验收或对账单样式（　　　　　　　　　）<br/>附件3：合规与授权文件清单（　　　　　　　　　）</p></section>
  <section><h2>签署页</h2><p>本合同经双方签字盖章后生效。本合同正文及附件具有同等法律效力。</p><table><tbody><tr><td>甲方（盖章）：</td><td>乙方（盖章）：</td></tr><tr><td>法定代表人/授权代表：</td><td>法定代表人/授权代表：</td></tr><tr><td>统一社会信用代码：</td><td>统一社会信用代码：</td></tr><tr><td>日期：</td><td>日期：</td></tr></tbody></table></section>
</div>}

function ContractCanvas({fields,selectedKey,onSelect,onMove,trial=false,readOnly=false}){
  const ref=useRef(null),drag=useRef(null); const down=(e,f)=>{if(trial||readOnly)return;e.preventDefault();onSelect(f.key);drag.current={key:f.key,cx:e.clientX,cy:e.clientY,x:f.x,y:f.y};e.currentTarget.setPointerCapture(e.pointerId)};
  const move=e=>{if(!drag.current||trial||readOnly)return;const rect=ref.current.getBoundingClientRect();onMove(drag.current.key,Math.max(0,Math.min(94,drag.current.x+(e.clientX-drag.current.cx)/rect.width*100)),Math.max(0,Math.min(106,drag.current.y+(e.clientY-drag.current.cy)/rect.height*110)))};
  return <div className="contract-layer-canvas" ref={ref} onPointerMove={move} onPointerUp={()=>drag.current=null}><ContractBase/><div className="contract-layer-badge"><Tag>版式底图层</Tag><Tag color="green">动态文字层</Tag></div>{fields.map(f=><div key={f.key} className={`contract-field-box ${selectedKey===f.key?'selected':''} ${trial?'trial':''}`} onPointerDown={e=>down(e,f)} onClick={()=>onSelect?.(f.key)} style={{left:`${f.x}%`,top:`${f.y}%`,width:`${f.w}%`}} title={`${f.name} / ${f.key}`}>{f.sample}</div>)}</div>;
}

export default function ContractSeedMockEditor({fileName,onBack,readOnly=false}){
  const [step,setStep]=useState(readOnly?1:0),[fields,setFields]=useState(initialFields),[selectedKey,setSelectedKey]=useState('contract_no'),[published,setPublished]=useState(false); const selected=useMemo(()=>fields.find(f=>f.key===selectedKey)||fields[0],[fields,selectedKey]);
  const update=(key,value)=>setFields(current=>current.map(f=>f.key===selectedKey?{...f,[key]:value}:f)); const move=(key,x,y)=>setFields(current=>current.map(f=>f.key===key?{...f,x,y}:f));
  const columns=[{title:'章节',dataIndex:'section',width:130},{title:'字段Key',dataIndex:'key',width:190,render:v=><Text code copyable>{v}</Text>},{title:'动态字段',dataIndex:'name',width:180},{title:'系统示例',dataIndex:'sample'},{title:'生成方式',dataIndex:'generation',width:120,render:v=><Tag color="blue">{v}</Tag>}];
  return <div className="template-create-page document-template-create-page"><Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<ArrowLeftOutlined/>} onClick={onBack}>{readOnly?'返回模板列表':'返回版面分析'}</Button><div><Title level={2}>{readOnly?'合同模板详情':'新建文档类图像模板'}</Title><Paragraph type="secondary">合同 · {fileName} · 已按Word段落、表格和样式结构生成Mock模板</Paragraph></div></Space><Tag color={readOnly?'blue':'purple'}>{readOnly?'只读草稿':'前端 Mock'}</Tag></Flex><Card className="main-card"><Steps current={readOnly?2:Math.min(step+1,3)} items={[{title:'上传与结构分析',description:'Word / PDF'},{title:'字段与条款调整',description:'替换字段与插槽'},{title:'安全样式重建',description:'结构与全文一致性'},{title:'预览保存',description:'试运行并发布'}]}/>
    <Alert className="section-title" type="info" showIcon message="DOCX结构化模板策略" description="版式底层保留采购协议的标题、主体表、七条条款、附件和签署表；绿色动态文字层单独保存字段值、坐标、生成规则和质检规则。"/>
    {readOnly&&<Table className="section-title" size="small" pagination={{pageSize:8,showSizeChanger:false}} columns={columns} dataSource={fields}/>} 
    {step===0&&<><Table className="section-title" size="small" pagination={{pageSize:12,showSizeChanger:false}} columns={columns} dataSource={fields}/><Flex justify="flex-end"><Button type="primary" onClick={()=>setStep(1)}>确认字段并进入编辑器</Button></Flex></>}
    {step===1&&<Row gutter={16} className="section-title"><Col span={17}><Card size="small" title="双图层合同编辑器" extra={<Text type="secondary">{readOnly?'只读查看版式与动态文字坐标':'拖动绿色文本框调整位置'}</Text>}><ContractCanvas fields={fields} selectedKey={selectedKey} onSelect={setSelectedKey} onMove={move} readOnly={readOnly}/></Card></Col><Col span={7}><Card size="small" title="动态字段配置"><Descriptions size="small" column={1} items={[{key:'id',label:'字段Key',children:<Text code>{selected.key}</Text>},{key:'section',label:'所属章节',children:selected.section}]}/><Divider/><Form layout="vertical"><Form.Item label="字段示例"><Input value={selected.sample} disabled={readOnly} onChange={e=>update('sample',e.target.value)}/></Form.Item><Form.Item label="数据类型"><Select value={selected.dataType} disabled={readOnly} onChange={v=>update('dataType',v)} options={['text','code','date','number','amount','enum','address','company_name','person_name','asset'].map(v=>({value:v,label:v}))}/></Form.Item><Form.Item label="生成方式"><Select value={selected.generation} disabled={readOnly} onChange={v=>update('generation',v)} options={[{value:'dictionary_rule',label:'字典+规则'},{value:'computed',label:'计算值'},{value:'llm_prompt',label:'模型+Prompt'}]}/></Form.Item><Form.Item label="生成规则与语义约束"><Input.TextArea rows={4} value={selected.rule} readOnly={readOnly} onChange={e=>update('rule',e.target.value)}/></Form.Item><Form.Item label="质检规则"><Input.TextArea rows={4} value={selected.quality} readOnly={readOnly} onChange={e=>update('quality',e.target.value)}/></Form.Item></Form></Card></Col>{readOnly?<Col span={24}><Card size="small" title="Mock试运行与质检记录"><Descriptions bordered size="small" column={4} items={[{key:'status',label:'结果',children:<Tag color="green">PASS</Tag>},{key:'fields',label:'动态字段',children:`${fields.length} 项`},{key:'consistency',label:'全文主体一致',children:'通过'},{key:'bounds',label:'文本框越界',children:'0'}]}/></Card></Col>:<Col span={24}><Flex justify="space-between"><Button onClick={()=>setStep(0)}>返回字段表</Button><Button type="primary" icon={<PlayCircleOutlined/>} onClick={()=>setStep(2)}>试运行生成示例合同</Button></Flex></Col>}</Row>}
    {step===2&&<Row gutter={16} className="section-title"><Col span={18}><Card size="small" title="Mock试运行示例合同"><ContractCanvas fields={fields} trial/></Card></Col><Col span={6}><Card size="small" title="试运行质检"><Space direction="vertical"><Tag color="green">PASS</Tag><Text>动态字段：{fields.length}项</Text><Text>必填字段：通过</Text><Text>全文主体一致：通过</Text><Text>金额关系：通过</Text><Text>日期与期限：通过</Text><Text>文本框越界：0</Text></Space></Card></Col>{published&&<Col span={24}><Alert type="success" showIcon message="采购协议模板已发布" description="当前为前端 Mock 发布结果；版式结构、动态字段坐标、生成规则和质检规则已纳入模板定义。"/></Col>}<Col span={24}><Flex justify="space-between"><Button onClick={()=>setStep(1)}>返回编辑</Button><Button type="primary" icon={<CheckCircleOutlined/>} disabled={published} onClick={()=>{setPublished(true);message.success('采购协议Mock模板已发布')}}>{published?'已发布':'发布模板'}</Button></Flex></Col></Row>}
  </Card></div>;
}
