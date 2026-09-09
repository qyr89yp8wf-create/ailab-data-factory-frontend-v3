import assert from 'node:assert/strict';
import {compileConversationPrompts,freezeValidatedEvent,validateCompiledRequest,validateEventResult} from '../src/conversationPromptCompiler.js';

const values={
  businessType:'客服“测试”\n含换行',assistantIdentityMarkdown:'客服',assistantPermissionMarkdown:'查询',userRoleMarkdown:'客户',sceneMarkdown:'测试场景',completionRequirementsMarkdown:'回应问题',constraintsMarkdown:'不得编造',
  sampler:{dimensions:[
    {dimension_id:'dim_scene_stable',name:'子场景',values:['物流状态查询'],option_ids:{'物流状态查询':'opt_scene_stable'}},
    {dimension_id:'dim_info_stable',name:'首轮信息完整度',values:['缺少必要信息'],option_ids:{'缺少必要信息':'opt_info_missing'}},
    {dimension_id:'dim_tool_stable',name:'工具执行结果',values:['调用失败'],option_ids:{}}
  ]},
  toolsEnabled:true,toolCatalog:[{name:'query_shipment',description:'查询',call_condition:'有编号',input_fields:[{name:'shipment_id',type:'string',required:true,pattern:'^SYN[0-9]{10}$'}],mock_return_rules:[{outcome_type_id:'outcome_failure_stable',return_type:'调用失败',output_fields:[{name:'code',type:'string',required:true,const:'SERVICE_UNAVAILABLE'},{name:'message',type:'string',required:true}],generation_constraint:'失败不返回状态',example_result:'{"code":"SERVICE_UNAVAILABLE","message":"暂不可用"}'}]}],
  knowledgeEnabled:false,fewShotEnabled:false
};

const compiled=compileConversationPrompts(values,{seed:1,minTurns:3,maxTurns:3,model:'demo-model',generationParameters:{temperature:0.2}});
assert.equal(compiled.stageOne.input.dimension_definitions[0].dimension_id,'dim_scene_stable');
assert.equal(compiled.stageOne.input.dimension_definitions[0].options[0].option_id,'opt_scene_stable');
assert.equal(compiled.assignment.tool_outcome_assignments[0].outcome_type_id,'outcome_failure_stable');
assert.deepEqual(compiled.stageOne.input.dimension_definitions[2].options_source,{collection:'tool_catalog',field:'mock_return_types',tool_names:['query_shipment']});
assert.equal(compiled.stageOne.input.tool_catalog[0].input_schema.additionalProperties,false);
assert.equal(compiled.stageOne.input.tool_catalog[0].input_schema.properties.shipment_id.pattern,'^SYN[0-9]{10}$');
assert.equal(validateCompiledRequest(compiled.stageOne).valid,true);
assert.equal(validateCompiledRequest(compiled.stageTwo).valid,true);
assert.equal(compiled.stageOne.request.model,'demo-model');
assert.deepEqual(compiled.stageOne.request.generation_parameters,{temperature:0.2});

const fact={fact_id:'fact_shipment',name:'shipment_id',value:'SYN2026000001',source:'user_report',source_ref:null,user_knows_initially:true,assistant_knows_initially:false,disclosure_step_id:'s1'};
const base={status:'ok',event:{user_goal:'查询包裹',participants:{user_identity:'客户',assistant_identity:'客服'},facts:[fact],unknowns:[],knowledge_refs:[],interaction_plan:[
  {step_id:'s1',turn_index:1,actor:'user',action_type:'user_message',action:'提供问题但不提供编号',fact_refs:[],call_ref:null},
  {step_id:'s2',turn_index:1,actor:'assistant',action_type:'assistant_message',action:'追问编号',fact_refs:[],call_ref:null},
  {step_id:'s3',turn_index:2,actor:'user',action_type:'user_message',action:'提供编号',fact_refs:['fact_shipment'],call_ref:null},
  {step_id:'s4',turn_index:2,actor:'assistant',action_type:'tool_call',action:'调用查询',fact_refs:['fact_shipment'],call_ref:'call_001'},
  {step_id:'s5',turn_index:2,actor:'tool',action_type:'tool_response',action:'返回失败',fact_refs:[],call_ref:'call_001'},
  {step_id:'s6',turn_index:2,actor:'assistant',action_type:'assistant_message',action:'说明失败',fact_refs:[],call_ref:null},
  {step_id:'s7',turn_index:3,actor:'user',action_type:'user_message',action:'询问下一步',fact_refs:[],call_ref:null},
  {step_id:'s8',turn_index:3,actor:'assistant',action_type:'assistant_message',action:'说明限制',fact_refs:[],call_ref:null}
],tool_plan:[{call_ref:'call_001',tool_name:'query_shipment',arguments:{shipment_id:'SYN2026000001'},outcome_type_id:'outcome_failure_stable',response:{code:'SERVICE_UNAVAILABLE',message:'暂不可用'},required_fact_refs:['fact_shipment'],call_step_id:'s4',response_step_id:'s5'}],expected_completion:{outcome_description:'说明无法查询',unresolved_items:['状态未知'],next_step:null},dialogue_brief:'追问编号后调用失败并如实说明'}};

const pending=validateEventResult(base,compiled);
assert.equal(pending.status,'review_required');
assert.equal(pending.can_freeze,false);
const passed=validateEventResult(base,compiled,{semanticReview:{status:'pass'}});
assert.equal(passed.status,'pass');
assert.equal(freezeValidatedEvent(base,compiled,{semanticReview:{status:'pass'}}).status,'frozen');

const broken=structuredClone(base);
broken.event.interaction_plan[3].actor='tool';
broken.event.tool_plan[0].response={code:'SERVICE_UNAVAILABLE',message:'失败',status:'运输中'};
broken.event.tool_plan[0].response_step_id='s4';
const failed=validateEventResult(broken,compiled,{semanticReview:{status:'pass'}});
assert.equal(failed.status,'fail');
assert.ok(failed.errors.some(item=>item.includes('actor')));
assert.ok(failed.errors.some(item=>item.includes('不允许出现')));
assert.ok(failed.errors.some(item=>item.includes('步骤映射')));

const renamed=structuredClone(values);
renamed.sampler.dimensions[0].name='改名后的子场景';
renamed.sampler.dimensions[0].values=['改名选项'];
renamed.sampler.dimensions[0].option_ids={'改名选项':'opt_scene_stable'};
const renamedCompiled=compileConversationPrompts(renamed,{seed:1});
assert.equal(renamedCompiled.stageOne.input.dimension_definitions[0].dimension_id,'dim_scene_stable');
assert.equal(renamedCompiled.stageOne.input.dimension_definitions[0].options[0].option_id,'opt_scene_stable');

console.log('conversationPromptCompiler: all tests passed');
