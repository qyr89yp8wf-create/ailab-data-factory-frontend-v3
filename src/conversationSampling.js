export const SAMPLING_SCHEMA_VERSION = 'conversation-sampling/v1';
export const SAMPLER_ALGORITHM_VERSION = 'quota-conditional/v1';

const stableId = (prefix, name, index = 0) => `${prefix}_${String(name || index).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_').replace(/^_|_$/g, '') || index}`;

export function defaultConversationSampler() {
  const scenario = (id, name, goal, facts, knowledgeIds, profiles) => ({
    id, name, goal,
    cases: [{ id: `${id}_case_1`, name: `${name}标准案例`, knowledge_ids: knowledgeIds, clarification_only: false, facts, steps: [{ id: 'explain', name: '解释规则' }, { id: 'resolved', name: '解答完成' }] }],
    profiles: profiles || [{ id: `${id}_standard`, name: '标准咨询', eligible_case_ids: [`${id}_case_1`], withheld_fields: [], disclosure_condition: '按自然咨询顺序提供必要信息', steps: [{ id: 'explain', name: '解释规则' }, { id: 'resolved', name: '解答完成' }] }],
  });
  return {
    algorithm_version: SAMPLER_ALGORITHM_VERSION,
    scenarios: [
      scenario('delivery_time', '时效咨询', '说明参考时效及不确定因素', { route: { type: 'string', value: '上海→杭州', visibility: 'both' }, reference_days: { type: 'string', value: '2～3天（非保证）', visibility: 'assistant' } }, ['K_DELIVERY_TIME']),
      scenario('fee', '运费咨询', '解释计费依据并给出有依据的报价', { route: { type: 'string', value: '上海→杭州', visibility: 'both' }, actual_weight_kg: { type: 'number', value: 2, visibility: 'user' }, dimensions_cm: { type: 'string', value: '50×40×30', visibility: 'user' }, quoted_fee_yuan: { type: 'number', value: 57, visibility: 'assistant' } }, ['K_FEE_A'], [
        { id: 'fee_complete', name: '信息完整', eligible_case_ids: ['fee_case_1'], withheld_fields: [], disclosure_condition: '首轮提供线路、重量和尺寸', steps: [{id:'explain',name:'解释规则'},{id:'resolved',name:'解答完成'}] },
        { id: 'fee_ask_dimensions', name: '需要追问尺寸', eligible_case_ids: ['fee_case_1'], withheld_fields: ['dimensions_cm'], disclosure_condition: '客服询问长宽高后提供', steps: [{id:'collect',name:'追问尺寸'},{id:'explain',name:'解释规则'},{id:'resolved',name:'解答完成'}] },
        { id: 'fee_misunderstanding', name: '用户误解计费方式', eligible_case_ids: ['fee_case_1'], withheld_fields: [], disclosure_condition: '用户先质疑按体积重量计费', steps: [{id:'clarify',name:'澄清误解'},{id:'explain',name:'解释规则'},{id:'resolved',name:'解答完成'}] },
      ]),
      scenario('shipment_status', '物流状态查询', '基于已知轨迹说明当前状态', { shipment_id: { type: 'string', value: 'SYN_DEMO_001', visibility: 'user' }, status: { type: 'string', value: '在途', visibility: 'assistant' }, last_update: { type: 'string', value: '2026-09-01 16:00:00', visibility: 'assistant' }, arrival_time: { type: 'string', value: null, unknown_reason: '尚无可确认到达时间', visibility: 'neither' } }, ['K_SHIPMENT_STATUS']),
      scenario('packaging', '包装咨询', '说明普通玻璃杯包装要求', { item: { type: 'string', value: '普通玻璃杯', visibility: 'user' }, requirement: { type: 'string', value: '独立缓冲、隔离、外箱固定', visibility: 'assistant' } }, ['K_PACKAGING']),
    ],
    style_dimensions: [],
  };
}

export function emptyConversationSampler() {
  return { algorithm_version: SAMPLER_ALGORITHM_VERSION, scenarios: [], style_dimensions: [] };
}

