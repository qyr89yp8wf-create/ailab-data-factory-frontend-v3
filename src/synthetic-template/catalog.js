const field = (id, name, dataType, generatorType, sampleText, rule, required = true) => ({
  id,
  name,
  data_type: dataType,
  required,
  sample_text: sampleText,
  generator: {
    type: generatorType,
    rule,
    prompt: generatorType === 'llm_prompt' ? rule : '',
    dictionary: generatorType === 'dictionary_rule' ? rule.match(/customs_[a-z_]+/)?.[0] || '' : '',
  },
  quality_rule: {
    version: 'field-quality-rule/v1',
    required,
    checks: [{ type: 'required', message: `${name}不能为空` }],
    cross_field_checks: [],
  },
});

export const FALLBACK_CATALOG = {
  schema_version: 'fictional-template-catalog/v1',
  document_types: [
    { value: 'customs', label: '报关单', description: '贸易申报业务字段，自有横向表格版式', canvas: { width: 2480, height: 1754 } },
    { value: 'domestic_waybill', label: '国内运单', description: '国内收寄、路由、费用与码图字段', canvas: { width: 2480, height: 1400 } },
    { value: 'contract', label: '合同', description: 'A4 文档结构，支持六类合同内容', canvas: { width: 1754, height: 2480 } },
  ],
  content_subtypes: {
    contract: [
      { value: 'purchase_agreement', label: '采购协议' },
      { value: 'consignment_agreement', label: '代销协议' },
      { value: 'logistics_service', label: '物流服务合同' },
      { value: 'warehousing_customs', label: '仓储报关协议' },
      { value: 'supply_chain_factoring', label: '供应链保理合同' },
      { value: 'pledge_agreement', label: '质押协议' },
    ],
  },
  layout_presets: [
    { id: 'customs_landscape_v1', document_type: 'customs', name: '贸易申报横向标准版', description: '页眉摘要、基础申报区、商品明细区和声明区', columns: 4 },
    { id: 'waybill_portrait_v1', document_type: 'domestic_waybill', name: '国内运单双栏标签版', description: '收寄双栏、路由码区、费用服务区和签收区', columns: 2 },
    { id: 'contract_standard_v1', document_type: 'contract', name: '商务合同 A4 条款版', description: '标题与编号、主体信息、编号条款、附件与签署区', columns: 1 },
  ],
  themes: [
    { id: 'ocean_blue', name: '远洋蓝', primary_color: '#2457A7', accent_color: '#EAF1FB', border_color: '#34506F' },
    { id: 'forest_green', name: '松林绿', primary_color: '#23775A', accent_color: '#E8F5EF', border_color: '#3C6657' },
    { id: 'warm_slate', name: '暖灰', primary_color: '#665A52', accent_color: '#F4EFEA', border_color: '#70645C' },
  ],
  logos: [
    { id: 'orbit_grid', name: '轨道网格', glyph: '环', safety_text: 'SYNTHETIC' },
    { id: 'folded_route', name: '折线路径', glyph: '路', safety_text: 'FICTIONAL' },
    { id: 'linked_blocks', name: '连接方块', glyph: '格', safety_text: 'TRAINING' },
  ],
};

const customsFields = [
  field('declaration_no', '申报编号', 'code', 'computed', 'SYN260827000001', '生成SYN+日期+6位安全流水号'),
  field('filing_date', '申报日期', 'date', 'computed', '2026-08-27', '在任务日期范围内生成YYYY-MM-DD日期'),
  field('declarant', '申报单位', 'company_name', 'llm_prompt', '华源虚构贸易有限公司', '生成不对应真实注册主体的中文虚构贸易公司名称'),
  field('consignee', '境内收货人', 'company_name', 'llm_prompt', '星河虚构供应链有限公司', '生成不对应真实注册主体的中文虚构企业名称'),
  field('transport_mode', '运输方式', 'transport_mode', 'dictionary_rule', '水路运输', '从customs_transport_mode同一记录读取代码与名称'),
  field('trade_mode', '监管方式', 'supervision_mode', 'dictionary_rule', '一般贸易', '从customs_supervision_mode同一记录读取代码与名称'),
  field('currency', '币制', 'currency', 'dictionary_rule', '人民币', '从customs_currency同一记录读取代码与名称'),
  field('origin', '原产国（地区）', 'country_region', 'dictionary_rule', '中国', '从customs_country_region同一记录读取代码与名称'),
  field('item_no', '项号', 'integer', 'computed', '1', '按明细顺序生成正整数'),
  field('hs_code', '商品编号', 'hs_code', 'dictionary_rule', '4819100000', '从hs2022_six_digit选择基线并安全扩展为10位'),
  field('goods_name', '商品名称及规格', 'goods_description', 'llm_prompt', '瓦楞纸制包装箱 560×420mm', '依据HS类别生成虚构且一致的商品名称与规格'),
  field('quantity', '数量及单位', 'quantity', 'computed', '1250 千克', '生成正数并与计量单位保持一致'),
  field('unit_price', '单价', 'amount', 'computed', '12.80', '生成非负两位小数'),
  field('total_price', '总价', 'amount', 'computed', '16000.00', '按数量×单价计算并保留两位小数'),
  field('levy', '征免', 'text', 'dictionary_rule', '照章征税', '从customs_levy_mode读取征免方式'),
  field('operator', '填制人', 'person_name', 'llm_prompt', '林安', '生成常见但不可追溯到真实主体的虚构中文姓名'),
];

