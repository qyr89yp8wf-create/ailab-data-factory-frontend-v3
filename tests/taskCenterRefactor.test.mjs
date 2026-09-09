import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONVERSATION_DEMO_CONFIGURATION,CONVERSATION_DEMO_TEMPLATE} from '../src/conversationDemoTemplate.js';
import {compileConversationPromptsFromConfiguration} from '../src/conversationPromptCompiler.js';
import {COLDCHAIN_MODEL_CONFIGURATION} from '../src/timeSeriesModelSeed.js';

assert.match(CONVERSATION_DEMO_TEMPLATE.name,/（演示用）$/);
assert.equal(CONVERSATION_DEMO_TEMPLATE.status,'enabled');
assert.equal(CONVERSATION_DEMO_CONFIGURATION.scenario.sample_labels_enabled,false);
assert.equal(CONVERSATION_DEMO_CONFIGURATION.prompt_template.output_format,'messages_jsonl');
assert.equal(CONVERSATION_DEMO_CONFIGURATION.sampler.dimensions.length,6);
assert.deepEqual(CONVERSATION_DEMO_CONFIGURATION.sampler.dimensions.find(item=>item.dimension_id==='tool_result').values,['查询成功','无记录','调用失败']);
assert.equal(CONVERSATION_DEMO_CONFIGURATION.knowledge.enabled,true);
assert.equal(CONVERSATION_DEMO_CONFIGURATION.tools.catalog[0].mock_return_rules.length,3);
const compiled=compileConversationPromptsFromConfiguration(CONVERSATION_DEMO_CONFIGURATION,{seed:7,minTurns:3,maxTurns:6,referenceTime:'2026-09-09T10:00:00+08:00'});
assert.equal(compiled.stageOne.request.messages.length,2);
assert.equal(compiled.stageTwo.request.messages.length,2);

assert.equal(COLDCHAIN_MODEL_CONFIGURATION.generation.method,'model');
assert.equal(COLDCHAIN_MODEL_CONFIGURATION.event_generation.sampling_dimensions.length,4);
assert.equal(COLDCHAIN_MODEL_CONFIGURATION.event_generation.event_definitions.length,8);
assert.equal(COLDCHAIN_MODEL_CONFIGURATION.fields.length,13);

const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
const coldchainEditor=await readFile(new URL('../src/ColdChainTemplateCenter.jsx',import.meta.url),'utf8');
const coldchainApi=await readFile(new URL('../src/coldchainApi.js',import.meta.url),'utf8');
assert.match(main,/task-two-column-layout/);
assert.match(main,/最少时序步数/);
assert.match(main,/最多时序步数/);
assert.match(main,/start_time_policy:'per_sample_generated'/);
assert.match(main,/seed_policy:'system_generated'/);
assert.doesNotMatch(main,/label:'系统时间设置'/);
assert.match(main,/title="事件采样比例"/);
assert.doesNotMatch(main,/name="randomSeed"/);
assert.doesNotMatch(main,/name="samplingSeed"/);
assert.ok(main.indexOf('const selectedDataset=eligibleDatasets.find')<main.indexOf('const selectedTemplate=isSynthesis'), 'selectedDataset 必须先初始化，再用于选择质检模板');
assert.match(coldchainEditor,/title="1\. 事件内容生成请求"/);
assert.match(coldchainEditor,/label:'分配采样条件'/);
assert.match(coldchainEditor,/label:'阶段一完整请求'/);
assert.match(coldchainEditor,/title="2\. 事件内容合成"/);
assert.match(coldchainEditor,/title="3\. 阶段二完整请求"/);
assert.match(coldchainEditor,/下载完整数据（CSV）/);
assert.match(coldchainEditor,/text\/csv;charset=utf-8/);
assert.match(coldchainApi,/generatedEventResult=\{status:'ok',event:generatedEvent\}/);
assert.match(coldchainApi,/request_preview:true/);

console.log('taskCenterRefactor: all tests passed');