function allocate(items, count) {
  const normalizedCount = Number(count);
  const active = items.filter(item => item.enabled !== false && Number.isFinite(Number(item.weight ?? 1)) && Number(item.weight ?? 1) > 0).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  if (!Number.isInteger(normalizedCount) || normalizedCount < 0) throw new Error('候选对话数量必须为非负整数');
  if (!active.length) throw new Error('至少需要一个可采样项');
  const total = active.reduce((sum,item)=>sum+Number(item.weight ?? 1),0);
  const rows = active.map(item => { const exact=normalizedCount*Number(item.weight ?? 1)/total; return { ...item, exact, quota:Math.floor(exact), remainder:exact-Math.floor(exact) }; });
  let remaining = normalizedCount-rows.reduce((sum,item)=>sum+item.quota,0);
  [...rows].sort((a,b)=>b.remainder-a.remainder||String(a.id).localeCompare(String(b.id))).slice(0,remaining).forEach(item=>{rows.find(row=>row.id===item.id).quota+=1;});
  return rows.map(({exact,remainder,...item})=>({...item, ratio:Number(item.weight ?? 1)/total}));
}

export function buildQuotaPlan(sampler, count) {
  const scenarios = allocate(sampler?.scenarios || [], Number(count));
  return scenarios.map(scenario => ({ ...scenario, profiles:allocate(scenario.profiles || [], scenario.quota) }));
}

function seeded(seed) { let value=(Number(seed)||1)>>>0; return ()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;}; }

export function sampleAssignments({ sampler, count, seed = 20260907 }) {
  if (sampler?.dimensions?.length) {
    const random = seeded(seed);
    const dimensions = sampler.dimensions.filter(item => item?.name && item.enabled !== false && item.values?.length);
    if (!dimensions.length) throw new Error('至少需要一个包含枚举值的事件采样维度');
    return Array.from({ length: Number(count || 0) }, (_, index) => {
      const eventDimensions = Object.fromEntries(dimensions.map(item => [item.name, item.values[Math.floor(random() * item.values.length)]]));
      return {
        sequence: index + 1,
        sample_id: `SAMPLE-${String(index + 1).padStart(6, '0')}`,
        assignment_id: `ASSIGN-${String(seed)}-${String(index + 1).padStart(6, '0')}`,
        event_dimensions: eventDimensions,
        coverage_target: eventDimensions,
      };
    });
  }
  const plan=buildQuotaPlan(sampler,count); const random=seeded(seed); const assignments=[];
  plan.forEach(scenario=>scenario.profiles.forEach(profile=>{
    const cases=(scenario.cases||[]).filter(item=>item.enabled!==false&&Number(item.weight??1)>0&&profile.eligible_case_ids?.includes(item.id));
    if(!cases.length) throw new Error(`${scenario.name} / ${profile.name} 没有可用合法案例`);
    for(let index=0;index<profile.quota;index+=1){const item=cases[Math.floor(random()*cases.length)];const facts=item.facts||Object.fromEntries((item.fact_items||[]).filter(fact=>fact?.key).map(fact=>[fact.key,{type:fact.type||'string',value:fact.value,visibility:fact.visibility||'both'}]));const steps=profile.steps||String(profile.state_path||'').split(/[,，>→\n]+/).map(value=>value.trim()).filter(Boolean).map(id=>({id,name:id}));assignments.push({scenario_id:scenario.id,scenario_name:scenario.name,profile_id:profile.id,profile_name:profile.name,case_id:item.id,case_name:item.name,knowledge_ids:item.knowledge_ids||[],tool_names:item.tool_names||[],business_facts:facts,withheld_fields:profile.withheld_fields||[],initial_disclosed_fields:profile.initial_disclosed_fields||[],disclosure_condition:profile.disclosure_condition,state_path:steps.map(step=>step.id),expected_final_state:profile.expected_final_state||steps.at(-1)?.id||(item.steps||[]).at(-1)?.id||null,coverage_target:{scenario:scenario.id,profile:profile.id}});}
  }));
  for(let i=assignments.length-1;i>0;i-=1){const j=Math.floor(random()*(i+1));[assignments[i],assignments[j]]=[assignments[j],assignments[i]];}
  return assignments.map((item,index)=>({...item,sequence:index+1,sample_id:`SAMPLE-${String(index+1).padStart(6,'0')}`,assignment_id:`ASSIGN-${String(seed)}-${String(index+1).padStart(6,'0')}`}));
}
