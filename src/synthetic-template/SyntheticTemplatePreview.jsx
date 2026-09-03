import React from 'react';
import { Empty, Image } from 'antd';

const fieldValue = (fields, id, fallback = '—') => fields.find(item => item.id === id)?.sample_text || fallback;

function LogoMark({ logo, color, compact = false }) {
  if (!logo || logo.id === 'none') return null;
  return <div className={`fictional-logo ${compact ? 'is-compact' : ''}`} style={{ '--logo-color': color }}>
    <span className="fictional-logo-glyph">{logo.glyph || '合'}</span>
    <span><b>{logo.name}</b><small>{logo.safety_text || 'SYNTHETIC'}</small></span>
  </div>;
}

function LabeledValue({ label, value, wide = false }) {
  return <div className={`fictional-form-value ${wide ? 'is-wide' : ''}`}><span>{label}</span><b>{value}</b></div>;
}

function CustomsPreview({ fields }) {
  return <>
    <div className="fictional-summary-grid">
      <LabeledValue label="申报单编号" value={fieldValue(fields, 'declaration_no')}/>
      <LabeledValue label="申报日期" value={fieldValue(fields, 'filing_date')}/>
      <LabeledValue label="运输方式" value={fieldValue(fields, 'transport_mode')}/>
      <LabeledValue label="监管方式" value={fieldValue(fields, 'trade_mode')}/>
      <LabeledValue label="境内收货人" value={fieldValue(fields, 'consignee')} wide/>
      <LabeledValue label="申报单位" value={fieldValue(fields, 'declarant')} wide/>
      <LabeledValue label="币制" value={fieldValue(fields, 'currency')}/>
      <LabeledValue label="征免" value={fieldValue(fields, 'levy')}/>
      <LabeledValue label="填制人" value={fieldValue(fields, 'operator')}/>
    </div>
    <div className="fictional-section-title">商品明细</div>
    <div className="fictional-goods-table">
      <div className="is-head"><span>项号</span><span>商品编号</span><span>商品名称及规格型号</span><span>数量及单位</span><span>单价</span><span>总价</span><span>原产国</span></div>
      <div><span>{fieldValue(fields, 'item_no')}</span><span>{fieldValue(fields, 'hs_code')}</span><span>{fieldValue(fields, 'goods_name')}</span><span>{fieldValue(fields, 'quantity')}</span><span>{fieldValue(fields, 'unit_price')}</span><span>{fieldValue(fields, 'total_price')}</span><span>{fieldValue(fields, 'origin')}</span></div>
      <div><span>2</span><span>3926909090</span><span>训练用包装附件｜规格B</span><span>80箱</span><span>12.20</span><span>976.00</span><span>葡萄牙（PRT）</span></div>
    </div>
    <div className="fictional-footer-grid"><span>币制：{fieldValue(fields, 'currency')}</span><span>监管方式：{fieldValue(fields, 'trade_mode')}</span><span>征免：{fieldValue(fields, 'levy')}</span><span>本页为合成训练样本，不具备申报效力</span></div>
  </>;
}

function WaybillPreview({ fields }) {
  return <>
    <div className="fictional-waybill-route">
      <div><small>运单号 / TRACKING NO.</small><b>{fieldValue(fields, 'waybill_no')}</b></div>
      <div className="fictional-barcode"><span>SYNTHETIC · SAFE CODE</span></div>
    </div>
    <div className="fictional-waybill-columns">
      <section><h4>寄件信息</h4><LabeledValue label="寄件人" value={`${fieldValue(fields, 'sender_name')}  ${fieldValue(fields, 'sender_phone')}`}/><LabeledValue label="地址" value={fieldValue(fields, 'sender_address')}/></section>
      <section><h4>收件信息</h4><LabeledValue label="收件人" value={`${fieldValue(fields, 'receiver_name')}  ${fieldValue(fields, 'receiver_phone')}`}/><LabeledValue label="地址" value={fieldValue(fields, 'receiver_address')}/></section>
    </div>
    <div className="fictional-waybill-grid">
      <LabeledValue label="计费重量" value={fieldValue(fields, 'weight')}/><LabeledValue label="服务类型" value={fieldValue(fields, 'service')}/>
      <LabeledValue label="运费" value={fieldValue(fields, 'fee')}/><LabeledValue label="码图载荷" value="SYNTHETIC:"/>
    </div>
    <div className="fictional-waybill-description"><small>托寄物</small><b>{fieldValue(fields, 'goods')}</b><p>本运单为虚构训练样本，不代表真实承运、签收或结算关系。</p></div>
    <div className="fictional-sign-area"><span>寄件确认</span><span>收件确认</span><span>仅供模型训练 · 不可用于真实寄递</span></div>
  </>;
}

