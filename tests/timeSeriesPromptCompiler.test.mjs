import assert from 'node:assert/strict';
import { COLDCHAIN_MODEL_CONFIGURATION } from '../src/timeSeriesModelSeed.js';
import { compileStage1, compileStage2, DEMO_FROZEN_EVENT, PREVIEW_RUNTIME, validateEventResult, validateRuntime, validateSeriesResult } from '../src/timeSeriesPromptCompiler.js';

const template=structuredClone(COLDCHAIN_MODEL_CONFIGURATION);
const door={selected_values:[{dimension_id:'event_type',dimension_name:'事件类型',option_id:'door_open',option_name:'开门'},{dimension_id:'primary_event_stage',dimension_name:'主要事件发生阶段',option_id:'port',option_name:'港口等待'},{dimension_id:'cargo_type',dimension_name:'货物类型',option_id:'chilled_goods',option_name:'冷藏货物'},{dimension_id:'environment',dimension_name:'环境条件',option_id:'mild_warm',option_name:'常规温暖环境'}],not_applicable_dimensions:[]};
const stage1=compileStage1(template,door,PREVIEW_RUNTIME);
assert.deepEqual(JSON.parse(stage1.messages[1].content),stage1.userInput,'阶段一User消息必须由输入对象直接序列化');
assert.equal(stage1.userInput.output_fields.length,13);
assert.equal(stage1.userInput.output_schema.oneOf[0].properties.event.properties.initial_values.required.length,13);
const eventSchema=stage1.userInput.output_schema.oneOf[0].properties.event;
assert.ok(eventSchema.required.includes('route_plan'),'定位字段启用时route_plan必须必填');
assert.ok(eventSchema.properties.events.items.properties.parameters.items.properties.value,'parameters必须有完整items');
assert.ok(eventSchema.properties.events.items.properties.response_windows.items.properties.recovery_end_index,'response_windows必须有完整items');
assert.ok(eventSchema.properties.context_values.items.properties.unit,'context_values必须有完整items');
assert.ok(eventSchema.properties.route_plan.items.properties.waypoints.items.properties.latitude,'route_plan与waypoints必须有完整items');
assert.equal(JSON.stringify(stage1.userInput).includes('nominal_itinerary'),false,'阶段一不得预置固定行程');
assert.equal(JSON.stringify(stage1.userInput).includes('route_plan'),true,'route_plan只应作为输出Schema能力存在');

const stage2=compileStage2(template,PREVIEW_RUNTIME,{assignment:door,event:DEMO_FROZEN_EVENT});
assert.deepEqual(JSON.parse(stage2.messages[1].content),stage2.userInput,'阶段二User消息必须由输入对象直接序列化');
assert.equal(stage2.userInput.output_schema.oneOf[0].properties.rows.minItems,48);
assert.equal(stage2.userInput.output_schema.oneOf[0].properties.rows.items.required.length,14);

const doorAtSea={...door,selected_values:door.selected_values.map(item=>item.dimension_id==='primary_event_stage'?{...item,option_id:'sea',option_name:'海运'}:item)};
assert.throws(()=>compileStage1(template,doorAtSea,PREVIEW_RUNTIME),/不允许发生/,'开门海运必须被兼容校验阻止');
assert.throws(()=>validateRuntime({...PREVIEW_RUNTIME,duration_minutes:719}),/点数×采样间隔/);
assert.throws(()=>validateEventResult({status:'ok',event:{...DEMO_FROZEN_EVENT,events:[{...DEMO_FROZEN_EVENT.events[0],event_type_id:'power_off_short'}]}},template,door,PREVIEW_RUNTIME),/与assignment不一致/);