const waybillFields = [
  field('waybill_no', '运单号', 'code', 'computed', 'SYN-WB-260827-004281', '生成SYN-WB-日期-6位流水号'),
  field('sender_name', '寄件人', 'person_name', 'llm_prompt', '周宁', '生成虚构中文姓名'),
  field('sender_phone', '寄件电话', 'phone', 'computed', '138****4821', '生成合成手机号并默认部分掩码'),
  field('sender_address', '寄件地址', 'address', 'llm_prompt', '杭州市云栖虚构产业园A区', '生成虚构且不可投递的中文地址，必须含虚构标记'),
  field('receiver_name', '收件人', 'person_name', 'llm_prompt', '陈川', '生成虚构中文姓名'),
  field('receiver_phone', '收件电话', 'phone', 'computed', '156****0937', '生成合成手机号并默认部分掩码'),
  field('receiver_address', '收件地址', 'address', 'llm_prompt', '成都市星港虚构商务区B座', '生成虚构且不可投递的中文地址，必须含虚构标记'),
  field('goods', '托寄物', 'goods_description', 'llm_prompt', '训练用包装材料', '生成普通非敏感货物名称'),
  field('weight', '计费重量', 'quantity', 'computed', '12.60 千克', '生成0.1至100千克的一至两位小数'),
  field('fee', '运费', 'amount', 'computed', '48.00 元', '生成非负金额并保留两位小数'),
  field('service', '服务类型', 'text', 'dictionary_rule', '标准陆运', '从fictional_logistics_service枚举读取'),
];

const contractBaseFields = [
  field('contract_no', '合同编号', 'code', 'computed', 'SYN-CT-260827-0086', '生成SYN-CT-日期-4位流水号'),
  field('sign_date', '签订日期', 'date', 'computed', '2026-08-27', '生成YYYY-MM-DD日期'),
  field('party_a', '甲方', 'company_name', 'llm_prompt', '青屿虚构供应链有限公司', '生成不对应真实注册主体的虚构公司名称'),
  field('party_b', '乙方', 'company_name', 'llm_prompt', '泊川虚构商贸有限公司', '生成不对应真实注册主体且不同于甲方的虚构公司名称'),
  field('subject', '协议标的', 'goods_description', 'llm_prompt', '训练用包装物料服务', '依据合同类型生成合规的虚构标的描述'),
  field('amount', '合同金额', 'amount', 'computed', '人民币 168,000.00 元', '生成正金额，币制与大写金额保持一致'),
  field('term', '履行期限', 'date_range', 'computed', '2026-09-01 至 2027-08-31', '生成起始日期不晚于终止日期的日期范围'),
];

const contractSubtypeFields = {
  purchase_agreement: [field('scenario_field_1', '采购标的', 'text', 'llm_prompt', '标准包装耗材（样品）', '生成普通、合法的虚构采购标的'), field('scenario_field_2', '交付批次', 'integer', 'computed', '3批', '生成1至12批')],
  consignment_agreement: [field('scenario_field_1', '代销商品范围', 'text', 'llm_prompt', '办公耗材样品系列', '生成虚构代销商品范围'), field('scenario_field_2', '代销佣金比例', 'decimal', 'computed', '8.00%', '生成1%至30%的比例')],
  logistics_service: [field('scenario_field_1', '服务线路', 'text', 'llm_prompt', '海州—临川干线（虚构）', '生成虚构国内物流线路'), field('scenario_field_2', '时效承诺', 'integer', 'computed', '48小时', '生成12至168小时')],
  warehousing_customs: [field('scenario_field_1', '仓储地点', 'address', 'llm_prompt', '海州综合训练仓', '生成虚构仓储地点'), field('scenario_field_2', '报关服务范围', 'text', 'llm_prompt', '一般贸易申报与单证核验', '生成合规业务服务范围')],
  supply_chain_factoring: [field('scenario_field_1', '应收账款金额', 'amount', 'computed', '人民币 420,000.00 元', '生成不高于基础交易金额的正数'), field('scenario_field_2', '保理融资比例', 'decimal', 'computed', '75.00%', '生成50%至90%的比例')],
  pledge_agreement: [field('scenario_field_1', '质押物', 'text', 'llm_prompt', '标准工业原料样品批次', '生成合法且虚构的质押物描述'), field('scenario_field_2', '评估价值', 'amount', 'computed', '人民币 680,000.00 元', '生成不低于担保债权的正数金额')],
};

export function defaultFields(documentType, contentSubtype = 'purchase_agreement') {
  if (documentType === 'customs') return customsFields.map(item => structuredClone(item));
  if (documentType === 'domestic_waybill') return waybillFields.map(item => structuredClone(item));
  return [...contractBaseFields, ...(contractSubtypeFields[contentSubtype] || contractSubtypeFields.purchase_agreement)].map(item => structuredClone(item));
}

export const DATA_TYPE_OPTIONS = [
  ['text', '文本'], ['code', '代码'], ['serial_number', '业务编号'], ['company_name', '企业名称'],
  ['person_name', '人员姓名'], ['phone', '电话'], ['address', '地址'], ['date', '日期'], ['date_range', '日期范围'], ['amount', '金额'],
  ['quantity', '数量'], ['integer', '整数'], ['decimal', '小数'], ['enum', '枚举'],
  ['goods_description', '商品/标的描述'],
  ['country_region', '国家/地区'], ['currency', '币制'], ['transport_mode', '运输方式'],
  ['supervision_mode', '监管方式'], ['trade_term', '成交方式'], ['hs_code', 'HS编码'],
].map(([value, label]) => ({ value, label }));

export const GENERATOR_OPTIONS = [
  { value: 'dictionary_rule', label: '字典 + 规则' },
  { value: 'computed', label: '计算值' },
  { value: 'llm_prompt', label: '模型 + Prompt' },
];
