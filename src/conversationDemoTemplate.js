const dimensions = [
  {dimension_id:'sub_scene',name:'子场景',values:['物流状态查询','运输时效咨询','运费咨询','包装咨询'],option_ids:{物流状态查询:'shipment_status',运输时效咨询:'delivery_time',运费咨询:'delivery_fee',包装咨询:'packaging'},description:'本条对话主要处理的业务问题',applicability_conditions:'所有事件',prohibited_conditions:''},
  {dimension_id:'user_identity',name:'用户身份',values:['寄件人','收件人','企业客户'],option_ids:{寄件人:'sender',收件人:'recipient',企业客户:'business_customer'},description:'发起咨询的客户身份与业务背景',applicability_conditions:'所有事件',prohibited_conditions:''},
  {dimension_id:'user_initial_attitude',name:'用户初始态度',values:['平静','焦急','不满'],option_ids:{平静:'calm',焦急:'anxious',不满:'dissatisfied'},description:'用户进入对话时的情绪，不限定后续情绪变化',applicability_conditions:'所有事件',prohibited_conditions:''},
  {dimension_id:'first_turn_completeness',name:'首轮信息完整度',values:['信息完整','信息不完整'],option_ids:{信息完整:'complete',信息不完整:'incomplete'},description:'用户首轮是否提供处理当前问题所需的信息',applicability_conditions:'当前子场景存在需要用户提供的必要信息',prohibited_conditions:'一般规则咨询不得仅因没有运单号而判为信息不完整'},
  {dimension_id:'business_exception',name:'业务异常事件',values:['无异常','运输延误','物流记录停滞'],option_ids:{无异常:'none',运输延误:'delivery_delay',物流记录停滞:'tracking_stalled'},description:'具体运单的业务异常情况',applicability_conditions:'物流状态查询子场景',prohibited_conditions:'一般运费、包装及运输规则咨询不得组合具体运单异常'},
  {dimension_id:'tool_result',name:'工具执行结果',values:['查询成功','无记录','调用失败'],option_ids:{查询成功:'outcome_success',无记录:'outcome_not_found',调用失败:'outcome_service_failure'},description:'选项来自工具模拟返回配置',applicability_conditions:'本条事件安排调用对应工具',prohibited_conditions:'未调用工具时不得采样；同一次调用只能选择一种返回类型'},
];

const knowledgeText = `[知识卡 DELIVERY-STATUS-001]\n知识主题：物流状态及记录更新\n适用范围：物流状态查询。\n业务规则：运输中表示包裹仍处于运输流程，不代表已到达收件地址。物流记录超过24小时未更新，可以说明记录暂未更新，但不能仅据此认定包裹丢失或确定延误原因。\n处理建议：说明已查询到的状态和最后更新时间；原因未知时明确说明无法确认。\n\n[知识卡 DELIVERY-TIME-001]\n知识主题：运输时效\n适用范围：运输时效咨询及延误解释。\n业务规则：本示例未提供线路时效表，不支持计算具体到达日期。工具返回预计到达时间时，应说明其为预计时间。\n\n[知识卡 DELIVERY-FEE-001]\n知识主题：运费计费\n适用范围：运费咨询。\n业务规则：计费重量取实际重量与体积重量中的较大值；体积重量为长×宽×高÷6000。本示例未提供线路单价，不得给出最终运费。\n\n[知识卡 DELIVERY-PACK-001]\n知识主题：包装要求\n适用范围：包装要求咨询。\n业务规则：普通物品使用强度适当的外包装并填充空隙；易碎品单独缓冲；特殊物品需另行核实寄递限制。`;