const contractClauseMap = {
  purchase_agreement: ['采购标的与技术要求', '价格、结算及发票约定', '交付、验收与风险转移', '质量保证与违约责任'],
  consignment_agreement: ['代销范围与授权边界', '库存、定价与销售管理', '佣金结算与退换货', '品牌合规与违约责任'],
  logistics_service: ['服务线路与作业范围', '运输时效与交接标准', '费用结算与异常处置', '货损责任与保险安排'],
  warehousing_customs: ['仓储场地与保管责任', '申报资料与委托边界', '出入库和盘点流程', '费用结算与异常处置'],
  supply_chain_factoring: ['基础交易与应收账款', '融资比例与保理费用', '回款账户与通知义务', '追索、担保与风险处置'],
  pledge_agreement: ['主债权与担保范围', '质押物清单与评估价值', '保管、盘点与保险', '质权实现与违约责任'],
};

function ContractPreview({ fields, subtype, subtypeLabel }) {
  const clauses = contractClauseMap[subtype] || contractClauseMap.purchase_agreement;
  return <>
    <div className="fictional-contract-meta"><span>合同编号：{fieldValue(fields, 'contract_no')}</span><span>合成训练文档</span></div>
    <h2 className="fictional-contract-title">{subtypeLabel || fieldValue(fields, 'contract_title')}</h2>
    <div className="fictional-contract-parties"><p><b>甲方：</b>{fieldValue(fields, 'party_a')}</p><p><b>乙方：</b>{fieldValue(fields, 'party_b')}</p><p><b>签订日期：</b>{fieldValue(fields, 'sign_date')}</p></div>
    <p className="fictional-contract-lead">为验证文档理解、版面分析与文字识别能力，双方基于完全虚构的业务事实，经协商形成如下样本条款。本文件不对应任何真实交易主体或法律关系。</p>
    {clauses.map((title, index) => <section className="fictional-clause" key={title}><h4>第{index + 1}条　{title}</h4><p>{index === 0 ? `本协议标的为${fieldValue(fields, 'subject')}，示例金额为${fieldValue(fields, 'amount')}。` : '双方应按照约定的时间、标准和资料要求履行各自义务；所有示例名称、地址、编号和金额仅用于合成数据训练。'}</p></section>)}
    <div className="fictional-contract-sign"><div><b>甲方（样本主体）</b><span>{fieldValue(fields, 'party_a')}</span></div><div><b>乙方（样本主体）</b><span>{fieldValue(fields, 'party_b')}</span></div></div>
  </>;
}

export default function SyntheticTemplatePreview({ config, fields, catalog, trialImageUrl }) {
  if (trialImageUrl) return <div className="fictional-trial-preview"><Image src={trialImageUrl} fallback=""/><small>Mock 试运行渲染结果</small></div>;
  if (!config?.documentType) return <Empty description="请选择文档类型"/>;
  const theme = (catalog.themes || []).find(item => item.id === config.themeId) || catalog.themes?.[0] || {};
  const logo = (catalog.logos || []).find(item => item.id === config.logoId) || catalog.logos?.[0];
  const subtypeLabel = catalog.content_subtypes?.contract?.find(item => item.value === config.contentSubtype)?.label;
  const title = config.documentType === 'customs' ? '贸易货物申报信息单' : config.documentType === 'domestic_waybill' ? '国内货物运输标签' : subtypeLabel || '商务合同';
  return <div className={`fictional-paper is-${config.documentType}`} style={{ '--primary': config.primaryColor || theme.primary_color, '--accent': config.accentColor || theme.accent_color, '--border': theme.border_color || config.primaryColor }}>
    <div className="fictional-watermark">SYNTHETIC DATA · 合成样本</div>
    <header className={`fictional-paper-header is-logo-${config.logoPosition || 'top_left'}`}>
      <LogoMark logo={logo} color={config.primaryColor || theme.primary_color}/>
      <div className="fictional-paper-title"><h3>{title}</h3><p>FICTIONAL DOCUMENT · 非真实业务单据</p></div>
      <div className="fictional-safety-chip">样本专用</div>
    </header>
    {config.documentType === 'customs' && <CustomsPreview fields={fields}/>} 
    {config.documentType === 'domestic_waybill' && <WaybillPreview fields={fields}/>} 
    {config.documentType === 'contract' && <ContractPreview fields={fields} subtype={config.contentSubtype} subtypeLabel={subtypeLabel}/>} 
  </div>;
}