const normalAssignment={selected_values:[{dimension_id:'event_type',dimension_name:'事件类型',option_id:'normal',option_name:'正常运行'},{dimension_id:'cargo_type',dimension_name:'货物类型',option_id:'chilled_goods',option_name:'冷藏货物'},{dimension_id:'environment',dimension_name:'环境条件',option_id:'mild_warm',option_name:'常规温暖环境'}],not_applicable_dimensions:['primary_event_stage']};
const normalEvent={...DEMO_FROZEN_EVENT,events:[]};
assert.equal(validateEventResult({status:'ok',event:normalEvent},template,normalAssignment,PREVIEW_RUNTIME).status,'valid');
const missingRoute=structuredClone(DEMO_FROZEN_EVENT);delete missingRoute.route_plan;
assert.throws(()=>validateEventResult({status:'ok',event:missingRoute},template,door,PREVIEW_RUNTIME),/route_plan为必填字段/,'定位启用时缺少路线必须失败');
const wrongResponse=structuredClone(DEMO_FROZEN_EVENT);wrongResponse.events[0].response_windows[0].recovery_start_index=20;
assert.throws(()=>validateEventResult({status:'ok',event:wrongResponse},template,door,PREVIEW_RUNTIME),/recovery_start_index是不允许的额外字段/);
const wrongContext=structuredClone(DEMO_FROZEN_EVENT);wrongContext.context_values=[{key:'baseline_air_c',value:4,unit:'℃'}];
assert.throws(()=>validateEventResult({status:'ok',event:wrongContext},template,door,PREVIEW_RUNTIME),/name为必填字段/);
const wrongRoute=structuredClone(DEMO_FROZEN_EVENT);wrongRoute.route_plan[0].interpolation='static';
assert.throws(()=>validateEventResult({status:'ok',event:wrongRoute},template,door,PREVIEW_RUNTIME),/不在允许枚举中/);
const wrongLag=structuredClone(DEMO_FROZEN_EVENT);wrongLag.events[0].parameters.find(item=>item.name==='cargo_lag_minutes').value=20;
assert.throws(()=>validateEventResult({status:'ok',event:wrongLag},template,door,PREVIEW_RUNTIME),/必须对齐runtime.step_minutes/);
const outOfRangeLag=structuredClone(DEMO_FROZEN_EVENT);outOfRangeLag.events[0].parameters.find(item=>item.name==='cargo_lag_minutes').value=45;outOfRangeLag.events[0].response_windows.find(item=>item.field_id==='cargo_temperature').start_index=19;
assert.throws(()=>validateEventResult({status:'ok',event:outOfRangeLag},template,door,PREVIEW_RUNTIME),/超出配置范围/);
const cargoCrossStage=structuredClone(DEMO_FROZEN_EVENT);cargoCrossStage.events[0].response_windows.find(item=>item.field_id==='cargo_temperature').recovery_end_index=26;
assert.equal(validateEventResult({status:'ok',event:cargoCrossStage},template,door,PREVIEW_RUNTIME).status,'valid','货物恢复允许跨入下一阶段');
const airCrossStage=structuredClone(DEMO_FROZEN_EVENT);airCrossStage.events[0].response_windows.find(item=>item.field_id==='return_air_temperature').recovery_end_index=24;
assert.throws(()=>validateEventResult({status:'ok',event:airCrossStage},template,door,PREVIEW_RUNTIME),/空气恢复完成点必须位于事件阶段内/);

const rows=Array.from({length:48},(_,index)=>({index,...DEMO_FROZEN_EVENT.initial_values}));
assert.equal(validateSeriesResult({status:'ok',rows},template,PREVIEW_RUNTIME,DEMO_FROZEN_EVENT).rows.length,48);
assert.throws(()=>validateSeriesResult({status:'ok',rows:rows.slice(1)},template,PREVIEW_RUNTIME,DEMO_FROZEN_EVENT),/48行/);
assert.throws(()=>validateSeriesResult({status:'ok',rows:rows.map((row,index)=>({...row,index:index===2?1:index}))},template,PREVIEW_RUNTIME,DEMO_FROZEN_EVENT),/index必须为2/);
assert.throws(()=>validateSeriesResult({status:'ok',rows:rows.map((row,index)=>index===2?{...row,temperature_setpoint:'4'}:row)},template,PREVIEW_RUNTIME,DEMO_FROZEN_EVENT),/必须是number/);

const water={fields:[{field_id:'level',label:'液位',type:'number',unit:'m',nullable:false,enabled:true,value_schema:{type:'number',minimum:0,maximum:10},overall_change_rules:'液位缓慢变化',stage_event_rules:'',relations_special_constraints:''},{field_id:'valve_status',label:'阀门状态',type:'string',unit:'',nullable:false,enabled:true,enum_values:['open','closed'],value_schema:{type:'string',enum:['open','closed']},overall_change_rules:'初始关闭',stage_event_rules:'进水时开启',relations_special_constraints:''}],event_generation:{scene_config:{business_scene_description:'水箱液位变化'},sampling_dimensions:[{dimension_id:'event_type',name:'事件类型',values:['正常'],option_ids:{正常:'normal'}}],event_definitions:[{event_id:'normal',name:'正常'}],compatibility_rules:{normal:[]}}};
const waterCompiled=compileStage1(water,{event_type_id:'normal',values:{event_type:'normal'},not_applicable_dimensions:[]},PREVIEW_RUNTIME);
assert.equal(/冷链|港口|箱温/.test(waterCompiled.userText),false,'通用编译输入不得泄漏冷链字段或场景词');
assert.equal(waterCompiled.userInput.output_schema.oneOf[0].properties.event.required.includes('route_plan'),false,'非定位模板不得要求route_plan');

console.log('timeSeriesPromptCompiler: all tests passed');