export const CONVERSATION_DEMO_CONFIGURATION = {
  sampling_schema_version:'conversation-sampling/v1',
  identity:{name:'物流智能客服对话模板（演示用）',business_type:'智能客服多轮对话',description:'用于合成物流咨询多轮对话，覆盖物流状态、运输时效、运费、包装及异常问题。'},
  scenario:{
    assistant_identity_markdown:'物流企业的在线智能客服，为寄件人、收件人及企业客户提供物流咨询服务。',
    assistant_permission_markdown:'可依据知识卡回答业务规则，并在满足条件时使用已配置工具。具体运单结论必须依据查询结果；不得声称完成未配置的操作。',
    user_role_markdown:'用户为寄件人、收件人或企业客户，可能掌握运单号或页面物流记录，但不了解系统内部信息。',
    scene_markdown:'客户通过在线客服咨询物流状态、运输时效、运费、包装，以及延误、停滞和签收争议。具体子场景与用户状态由事件采样维度确定。',
    completion_requirements_markdown:'结束前回应核心问题；无法解决时明确原因和当前限制；涉及操作时区分建议办理、已尝试和已完成。',
    constraints_markdown:'业务结论以知识卡和工具结果为准；不得编造物流节点、原因、时间、费用、赔付或办理结果；只收集当前问题必需的信息。',
    sample_labels_enabled:false,coverage_labels_markdown:'',coverage_label_prompt:'',other_instructions_enabled:false,other_markdown:'',
  },
  sampler:{algorithm_version:'quota-conditional/v1',dimensions},
  knowledge:{enabled:true,mode:'knowledge_cards',usage_instructions:'根据咨询子场景选择适用知识。一般规则依据知识卡，具体运单状态依据工具结果；不得用一般规则推断具体运单事实。',text:knowledgeText},
  tools:{enabled:true,mode:'agent_trace',catalog:[{name:'query_shipment',description:'根据合成运单号查询物流状态、最后更新时间及已知异常信息。',call_condition:'用户查询具体运单且已提供符合格式的运单号；一般规则咨询无需调用。',input_fields:[{name:'shipment_id',type:'string',required:true,pattern:'^SYN[0-9]{10}$',description:'SYN 加10位数字'}],example_arguments:{shipment_id:'SYN2026000001'},mock_return_rules:[
    {outcome_type_id:'outcome_success',return_type:'查询成功',output_fields:[{name:'shipment_id',type:'string',required:true},{name:'status',type:'string',required:true},{name:'last_update_time',type:'string',required:true},{name:'exception_type',type:'string',required:true},{name:'known_reason',type:'string',required:false}],generation_constraint:'状态限定为已揽收、运输中、派送中或已签收；原因未知时省略。'},
    {outcome_type_id:'outcome_not_found',return_type:'无记录',output_fields:[{name:'shipment_id',type:'string',required:true},{name:'code',type:'string',required:true},{name:'message',type:'string',required:true}],generation_constraint:'code 固定为 NOT_FOUND；不返回物流状态。'},
    {outcome_type_id:'outcome_service_failure',return_type:'调用失败',output_fields:[{name:'code',type:'string',required:true},{name:'message',type:'string',required:true}],generation_constraint:'code 固定为 SERVICE_UNAVAILABLE；不返回物流状态。'},
  ]}]},
  few_shot:{enabled:true,dialogue_jsonl:'{"messages":[{"role":"user","content":"寄陶瓷杯要怎么包装？"},{"role":"assistant","content":"建议单独缓冲包裹并填满箱内空隙，最后牢固封口。"}]}',tool_jsonl:'',knowledge_jsonl:''},
  prompt_template:{version:'conversation-two-stage/v2',output_format:'messages_jsonl',user_editable:false},
  quality:{fixed_policy_ref:'conversation-fixed-quality/v1',fixed_rules_locked:true,custom_enabled:true,label_coverage_enabled:false,scenario_rules:[]},
  trial_config:{model:{provider:'bailian',alias:'qwen3-14b',temperature:0.2,enable_thinking:false},sample_count:3,min_turns:3,max_turns:6,generate_dialogue:true,judge_enabled:true},
};

export const CONVERSATION_DEMO_TEMPLATE = {
  template_id:'CONVTPL-LOGISTICS-DEMO-V2',name:'物流智能客服对话模板（演示用）',description:CONVERSATION_DEMO_CONFIGURATION.identity.description,business_type:'智能客服多轮对话',version:'V1',version_count:1,status:'enabled',rule_card_count:4,configuration:CONVERSATION_DEMO_CONFIGURATION,selected_version:{version:'V1',configuration_v2:CONVERSATION_DEMO_CONFIGURATION,rule_card_count:4},created_at:'2026-09-09 09:00:00',updated_at:'2026-09-09 09:00:00',
};
