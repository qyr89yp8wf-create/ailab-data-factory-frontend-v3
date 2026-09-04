import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert, App as AntApp, Avatar, Badge, Breadcrumb, Button, Card, Checkbox, Col,
  ConfigProvider, Descriptions, Divider, Drawer, Dropdown, Empty, Flex, Form,
  Input, InputNumber, Layout, Menu, Modal, Progress, Radio, Row, Segmented,
  Select, Slider, Space, Statistic, Steps, Switch, Table, Tabs, Tag, Timeline,
  Tooltip, Typography, Upload, message
} from 'antd';
import {
  AppstoreOutlined, BellOutlined, CheckCircleOutlined, CloudUploadOutlined,
  DatabaseOutlined, DeleteOutlined, DownOutlined, ExclamationCircleOutlined,
  FileImageOutlined, FileTextOutlined, FilterOutlined, FundOutlined,
  HomeOutlined, LeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlayCircleOutlined,
  PlusOutlined, SearchOutlined, SettingOutlined, SafetyCertificateOutlined,
  RiseOutlined, ArrowRightOutlined, ApartmentOutlined, KeyOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import {
  CUSTOMS_INITIAL_VALUES, CustomsAugmentationFields, CustomsGenerationFields,
  CustomsQualityFields, CustomsTaskDetail, CustomsTemplateFields,
  createCustomsBackendJob, customsStages
} from './CustomsMvp';
import { CustomsQualityReportPage } from './CustomsQualityReport';
import { ColdChainQualityReportPage } from './ColdChainQualityReport';
import {
  COLD_CHAIN_INITIAL_VALUES, ColdChainAugmentationFields, ColdChainGenerationFields,
  ColdChainQualityFields, ColdChainSubmissionSummary, ColdChainTaskDetail,
  ColdChainTemplateSelectionFields, createColdChainBackendJob, coldchainStages,
} from './ColdChainMvp';
import {
  CONVERSATION_TASK_INITIAL_VALUES, ConversationAugmentationFields,
  ConversationGenerationFields, ConversationQualityExpansionFields,
  ConversationSubmissionSummary, ConversationTaskInformation, ConversationTaskLogs,
  ConversationTaskResults, ConversationTemplateSelectionFields,
  createConversationBackendJob, conversationStages,
} from './ConversationTaskFlow';
import { ConversationQualityReportPage } from './ConversationQualityReport';
import {
  SYNTHETIC_DOCUMENT_INITIAL_VALUES, SyntheticDocumentAugmentationFields,
  SyntheticDocumentGenerationFields, SyntheticDocumentQualityFields,
  SyntheticDocumentSubmissionSummary, SyntheticDocumentTaskDetail,
  SyntheticDocumentTemplateFields, createSyntheticDocumentBackendJob,
  syntheticDocumentStages,
} from './SyntheticDocumentTaskFlow';
import { customsApi } from './customsApi';
import { coldchainApi } from './coldchainApi';
import { conversationApi } from './conversationApi';
import { syntheticTemplateApi } from './syntheticTemplateApi';
import { localStoreApi } from './localStoreApi';
import { formatDateTime, nowDateTime } from './timeUtils';
import { TemplateCenter } from './TemplateCenter';
import { ApiKeysManager } from './ApiKeysManager';
import './styles.css';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const CURRENT_USER = 'feidongni';
const TASK_TYPES = ['数据合成','数据质检','数据增强','定向扩增'];

const modalityColor = { 文档图像:'blue', 对话文本:'geekblue', 时序数据:'green' };
const stageColor = { 数据合成:'cyan', 数据质检:'purple', 数据增强:'orange', 生成:'cyan', 增强:'orange', 隐私处理:'red', 质量评估:'purple', 隐私评估:'volcano', 覆盖评估:'gold', 定向增强:'orange', 定向扩增:'lime', 问题处置:'magenta' };
const statusMap = { 运行中:'processing', 已完成:'success', 失败:'error', 已终止:'default', 排队中:'warning', 草稿:'default', 可用:'success' };
const modalityLabelMap = { 文档图像:'文档类图像', 对话文本:'对话类数据', 时序数据:'时序类数据' };
const taskTypeColor=value=>({数据合成:'blue',数据质检:'purple',数据增强:'orange',定向扩增:'lime'}[value]||'default');
const taskPageConfig = {
  'tasks-document': { modality:'文档图像', label:'文档类图像', icon:<FileImageOutlined/> },
  'tasks-conversation': { modality:'对话文本', label:'对话类数据', icon:<FileTextOutlined/> },
  'tasks-timeseries': { modality:'时序数据', label:'时序类数据', icon:<FundOutlined/> },
};

const initialTasks = [
  { key:'1', id:'TASK-20260812-0048', name:'物流运单批量合成', description:'合成训练所需运单图像', taskType:'数据合成', modality:'文档图像', businessType:'运单', stages:['数据合成'], input:'运单模板', output:'物流运单图像数据集 / V3', currentStage:'数据合成', status:'运行中', progress:68, created:'2026-08-12 09:42:00' },
  { key:'2', id:'TASK-20260812-0039', name:'报关单覆盖短板扩增', description:'根据已有覆盖检查结果补齐报关单短板', taskType:'定向扩增', modality:'文档图像', businessType:'报关单', stages:['定向扩增'], input:'报关单与合同数据集 / V2', output:'报关单与合同数据集 / V3', currentStage:'定向扩增', status:'已完成', progress:100, created:'2026-08-12 09:10:00' },
  { key:'3', id:'TASK-20260812-0027', name:'投诉对话数据质检', description:'检查敏感信息和对话质量', taskType:'数据质检', modality:'对话文本', businessType:'异常反馈', stages:['数据质检'], input:'物流客服多轮对话 / 524D25F69157', output:'物流客服多轮对话 / 8A67C201DF33', currentStage:'样本级质检标签写入', status:'运行中', progress:42, created:'2026-08-12 08:56:00' },
  { key:'4', id:'TASK-20260811-0186', name:'冷链温湿度异常序列合成', description:'合成超温和骤冷事件序列', taskType:'数据合成', modality:'时序数据', businessType:'传感器时序', stages:['数据合成'], input:'冷链时序模板', output:'冷链温湿度时序集 / V3', currentStage:'结果写入', status:'已完成', progress:100, created:'2026-08-11 17:32:00' },
  { key:'5', id:'TASK-20260811-0173', name:'合同图像数据质检', description:'输出OCR可用性和字段一致性报告', taskType:'数据质检', modality:'文档图像', businessType:'合同', stages:['数据质检'], input:'合同图像数据集 / 7042CB169AED', output:'技术失败，未创建正式版本', currentStage:'OCR回检失败', status:'失败', progress:76, created:'2026-08-11 16:48:00' },
  { key:'6', id:'TASK-20260811-0159', name:'GPS偏航场景定向扩增', description:'根据覆盖短板定向扩增偏航场景', taskType:'定向扩增', modality:'时序数据', businessType:'GPS轨迹', stages:['定向扩增'], input:'车辆GPS轨迹集 / V2', output:'车辆GPS轨迹集 / V3', currentStage:'等待资源', status:'排队中', progress:0, created:'2026-08-11 15:21:00' },
  { key:'7', id:'TASK-20260811-0141', name:'异常反馈多轮对话合成', description:'合成投诉、延误与破损场景对话', taskType:'数据合成', modality:'对话文本', businessType:'异常反馈', stages:['数据合成'], input:'智能客服对话模板', output:'物流客服多轮对话 / V3', currentStage:'结果写入', status:'已完成', progress:100, created:'2026-08-11 14:06:00' },
];

const backendStatusMap = {
  queued:'排队中', running:'运行中', completed:'已完成', failed:'失败', cancelled:'已终止',
  generating:'运行中', extracting_rules:'运行中', retrieving:'运行中', planning:'运行中',
  generating_dialogues:'运行中', augmenting:'运行中', quality_checking:'运行中',
  expanding:'运行中', rechecking:'运行中', writing_results:'运行中',
};

function validationMeta(job) {
  if(job.pipeline==='cold-chain') return {name:'冷链时序模板任务',modality:'时序数据',businessType:'传感器时序',stages:['生成',...(job.parameters?.augmentation?.enabled?['增强']:[]),...(job.parameters?.enable_quality?['质量评估']:[]),...(job.parameters?.enable_expansion?['定向扩增']:[])]};
  if(job.pipeline==='conversation') return {name:'智能客服对话运行验证',modality:'对话文本',businessType:'智能客服多轮对话',stages:['生成','质量评估',...(job.parameters?.expansion?.enabled?['定向扩增']:[])]};
  return {name:'进口报关单运行验证',modality:'文档图像',businessType:'报关单',stages:['生成',...(job.parameters?.run_qc?['质量评估']:[]),...(job.parameters?.enable_expansion?['定向扩增']:[])]};
}

function validationToTask(job) {
  const meta=validationMeta(job);
  const status=backendStatusMap[job.status]||'运行中';
  return {
    key:`validation-${job.id}`,id:job.id,name:`${meta.name} · ${job.id.slice(-4)}`,
    description:'由浏览器 Mock 自动恢复的验证记录，参数、阶段事件与生成结果均保存在本地状态中。',
    taskType:'数据合成',modality:meta.modality,businessType:meta.businessType,stages:['数据合成'],
    input:'本地验证参数',output:'本地文件系统',currentStage:job.message||job.stage,
    status,progress:Number(job.progress)||0,
    created:formatDateTime(job.created_at),
    backendJob:job,validationOnly:true,
  };
}

function mergeValidationTasks(tasks, validations) {
  const jobs=new Map(validations.map(job=>[job.id,job]));
  const merged=tasks.map(task=>{
    const job=jobs.get(task.id);
    if(!job)return task;
    jobs.delete(task.id);
    return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||task.currentStage};
  });
  return [...validations.filter(job=>jobs.has(job.id)).map(validationToTask),...merged];
}

function normalizedTaskType(task) {
  if(TASK_TYPES.includes(task.taskType))return task.taskType;
  if(task.taskType==='数据生成')return '数据合成';
  if((task.stages||[]).includes('定向扩增'))return '定向扩增';
  if((task.stages||[]).some(stage=>['增强','定向增强'].includes(stage)))return '数据增强';
  return '数据质检';
}

function normalizeTaskTimes(items) {
  return (items || []).map(task=>{const taskType=normalizedTaskType(task);return {...task,taskType,stages:[taskType],created:formatDateTime(task.created || task.created_at),updated:task.updated||task.updated_at?formatDateTime(task.updated||task.updated_at):undefined};});
}

const initialDatasets = [
  { id:1, name:'物流运单图像数据集', modality:'文档图像', businessType:'运单', status:'可用', desc:'华东区域标准运单及多种扫描、拍摄场景。', defaultVersion:'V3', totalSamples:'520K', reference:true, versions:[
    { id:'D1V3', version:'V3', note:'补充夜间反光与折叠场景', source:'TASK-20260812-0048', sourceName:'物流运单批量生成', samples:'220K', quality:96.4, created:'2026-08-12 10:50:00', consumers:['TASK-20260812-0062'] },
    { id:'D1V2', version:'V2', note:'隐私处理后的运单数据', source:'TASK-20260810-0112', sourceName:'运单隐私优化', samples:'180K', quality:94.8, created:'2026-08-10 16:20:00', consumers:['TASK-20260812-0048'] },
    { id:'D1V1', version:'V1', note:'首批运单生成结果', source:'TASK-20260808-0016', sourceName:'华东区运单初始生成', samples:'120K', quality:91.2, created:'2026-08-08 09:30:00', consumers:['TASK-20260810-0112'] }
  ]},
  { id:2, name:'报关单与合同数据集', modality:'文档图像', businessType:'报关单', status:'可用', desc:'报关字段、表格、金额及贸易术语样本。', defaultVersion:'V3', totalSamples:'286K', reference:true, versions:[
    { id:'D2V3', version:'V3', note:'覆盖短板定向扩增结果', source:'TASK-20260812-0039', sourceName:'报关单覆盖短板优化', samples:'126K', quality:93.8, created:'2026-08-12 12:10:00', consumers:[] },
    { id:'D2V2', version:'V2', note:'统一字段结构后的数据', source:'TASK-20260809-0088', sourceName:'报关单格式优化', samples:'90K', quality:92.8, created:'2026-08-09 14:40:00', consumers:['TASK-20260812-0039'] },
    { id:'D2V1', version:'V1', note:'首批报关单生成结果', source:'TASK-20260807-0012', sourceName:'报关单初始生成', samples:'70K', quality:88.6, created:'2026-08-07 11:05:00', consumers:['TASK-20260809-0088'] }
  ]},
  { id:3, name:'物流客服多轮对话', modality:'对话文本', businessType:'异常反馈', status:'可用', desc:'咨询、信息收集、异常反馈与投诉售后对话。', defaultVersion:'V4', totalSamples:'430K', reference:true, versions:[
    { id:'D3V4', version:'V4', note:'隐私风险自动处理结果', source:'TASK-20260812-0027', sourceName:'投诉对话隐私优化', samples:'130K', quality:95.1, created:'2026-08-12 11:20:00', consumers:[] },
    { id:'D3V3', version:'V3', note:'异常反馈生成结果', source:'TASK-20260811-0141', sourceName:'异常反馈多轮对话生成', samples:'120K', quality:94.1, created:'2026-08-11 15:40:00', consumers:['TASK-20260812-0027'] },
    { id:'D3V2', version:'V2', note:'客户服务参考场景生成结果', source:'TASK-20260806-0025', sourceName:'客服多轮对话生成', samples:'100K', quality:92.0, created:'2026-08-06 10:15:00', consumers:['TASK-20260811-0141'] }
  ]},
  { id:4, name:'冷链温湿度时序集', modality:'时序数据', businessType:'传感器时序', status:'可用', desc:'多路线冷链温湿度序列与超温、骤冷事件。', defaultVersion:'V3', totalSamples:'180K', reference:true, versions:[
    { id:'D4V3', version:'V3', note:'异常事件生成结果', source:'TASK-20260811-0186', sourceName:'冷链温湿度异常序列生成', samples:'80K', quality:95.7, created:'2026-08-11 18:10:00', consumers:[] },
    { id:'D4V2', version:'V2', note:'清洗后的真实设备数据', source:'TASK-20260808-0042', sourceName:'温湿度完整性优化', samples:'60K', quality:93.2, created:'2026-08-08 13:00:00', consumers:['TASK-20260811-0186'] },
    { id:'D4V1', version:'V1', note:'首批冷链传感器生成结果', source:'TASK-20260805-0018', sourceName:'冷链温湿度初始生成', samples:'40K', quality:89.5, created:'2026-08-05 09:20:00', consumers:['TASK-20260808-0042'] }
  ]},
  { id:5, name:'车辆GPS轨迹集', modality:'时序数据', businessType:'GPS轨迹', status:'可用', desc:'车辆路线、速度、停留、偏航和急停事件。', defaultVersion:'V3', totalSamples:'100K', reference:true, versions:[
    { id:'D5V3', version:'V3', note:'偏航场景扩增结果', source:'TASK-20260811-0159', sourceName:'GPS偏航场景优化', samples:'45K', quality:92.8, created:'2026-08-11 17:30:00', consumers:[] },
    { id:'D5V2', version:'V2', note:'轨迹纠偏后数据', source:'TASK-20260807-0031', sourceName:'GPS质量优化', samples:'35K', quality:91.9, created:'2026-08-07 16:00:00', consumers:['TASK-20260811-0159'] },
    { id:'D5V1', version:'V1', note:'首批车辆轨迹生成结果', source:'TASK-20260804-0009', sourceName:'车辆GPS轨迹初始生成', samples:'20K', quality:87.4, created:'2026-08-04 08:50:00', consumers:['TASK-20260807-0031'] }
  ]}
];

initialDatasets.push({ id:6, name:'用户上传文档样例数据集', modality:'文档类图像', businessType:'报关单', status:'可用', desc:'用户上传并完成隐私检查与自动脱敏的数据集。系统仅保存脱敏后的数据。', defaultVersion:'A7F3C91D2E44', totalSamples:1280, reference:false, sourceType:'用户上传', templateId:'TPL-DOC-CUSTOMS-V1', templateVersion:'V1', updatedAt:'2026-09-04 10:30:00', versions:[{ id:'A7F3C91D2E44', version:'A7F3C91D2E44', note:'用户上传数据集首个脱敏版本', source:'UPLOAD-20260904-103000', sourceName:'用户上传与隐私脱敏', samples:1280, created:'2026-09-04 10:30:00', updatedAt:'2026-09-04 10:30:00', consumers:[], sourceType:'用户上传', templateId:'TPL-DOC-CUSTOMS-V1', templateVersion:'V1', privacyCheck:{status:'通过', checked:1280, desensitized:37, rules:['身份证号','手机号','地址']}, qualityReport:{status:'待质检', checkedSampleCount:0} }]});

const VERSION_ID_PATTERN = /^[0-9A-F]{12}$/;
const DATASET_ID_PATTERN = /^DATASET-\d{8}-\d{4}$/;

function numericSampleCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const matches = [...String(value ?? '').replaceAll(',', '').matchAll(/(\d+(?:\.\d+)?)\s*([KkMm]?)/g)];
  return Math.round(matches.reduce((total, match) => {
    const multiplier = match[2]?.toLowerCase() === 'm' ? 1000000 : match[2]?.toLowerCase() === 'k' ? 1000 : 1;
    return total + Number(match[1]) * multiplier;
  }, 0));
}

function fixedHashId(seed) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const character of String(seed)) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + 97), 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`.slice(0, 12).toUpperCase();
}

function createVersionId(seed = `${Date.now()}-${Math.random()}`) {
  return fixedHashId(seed);
}

function createDatasetId(seed = `${Date.now()}-${Math.random()}`, dateValue = nowDateTime(), sequenceHint) {
  const dateMatch = String(dateValue || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : '20260902';
  const numericHint = Number(sequenceHint);
  const sequence = Number.isInteger(numericHint) && numericHint >= 0 && numericHint <= 9999
    ? numericHint
    : parseInt(fixedHashId(seed).slice(0, 8), 16) % 10000;
  return `DATASET-${date}-${String(sequence).padStart(4, '0')}`;
}

function qualityStatusCounts(total, score) {
  const count = Math.max(0, numericSampleCount(total));
  const pass = Math.min(count, Math.round(count * Math.max(0, Math.min(100, Number(score) || 92)) / 100));
  const remaining = count - pass;
  const review = Math.round(remaining * 0.72);
  return { PASS: pass, REVIEW: review, REJECT: remaining - review };
}

function buildVersionQualityReport(modality, version) {
  if (version.qualityReport) return version.qualityReport;
  if (version.qualityChecked === false) return null;
  const dataCount = numericSampleCount(version.samples);
  const checkedSampleCount = Math.min(dataCount, Math.max(0, numericSampleCount(version.checkedSampleCount ?? dataCount)));
  const uncheckedSampleCount = Math.max(0, dataCount - checkedSampleCount);
  const executionRange = uncheckedSampleCount > 0 ? 'sample' : 'full';
  const score = Number(version.quality);
  const averageScore = Number.isFinite(score) ? score : 92;
  const statusCounts = {...qualityStatusCounts(checkedSampleCount, averageScore), UNCHECKED: uncheckedSampleCount};
  if (modality === '文档图像') return {
    reportId: version.qualityReportId || `QREPORT-${fixedHashId(`${version.version}-document`)}`, kind: 'document', sampleCount: dataCount, checkedSampleCount, uncheckedSampleCount, executionRange, statusCounts,
    lowQualityCount: statusCounts.REVIEW + statusCounts.REJECT,
    ocrAverages: {
      cer: Math.max(0.018, Number(((100 - averageScore) / 100).toFixed(4))),
      fieldExactRate: Number(Math.min(.99, averageScore / 100).toFixed(4)),
      numericCodeAccuracy: Number(Math.min(.995, (averageScore + 2.1) / 100).toFixed(4)),
      detectionCoverage: Number(Math.min(.995, (averageScore + 1.2) / 100).toFixed(4)),
      meanRecognitionConfidence: Number(Math.min(.995, (averageScore + .8) / 100).toFixed(4)),
      lowConfidenceRate: Number(Math.max(.01, (100 - averageScore) / 125).toFixed(4)),
    },
    imageQuality: { brightness: 224.36, contrast: 61.82, sharpness: 318.45 },
    geometry: { validPolygonRate: .9987, bboxPolygonErrorPx: .42, reprojectionRmsePx: .0061, outOfBoundsRate: .0012, fieldHeightP10Px: 17.8, fieldHeightMedianPx: 24.6 },
    privacy: { initialRiskCount: Math.max(1, Math.round(checkedSampleCount * .003)), maskedCount: Math.max(1, Math.round(checkedSampleCount * .003)), residualRiskCount: 0 },
    coverageGaps: executionRange==='full'?[{key:'doc-shadow',dimension:'拍摄场景',label:'强阴影',pass:86,target:180,gap:94},{key:'doc-fold',dimension:'文档退化',label:'折痕遮挡',pass:62,target:150,gap:88},{key:'doc-stamp',dimension:'印章类型',label:'骑缝章',pass:35,target:100,gap:65}]:[],
  };
  if (modality === '对话文本') return {
    reportId: version.qualityReportId || `QREPORT-${fixedHashId(`${version.version}-conversation`)}`, kind: 'conversation', sampleCount: dataCount, checkedSampleCount, uncheckedSampleCount, executionRange, statusCounts, averageScore,
    schemaValidRate: .996, stateLegalRate: .973, toolAccuracyRate: .961, evidenceResolvableRate: .982, roleStableRate:.987, nonDuplicateRate:.954,
    privacy: { initialRiskCount: Math.max(1, Math.round(checkedSampleCount * .004)), maskedCount: Math.max(1, Math.round(checkedSampleCount * .004)), residualRiskCount: 0 },
    coverageGaps: executionRange==='full'?[{key:'conv-angry',dimension:'用户情绪',label:'强烈不满',pass:120,target:260,gap:140},{key:'conv-evidence',dimension:'信息完整度',label:'缺少物流凭证',pass:75,target:160,gap:85},{key:'conv-path',dimension:'状态路径',label:'升级人工处理',pass:48,target:120,gap:72}]:[],
  };
  return {
    reportId: version.qualityReportId || `QREPORT-${fixedHashId(`${version.version}-timeseries`)}`, kind: 'timeseries', shipmentCount: dataCount, checkedSampleCount, uncheckedSampleCount, executionRange, statusCounts, averageScore,
    coverageScore: Number(Math.min(100, averageScore + .9).toFixed(1)), lowQualityCount: statusCounts.REVIEW + statusCounts.REJECT,
    dimensionScores: { contract: 99, temporal: 97, physical: 96, geospatial: 94, ground_truth: 95, privacy: 100, template_rules: 98, coverage_labels: 93 },
    units: { temperature: '摄氏度（°C）', sampleIntervalMinutes: 60, humidity: '%RH' },
    privacy: { checkedSampleCount, failedSampleCount: 0, statusCounts: { PASS: checkedSampleCount, UNCHECKED: uncheckedSampleCount } },
    coverageGaps: executionRange==='full'?[{key:'ts-overheat',dimension:'异常事件',label:'持续超温',pass:38,target:120,gap:82},{key:'ts-offline',dimension:'异常事件',label:'计划性断网',pass:26,target:90,gap:64},{key:'ts-route',dimension:'参数形态',label:'GPS 偏航后回归',pass:44,target:110,gap:66}]:[],
  };
}

function isFullQualityVersion(version) {
  return Boolean(version?.qualityReport&&version?.sampleQualityLabels&&(version.qualityReport.executionRange||'full')==='full'&&(version.sampleQualityLabels.coverage||'full')==='full');
}

function normalizeDownstreamTask(value, datasetName, updatedAt, index) {
  if (value && typeof value === 'object') return {
    id: value.id,
    name: value.name || `${datasetName}${value.taskType || '数据质检'}任务`,
    taskType: value.taskType || '数据质检',
    updatedAt: formatDateTime(value.updatedAt || value.created || updatedAt),
    status: value.status || '已完成',
  };
  const linkedTask = initialTasks.find(task => task.id === value);
  const inferredType = linkedTask?.taskType || (linkedTask?.stages?.includes('定向扩增') ? '定向扩增' : linkedTask?.stages?.includes('增强') ? '数据增强' : '数据质检');
  return { id: String(value), name: linkedTask?.name || `${datasetName}${inferredType}任务`, taskType: inferredType, updatedAt: formatDateTime(linkedTask?.updated || linkedTask?.created || updatedAt), status: linkedTask?.status || '已完成', key: `${value}-${index}` };
}

function normalizeDatasets(items) {
  return (Array.isArray(items) ? items : []).map((dataset, datasetIndex) => {
    const rawVersions = Array.isArray(dataset.versions) ? dataset.versions : [];
    const rawDatasetId = String(dataset.id ?? '');
    const datasetDate = dataset.updatedAt || rawVersions[0]?.updatedAt || rawVersions[0]?.created || nowDateTime();
    const datasetId = DATASET_ID_PATTERN.test(rawDatasetId)
      ? rawDatasetId
      : createDatasetId(`${rawDatasetId}-${dataset.name}-${datasetIndex}`, datasetDate, /^\d+$/.test(rawDatasetId) ? Number(rawDatasetId) : undefined);
    const versionIds = rawVersions.map((version, versionIndex) => VERSION_ID_PATTERN.test(String(version.version || ''))
      ? String(version.version)
      : createVersionId(`${datasetId}-${version.id || version.version}-${version.source || versionIndex}`));
    const template = templateForDataset(dataset);
    const versions = rawVersions.map((version, versionIndex) => {
      const updatedAt = formatDateTime(version.updatedAt || version.created);
      const versionId = versionIds[versionIndex];
      const qualityChecked = version.qualityChecked === false ? false : Boolean(version.qualityReport || version.sampleQualityLabels || version.quality !== undefined);
      const normalized = {
        ...version,
        id: versionId,
        version: versionId,
        note: version.note || version.description || '-',
        samples: numericSampleCount(version.samples),
        updatedAt,
        created: updatedAt,
        source: version.source || 'UPLOAD',
        sourceName: version.sourceName || '用户上传',
        versionKind: version.versionKind || (String(version.source||'').startsWith('UPLOAD-') ? '上传脱敏' : versionIndex===rawVersions.length-1 ? '合成' : '质检标注'),
        templateId: version.templateId || dataset.templateId || template?.id,
        templateVersion: version.templateVersion || dataset.templateVersion || template?.version,
        sourceDatasetId: version.sourceDatasetId || (versionIndex < versionIds.length-1 ? datasetId : null),
        sourceVersionId: version.sourceVersionId || (versionIndex < versionIds.length-1 ? versionIds[versionIndex+1] : null),
        qualityChecked,
        checkedSampleCount: version.checkedSampleCount,
      };
      normalized.consumers = (version.consumers || []).map((task, index) => normalizeDownstreamTask(task, dataset.name, updatedAt, index));
      normalized.qualityReport = qualityChecked ? buildVersionQualityReport(dataset.modality, normalized) : null;
      normalized.qualityReportId = normalized.qualityReport?.reportId || version.qualityReportId || null;
      normalized.sampleQualityLabels = qualityChecked ? (version.sampleQualityLabels || {schemaVersion:'sample-quality/v1',coverage:'full',fields:['overall_score','overall_result','rule_results','issue_labels']}) : null;
      normalized.fullQualityChecked = isFullQualityVersion(normalized);
      if(normalized.qualityReport)normalized.qualityReport={...normalized.qualityReport,inputVersionId:normalized.sourceVersionId||normalized.version,outputVersionId:normalized.version,templateId:normalized.templateId,templateVersion:normalized.templateVersion,ruleSnapshot:TEMPLATE_QUALITY_RULES[dataset.modality]||[]};
      return normalized;
    });
    const defaultRaw = rawVersions.find(version => version.version === dataset.defaultVersion || version.id === dataset.defaultVersion);
    const defaultIndex = defaultRaw ? rawVersions.indexOf(defaultRaw) : 0;
    return {
      ...dataset,
      id: datasetId,
      sourceType: dataset.sourceType || '任务生成',
      templateId: dataset.templateId || template?.id,
      templateVersion: dataset.templateVersion || template?.version,
      totalSamples: numericSampleCount(dataset.totalSamples) || versions.reduce((sum, version) => sum + numericSampleCount(version.samples), 0),
      defaultVersion: versions[defaultIndex]?.version || versions[0]?.version || '-',
      updatedAt: formatDateTime(dataset.updatedAt || versions[0]?.updatedAt),
      versions,
    };
  });
}

const businessTypeMap = {
  文档图像:['运单','报关单','合同'],
  对话文本:['智能客服多轮对话'],
  时序数据:['GPS轨迹','传感器时序']
};

function StatusTag({ value }) {
  return <Tag color={value==='可用'||value==='已完成'?'green':value==='失败'?'red':value==='运行中'?'blue':value==='排队中'?'gold':'default'}>{value}</Tag>;
}

function StageTags({ stages=[] }) {
  return <Space size={[0,4]} wrap>{stages.map(s=><Tag key={s} color={stageColor[s]}>{s}</Tag>)}</Space>;
}

const customsStageMeta = {
  queued: ['排队', 'gray'], generating: ['数据合成', 'blue'], quality_checking: ['质检', 'purple'],
  expanding: ['扩增', 'orange'], rechecking: ['复检', 'cyan'], completed: ['完成', 'green'], failed: ['失败', 'red'],
};
const customsStageOrder = ['queued', 'generating', 'quality_checking', 'expanding', 'rechecking', 'completed'];
const stampLabels = {customs_review:'海关审核合成章',broker_declaration:'报关公司报关合成章',broker_company:'报关公司企业合成公章'};

function CustomsSubmissionSummary({ form }) {
  const values=form.getFieldsValue(true);
  const resolution=values.enableBackgroundDiffusion?`${values.outputWidth||2480}×${values.outputHeight||1754}`:'未启用拍照背景';
  const stamps=values.enableStamps?(values.stampProfiles||[]).map(item=>stampLabels[item]||item).join('、'):'未启用';
  return <>
    <Alert type="info" showIcon message="点击“提交任务”后创建报关单 Mock 任务" description="提交成功后自动返回文档类图像任务列表，新任务显示在第一行，并提供生成、质检、扩增和复检的模拟日志。"/>
    <Descriptions bordered size="small" column={2} className="section-title" items={[
      {key:'template',label:'模板',children:values.customsTemplateId==='customs_import_standard_v1'?'进口报关单标准模板 V1':values.customsTemplateId||'-'},
      {key:'count',label:'生成图片数',children:`${values.count||0} 张`},
      {key:'seed',label:'随机种子',children:values.seed||'-'},
      {key:'stamp',label:'合成章',children:stamps||'未选择'},
      {key:'privacy',label:'隐私保护',children:values.enablePrivacy?`已启用 · ${(values.privacyFields||[]).length} 个字段`:'未启用'},
      {key:'text',label:'Qwen文本',children:values.enableQwenText?'已启用':'未启用'},
      {key:'augment',label:'本地增强',children:'Augraphy + Albumentations'},
      {key:'background',label:'拍照背景',children:values.enableBackgroundDiffusion?'已启用':'未启用'},
      {key:'resolution',label:'正式成品尺寸',children:resolution},
      {key:'scale',label:'原始内容占比',children:values.enableBackgroundDiffusion?`${values.documentContentPercent||94}%`:'-'},
      {key:'qc',label:'本地质检',children:values.runQc?'PP-OCRv5 已启用':'未启用'},
      {key:'expansion',label:'定向扩增',children:values.runQc&&values.enableExpansion?`最多新增 ${values.maxNewImages||0} 张`:'未启用'},
    ]}/>
  </>;
}

function CustomsTaskInformation({ task }) {
  const job=task.backendJob||{};
  const values=task.configSnapshot||{};
  const params=job.parameters||{};
  const stamps=values.enableStamps===false||params.enable_stamps===false?'未启用':((values.stampProfiles||params.stamp_profiles||[]).map(item=>stampLabels[item]||item).join('、')||'未记录');
  const privacyEnabled=values.enablePrivacy??params.enable_privacy;
  const backgroundEnabled=values.enableBackgroundDiffusion??params.enable_background_diffusion;
  const qcEnabled=values.runQc??params.run_qc;
  const expansionEnabled=values.enableExpansion??params.enable_expansion;
  return <>
    <Descriptions bordered size="small" column={2} className="detail-descriptions" items={[
      {key:'id',label:'任务ID',children:task.id},{key:'status',label:'状态',children:<StatusTag value={task.status}/>},
      {key:'stage',label:'当前节点',children:task.currentStage},{key:'created',label:'创建时间',children:task.created},
      {key:'input',label:'输入',children:task.input},{key:'output',label:'输出',children:task.output},
      {key:'path',label:'模拟产物目录',span:2,children:job.storage_path?<Text copyable>{job.storage_path}</Text>:'任务创建后由 Mock 分配'},
    ]}/>
    <Divider orientation="left">配置快照</Divider>
    <Descriptions bordered size="small" column={2} items={[
      {key:'template',label:'模板',children:values.customsTemplateId==='customs_import_standard_v1'?'进口报关单标准模板 V1':values.customsTemplateId||'历史默认模板'},
      {key:'count',label:'生成图片数',children:`${values.count??params.count??'-'} 张`},
      {key:'seed',label:'随机种子',children:values.seed??params.seed??'-'},
      {key:'stamps',label:'合成章',children:stamps},
      {key:'privacy',label:'隐私保护',children:privacyEnabled?`已启用 · ${(values.privacyFields||Object.keys(params.privacy_field_strategies||{})).length} 个字段`:'未启用'},
      {key:'text',label:'Qwen文本',children:(values.enableQwenText??params.enable_qwen_text)?'已启用':'未启用'},
      {key:'augment',label:'本地增强',children:'Augraphy + Albumentations'},
      {key:'background',label:'拍照背景',children:backgroundEnabled?'已启用':'未启用'},
      {key:'resolution',label:'正式成品尺寸',children:backgroundEnabled?`${values.outputWidth??params.output_width??2480}×${values.outputHeight??params.output_height??1754}`:'未启用拍照背景'},
      {key:'scale',label:'原始内容占比',children:backgroundEnabled?`${values.documentContentPercent??Math.round(Number(params.document_content_scale||0.94)*100)}%`:'-'},
      {key:'qc',label:'PP-OCRv5质检',children:qcEnabled?'已启用':'未启用'},
      {key:'vlm',label:'VLM复核',children:(values.enableVlmReview??params.enable_vlm_review)?'已启用':'未启用'},
      {key:'expansion',label:'定向扩增',children:expansionEnabled?`已启用 · 最多 ${values.maxNewImages??params.max_new_images??0} 张`:'未启用'},
      {key:'write',label:'结果写入',children:values.outputMode==='newVersion'?`${values.targetDataset||'-'} / 新版本`:`${values.outputDatasetName||task.output||'-'} / 新数据集`},
    ]}/>
  </>;
}

function CustomsTaskLogs({ task }) {
  const job=task.backendJob||{};
  const events=job.events||[];
  const currentStatus=job.status||job.stage||'queued';
  const currentIndex=currentStatus==='failed'?Math.max(0,customsStageOrder.indexOf(job.stage)):Math.max(0,customsStageOrder.indexOf(currentStatus));
  return <>
    <Alert type={job.status==='failed'?'error':job.status==='completed'?'success':'info'} showIcon message={`当前执行：${job.message||task.currentStage||'等待资源'}`} description={job.error||`进度 ${Number(job.progress)||0}% · 日志随任务状态自动更新`}/>
    <Progress className="section-title" percent={Number(job.progress)||0} status={job.status==='failed'?'exception':job.status==='completed'?'success':'active'}/>
    <Steps size="small" responsive={false} current={currentIndex} status={job.status==='failed'?'error':'process'} items={customsStageOrder.map(key=>({title:customsStageMeta[key][0]}))}/>
    <Divider orientation="left">运行日志明细</Divider>
    {events.length?<Timeline className="customs-log-timeline" items={[...events].reverse().map((event,index)=>({
      color:customsStageMeta[event.status]?.[1]||'gray',
      children:<div><Flex justify="space-between" gap={12}><Text strong>{customsStageMeta[event.status]?.[0]||event.status}</Text><Text type="secondary">{formatDateTime(event.time)}</Text></Flex><Paragraph type="secondary">{event.message}</Paragraph></div>,
      key:`${event.time||index}-${event.status}`,
    }))}/>:<Empty description="Mock 尚未写入阶段日志"/>}
  </>;
}

const coldChainStageMeta = {
  queued:['排队','gray'], generating:['数据生成与模块执行','blue'],
  quality_checking:['结果汇总','purple'], completed:['完成','green'], failed:['失败','red'],
};
const coldChainStageOrder = ['queued','generating','quality_checking','completed'];

function ColdChainTaskInformation({ task }) {
  const job=task.backendJob||{};
  const values=task.configSnapshot||{};
  const params=job.parameters||{};
  const augmentation=values.enableAugmentation??params.augmentation?.enabled;
  const privacy=values.enablePrivacy??params.privacy_policy?.enabled;
  const quality=values.enableQuality??params.enable_quality;
  const expansion=values.enableExpansion??params.enable_expansion;
  const selected=values.parameters||params.parameters||[];
  return <>
    <Descriptions bordered size="small" column={2} className="detail-descriptions" items={[
      {key:'id',label:'任务ID',children:<Text copyable>{task.id}</Text>},{key:'status',label:'状态',children:<StatusTag value={task.status}/>},
      {key:'stage',label:'当前节点',children:task.currentStage},{key:'created',label:'创建时间',children:task.created},
      {key:'input',label:'输入模板',children:task.input},{key:'output',label:'输出数据集',children:task.output},
      {key:'path',label:'模拟产物目录',span:2,children:job.storage_path?<Text copyable>{job.storage_path}</Text>:'任务创建后由 Mock 分配'},
    ]}/>
    <Divider orientation="left">配置快照</Divider>
    <Descriptions bordered size="small" column={2} items={[
      {key:'template',label:'模板版本',children:`${values.coldchainTemplateName||params.template_id||'-'} / ${values.coldchainTemplateVersion||params.template_version||'-'}`},
      {key:'count',label:'生成票数',children:`${values.count??params.count??'-'} 票`},
      {key:'seed',label:'随机种子',children:values.seed??params.seed??'-'},
      {key:'interval',label:'采样间隔',children:`每 ${values.sampleIntervalMinutes??params.sample_interval_minutes??60} 分钟`},
      {key:'model',label:'生成模型',children:values.modelAlias||params.model_alias||'qwen3-14b'},
      {key:'fields',label:'输出参数',children:selected.length?`${selected.length} 项`:'未记录'},
      {key:'augmentation',label:'数据增强',children:augmentation?`已启用 · 最多新增 ${values.augmentationMaxNew??params.augmentation?.max_new??0} 票`:'未启用'},
      {key:'privacy',label:'隐私保护',children:privacy?'已启用':'未启用'},
      {key:'quality',label:'质检',children:quality===false?'未启用':'已启用'},
      {key:'privacyQc',label:'隐私质检',children:(values.privacyCheckEnabled??params.privacy_check_enabled)!==false?'已启用':'未启用'},
      {key:'expansion',label:'定向扩增',children:expansion?`已启用 · 最多新增 ${values.maxExpansionCount??params.max_expansion_count??0} 票`:'未启用'},
      {key:'write',label:'结果写入',children:values.outputMode==='newVersion'?`${values.targetDataset||'-'} / 新版本`:`${values.outputDatasetName||task.output||'-'} / 新数据集`},
    ]}/>
  </>;
}

function ColdChainTaskLogs({ task }) {
  const job=task.backendJob||{};
  const events=job.events||[];
  const currentStatus=job.status||job.stage||'queued';
  const currentIndex=currentStatus==='failed'?Math.max(0,coldChainStageOrder.indexOf(job.stage)):Math.max(0,coldChainStageOrder.indexOf(currentStatus));
  return <>
    <Alert type={job.status==='failed'?'error':job.status==='completed'?'success':'info'} showIcon message={`当前执行：${job.message||task.currentStage||'等待资源'}`} description={job.error||`进度 ${Number(job.progress)||0}% · 日志随任务状态自动更新`}/>
    <Progress className="section-title" percent={Number(job.progress)||0} status={job.status==='failed'?'exception':job.status==='completed'?'success':'active'}/>
    <Steps size="small" responsive={false} current={currentIndex} status={job.status==='failed'?'error':'process'} items={coldChainStageOrder.map(key=>({title:coldChainStageMeta[key][0]}))}/>
    <Divider orientation="left">运行日志明细</Divider>
    {events.length?<Timeline className="customs-log-timeline" items={[...events].reverse().map((event,index)=>({
      color:coldChainStageMeta[event.status]?.[1]||'gray',
      children:<div><Flex justify="space-between" gap={12}><Text strong>{coldChainStageMeta[event.status]?.[0]||event.status}</Text><Text type="secondary">{formatDateTime(event.time)}</Text></Flex><Paragraph type="secondary">{event.message}</Paragraph></div>,
      key:`${event.time||index}-${event.status}`,
    }))}/>:<Empty description="Mock 尚未写入阶段日志"/>}
  </>;
}

function PageHeader({ title, description, actions }) {
  return <Flex justify="space-between" align="flex-start" className="page-header"><div><Title level={3}>{title}</Title><Text type="secondary">{description}</Text></div><Space>{actions}</Space></Flex>;
}

function StatCards({ items }) {
  return null;
}

function ReferenceExampleForm({ modality, form, datasets }) {
  const enabled=Form.useWatch('useReference',form);
  const mode=Form.useWatch('referenceMode',form);
  const versionOptions=datasets.filter(d=>d.modality===modality).flatMap(d=>d.versions.map(v=>({label:`${d.name} / ${v.version}`,value:`${d.name} / ${v.version}`})));
  return <>
    <Form.Item name="useReference" label="使用参考样例" valuePropName="checked"><Switch checkedChildren="使用" unCheckedChildren="不使用"/></Form.Item>
    {!enabled?<Alert type="info" showIcon message="系统将仅根据业务规则和本次参数生成数据。"/>:<>
      <Form.Item name="referenceMode" label="参考样例来源"><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'选择数据集版本',value:'dataset'},{label:'临时上传',value:'upload'}]}/></Form.Item>
      {mode==='upload'?<Form.Item name="referenceFiles" label="上传参考样例"><Upload beforeUpload={()=>false} maxCount={10}><Button icon={<CloudUploadOutlined/>}>选择文件</Button></Upload></Form.Item>:<Form.Item name="referenceVersion" label="选择数据集版本"><Select showSearch optionFilterProp="label" options={versionOptions}/></Form.Item>}
      <Divider orientation="left">参考约束</Divider>
      <Alert type="success" showIcon message="系统将自动执行格式预检、隐私扫描和参考约束提取。"/>
      <Row gutter={16}><Col span={12}><Form.Item label="内容参考强度"><Slider marks={{0:'不参考',50:'适度',100:'严格'}} defaultValue={60}/></Form.Item></Col><Col span={12}><Form.Item label="形式参考强度"><Slider marks={{0:'不参考',50:'适度',100:'严格'}} defaultValue={70}/></Form.Item></Col></Row>
    </>}
  </>;
}

function GenerationParameters({ modality, businessType }) {
  if(modality==='文档图像') return <Row gutter={16}>
    <Col span={12}><Form.Item label="文档类型"><Input value={businessType} disabled/></Form.Item></Col>
    <Col span={12}><Form.Item label="版式变体"><Select defaultValue="标准版式" options={['标准版式','紧凑版式','多页版式'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="字段完整度"><Slider defaultValue={95} marks={{80:'80%',100:'100%'}}/></Form.Item></Col>
    <Col span={12}><Form.Item label="业务异常比例"><InputNumber min={0} max={100} defaultValue={10} addonAfter="%"/></Form.Item></Col>
  </Row>;
  if(modality==='对话文本') return <Row gutter={16}>
    <Col span={12}><Form.Item label="对话场景"><Checkbox.Group defaultValue={['异常反馈']} options={['咨询问答','信息收集','异常反馈']}/></Form.Item></Col>
    <Col span={12}><Form.Item label="角色"><Checkbox.Group defaultValue={['客户','客服']} options={['客户','客服','调度员','司机']}/></Form.Item></Col>
    <Col span={12}><Form.Item label="轮次范围"><Select defaultValue="6-10轮" options={['3-5轮','6-10轮','11-15轮'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="表达风格"><Select defaultValue="自然口语" options={['正式规范','自然口语','简短直接'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
  </Row>;
  if(businessType==='GPS轨迹') return <Row gutter={16}>
    <Col span={12}><Form.Item label="路线范围"><Select defaultValue="城市配送" options={['城市配送','城际运输','长途干线'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="采样频率"><Select defaultValue="每30秒" options={['每10秒','每30秒','每1分钟'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="偏航事件比例"><InputNumber min={0} max={100} defaultValue={8} addonAfter="%"/></Form.Item></Col>
    <Col span={12}><Form.Item label="停留事件"><Switch defaultChecked/></Form.Item></Col>
  </Row>;
  return <Row gutter={16}>
    <Col span={12}><Form.Item label="传感器类型"><Checkbox.Group defaultValue={['温度','湿度']} options={['温度','湿度','振动']}/></Form.Item></Col>
    <Col span={12}><Form.Item label="生成方式"><Select defaultValue="独立生成" options={['独立生成','关联已有GPS轨迹'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="采样频率"><Select defaultValue="每5分钟" options={['每1分钟','每5分钟','每10分钟'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="异常事件"><Checkbox.Group defaultValue={['超温']} options={['超温','骤冷','冲击','设备离线']}/></Form.Item></Col>
  </Row>;
}

function OutputConfig({ form, datasets, modality }) {
  const mode=Form.useWatch('outputMode',form)||'newDataset';
  const options=datasets.filter(d=>d.modality===modality).map(d=>({label:`${d.name}（当前${d.defaultVersion}，共${d.versions.length}个版本）`,value:d.name}));
  return <>
    <Form.Item name="outputMode" label="结果写入方式"><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'创建新数据集',value:'newDataset'},{label:'写入已有数据集的新版本',value:'newVersion'}]}/></Form.Item>
    {mode==='newDataset'?<Row gutter={16}><Col span={12}><Form.Item name="outputDatasetName" label="数据集名称" rules={[{required:true}]}><Input placeholder="请输入新数据集名称"/></Form.Item></Col><Col span={12}><Form.Item name="versionNote" label="版本描述" rules={[{required:true}]}><Input placeholder="说明本批数据的业务含义"/></Form.Item></Col></Row>:<Row gutter={16}><Col span={12}><Form.Item name="targetDataset" label="目标数据集" rules={[{required:true}]}><Select options={options}/></Form.Item></Col><Col span={12}><Form.Item name="versionNote" label="版本描述" rules={[{required:true}]}><Input placeholder="说明本次输出与业务用途"/></Form.Item></Col></Row>}
    <Alert type="info" showIcon message="结果会形成独立且不可编辑的数据快照，并记录来源任务、来源版本和模板快照。"/>
  </>;
}

const CUSTOMS_EVALUATION_FIELDS = {
  quality: ['CER（字符错误率）','字段完全一致率','数字代码准确率','bbox / polygon 重投影有效率','字段高度 P10 / 中位数','图片质量分档','PASS / REVIEW / REJECT'],
  privacy: ['境内收货人','境外发货人','消费使用单位','申报单位','报关人员姓名及证号','联系电话','货物存放地点','业务唯一编号','条形码 / 二维码','印章图案'],
  coverage: ['报关业务字段覆盖','国家/地区与币制代码覆盖','口岸/关区与监管方式覆盖','HS商品与计量单位覆盖','合成章类型覆盖','拍照/扫描场景覆盖','折痕/污渍/阴影覆盖','透视/压缩/低可读性覆盖'],
};

function CustomsEvaluationConfiguration({ form, scopes }) {
  const enableQualityVlm=Form.useWatch('evaluationQualityVlm',form);
  const enablePrivacyVlm=Form.useWatch('evaluationPrivacyVlm',form);
  const enableCoverageVlm=Form.useWatch('evaluationCoverageVlm',form);
  return <>
    {scopes.includes('质量评估')&&<Card size="small" title="质量评估字段" className="section-title" extra={<Tag color="green">PP-OCRv5 本地执行</Tag>}>
      <Checkbox.Group value={CUSTOMS_EVALUATION_FIELDS.quality} options={CUSTOMS_EVALUATION_FIELDS.quality} disabled/>
      <Row gutter={16} className="section-title">
        <Col span={8}><Form.Item name="evaluationOcrModel" label="OCR模型"><Select options={[{value:'pp-ocrv5-local',label:'PP-OCRv5（本地CPU）'}]}/></Form.Item></Col>
        <Col span={8}><Form.Item name="evaluationPassThreshold" label="质量通过门槛"><Select options={[{value:70,label:'宽松（70分）'},{value:80,label:'标准（80分）'},{value:90,label:'严格（90分）'}]}/></Form.Item></Col>
        <Col span={8}><Form.Item name="evaluationSampleRange" label="评估样本范围"><Select options={['全部数据','随机抽样20%','分层抽样'].map(value=>({value,label:value}))}/></Form.Item></Col>
      </Row>
      <Descriptions bordered size="small" column={4} items={[{key:'cer',label:'CER上限',children:'≤ 0.05'},{key:'exact',label:'字段完全一致率',children:'≥ 90%'},{key:'code',label:'数字代码准确率',children:'≥ 95%'},{key:'polygon',label:'polygon有效率',children:'≥ 99.5%'},{key:'p10',label:'字段高度P10',children:'≥ 16px'},{key:'median',label:'字段高度中位数',children:'≥ 20px'},{key:'grade',label:'图片质量',children:'清晰/可用/低质'},{key:'decision',label:'最终判定',children:'PASS/REVIEW/REJECT'}]}/>
      <Flex justify="space-between" align="center" className="section-title"><div><Text strong>启用 Qwen-VL 第二路复核</Text><div><Text type="secondary">检查遮挡、版式异常和整体可读性，只允许降级本地结论。</Text></div></div><Form.Item name="evaluationQualityVlm" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      {enableQualityVlm&&<Form.Item name="evaluationQualityVlmModel" label="VLM模型"><Select options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]}/></Form.Item>}
    </Card>}
    {scopes.includes('隐私评估')&&<Card size="small" title="隐私评估字段" className="section-title">
      <Form.Item name="evaluationPrivacyFields" label="检查字段"><Checkbox.Group options={CUSTOMS_EVALUATION_FIELDS.privacy}/></Form.Item>
      <Alert type="info" showIcon message="隐私评估只标记低质样本" description="通过结构化字段契约、格式规则、机器码和图案检查判断是否仍含不安全内容；不在原样本上二次处理。"/>
      <Flex justify="space-between" align="center" className="section-title"><div><Text strong>启用 VLM 图像隐私复核</Text><div><Text type="secondary">用于检查印章、码区及文字图像中疑似未替换内容。</Text></div></div><Form.Item name="evaluationPrivacyVlm" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      {enablePrivacyVlm&&<Form.Item name="evaluationPrivacyVlmModel" label="VLM模型"><Select options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]}/></Form.Item>}
    </Card>}
    {scopes.includes('覆盖评估')&&<Card size="small" title="覆盖评估字段" className="section-title">
      <Form.Item name="evaluationCoverageFields" label="统计维度"><Checkbox.Group options={CUSTOMS_EVALUATION_FIELDS.coverage}/></Form.Item>
      <Alert type="info" showIcon message="优先统计合成时自带标签" description="业务字段、字典取值、增强算子和印章类型直接读取 manifest；无法从结构化标签获得的视觉场景，再由VLM按用户勾选标签补充打标。"/>
      <Flex justify="space-between" align="center" className="section-title"><div><Text strong>启用 VLM 视觉覆盖打标</Text><div><Text type="secondary">识别拍照、阴影、折痕、污渍、遮挡、透视和低可读性等视觉标签。</Text></div></div><Form.Item name="evaluationCoverageVlm" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      {enableCoverageVlm&&<Form.Item name="evaluationCoverageVlmModel" label="VLM模型"><Select options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]}/></Form.Item>}
    </Card>}
  </>;
}

function DocumentDirectionalExpansion({ form, standalone = false }) {
  const enabled=standalone||Boolean(Form.useWatch('enableAutoExpansion',form));
  return <>
    <Card size="small" title={standalone?'自动定向扩增':'自动定向扩增（可选）'} extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableAutoExpansion" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Paragraph type="secondary">根据质量、隐私和覆盖评估结果定位低质类型及覆盖短板，生成新的替代或补充样本；不修改输入版本中的原图片。</Paragraph>
      {!enabled?<Alert type="info" showIcon message="未启用：任务只输出评估报告，不生成新数据。"/>:<>
        <Alert type="success" showIcon message="已启用：仅针对命中的低质标签和覆盖不足标签补量，新增样本必须重新质检。"/>
        <Row gutter={16} className="section-title">
          <Col span={8}><Form.Item name="maxEvaluationExpansion" label="扩增上限" rules={[{required:true,message:'请配置扩增上限'}]}><InputNumber min={1} max={100000} addonAfter="张" style={{width:'100%'}}/></Form.Item></Col>
          <Col span={8}><Form.Item name="evaluationExpansionLlm" label="文字与字段生成模型"><Select options={[{value:'qwen3-14b-no-thinking',label:'Qwen3-14B（非思考模式）'}]}/></Form.Item></Col>
          <Col span={8}><Form.Item name="evaluationExpansionDiffusion" label="图像生成模型"><Select options={[{value:'qwen-image-edit',label:'Qwen-Image-Edit'},{value:'none',label:'不调用图像生成模型，仅本地增强'}]}/></Form.Item></Col>
        </Row>
        <Form.Item name="evaluationExpansionTargets" label="允许扩增的目标类型"><Checkbox.Group options={['低质样本替代','业务字段覆盖补齐','代码表取值覆盖补齐','视觉场景覆盖补齐','隐私失败样本替代']}/></Form.Item>
      </>}
    </Card>
  </>;
}

function LegacyCreateTaskPage({ draft, datasets, onCancel, onSubmit }) {
  const [step,setStep]=useState(0); const [submitting,setSubmitting]=useState(false); const [form]=Form.useForm(); const [selectedBusinessType,setSelectedBusinessType]=useState(businessTypeMap[draft.modality][0]);
  const businessType=Form.useWatch('businessType',form)||selectedBusinessType;
  const evaluationScopes=Form.useWatch('evaluationScopes',form)||['质量评估'];
  const optimization=Form.useWatch('optimization',form)||[];
  const inputVersion=Form.useWatch('inputVersion',form);
  const enableAutoExpansion=Form.useWatch('enableAutoExpansion',form);
  const isGenerate=draft.taskType==='数据生成';
  const modalityLabel=modalityLabelMap[draft.modality]||draft.modality;
  const isSyntheticDocumentGenerate=isGenerate&&draft.modality==='文档图像';
  const isCustomsGenerate=isGenerate&&draft.modality==='文档图像'&&businessType==='报关单';
  const isColdChainGenerate=isGenerate&&draft.modality==='时序数据'&&businessType==='传感器时序';
  const isConversationGenerate=isGenerate&&draft.modality==='对话文本'&&businessType==='智能客服多轮对话';
  const isDocumentEvaluation=!isGenerate&&draft.modality==='文档图像';
  const selectedInputDataset=useMemo(()=>datasets.find(dataset=>dataset.versions.some(version=>`${dataset.name} / ${version.version}`===inputVersion)),[datasets,inputVersion]);
  useEffect(()=>{if(isDocumentEvaluation&&selectedInputDataset){setSelectedBusinessType(selectedInputDataset.businessType);form.setFieldsValue({businessType:selectedInputDataset.businessType,inputDatasetName:selectedInputDataset.name,targetDataset:selectedInputDataset.name,outputMode:'newVersion'});}},[form,isDocumentEvaluation,selectedInputDataset]);
  const stepTitles=isSyntheticDocumentGenerate?['模板选择','数据合成配置','数据增强配置','质检与扩增配置','结果写入']:isColdChainGenerate?['模板选择','数据生成配置','数据增强配置','质检与扩增','结果写入']:isConversationGenerate?['模板选择','数据生成配置','数据增强配置','质检与扩增','结果写入']:isGenerate?['业务与生成配置','参考样例','可选处理','小样预览','结果写入']:isDocumentEvaluation?['选择输入版本','评估配置','自动定向扩增','结果写入']:['选择输入版本','评估配置','自动优化','结果与提交'];
  const current=stepTitles[step];
  const versionOptions=datasets.filter(d=>d.modality===draft.modality).flatMap(d=>d.versions.map(v=>({label:`${d.name} / ${v.version} · ${v.samples}条`,value:`${d.name} / ${v.version}`,businessType:d.businessType,datasetName:d.name})));
  const next=async()=>{let fields=[];if(current==='业务与生成配置')fields=['businessType','count'];if(current==='模板选择')fields=isConversationGenerate?['conversationTemplateId','conversationTemplateVersion']:isColdChainGenerate?['businessType','coldchainTemplateId','coldchainTemplateVersion']:isSyntheticDocumentGenerate?['businessType','syntheticDocumentTemplateId','syntheticDocumentTemplateVersion']:['businessType','customsTemplateId'];if(current==='数据合成配置')fields=isSyntheticDocumentGenerate?['count','seed','outputResolutionMode']:['count','seed','stampProfiles'];if(current==='数据生成配置')fields=isColdChainGenerate?['count','seed','sampleIntervalMinutes','modelAlias','parameters']:['count','turnMin','turnMax','seed','provider','modelAlias'];if(current==='数据增强配置')fields=isColdChainGenerate?form.getFieldValue('enableAugmentation')?['augmentationMethods','augmentationRatio','augmentationIntensity','augmentationMaxNew']:[]:isConversationGenerate?(form.getFieldValue('enableAugmentation')?['augmentationMethods','augmentationRatio','augmentationMaxNew','augmentationModelAlias','augmentationTemperature']:[]):isSyntheticDocumentGenerate?[]:['outputWidth','outputHeight','documentContentPercent'];if(current==='质检与扩增配置'&&isCustomsGenerate&&!isSyntheticDocumentGenerate)fields=['maxNewImages'];if(current==='质检与扩增'&&isConversationGenerate)fields=['passThreshold','duplicateThreshold','qualityModelAlias','qualityTemperature','maxNew'];if(current==='质检与扩增'&&isColdChainGenerate&&form.getFieldValue('enableExpansion'))fields=['maxExpansionCount'];if(current==='选择输入版本')fields=['inputVersion'];if(current==='评估配置')fields=['evaluationScopes'];if(current==='自动定向扩增'&&form.getFieldValue('enableAutoExpansion'))fields=['maxEvaluationExpansion','evaluationExpansionTargets'];if(current==='结果写入'&&!isDocumentEvaluation)fields=form.getFieldValue('outputMode')==='newVersion'?['targetDataset','versionNote']:['outputDatasetName','versionNote'];if(current==='结果与提交'&&optimization.length)fields=form.getFieldValue('outputMode')==='newVersion'?['targetDataset','versionNote']:['outputDatasetName','versionNote'];try{if(fields.length)await form.validateFields(fields);setStep(s=>Math.min(s+1,stepTitles.length-1));}catch{message.warning('请完成当前步骤的必填项');}};
  const submit=async()=>{if(submitting)return;setSubmitting(true);try{const v=await form.validateFields();const stages=isSyntheticDocumentGenerate?syntheticDocumentStages(v):isCustomsGenerate?customsStages(v):isColdChainGenerate?coldchainStages(v):isConversationGenerate?conversationStages(v):isGenerate?['生成',...(v.enableAugment?['增强']:[]),...(v.enablePrivacy?['隐私处理']:[])]:isDocumentEvaluation?[...v.evaluationScopes,...(v.enableAutoExpansion?['定向扩增']:[])]:[...v.evaluationScopes,...(v.optimization||[])];const output=isDocumentEvaluation?(v.enableAutoExpansion?`${v.inputDatasetName} / 新版本`:'仅评估报告'):!isGenerate&&!optimization.length?'仅评估报告':v.outputMode==='newVersion'?`${v.targetDataset} / 新版本`:v.outputDatasetName;const backendJob=isSyntheticDocumentGenerate?await createSyntheticDocumentBackendJob(form):isCustomsGenerate?await createCustomsBackendJob(form):isColdChainGenerate?await createColdChainBackendJob(form):isConversationGenerate?await createConversationBackendJob(form):null;const input=isSyntheticDocumentGenerate?`${v.syntheticDocumentTemplateId} / ${v.syntheticDocumentTemplateVersion}`:isCustomsGenerate?'报关单模板与结构化配置':isColdChainGenerate?`${v.coldchainTemplateId} / ${v.coldchainTemplateVersion}`:isConversationGenerate?`${v.conversationTemplateId} / ${v.conversationTemplateVersion}`:isGenerate?(v.useReference?`参考：${v.referenceVersion||'临时上传'}`:'系统生成'):v.inputVersion;onSubmit({...draft,...v,businessType,stages,input,output,backendJob});}catch(error){if(!error?.errorFields)message.error(error.message||'任务提交失败');else message.warning('请完成必填配置');}finally{setSubmitting(false);}};
  const allowedOptimizations=[...(evaluationScopes.includes('质量评估')?['问题处置']:[]),...(evaluationScopes.includes('隐私评估')?['隐私处理']:[]),...(evaluationScopes.includes('覆盖评估')?['定向增强','定向扩增']:[])];
  return <div className="create-task-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label={`返回${modalityLabel}任务列表`} onClick={onCancel}/><Title level={3}>新建{modalityLabel}{draft.taskType}任务</Title></Space><Space><Button disabled={submitting} onClick={()=>message.success('草稿已保存')}>保存草稿</Button>{step>0&&<Button disabled={submitting} onClick={()=>setStep(s=>s-1)}>上一步</Button>}{step<stepTitles.length-1?<Button type="primary" onClick={next}>下一步</Button>:<Button type="primary" loading={submitting} onClick={submit}>提交任务</Button>}</Space></Flex>
    <Form form={form} layout="vertical" initialValues={{...(draft.modality==='文档图像'?SYNTHETIC_DOCUMENT_INITIAL_VALUES:draft.modality==='时序数据'?COLD_CHAIN_INITIAL_VALUES:draft.modality==='对话文本'?CONVERSATION_TASK_INITIAL_VALUES:{}),count:draft.modality==='对话文本'?20:draft.modality==='文档图像'?10:draft.modality==='时序数据'?10:10000,useReference:false,referenceMode:'dataset',outputMode:'newDataset',outputDatasetName:draft.modality==='对话文本'?'智能客服多轮对话':draft.modality==='时序数据'?'冷藏集装箱国际运输时序数据集':'',versionNote:draft.modality==='对话文本'?'模板驱动的合成、增强、质检与定向扩增结果':draft.modality==='时序数据'?'冷链时序模板驱动的生成、增强、质检与定向扩增结果':draft.modality==='文档图像'?'质检驱动的文档图像定向扩增结果':'',evaluationScopes:['质量评估'],optimization:[],sampleRange:'全部数据',inputVersionStrategy:'锁定所选版本',evaluationOcrModel:'pp-ocrv5-local',evaluationPassThreshold:80,evaluationSampleRange:'全部数据',evaluationQualityVlm:false,evaluationPrivacyVlm:false,evaluationCoverageVlm:true,evaluationQualityVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyVlmModel:'qwen3-vl-8b-instruct',evaluationCoverageVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyFields:CUSTOMS_EVALUATION_FIELDS.privacy,evaluationCoverageFields:CUSTOMS_EVALUATION_FIELDS.coverage,enableAutoExpansion:false,maxEvaluationExpansion:5000,evaluationExpansionLlm:'qwen3-14b-no-thinking',evaluationExpansionDiffusion:'qwen-image-edit',evaluationExpansionTargets:['低质样本替代','业务字段覆盖补齐','代码表取值覆盖补齐','视觉场景覆盖补齐','隐私失败样本替代'],...(draft.configSnapshot||{}),name:draft.name,description:draft.description,businessType:draft.businessType||draft.configSnapshot?.businessType||businessTypeMap[draft.modality][0]}}>
      <Card className="task-fixed-header"><Row gutter={20} align="bottom"><Col span={12}><Form.Item name="name" label="任务名称" rules={[{required:true}]}><Input maxLength={50}/></Form.Item></Col><Col span={12}><Form.Item name="description" label="任务描述"><Input maxLength={200} placeholder="可随时修改"/></Form.Item></Col></Row></Card>
      <Card className="task-step-card"><Steps current={step} items={stepTitles.map(title=>({title}))}/><Divider/><div className="task-step-content">
        {current==='模板选择'&&(isConversationGenerate?<ConversationTemplateSelectionFields form={form}/>:isColdChainGenerate?<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);if(value==='传感器时序')form.setFieldsValue(COLD_CHAIN_INITIAL_VALUES);}}/></Form.Item><ColdChainTemplateSelectionFields form={form}/></>:isSyntheticDocumentGenerate?<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);form.setFieldsValue({...SYNTHETIC_DOCUMENT_INITIAL_VALUES,businessType:value});}}/></Form.Item><SyntheticDocumentTemplateFields form={form}/></>:<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);if(value==='报关单')form.setFieldsValue(CUSTOMS_INITIAL_VALUES);}}/></Form.Item><CustomsTemplateFields form={form}/></>)}
        {current==='数据合成配置'&&(isSyntheticDocumentGenerate?<SyntheticDocumentGenerationFields form={form}/>:<CustomsGenerationFields form={form}/>)}
        {current==='数据生成配置'&&(isColdChainGenerate?<ColdChainGenerationFields form={form}/>:<ConversationGenerationFields form={form}/>)}
        {current==='数据增强配置'&&(isColdChainGenerate?<ColdChainAugmentationFields form={form}/>:isConversationGenerate?<ConversationAugmentationFields form={form}/>:isSyntheticDocumentGenerate?<SyntheticDocumentAugmentationFields form={form}/>:<CustomsAugmentationFields form={form}/>)}
        {current==='质检与扩增配置'&&(isSyntheticDocumentGenerate?<SyntheticDocumentQualityFields form={form}/>:<CustomsQualityFields form={form}/>)}
        {current==='质检与扩增'&&(isConversationGenerate?<ConversationQualityExpansionFields form={form}/>:<ColdChainQualityFields form={form}/>)}
        {current==='业务与生成配置'&&<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);if(draft.modality==='文档图像'&&value==='报关单'){form.setFieldsValue(CUSTOMS_INITIAL_VALUES);setStep(0);}if(draft.modality==='时序数据'&&value==='传感器时序'){form.setFieldsValue(COLD_CHAIN_INITIAL_VALUES);setStep(0);}}}/></Form.Item>{draft.modality==='对话文本'&&<Alert type="info" showIcon message="咨询问答、信息收集和异常反馈在同一业务子类型下通过场景参数配置。"/>}<Divider orientation="left">生成参数</Divider><GenerationParameters modality={draft.modality} businessType={businessType}/><Form.Item name="count" label="目标样本数" rules={[{required:true}]}><InputNumber min={10} max={1000000} style={{width:240}}/></Form.Item></>}
        {current==='参考样例'&&<ReferenceExampleForm modality={draft.modality} form={form} datasets={datasets}/>} 
        {current==='可选处理'&&<><Row gutter={20}><Col span={12}><Card size="small" title="数据增强" extra={<Form.Item name="enableAugment" valuePropName="checked" noStyle><Switch/></Form.Item>}><Paragraph type="secondary">为生成结果增加真实噪声、表达变化或设备异常。</Paragraph><Form.Item label="增强强度"><Select defaultValue="中等" options={['轻度','中等','重度'].map(v=>({label:v,value:v}))}/></Form.Item></Card></Col><Col span={12}><Card size="small" title="隐私处理" extra={<Form.Item name="enablePrivacy" valuePropName="checked" noStyle><Switch/></Form.Item>}><Paragraph type="secondary">基础隐私检查默认执行；开启后自动处理命中内容。</Paragraph><Form.Item label="处理方式"><Select defaultValue="虚构替换" options={['掩码','泛化','虚构替换'].map(v=>({label:v,value:v}))}/></Form.Item></Card></Col></Row><Alert className="section-title" type="info" showIcon message="格式校验、基础隐私检查和结果安全门槛是系统默认节点。"/></>}
        {current==='小样预览'&&<><Alert type="success" showIcon message="小样已完成：5条生成成功，基础安全检查通过。"/><Row gutter={12} className="preview-metrics">{[['小样数量','5'],['真实性','91.6'],['逻辑一致性','96.2'],['模型可用性','94.8']].map(([a,b])=><Col span={6} key={a}><Card size="small"><Statistic title={a} value={b}/></Card></Col>)}</Row><Divider orientation="left">本次执行流程</Divider><Steps direction="vertical" size="small" current={-1} items={['生成',...(form.getFieldValue('enableAugment')?['增强']:[]),...(form.getFieldValue('enablePrivacy')?['隐私处理']:[]),'基础安全检查'].map(title=>({title}))}/></>}
        {current==='结果写入'&&isGenerate&&(isSyntheticDocumentGenerate?<><SyntheticDocumentSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:isCustomsGenerate?<><CustomsSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:isColdChainGenerate?<><ColdChainSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:isConversationGenerate?<><ConversationSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:<OutputConfig form={form} datasets={datasets} modality={draft.modality}/>)} 
        {current==='选择输入版本'&&<><Alert type="info" showIcon message="评估与优化针对一个确定、不可编辑的数据集版本执行。"/><Form.Item name="inputVersion" label="输入数据集版本" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={versionOptions}/></Form.Item>{isDocumentEvaluation&&selectedInputDataset&&<Alert className="section-title" type="success" showIcon message={`系统识别业务类型：${selectedInputDataset.businessType}`} description={`${selectedInputDataset.name} · ${inputVersion}；后续评估字段将按${selectedInputDataset.businessType}模板和数据契约加载。`}/>}<Form.Item name="inputVersionStrategy" label="版本策略"><Radio.Group options={['锁定所选版本']}/></Form.Item></>}
        {current==='评估配置'&&<><Form.Item name="evaluationScopes" label="评估范围" rules={[{required:true,message:'至少选择一项'}]}><Checkbox.Group options={['质量评估','隐私评估','覆盖评估']}/></Form.Item>{isDocumentEvaluation?(businessType==='报关单'?<CustomsEvaluationConfiguration form={form} scopes={evaluationScopes}/>:<Alert className="section-title" type="info" showIcon message={`已识别为${businessType}`} description="本轮先实现报关单的详细评估字段；运单和合同将复用相同框架并加载各自模板字段。"/>):<><Alert type="info" showIcon message="覆盖评估同时分析业务场景覆盖和增强维度多样性。"/><Row gutter={16} className="section-title"><Col span={12}><Form.Item label="评估样本范围"><Select defaultValue="全部数据" options={['全部数据','随机抽样20%','分层抽样'].map(v=>({label:v,value:v}))}/></Form.Item></Col><Col span={12}><Form.Item label="质量通过门槛"><Select defaultValue="标准（80分）" options={['宽松（70分）','标准（80分）','严格（90分）'].map(v=>({label:v,value:v}))}/></Form.Item></Col></Row></>}</>}
        {current==='自动定向扩增'&&<DocumentDirectionalExpansion form={form}/>} 
        {current==='结果写入'&&isDocumentEvaluation&&<>{enableAutoExpansion?<Alert type="success" showIcon message="自动扩增结果将写入输入数据集的新版本" description={`${selectedInputDataset?.name||'输入数据集'}将生成一个新的不可编辑版本；原版本保持不变，评估报告同时关联新旧版本。`}/>:<Alert type="info" showIcon message="本任务只生成评估报告" description="未启用自动定向扩增，不创建数据集新版本。"/>}<Divider orientation="left">执行摘要</Divider><Descriptions bordered size="small" column={2} items={[{key:'input',label:'输入版本',children:inputVersion||'-'},{key:'business',label:'业务类型',children:<Tag color="blue">{businessType}</Tag>},{key:'scope',label:'评估范围',children:<StageTags stages={evaluationScopes}/>},{key:'expansion',label:'自动定向扩增',children:enableAutoExpansion?`已启用 · 上限 ${form.getFieldValue('maxEvaluationExpansion')||0} 张`:'未启用'},{key:'models',label:'模型配置',children:enableAutoExpansion?`${form.getFieldValue('evaluationExpansionLlm')} / ${form.getFieldValue('evaluationExpansionDiffusion')}`:'按评估项配置'},{key:'output',label:'结果产物',children:enableAutoExpansion?`${selectedInputDataset?.name||'-'} / 新版本`:'评估报告'}]}/></>}
        {current==='自动优化'&&<><Form.Item name="optimization" label="基于评估结果自动优化（可不选）"><Checkbox.Group options={allowedOptimizations}/></Form.Item>{!allowedOptimizations.length?<Empty description="请先选择评估范围"/>:<Alert type="info" showIcon message="未选择自动优化时仅生成评估报告；选择后只处理命中问题或覆盖短板。"/>}{optimization.includes('隐私处理')&&<Form.Item label="隐私处理方式"><Select defaultValue="虚构替换" options={['掩码','泛化','虚构替换'].map(v=>({label:v,value:v}))}/></Form.Item>}{(optimization.includes('定向增强')||optimization.includes('定向扩增'))&&<Form.Item label="最大新增样本数"><InputNumber min={100} max={100000} defaultValue={5000}/></Form.Item>}</>}
        {current==='结果与提交'&&<>{optimization.length?<OutputConfig form={form} datasets={datasets} modality={draft.modality}/>:<Alert type="success" showIcon message="本任务仅生成评估报告，不创建新的数据集版本。报告将关联输入版本和本次任务。"/>}<Divider orientation="left">执行摘要</Divider><Descriptions bordered size="small" column={2} items={[{key:'1',label:'输入版本',children:form.getFieldValue('inputVersion')},{key:'2',label:'评估范围',children:<StageTags stages={evaluationScopes}/>},{key:'3',label:'自动优化',children:optimization.length?<StageTags stages={optimization}/>:<Tag>不执行</Tag>},{key:'4',label:'数据产物',children:optimization.length?'新数据集或新版本':'仅评估报告'}]}/></>}
      </div></Card>
    </Form>
  </div>;
}

function PreV3CreateTaskPage({ draft, datasets, onCancel, onSubmit }) {
  const [submitting,setSubmitting]=useState(false);
  const [form]=Form.useForm();
  const [selectedBusinessType,setSelectedBusinessType]=useState(draft.businessType||draft.configSnapshot?.businessType||businessTypeMap[draft.modality][0]);
  const businessType=Form.useWatch('businessType',form)||selectedBusinessType;
  const evaluationScopes=Form.useWatch('evaluationScopes',form)||['质量评估'];
  const inputVersion=Form.useWatch('inputVersion',form);
  const isSynthesis=draft.taskType==='数据合成';
  const isQuality=draft.taskType==='数据质检';
  const isAugmentation=draft.taskType==='数据增强';
  const isExpansion=draft.taskType==='定向扩增';
  const modalityLabel=modalityLabelMap[draft.modality]||draft.modality;
  const taskPageTitle=`新建${modalityLabel}${modalityLabel.endsWith('数据')&&draft.taskType.startsWith('数据')?draft.taskType.slice(2):draft.taskType}任务`;
  const selectedInputDataset=useMemo(()=>datasets.find(dataset=>dataset.versions.some(version=>`${dataset.name} / ${version.version}`===inputVersion)),[datasets,inputVersion]);
  const versionOptions=datasets.filter(dataset=>dataset.modality===draft.modality).flatMap(dataset=>dataset.versions.map(version=>({label:`${dataset.name} / ${version.version} · ${numericSampleCount(version.samples).toLocaleString()}条`,value:`${dataset.name} / ${version.version}`})));
  const modeValues=isSynthesis
    ? {enableAugmentation:false,enableAugment:false,runQc:false,enableQuality:false,enableExpansion:false,enableAutoExpansion:false}
    : isQuality
      ? {enableAugmentation:false,enableAugment:false,runQc:true,enableQuality:true,enableExpansion:false,enableAutoExpansion:false}
      : isAugmentation
        ? {enableAugmentation:true,enableAugment:true,runQc:false,enableQuality:false,enableExpansion:false,enableAutoExpansion:false}
        : {enableAugmentation:false,enableAugment:false,runQc:true,enableQuality:true,enableExpansion:true,enableAutoExpansion:true};

  useEffect(()=>{
    form.setFieldsValue(modeValues);
  },[businessType,draft.taskType,form]);

  useEffect(()=>{
    if(isSynthesis||!selectedInputDataset)return;
    setSelectedBusinessType(selectedInputDataset.businessType);
    form.setFieldsValue({businessType:selectedInputDataset.businessType,inputDatasetName:selectedInputDataset.name,targetDataset:selectedInputDataset.name,outputMode:'newVersion'});
  },[form,isSynthesis,selectedInputDataset]);

  const changeBusinessType=value=>{
    setSelectedBusinessType(value);
    if(draft.modality==='文档图像')form.setFieldsValue({...SYNTHETIC_DOCUMENT_INITIAL_VALUES,...modeValues,businessType:value});
    if(draft.modality==='时序数据')form.setFieldsValue({...COLD_CHAIN_INITIAL_VALUES,...modeValues,businessType:value});
    if(draft.modality==='对话文本')form.setFieldsValue({...CONVERSATION_TASK_INITIAL_VALUES,...modeValues,businessType:value});
  };

  const synthesisTemplateFields=draft.modality==='文档图像'
    ? <SyntheticDocumentTemplateFields form={form}/>
    : draft.modality==='对话文本'
      ? <ConversationTemplateSelectionFields form={form}/>
      : <ColdChainTemplateSelectionFields form={form}/>;
  const synthesisParameterFields=draft.modality==='文档图像'
    ? <SyntheticDocumentGenerationFields form={form}/>
    : draft.modality==='对话文本'
      ? <ConversationGenerationFields form={form}/>
      : <ColdChainGenerationFields form={form}/>;

  const inputVersionFields=<>
    <Alert type="info" showIcon message={`${draft.taskType}针对一个确定、不可编辑的数据集版本执行。`}/>
    <Form.Item name="inputVersion" label="输入数据集版本" rules={[{required:true,message:'请选择输入数据集版本'}]}><Select showSearch optionFilterProp="label" options={versionOptions}/></Form.Item>
    {selectedInputDataset&&<Alert className="section-title" type="success" showIcon message={`已识别业务类型：${selectedInputDataset.businessType}`} description={`${selectedInputDataset.name} · ${inputVersion}`}/>} 
    <Form.Item name="inputVersionStrategy" label="版本策略"><Radio.Group options={['锁定所选版本']}/></Form.Item>
  </>;

  const qualityFields=<>
    <Form.Item name="evaluationScopes" label="质检范围" rules={[{required:true,message:'至少选择一项'}]}><Checkbox.Group options={['质量评估','隐私评估','覆盖评估']}/></Form.Item>
    {draft.modality==='文档图像'&&(businessType==='报关单'
      ? <CustomsEvaluationConfiguration form={form} scopes={evaluationScopes}/>
      : <><Alert type="info" showIcon message="沿用现有文档质检配置" description="按所选版本执行质量、隐私与覆盖检查。"/><Row gutter={16} className="section-title"><Col span={12}><Form.Item name="evaluationSampleRange" label="评估样本范围"><Select options={['全部数据','随机抽样20%','分层抽样'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={12}><Form.Item name="evaluationPassThreshold" label="质量通过门槛"><Select options={[{value:70,label:'宽松（70分）'},{value:80,label:'标准（80分）'},{value:90,label:'严格（90分）'}]}/></Form.Item></Col></Row></>)}
    {draft.modality==='对话文本'&&<ConversationQualityExpansionFields form={form} mode="quality" standalone/>}
    {draft.modality==='时序数据'&&<ColdChainQualityFields form={form} mode="quality" standalone/>}
  </>;

  const augmentationFields=draft.modality==='文档图像'
    ? (businessType==='报关单'?<CustomsAugmentationFields form={form}/>:<SyntheticDocumentAugmentationFields form={form}/>)
    : draft.modality==='对话文本'
      ? <ConversationAugmentationFields form={form} standalone/>
      : <ColdChainAugmentationFields form={form} standalone/>;

  const expansionFields=draft.modality==='文档图像'
    ? <DocumentDirectionalExpansion form={form} standalone/>
    : draft.modality==='对话文本'
      ? <ConversationQualityExpansionFields form={form} mode="expansion" standalone/>
      : <ColdChainQualityFields form={form} mode="expansion" standalone/>;

  const submit=async()=>{
    if(submitting)return;
    setSubmitting(true);
    try{
      form.setFieldsValue(modeValues);
      const values=await form.validateFields();
      let backendJob=null;
      if(isSynthesis){
        if(draft.modality==='文档图像')backendJob=await createSyntheticDocumentBackendJob(form);
        if(draft.modality==='对话文本')backendJob=await createConversationBackendJob(form);
        if(draft.modality==='时序数据')backendJob=await createColdChainBackendJob(form);
      }
      const output=isQuality?`${values.targetDataset||'输入数据集'} / 质检标注新版本`:values.outputMode==='newVersion'?`${values.targetDataset} / 新版本`:values.outputDatasetName;
      const input=isSynthesis
        ? draft.modality==='文档图像'?`${values.syntheticDocumentTemplateId} / ${values.syntheticDocumentTemplateVersion}`:draft.modality==='对话文本'?`${values.conversationTemplateId} / ${values.conversationTemplateVersion}`:`${values.coldchainTemplateId} / ${values.coldchainTemplateVersion}`
        : values.inputVersion;
      onSubmit({...draft,...values,...modeValues,businessType:values.businessType||businessType,stages:[draft.taskType],input,output,backendJob});
    }catch(error){
      if(!error?.errorFields)message.error(error.message||'任务提交失败');
      else message.warning('请完成必填配置');
    }finally{setSubmitting(false);}
  };

  const defaultOutputName=draft.modality==='文档图像'?'文档图像数据集':draft.modality==='对话文本'?'智能客服多轮对话':'冷藏集装箱国际运输时序数据集';
  const defaultVersionNote=isSynthesis?'数据合成结果':isAugmentation?'数据增强结果':isExpansion?'定向扩增结果':'数据质检结果';
  return <div className="create-task-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label={`返回${modalityLabel}任务列表`} onClick={onCancel}/><Title level={3}>{taskPageTitle}</Title></Space><Space><Button disabled={submitting} onClick={()=>message.success('草稿已保存')}>保存草稿</Button><Button type="primary" loading={submitting} onClick={submit}>提交任务</Button></Space></Flex>
    <Form form={form} layout="vertical" initialValues={{...(draft.modality==='文档图像'?SYNTHETIC_DOCUMENT_INITIAL_VALUES:draft.modality==='时序数据'?COLD_CHAIN_INITIAL_VALUES:CONVERSATION_TASK_INITIAL_VALUES),...modeValues,count:draft.modality==='对话文本'?20:10,outputMode:'newDataset',outputDatasetName:defaultOutputName,versionNote:defaultVersionNote,evaluationScopes:['质量评估'],inputVersionStrategy:'锁定所选版本',evaluationOcrModel:'pp-ocrv5-local',evaluationPassThreshold:80,evaluationSampleRange:'全部数据',evaluationQualityVlm:false,evaluationPrivacyVlm:false,evaluationCoverageVlm:true,evaluationQualityVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyVlmModel:'qwen3-vl-8b-instruct',evaluationCoverageVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyFields:CUSTOMS_EVALUATION_FIELDS.privacy,evaluationCoverageFields:CUSTOMS_EVALUATION_FIELDS.coverage,maxEvaluationExpansion:5000,evaluationExpansionLlm:'qwen3-14b-no-thinking',evaluationExpansionDiffusion:'qwen-image-edit',evaluationExpansionTargets:['低质样本替代','业务字段覆盖补齐','代码表取值覆盖补齐','视觉场景覆盖补齐','隐私失败样本替代'],...(draft.configSnapshot||{}),name:draft.name,description:draft.description,businessType:selectedBusinessType}}>
      <Card className="task-fixed-header"><Row gutter={20} align="bottom"><Col span={12}><Form.Item name="name" label="任务名称" rules={[{required:true,message:'请输入任务名称'}]}><Input maxLength={50}/></Form.Item></Col><Col span={12}><Form.Item name="description" label="任务描述"><Input maxLength={200} placeholder="可随时修改"/></Form.Item></Col></Row></Card>
      {isSynthesis&&<>
        <Card className="task-step-card" title="模板与数据合成配置">
          <Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={changeBusinessType}/></Form.Item>
          {synthesisTemplateFields}<Divider orientation="left">数据合成参数</Divider>{synthesisParameterFields}
        </Card>
        <Card className="task-step-card section-title" title="结果写入"><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></Card>
      </>}
      {!isSynthesis&&<>
        <Card className="task-step-card" title="输入数据版本">{inputVersionFields}</Card>
        <Card className="task-step-card section-title" title={`${draft.taskType}配置`}>{isQuality?qualityFields:isAugmentation?augmentationFields:expansionFields}</Card>
        {!isQuality&&<Card className="task-step-card section-title" title="结果写入"><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></Card>}
        {isQuality&&<Alert className="section-title" type="success" showIcon message="任务完成后创建质检标注版本" description="输入版本保持不变；样本级质检标签和质检报告写入同一条新版本。"/>}
      </>}
    </Form>
  </div>;
}

const PUBLISHED_TEMPLATE_PROFILES = [
  { id:'TEMPLATE-DOC-20260902-E3A971', name:'贸易报关单版面分析模板', modality:'文档图像', businessType:'报关单', version:'1.0.0', trialStatus:'试运行通过', method:'版面分析法', outputFormat:'PNG + JSON', defaultModel:'Qwen3-VL-8B-Instruct' },
  { id:'TEMPLATE-DOC-20260902-WB0012', name:'物流运单底图生成模板', modality:'文档图像', businessType:'运单', version:'1.0.0', trialStatus:'试运行通过', method:'底图生成法', outputFormat:'PNG + JSON', defaultModel:'Qwen3-VL-8B-Instruct', imageModel:'Doubao-Seedream-4.0', backgroundPrompt:'生成一张横版物流运单空白底图：保留规范表格、分区线、浅灰辅助线和右下角二维码占位，不生成任何真实姓名、地址、电话、单号或可识别文字。' },
  { id:'TEMPLATE-CONV-20260902-C01A7B', name:'物流智能客服对话模板', modality:'对话文本', businessType:'智能客服多轮对话', version:'1.0.0', trialStatus:'试运行通过', outputFormat:'VERL SFT', defaultModel:'Qwen3-14B' },
  { id:'TEMPLATE-CONV-20260902-AF2210', name:'物流异常反馈对话模板', modality:'对话文本', businessType:'异常反馈', version:'1.0.0', trialStatus:'试运行通过', outputFormat:'VERL SFT', defaultModel:'Qwen3-14B' },
  { id:'TEMPLATE-TS-20260902-CC1024', name:'冷链运输时序模板', modality:'时序数据', businessType:'传感器时序', version:'1.0.0', trialStatus:'试运行通过', outputFormat:'JSONL + CSV', defaultModel:'Qwen3-14B', outputFields:'temperature、humidity、longitude、latitude、event_label' },
  { id:'TEMPLATE-TS-20260902-GPS072', name:'车辆 GPS 轨迹时序模板', modality:'时序数据', businessType:'GPS轨迹', version:'1.0.0', trialStatus:'试运行通过', outputFormat:'JSONL + CSV', defaultModel:'Qwen3-14B', outputFields:'longitude、latitude、speed、heading、event_label' },
];

const TEMPLATE_QUALITY_RULES = {
  文档图像: [
    {id:'BASE-STRUCTURE',name:'输出内容结构检查',category:'基础规则',target:'图像、字段与标注',method:'规则判断',threshold:'结构完整且字段可解析',content:'检查图片、字段 JSON、bbox/polygon、字段 ID 和图层对象是否完整，坐标不得越界。'},
    {id:'BASE-PRIVACY',name:'隐私与敏感信息检查',category:'基础规则',target:'图像与字段',method:'规则判断',threshold:'残留风险数 = 0',privacy:true,content:'检查姓名、联系方式、地址、业务唯一编号、条形码、二维码、印章和其他敏感内容是否为安全虚构值。'},
    {id:'BASE-DUPLICATE',name:'重复样本检查',category:'基础规则',target:'图像与字段',method:'规则判断',threshold:'感知哈希及关键字段组合不重复',content:'同时计算图像感知哈希、字段组合哈希和标注结构哈希，判断样本是否重复。'},
    {id:'SCENE-OCR-EXACT',name:'字段 OCR 完全一致性',category:'场景规则',target:'图像与字段',method:'语义判断',threshold:'得分 ≥ 0.90',content:'逐字段对比 Ground Truth 与 OCR 结果，检查文字、日期、编号、金额和单位是否保持一致。',passExample:'申报日期与 Ground Truth 完全一致',failExample:'海关编号出现字符替换'},
    {id:'SCENE-NUMERIC-CODE',name:'数字与代码准确性',category:'场景规则',target:'字段',method:'规则判断',threshold:'准确率 ≥ 95%',content:'对日期、金额、税则号、国别代码和口岸代码等数字代码字段执行标准化后精确比较。'},
    {id:'SCENE-LAYOUT-FIELD',name:'版面与字段一致性',category:'场景规则',target:'图像与字段',method:'语义判断',threshold:'得分 ≥ 0.85',content:'判断字段位置、标签和值的绑定关系是否符合模板定义的版面语义。'},
    {id:'SCENE-IMAGE-GEOMETRY',name:'图片与几何质量',category:'场景规则',target:'图像与标注',method:'函数判断',threshold:'polygon 有效率 ≥ 99.5%',content:'计算亮度、对比度、清晰度、bbox/polygon 重投影误差、越界比例和字段像素高度。'},
    {id:'SCENE-LABEL-COVERAGE',name:'标签覆盖率',category:'场景规则',target:'样本标签',method:'规则判断',threshold:'输出各标签 PASS 数及缺口',content:'按业务字段、版式、印章类型及拍摄/扫描场景统计样本覆盖量，为定向扩增提供依据。'},
  ],
  对话文本: [
    {id:'BASE-STRUCTURE',name:'输出内容结构检查',category:'基础规则',target:'对话',method:'规则判断',threshold:'Schema 合法 = true',content:'检查 VERL SFT 数据结构、messages 角色顺序、必填字段和轮次范围。'},
    {id:'BASE-PRIVACY',name:'隐私与敏感信息检查',category:'基础规则',target:'对话',method:'规则判断',threshold:'残留风险数 = 0',privacy:true,content:'检查姓名、电话、地址、订单号、证件号、密钥和 Token 等敏感内容。'},
    {id:'BASE-DUPLICATE',name:'重复样本检查',category:'基础规则',target:'对话',method:'规则判断',threshold:'语义相似度 < 0.92',content:'结合文本指纹和语义相似度检查重复对话。'},
    {id:'BASE-LABEL-COVERAGE',name:'标签覆盖率',category:'基础规则',target:'样本标签',method:'规则判断',threshold:'输出各标签 PASS 数及缺口',content:'统计意图、情绪、信息完整度及状态路径等标签的 PASS 样本数量。'},
    {id:'SCENE-EVIDENCE',name:'事实与证据一致性',category:'场景规则',target:'对话与知识卡',method:'语义判断',threshold:'得分 ≥ 0.85',content:'判断回复结论是否能够由知识卡或对话中已给出的事实支持。',passExample:'根据知识卡准确说明赔付条件',failExample:'编造知识卡未提供的时效承诺'},
    {id:'SCENE-ROLE',name:'角色稳定性',category:'场景规则',target:'对话',method:'语义判断',threshold:'得分 ≥ 0.85',content:'判断客服与用户角色、语气和职责是否在多轮对话中保持一致。'},
    {id:'SCENE-STATE',name:'状态转换合法性',category:'场景规则',target:'对话',method:'规则判断',threshold:'状态机校验 = true',content:'根据模板状态机校验问题确认、信息收集、方案处理和结束等状态转换。'},
    {id:'SCENE-TOOL',name:'工具契约检查',category:'场景规则',target:'对话与工具调用',method:'规则判断',threshold:'工具名及参数 Schema 合法',content:'检查工具选择、参数字段、参数类型和调用结果引用是否符合模板工具定义。'},
  ],
  时序数据: [
    {id:'BASE-STRUCTURE',name:'输出内容结构检查',category:'基础规则',target:'时序参数',method:'规则判断',threshold:'字段契约合法 = true',content:'检查字段名称、数据类型、必填参数、单位和输出结构是否符合模板契约。'},
    {id:'BASE-PRIVACY',name:'隐私与敏感信息检查',category:'基础规则',target:'两者',method:'规则判断',threshold:'残留风险数 = 0',privacy:true,content:'检查设备标识、车辆标识、人员信息、路线业务编号和文本事件中的敏感信息。'},
    {id:'BASE-DUPLICATE',name:'重复序列检查',category:'基础规则',target:'时序参数',method:'规则判断',threshold:'序列哈希不重复',content:'检查完全重复或高度相似的参数序列及事件序列。'},
    {id:'BASE-LABEL-COVERAGE',name:'标签覆盖率',category:'基础规则',target:'两者',method:'规则判断',threshold:'输出各标签 PASS 数及缺口',content:'统计异常事件、运输阶段、参数形态和标签组合的 PASS 数量。'},
    {id:'SCENE-EVENT-SEMANTIC',name:'语义事件有效性',category:'场景规则',target:'语义事件',method:'语义判断',threshold:'得分 ≥ 0.85',content:'判断异常事件名称、描述和上下文是否符合模板定义的业务语义。'},
    {id:'SCENE-TEMPORAL',name:'时间连续性',category:'场景规则',target:'时序参数',method:'函数判断',threshold:'时间戳单调且间隔误差 ≤ 1%',content:'检查时间戳顺序、步数、采样间隔、缺失点和重复时间戳。'},
    {id:'SCENE-RELATION',name:'参数关系合理性',category:'场景规则',target:'时序参数',method:'函数判断',threshold:'关系函数返回 true',content:'检查温湿度、速度、位置、阶段等参数之间的约束关系和物理边界。'},
    {id:'SCENE-FLUCTUATION',name:'整体波动合理性',category:'场景规则',target:'时序参数',method:'语义判断',threshold:'得分 ≥ 0.82',content:'判断整段序列趋势、突变、周期和噪声是否符合真实设备及运输过程。'},
    {id:'SCENE-EVENT-CONSISTENCY',name:'参数与事件一致性',category:'场景规则',target:'两者',method:'语义判断',threshold:'得分 ≥ 0.88',content:'判断事件发生时间与对应参数变化是否一致，事件前后状态是否合理。'},
  ],
};

const templatesForModality = modality => PUBLISHED_TEMPLATE_PROFILES.filter(item=>item.modality===modality);
const templateForDataset = dataset => PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===dataset?.templateId)
  || PUBLISHED_TEMPLATE_PROFILES.find(item=>item.modality===dataset?.modality&&item.businessType===dataset?.businessType)
  || templatesForModality(dataset?.modality)[0];

function TemplateSnapshot({ template }) {
  if(!template)return <Alert type="warning" showIcon message="未找到可用的已发布模板" description="请先在模板中心完成模板试运行并发布。"/>;
  return <Descriptions bordered size="small" column={3} items={[
    {key:'name',label:'适用模板',children:<div><Text strong>{template.name}</Text><div className="muted-id">{template.id}</div></div>},
    {key:'version',label:'模板版本',children:template.version},
    {key:'business',label:'业务类型',children:template.businessType},{key:'method',label:'模板制作方式',children:template.method||'-'},{key:'trial',label:'试运行状态',children:<Tag color="green">{template.trialStatus}</Tag>},{key:'format',label:'输出格式',children:template.outputFormat},
  ]}/>;
}

function TemplateRulesTable({ modality, template, title='模板质检规则' }) {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('全部');
  const [target,setTarget]=useState('全部');
  const [method,setMethod]=useState('全部');
  const rules=TEMPLATE_QUALITY_RULES[modality]||[];
  const targets=[...new Set(rules.map(rule=>rule.target))];
  const methods=[...new Set(rules.map(rule=>rule.method))];
  const filtered=rules.filter(rule=>(category==='全部'||rule.category===category)&&(target==='全部'||rule.target===target)&&(method==='全部'||rule.method===method)&&(!query||`${rule.name}${rule.id}`.toLowerCase().includes(query.toLowerCase())));
  const columns=[
    {title:'规则名称 / ID',width:220,render:(_,rule)=><div><Text strong>{rule.name}</Text><div className="muted-id">{rule.id}</div></div>},
    {title:'规则分类',dataIndex:'category',width:110,render:(value,rule)=><Tag color={rule.privacy?'blue':'green'}>{value}</Tag>},
    {title:'检查对象',dataIndex:'target',width:135},{title:'判断方式',dataIndex:'method',width:110},
    {title:'阈值 / 通过条件',dataIndex:'threshold',width:190},
    {title:'规则内容',dataIndex:'content',width:260,ellipsis:true},
    {title:'示例',width:190,render:(_,rule)=>rule.passExample||rule.failExample?<div><div>通过：{rule.passExample||'-'}</div><div>不通过：{rule.failExample||'-'}</div></div>:'-'},
    {title:'执行状态',fixed:'right',width:100,render:()=> <Tag color="processing">本次执行</Tag>},
  ];
  return <Card className="task-step-card section-title" title={title} extra={<Text type="secondary">规则来自锁定的模板快照，只读</Text>}>
    <TemplateSnapshot template={template}/>
    <Flex justify="space-between" align="center" gap={12} wrap="wrap" className="task-rules-toolbar"><Space wrap><Select value={category} onChange={setCategory} style={{width:130}} options={['全部','基础规则','场景规则'].map(value=>({value,label:value==='全部'?'全部规则分类':value}))}/><Select value={target} onChange={setTarget} style={{width:145}} options={['全部',...targets].map(value=>({value,label:value==='全部'?'全部检查对象':value}))}/><Select value={method} onChange={setMethod} style={{width:145}} options={['全部',...methods].map(value=>({value,label:value==='全部'?'全部判断方式':value}))}/></Space><Input allowClear prefix={<SearchOutlined/>} value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索规则名称或 ID" style={{width:240}}/></Flex>
    <Table rowKey="id" size="small" columns={columns} dataSource={filtered} scroll={{x:1320}} pagination={false} expandable={{expandedRowRender:rule=><div className="task-rule-expanded"><Text strong>完整规则内容</Text><pre>{rule.content}</pre><Text copyable={{text:rule.content}}>复制完整内容</Text></div>}}/>
  </Card>;
}

function TaskEvidencePanel({ title, identity, children, onOpenDetail }) {
  return <Card className="task-evidence-card" title={<Space><span>{title}</span><Tag>只读</Tag></Space>} extra={onOpenDetail?<Button type="link" size="small" onClick={onOpenDetail}>查看完整详情</Button>:null}>
    {identity&&<div className="task-evidence-identity"><Text strong>{identity.name||'-'}</Text><Text type="secondary" copyable={Boolean(identity.id)}>{identity.id||'-'}</Text>{identity.updatedAt&&<Text type="secondary">更新时间：{formatDateTime(identity.updatedAt)}</Text>}</div>}
    {children}
  </Card>;
}

function TemplateEvidence({ template, modality }) {
  if(!template)return <TaskEvidencePanel title="已发布模板"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先在右侧选择模板"/></TaskEvidencePanel>;
  const rules=TEMPLATE_QUALITY_RULES[modality]||[];
  return <TaskEvidencePanel title="已发布模板" identity={{name:template.name,id:template.id}}>
    <Descriptions size="small" column={1} bordered items={[
      {key:'version',label:'正式版本',children:template.version},{key:'business',label:'业务类型',children:template.businessType},{key:'method',label:'模板制作方式',children:template.method||'-'},{key:'format',label:'输出格式',children:template.outputFormat||'-'},{key:'model',label:'默认模型',children:template.defaultModel||'-'},{key:'rules',label:'质检规则',children:`${rules.length} 条`},
    ]}/>
    <Divider orientation="left">模板具体内容</Divider>
    {modality==='文档图像'&&<Descriptions size="small" column={1} bordered items={[
      {key:'resolution',label:'默认输出精度',children:template.resolution||'2480 × 1754'},{key:'layers',label:'模板图层',children:'底图、固定文字、动态字段、隐私保护层'},{key:'fields',label:'字段与标注',children:'字段 Key、数据类型、生成方式、文字样式、bbox / polygon'},{key:'privacy',label:'隐私保护',children:'安全虚构值、模糊处理及合成数据水印'},
    ]}/>} 
    {modality==='对话文本'&&<Descriptions size="small" column={1} bordered items={[
      {key:'scenario',label:'场景与角色',children:template.businessType},{key:'turns',label:'对话轮数约束',children:'最少 3 轮，最多 8 轮'},{key:'knowledge',label:'知识卡',children:'按问题、适用条件和标准回答约束生成回复'},{key:'labels',label:'样本标签',children:'意图、情绪、信息完整度、状态路径'},{key:'tools',label:'工具使用',children:'按模板工具契约生成调用名称、参数及结果引用'},{key:'instruction',label:'合成指令',children:'场景、角色、知识卡、状态机、标签及输出格式合并生成'},
    ]}/>} 
    {modality==='时序数据'&&<Descriptions size="small" column={1} bordered items={[
      {key:'events',label:'异常事件候选',children:'正常运输、计划性断网及模板配置的异常事件'},{key:'fields',label:'输出参数',children:template.outputFields||'时间戳及模板定义的时序参数'},{key:'generation',label:'参数生成规则',children:'函数生成或语义生成'},{key:'steps',label:'默认试运行',children:'100 个时间步，按模板间隔生成'},{key:'relation',label:'参数关系',children:'字段契约、时间连续性、参数关系和事件一致性'},
    ]}/>} 
    <TemplateRulesTable modality={modality} template={template} title="模板完整质检规则"/>
  </TaskEvidencePanel>;
}

function QualityRulesEvidence({ template, modality }) {
  const rules=TEMPLATE_QUALITY_RULES[modality]||[];
  return <TaskEvidencePanel title="模板质检规则" identity={{name:template?.name,id:template?.id}}>
    <TemplateSnapshot template={template}/>
    <Alert className="section-title" type="info" showIcon message={`${rules.length} 条规则将按模板快照执行`} description={`基础规则 ${rules.filter(rule=>rule.category==='基础规则').length} 条，场景规则 ${rules.filter(rule=>rule.category==='场景规则').length} 条，语义判断 ${rules.filter(rule=>rule.method==='语义判断').length} 条。`}/>
    <TemplateRulesTable modality={modality} template={template} title="本次执行的完整规则内容"/>
  </TaskEvidencePanel>;
}

function QualityReportEvidence({ dataset, version }) {
  if(!version)return <TaskEvidencePanel title="输入版本质检报告"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先在右侧选择数据集和版本"/></TaskEvidencePanel>;
  const report=version.qualityReport||{};
  const counts=report.statusCounts||{};
  const gaps=report.coverageGaps||[];
  return <TaskEvidencePanel title="输入版本质检报告" identity={{name:dataset?.name,id:report.reportId||version.qualityReportId,updatedAt:version.updatedAt}}>
    <Descriptions size="small" column={1} bordered items={[
      {key:'dataset',label:'数据集 ID',children:<Text copyable>{dataset?.id||'-'}</Text>},{key:'version',label:'版本 ID',children:<Text copyable>{version.version}</Text>},{key:'source-task',label:'来源任务',children:<div>{version.sourceName||'-'}<div className="muted-id">{version.source||'-'}</div></div>},{key:'source-version',label:'来源数据集版本',children:version.sourceVersionId||'-'},{key:'template',label:'模板血缘',children:<div>{PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===version.templateId)?.name||version.templateId||'-'}<div className="muted-id">{version.templateId||'-'} / {version.templateVersion||'-'}</div></div>},{key:'scope',label:'质检范围',children:report.executionRange==='sample'?'部分抽检':'全量质检'},{key:'count',label:'样本总数',children:numericSampleCount(version.samples).toLocaleString()},{key:'checked',label:'已质检 / 未质检',children:`${Number(report.checkedSampleCount??numericSampleCount(version.samples)).toLocaleString()} / ${Number(report.uncheckedSampleCount??counts.UNCHECKED??0).toLocaleString()}`},
    ]}/>
    <div className="task-evidence-status-grid">{['PASS','REVIEW','REJECT','UNCHECKED'].map(key=><div key={key}><Text type="secondary">{key}</Text><Text strong>{Number(counts[key]||0).toLocaleString()}</Text></div>)}</div>
    <Divider orientation="left">报告摘要</Divider>
    <Descriptions size="small" column={1} items={[
      {key:'score',label:'平均质量分',children:report.averageScore??version.quality??'-'},{key:'privacy',label:'隐私命中',children:report.privacy?.initialRiskCount??report.privacyHits??0},{key:'gaps',label:'覆盖缺口',children:`${gaps.length} 项`},
    ]}/>
    <Divider orientation="left">完整质检指标</Divider><VersionQualityReport dataset={dataset} version={version}/>
    <Divider orientation="left">逐规则质检结果</Divider>
    <Table rowKey="id" size="small" pagination={false} scroll={{x:900}} dataSource={report.ruleSnapshot||TEMPLATE_QUALITY_RULES[dataset?.modality]||[]} columns={[
      {title:'规则名称 / ID',width:210,render:(_,rule)=><div><Text strong>{rule.name}</Text><div className="muted-id">{rule.id}</div></div>},{title:'分类',dataIndex:'category',width:100,render:(value,rule)=><Tag color={rule.privacy?'blue':'green'}>{value}</Tag>},{title:'检查对象',dataIndex:'target',width:130},{title:'方式',dataIndex:'method',width:100},{title:'阈值 / 通过条件',dataIndex:'threshold',width:170},{title:'规则内容',dataIndex:'content',width:260},{title:'结果',fixed:'right',width:90,render:()=><Tag color="green">PASS</Tag>},
    ]}/>
    <Divider orientation="left">标签覆盖与建议缺口</Divider>
    {!!gaps.length?<Table rowKey="key" size="small" pagination={false} dataSource={gaps} columns={[{title:'维度',dataIndex:'dimension'},{title:'标签值',dataIndex:'label'},{title:'当前 PASS',dataIndex:'pass',width:90},{title:'目标数',dataIndex:'target',width:80},{title:'缺口',dataIndex:'gap',width:70}]}/>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前报告没有覆盖缺口"/>} 
  </TaskEvidencePanel>;
}

function ModelWithParameters({ form, modelName='generationModel', parameterSwitchName='generationParametersEnabled', parameterName='generationParameters', label='生成模型' }) {
  const enabled=Form.useWatch(parameterSwitchName,form);
  return <><Form.Item name={modelName} label={label} rules={[{required:true,message:`请选择${label}`}]}><Select options={['Qwen3-14B','Qwen3-VL-8B-Instruct','Doubao-Seedream-4.0','DeepSeek-V3.1'].map(value=>({value,label:value}))}/></Form.Item><Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>{label}参数（可选）</Text><div><Text type="secondary">开启后以 JSON 形式覆盖模板试运行参数</Text></div></div><Form.Item name={parameterSwitchName} valuePropName="checked" noStyle><Switch/></Form.Item></Flex>{enabled&&<Form.Item name={parameterName} rules={[{validator:(_,value)=>{try{JSON.parse(value||'{}');return Promise.resolve();}catch{return Promise.reject(new Error('请输入合法 JSON'));}}}]}><Input.TextArea rows={5} className="json-textarea"/></Form.Item>}</>;
}

function ApiEstimate({ items }) {
  const total=items.reduce((sum,item)=>sum+Number(item.value||0),0);
  return <Descriptions bordered size="small" column={Math.min(4,items.length+1)} items={[...items.map((item,index)=>({key:index,label:item.label,children:Number(item.value||0).toLocaleString()})),{key:'total',label:'总调用次数预估',children:<Text strong>{total.toLocaleString()}</Text>}]}/>;
}

function ApiUsageSummary({ usage={} }) {
  return <Descriptions bordered size="small" column={3} items={[
    {key:'model',label:'模型调用次数',children:Number(usage.model||0).toLocaleString()},
    {key:'image',label:'图像模型调用次数',children:Number(usage.image||0).toLocaleString()},
    {key:'tokens',label:'调用 Tokens 数',children:Number(usage.tokens||0).toLocaleString()},
  ]}/>;
}

function CreateTaskPage({ draft, datasets, onCancel, onSubmit }) {
  const [submitting,setSubmitting]=useState(false);
  const [form]=Form.useForm();
  const isSynthesis=draft.taskType==='数据合成';
  const isQuality=draft.taskType==='数据质检';
  const isAugmentation=draft.taskType==='数据增强';
  const isExpansion=draft.taskType==='定向扩增';
  const modalityLabel=modalityLabelMap[draft.modality]||draft.modality;
  const taskPageTitle=`新建${modalityLabel}${modalityLabel.endsWith('数据')&&draft.taskType.startsWith('数据')?draft.taskType.slice(2):draft.taskType}任务`;
  const templateId=Form.useWatch('templateId',form);
  const inputDatasetId=Form.useWatch('inputDatasetId',form);
  const inputVersionId=Form.useWatch('inputVersionId',form);
  const sampleSelection=Form.useWatch('sampleSelection',form)||'pass';
  const selectionThreshold=Form.useWatch('selectionThreshold',form)||75;
  const customEnhancementEnabled=Form.useWatch('customEnhancementEnabled',form);
  const documentEnhancementTypes=Form.useWatch('documentEnhancementTypes',form)||[];
  const documentSemanticCustomEnabled=Form.useWatch('documentSemanticCustomEnabled',form);
  const documentBackgroundCustomEnabled=Form.useWatch('documentBackgroundCustomEnabled',form);
  const timeseriesEventCustomEnabled=Form.useWatch('timeseriesEventCustomEnabled',form);
  const timeseriesParameterCustomEnabled=Form.useWatch('timeseriesParameterCustomEnabled',form);
  const customExpansionEnabled=Form.useWatch('customExpansionEnabled',form);
  const overrideBackgroundGeneration=Form.useWatch('overrideBackgroundGeneration',form);
  const customExpansionSettings=Form.useWatch('customExpansionSettings',form)||[];
  const sampleCount=Number(Form.useWatch('sampleCount',form)||0);
  const targetCount=Number(Form.useWatch('targetCount',form)||0);
  const qualityScope=Form.useWatch('qualityScope',form)||'full';
  const samplingRatio=Number(Form.useWatch('samplingRatio',form)||10);
  const semanticRuleCount=(TEMPLATE_QUALITY_RULES[draft.modality]||[]).filter(rule=>rule.method==='语义判断').length;
  const eligibleDatasets=useMemo(()=>datasets.filter(dataset=>dataset.modality===draft.modality&&dataset.templateId),[datasets,draft.modality]);
  const selectedDataset=eligibleDatasets.find(dataset=>dataset.id===inputDatasetId);
  const selectedVersion=selectedDataset?.versions.find(version=>version.version===inputVersionId);
  const selectedVersionSampleCount=numericSampleCount(selectedVersion?.samples);
  const qualityCheckedSampleCount=qualityScope==='full'?selectedVersionSampleCount:Math.min(selectedVersionSampleCount,Math.max(1,Math.ceil(selectedVersionSampleCount*samplingRatio/100)));
  const qualityUncheckedSampleCount=Math.max(0,selectedVersionSampleCount-qualityCheckedSampleCount);
  const selectedTemplate=isSynthesis?PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===templateId):templateForDataset(selectedDataset);
  const datasetOptions=eligibleDatasets.filter(dataset=>{
    if(isQuality)return dataset.versions.length>0;
    if(isAugmentation)return dataset.versions.some(isFullQualityVersion);
    if(isExpansion)return dataset.versions.some(isFullQualityVersion);
    return true;
  }).map(dataset=>({value:dataset.id,label:`${dataset.name} / ${dataset.id}`}));
  const versionOptions=(selectedDataset?.versions||[]).filter(version=>{
    if(isQuality)return Boolean(selectedDataset.templateId);
    if(isAugmentation)return isFullQualityVersion(version);
    if(isExpansion)return isFullQualityVersion(version);
    return true;
  }).map(version=>({value:version.version,label:`${version.version} · ${numericSampleCount(version.samples).toLocaleString()} 条 · ${version.versionKind||'数据版本'}`}));
  const statusCounts=selectedVersion?.qualityReport?.statusCounts||{};
  const passCount=Number(statusCounts.PASS||0);
  const selectableCount=sampleSelection==='pass'?passCount:Math.min(numericSampleCount(selectedVersion?.samples),Math.round(numericSampleCount(selectedVersion?.samples)*(1-(selectionThreshold/100)*.45)));
  const privacyHits=selectedVersion?.qualityReport?.privacy?.initialRiskCount||selectedVersion?.qualityReport?.privacyHits||0;
  const coverageGaps=selectedVersion?.qualityReport?.coverageGaps||[];
  const selectedGapKeys=Form.useWatch('coverageGapKeys',form)||[];
  const [expansionTargetConfig,setExpansionTargetConfig]=useState({});
  const qualityExpansionTargets=(TEMPLATE_QUALITY_RULES[draft.modality]||[]).filter(rule=>!rule.id.includes('COVERAGE')).map((rule,index)=>({key:`quality-${rule.id}`,kind:'低质数据',dimension:rule.category,label:rule.name,ruleId:rule.id,currentScore:Math.max(68,92-index*2),defaultTargetScore:rule.privacy?100:90}));
  const expansionTargetRows=[...coverageGaps.map(item=>({...item,kind:'标签覆盖'})),...qualityExpansionTargets];
  const targetConfigFor=row=>expansionTargetConfig[row.key]||{};
  const suggestedGapFor=row=>row.kind==='标签覆盖'?Math.max(0,Number(targetConfigFor(row).target??row.target)-Number(row.pass||0)):Math.max(0,Math.ceil(selectedVersionSampleCount*Math.max(0,Number(targetConfigFor(row).targetScore??row.defaultTargetScore)-Number(row.currentScore||0))/100));
  const selectedGapTotal=expansionTargetRows.filter(item=>selectedGapKeys.includes(item.key)).reduce((sum,item)=>sum+suggestedGapFor(item),0);
  const customExpansionTotal=customExpansionEnabled?customExpansionSettings.reduce((sum,item)=>sum+Number(item?.count||0),0):0;
  const expansionEstimate=Math.max(targetCount,selectedGapTotal+customExpansionTotal);

  useEffect(()=>{
    if(!isSynthesis)return;
    const template=PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===templateId)||templatesForModality(draft.modality)[0];
    if(!template)return;
    if(draft.configSnapshot&&templateId===draft.configSnapshot.templateId){form.setFieldsValue({businessType:template.businessType});return;}
    form.setFieldsValue({templateId:template.id,businessType:template.businessType,generationModel:template.defaultModel,imageGenerationModel:template.imageModel,backgroundPrompt:template.backgroundPrompt,overrideBackgroundGeneration:false});
  },[draft.configSnapshot,draft.modality,form,isSynthesis,templateId]);
  useEffect(()=>{
    if(!selectedDataset)return;
    const template=templateForDataset(selectedDataset);
    form.setFieldsValue({businessType:selectedDataset.businessType,templateId:template?.id,targetDataset:selectedDataset.name,...(isQuality&&inputVersionId?{versionNote:`基于 ${inputVersionId} 的质检标注版本`}:{})});
    if(inputVersionId&&!selectedDataset.versions.some(version=>version.version===inputVersionId))form.setFieldValue('inputVersionId',undefined);
  },[form,inputDatasetId,selectedDataset,inputVersionId,isQuality]);
  useEffect(()=>{
    if(!draft.inputDatasetId)return;
    form.setFieldsValue({inputDatasetId:draft.inputDatasetId,inputVersionId:draft.inputVersionId});
  },[draft.inputDatasetId,draft.inputVersionId,form]);
  useEffect(()=>{
    if(!isAugmentation||draft.modality!=='文档图像')return;
    const current=form.getFieldsValue(['documentSemanticRules','semanticEnhancementModel','semanticEnhancementParametersEnabled','semanticEnhancementParameters','backgroundEnhancementModel']);
    form.setFieldsValue({
      documentSemanticRules:current.documentSemanticRules||['SEM-FIELD-COMBINATION'],
      semanticEnhancementModel:current.semanticEnhancementModel||'Qwen3-VL-8B-Instruct',
      semanticEnhancementParametersEnabled:current.semanticEnhancementParametersEnabled??false,
      semanticEnhancementParameters:current.semanticEnhancementParameters||'{\n  "temperature": 0.4,\n  "top_p": 0.9\n}',
      backgroundEnhancementModel:current.backgroundEnhancementModel||'Doubao-Seedream-4.0',
    });
  },[draft.modality,form,isAugmentation]);
  useEffect(()=>{
    if(isExpansion&&draft.modality==='文档图像'&&!draft.configSnapshot)form.setFieldValue('expansionModel','Doubao-Seedream-4.0');
  },[draft.configSnapshot,draft.modality,form,isExpansion]);

  const inputCard=!isSynthesis&&<Card className="task-step-card" title="选择输入数据版本">
    <Alert type="info" showIcon message="请选择本次任务的输入数据集和确定版本" description={isQuality?'可选择已绑定模板的数据版本。':'仅可选择已完成有效全量质检、具备样本级标签的版本。'}/>
    <Row gutter={16} className="section-title"><Col span={12}><Form.Item name="inputDatasetId" label="输入数据集" rules={[{required:true,message:'请选择输入数据集'}]}><Select showSearch optionFilterProp="label" options={datasetOptions}/></Form.Item></Col><Col span={12}><Form.Item name="inputVersionId" label="版本 ID" rules={[{required:true,message:'请选择版本 ID'}]}><Select showSearch optionFilterProp="label" options={versionOptions} disabled={!selectedDataset}/></Form.Item></Col></Row>
  </Card>;

  const synthesisFields=<>
    <Card className="task-step-card" title="已发布模板与生成设置">
      <Form.Item name="templateId" label="已发布模板" rules={[{required:true,message:'请选择已发布模板'}]}><Select showSearch optionFilterProp="label" options={templatesForModality(draft.modality).map(template=>({value:template.id,label:`${template.name} · ${template.businessType}`}))}/></Form.Item>
      <Divider orientation="left">本次批量生成设置</Divider>
      <Row gutter={16}><Col span={8}><Form.Item name="sampleCount" label={`样本数量（${draft.modality==='文档图像'?'张':draft.modality==='时序数据'?'票':'条'}）`} rules={[{required:true}]}><InputNumber min={1} max={100000} style={{width:'100%'}}/></Form.Item></Col>{draft.modality==='文档图像'&&<><Col span={8}><Form.Item name="resolution" label="成品分辨率"><Select options={['2480 × 1754','3508 × 2480','自定义'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={8}><Form.Item name="patternRatio" label="图案 / 印章出现比例"><InputNumber min={0} max={100} addonAfter="%" style={{width:'100%'}}/></Form.Item></Col></>}{draft.modality==='对话文本'&&<><Col span={8}><Form.Item name="minTurns" label="最少对话轮数"><InputNumber min={1} style={{width:'100%'}}/></Form.Item></Col><Col span={8}><Form.Item name="maxTurns" label="最多对话轮数"><InputNumber min={1} style={{width:'100%'}}/></Form.Item></Col></>}{draft.modality==='时序数据'&&<><Col span={8}><Form.Item name="timeSteps" label="时序数据步数"><InputNumber min={2} style={{width:'100%'}}/></Form.Item></Col><Col span={8}><Form.Item name="timeInterval" label="时间戳间隔"><Select options={['30秒','1分钟','5分钟','1小时'].map(value=>({value,label:value}))}/></Form.Item></Col></>}</Row>
      {(draft.modality==='文档图像'||draft.modality==='时序数据')&&<Form.Item name="randomSeed" label="随机种子（可选）" extra="用于可复现程序化渲染或规则引擎结果；纯 LLM 生成且模型不支持 Seed 时不会传入。"><InputNumber min={0} precision={0} style={{width:260}} placeholder="留空则每次随机"/></Form.Item>}
      {draft.modality==='时序数据'&&<Form.Item label="需要交付的模板输出参数"><Input value={selectedTemplate?.outputFields||'-'} disabled/></Form.Item>}
      {draft.modality==='对话文本'&&<Form.Item label="输出数据格式"><Input value={selectedTemplate?.outputFormat||'-'} disabled/></Form.Item>}
      <ModelWithParameters form={form}/>
      {draft.modality==='文档图像'&&selectedTemplate?.method==='底图生成法'&&<><Divider orientation="left">底图生成配置</Divider><Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>任务级覆盖</Text><div><Text type="secondary">默认锁定模板中的图像模型和底图 Prompt；开启后仅覆盖本次任务。</Text></div></div><Form.Item name="overrideBackgroundGeneration" valuePropName="checked" noStyle><Switch/></Form.Item></Flex><Row gutter={16}><Col span={8}><Form.Item name="imageGenerationModel" label="图像生成模型"><Select disabled={!overrideBackgroundGeneration} options={['Doubao-Seedream-4.0','Qwen-Image'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={16}><Form.Item name="backgroundPrompt" label="底图生成 Prompt"><Input.TextArea rows={4} disabled={!overrideBackgroundGeneration}/></Form.Item></Col></Row></>}
      <Divider orientation="left">配置来源</Divider><Alert type="info" showIcon message="业务类型、结构、字段和规则来自模板" description="本页只覆盖样本规模和运行参数；增强、质检与定向扩增已拆分为独立任务。"/>
      <Divider orientation="left">API 调用次数预估</Divider><ApiEstimate items={[{label:'生成模型',value:sampleCount},{label:'图像模型',value:draft.modality==='文档图像'&&selectedTemplate?.method==='底图生成法'?sampleCount:0}]}/>
    </Card>
    <Card className="task-step-card section-title" title="结果写入"><OutputConfig form={form} datasets={datasets.filter(dataset=>dataset.templateId===selectedTemplate?.id)} modality={draft.modality}/></Card>
  </>;

  const qualityFields=<Card className="task-step-card section-title" title="质检运行设置">
    <Form.Item name="qualityScope" label="质检范围" rules={[{required:true}]}><Radio.Group optionType="button" buttonStyle="solid" options={[{value:'full',label:'全量质检'},{value:'sample',label:'部分抽检'}]}/></Form.Item>
    {qualityScope==='sample'&&<Row gutter={16}><Col span={8}><Form.Item name="samplingRatio" label="抽检比例" rules={[{required:true,message:'请输入抽检比例'}]}><InputNumber min={1} max={100} precision={0} addonAfter="%" style={{width:'100%'}}/></Form.Item></Col><Col span={16}><div style={{paddingTop:28}}><Text strong>{`本次预计抽检 ${qualityCheckedSampleCount.toLocaleString()} 条`}</Text><div><Text type="secondary">{`输入版本共 ${selectedVersionSampleCount.toLocaleString()} 条，输出版本仍保留全部样本；其余 ${qualityUncheckedSampleCount.toLocaleString()} 条写入“未质检”标签。`}</Text></div></div></Col></Row>}
    <Descriptions bordered size="small" column={3} items={[{key:'range',label:'质检执行范围',children:<Tag color={qualityScope==='full'?'blue':'orange'}>{qualityScope==='full'?'全部数据':`部分抽检 ${samplingRatio}%`}</Tag>},{key:'sample',label:'预计检查样本',children:qualityCheckedSampleCount.toLocaleString()},{key:'target',label:'目标数据集',children:selectedDataset?.name||'-'}]}/>
    <Divider orientation="left">质检模型覆盖</Divider><ModelWithParameters form={form} modelName="qualityModel" parameterSwitchName="qualityParametersEnabled" parameterName="qualityParameters" label="质检模型"/>
    <Divider orientation="left">结果写入</Divider><Form.Item name="targetDataset" label="目标数据集"><Input disabled/></Form.Item><Form.Item name="versionNote" label="输出版本描述" rules={[{required:true}]}><Input/></Form.Item>
    <Alert type="success" showIcon message="质检成功后只创建 1 个新版本" description={qualityScope==='full'?'新版本样本数与输入版本一致；全部样本写入质检结论和逐规则结果。':'新版本样本数与输入版本一致；抽中样本写入质检结论和逐规则结果，未抽中样本统一写入“未质检”标签。'}/>
    <Divider orientation="left">API 调用次数预估</Divider><ApiEstimate items={[{label:'语义质检',value:qualityCheckedSampleCount*semanticRuleCount},{label:'本地规则',value:0}]}/>
  </Card>;

  const conversationSemanticMethods=['表达同义改写','无关上下文注入','规则绕过对抗样本'];
  const timeseriesEventSemanticMethods=['计划性断网上报'];
  const timeseriesParameterMethods=['传感器轻微抖动','时间平移','GPS 微扰'];
  const documentSemanticPresetRules=[
    {id:'SEM-FIELD-COMBINATION',name:'业务字段组合变体',prompt:'在不改变模板字段契约和业务逻辑的前提下，生成新的合理业务字段组合，并同步更新图像文字与 Ground Truth。'},
    {id:'SEM-LONG-TEXT',name:'长文本字段语义改写',prompt:'对备注、商品描述等长文本字段进行语义等价改写，保持事实、数字、代码和字段含义一致。'},
    {id:'SEM-RARE-VALUE',name:'稀缺字段取值补充',prompt:'根据模板允许的枚举和字段依赖关系，生成低覆盖但合法的字段取值组合。'},
  ];
  const documentImageMethods=['文档退化','旋转 / 透视 / 亮度变化','折痕','扫描 / 复印','污渍','标注同步'];
  const documentBackgroundMethods=['桌面拍摄背景','文件夹衬底背景','扫描边缘背景'];
  const documentAugmentationConfig=<>
    <Divider orientation="left">增强类型</Divider>
    <Descriptions bordered size="small" column={1} items={[{key:'privacy',label:<Space><Text>隐私增强</Text><Tag color="blue">必选</Tag></Space>,children:'系统固定执行隐私检查，并按照下方配置处理命中的敏感内容；该能力不能取消。'}]}/>
    <Form.Item name="documentEnhancementTypes" initialValue={['图像增强']} label="其他增强类型（可多选）" className="section-title"><Checkbox.Group options={['语义增强','图像增强','背景增强']}/></Form.Item>
    {documentEnhancementTypes.includes('语义增强')&&<Card size="small" title="语义增强" className="section-title"><Table size="small" rowKey="id" pagination={false} dataSource={documentSemanticPresetRules} rowSelection={{selectedRowKeys:Form.useWatch('documentSemanticRules',form)||[],onChange:keys=>form.setFieldValue('documentSemanticRules',keys)}} columns={[{title:'预置规则名称 / ID',width:230,render:(_,rule)=><div><Text strong>{rule.name}</Text><div className="muted-id">{rule.id}</div></div>},{title:'Prompt',dataIndex:'prompt'}]}/><Flex justify="space-between" align="center" className="form-switch-line section-title"><div><Text strong>自定义语义增强规则</Text><div><Text type="secondary">填写规则名称和 Prompt，不支持上传或执行用户代码</Text></div></div><Form.Item name="documentSemanticCustomEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>{documentSemanticCustomEnabled&&<Row gutter={16}><Col span={8}><Form.Item name="documentSemanticCustomName" label="规则名称" rules={[{required:true}]}><Input/></Form.Item></Col><Col span={16}><Form.Item name="documentSemanticCustomPrompt" label="Prompt" rules={[{required:true}]}><Input.TextArea rows={4}/></Form.Item></Col></Row>}<Divider orientation="left">语义增强生成模型</Divider><ModelWithParameters form={form} modelName="semanticEnhancementModel" parameterSwitchName="semanticEnhancementParametersEnabled" parameterName="semanticEnhancementParameters" label="VLM 生成模型"/></Card>}
    {documentEnhancementTypes.includes('图像增强')&&<Card size="small" title="图像增强" className="section-title"><Form.Item name="documentImageMethods" initialValue={['文档退化','旋转 / 透视 / 亮度变化','标注同步']} label="预置图像增强方式" rules={[{required:true,message:'请选择至少一种图像增强方式'}]}><Checkbox.Group options={documentImageMethods}/></Form.Item><Text type="secondary">图像增强仅支持系统预置方式，不提供自定义规则。</Text></Card>}
    {documentEnhancementTypes.includes('背景增强')&&<Card size="small" title="背景增强" className="section-title"><Form.Item name="documentBackgroundMethods" label="预置背景增强方式" rules={[{required:true,message:'请选择至少一种背景增强方式'}]}><Checkbox.Group options={documentBackgroundMethods}/></Form.Item><Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义背景增强规则</Text><div><Text type="secondary">填写规则名称和 Prompt</Text></div></div><Form.Item name="documentBackgroundCustomEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>{documentBackgroundCustomEnabled&&<Row gutter={16}><Col span={8}><Form.Item name="documentBackgroundCustomName" label="规则名称" rules={[{required:true}]}><Input/></Form.Item></Col><Col span={16}><Form.Item name="documentBackgroundCustomPrompt" label="Prompt" rules={[{required:true}]}><Input.TextArea rows={4}/></Form.Item></Col></Row>}<Divider orientation="left">背景生成模型</Divider><Form.Item name="backgroundEnhancementModel" label="图像生成模型" rules={[{required:true,message:'请选择图像生成模型'}]}><Select options={['Doubao-Seedream-4.0','Qwen-Image'].map(value=>({value,label:value}))}/></Form.Item></Card>}
  </>;
  const conversationAugmentationConfig=<>
    <Divider orientation="left">语义增强</Divider>
    <Form.Item name="conversationSemanticMethods" initialValue={['表达同义改写']} label="预置语义增强规则"><Checkbox.Group options={conversationSemanticMethods}/></Form.Item>
    <Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义语义增强规则</Text><div><Text type="secondary">填写规则名称和增强 Prompt，可与预置规则组合执行</Text></div></div><Form.Item name="customEnhancementEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
    {customEnhancementEnabled&&<Row gutter={16}><Col span={8}><Form.Item name="customEnhancementName" label="规则名称" rules={[{required:true,message:'请输入规则名称'}]}><Input/></Form.Item></Col><Col span={16}><Form.Item name="customEnhancementPrompt" label="增强 Prompt" rules={[{required:true,message:'请输入增强 Prompt'}]}><Input.TextArea rows={4}/></Form.Item></Col></Row>}
    <Divider orientation="left">隐私增强</Divider>
    <Descriptions bordered size="small" column={1} items={[{key:'privacy',label:<Space><Text>隐私增强</Text><Tag color="blue">必选</Tag></Space>,children:'系统固定检查并处理质检报告命中的隐私内容，该增强类型不可取消。'}]}/>
    <Form.Item name="conversationPrivacyMethod" initialValue="部分掩码" label="脱敏方式" className="section-title" rules={[{required:true,message:'请选择脱敏方式'}]}><Select options={['部分掩码','全掩码','删除','泛化','随机替换','虚构替换'].map(value=>({value,label:value}))}/></Form.Item>
    <Alert type={privacyHits>0?'warning':'info'} showIcon message={privacyHits>0?`质检报告发现 ${privacyHits} 条隐私命中`:'质检报告暂未发现隐私命中'} description="增强任务仍会执行隐私检查；发现敏感内容时统一采用所选脱敏方式，并在增强后复检。"/>
  </>;
  const timeseriesAugmentationConfig=<>
    <Divider orientation="left">事件语义增强</Divider>
    <Form.Item name="timeseriesEventMethods" initialValue={['计划性断网上报']} label="预置事件语义增强规则"><Checkbox.Group options={timeseriesEventSemanticMethods}/></Form.Item>
    <Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义事件语义增强规则</Text><div><Text type="secondary">填写规则名称和 Prompt，用于调整或生成时序事件内容</Text></div></div><Form.Item name="timeseriesEventCustomEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
    {timeseriesEventCustomEnabled&&<Row gutter={16}><Col span={8}><Form.Item name="timeseriesEventCustomName" label="规则名称" rules={[{required:true,message:'请输入规则名称'}]}><Input/></Form.Item></Col><Col span={16}><Form.Item name="timeseriesEventCustomPrompt" label="增强 Prompt" rules={[{required:true,message:'请输入增强 Prompt'}]}><Input.TextArea rows={4}/></Form.Item></Col></Row>}
    <Divider orientation="left">输出参数增强</Divider>
    <Form.Item name="timeseriesParameterMethods" initialValue={['传感器轻微抖动','时间平移']} label="预置输出参数增强规则"><Checkbox.Group options={timeseriesParameterMethods}/></Form.Item>
    <Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义输出参数增强规则</Text><div><Text type="secondary">填写规则名称和 Prompt，用于调整模板定义的时序输出参数</Text></div></div><Form.Item name="timeseriesParameterCustomEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
    {timeseriesParameterCustomEnabled&&<Row gutter={16}><Col span={8}><Form.Item name="timeseriesParameterCustomName" label="规则名称" rules={[{required:true,message:'请输入规则名称'}]}><Input/></Form.Item></Col><Col span={16}><Form.Item name="timeseriesParameterCustomPrompt" label="增强 Prompt" rules={[{required:true,message:'请输入增强 Prompt'}]}><Input.TextArea rows={4}/></Form.Item></Col></Row>}
    <Divider orientation="left">隐私增强</Divider>
    <Descriptions bordered size="small" column={1} items={[{key:'privacy',label:<Space><Text>隐私增强</Text><Tag color="blue">必选</Tag></Space>,children:'系统固定检查设备标识、车辆标识、人员信息、路线业务编号和事件文本中的敏感信息，该增强类型不可取消。'}]}/>
    <Form.Item name="timeseriesPrivacyMethod" initialValue="虚构替换" label="脱敏方式" className="section-title" rules={[{required:true,message:'请选择脱敏方式'}]}><Select options={['部分掩码','全掩码','删除','泛化','随机替换','虚构替换'].map(value=>({value,label:value}))}/></Form.Item>
    <Alert type={privacyHits>0?'warning':'info'} showIcon message={privacyHits>0?`质检报告发现 ${privacyHits} 条隐私命中`:'质检报告暂未发现隐私命中'} description="增强任务仍会执行隐私检查；命中后采用所选方式处理，并校验同一序列内标识的一致性。"/>
  </>;
  const augmentationFields=<Card className="task-step-card section-title" title="数据增强设置">
    {selectedVersion&&<><Title level={5}>依据质检结果</Title><QualityStatusSummary counts={statusCounts} total={numericSampleCount(selectedVersion.samples)}/></>}
    <Divider orientation="left">增强样本选择</Divider><Form.Item name="sampleSelection"><Radio.Group optionType="button" buttonStyle="solid" options={[{value:'pass',label:'全部 PASS 样本'},{value:'threshold',label:'自定义选样阈值'}]}/></Form.Item>{sampleSelection==='threshold'&&<Form.Item name="selectionThreshold" label="增强选样阈值"><Slider min={0} max={100} marks={{0:'0',75:'75',100:'100'}}/></Form.Item>}<Alert type="info" showIcon message={`预计可选 ${selectableCount.toLocaleString()} 条样本`} description="该阈值只控制本次增强选样，不会修改模板 PASS 门槛和已有质检结论。"/>
    {draft.modality==='文档图像'?documentAugmentationConfig:draft.modality==='对话文本'?conversationAugmentationConfig:timeseriesAugmentationConfig}
    <Row gutter={16}><Col span={12}><Form.Item name="targetCount" label="目标新增数量"><InputNumber min={1} max={selectableCount||100000} style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item name="enhancementIntensity" label="增强强度"><Select options={['轻度','中等','重度'].map(value=>({value,label:value}))}/></Form.Item></Col></Row>
    {draft.modality==='文档图像'&&<><Divider orientation="left">隐私增强配置</Divider><Alert type={privacyHits>0?'warning':'info'} showIcon message={privacyHits>0?`质检报告发现 ${privacyHits} 条隐私命中`:'质检报告暂未发现隐私命中'} description="隐私增强为固定必选项；系统仍会执行隐私检查，命中后按配置处理，并在增强完成后复检。"/>{privacyHits>0&&<Table size="small" pagination={false} rowKey="type" dataSource={[{type:'姓名与联系方式',count:Math.max(1,Math.round(privacyHits*.5)),location:'字段值 / 对话正文',defaultMethod:'部分掩码'},{type:'地址与业务编号',count:Math.max(1,privacyHits-Math.max(1,Math.round(privacyHits*.5))),location:'地址、订单号及单证编号',defaultMethod:'虚构替换'}]} columns={[{title:'敏感信息类型',dataIndex:'type'},{title:'命中数',dataIndex:'count'},{title:'样例定位',dataIndex:'location'},{title:'脱敏方式',render:(_,item)=><Form.Item name={['privacyMethods',item.type]} initialValue={item.defaultMethod} noStyle rules={[{required:true}]}><Select style={{width:150}} options={['部分掩码','全掩码','删除','泛化','随机替换','虚构替换'].map(value=>({value,label:value}))}/></Form.Item>}]}/>}</>}
    {draft.modality!=='文档图像'&&<><Divider orientation="left">增强模型</Divider><ModelWithParameters form={form} modelName="enhancementModel" parameterSwitchName="enhancementParametersEnabled" parameterName="enhancementParameters" label="增强模型"/></>}
    <Divider orientation="left">结果写入与自动复检</Divider><Form.Item name="targetDataset" label="目标数据集"><Input disabled/></Form.Item><Form.Item name="versionNote" label="增强版本描述" rules={[{required:true}]}><Input/></Form.Item><Alert type="success" showIcon message="增强和自动复检完成后只创建 1 个增强版本" description="增强数据、样本级复检标签和复检报告写入同一个版本；工作区中间产物不计入版本数。"/>
    <Divider orientation="left">API 调用次数预估</Divider><ApiEstimate items={draft.modality==='文档图像'?[{label:'语义增强 VLM',value:documentEnhancementTypes.includes('语义增强')?targetCount:0},{label:'背景图像模型',value:documentEnhancementTypes.includes('背景增强')?targetCount:0},{label:'语义复检',value:targetCount*semanticRuleCount}]:[{label:'增强模型',value:targetCount},{label:'语义复检',value:targetCount*semanticRuleCount}]}/>
  </Card>;

  const expansionFields=<Card className="task-step-card section-title" title="定向扩增设置">
    <Alert type="info" showIcon message="扩增目标来自输入版本的正式质检报告" description="既可以补齐标签覆盖缺口，也可以针对低分质检项生成替代或补充样本；目标值允许按本次任务调整。"/>
    <Form.Item name="coverageGapKeys" hidden><Input/></Form.Item>
    <Table className="section-title" rowKey="key" size="small" pagination={false} dataSource={expansionTargetRows} columns={[
      {title:<Checkbox checked={selectedGapKeys.length===expansionTargetRows.length&&expansionTargetRows.length>0} indeterminate={selectedGapKeys.length>0&&selectedGapKeys.length<expansionTargetRows.length} onChange={event=>form.setFieldValue('coverageGapKeys',event.target.checked?expansionTargetRows.map(row=>row.key):[])} />,width:48,render:(_,row)=><Checkbox checked={selectedGapKeys.includes(row.key)} onChange={event=>form.setFieldValue('coverageGapKeys',event.target.checked?[...new Set([...selectedGapKeys,row.key])]:selectedGapKeys.filter(key=>key!==row.key))}/>},
      {title:'扩增目标类型',dataIndex:'kind',width:110,render:value=><Tag color={value==='标签覆盖'?'blue':'orange'}>{value}</Tag>},
      {title:'目标项目',width:230,render:(_,row)=><div><Text strong>{row.label}</Text><div className="muted-id">{row.kind==='标签覆盖'?row.dimension:row.ruleId}</div></div>},
      {title:'当前值',width:130,render:(_,row)=>row.kind==='标签覆盖'?`${Number(row.pass||0).toLocaleString()} 条`:`${row.currentScore} 分`},
      {title:'扩增目标（可编辑）',width:190,render:(_,row)=>row.kind==='标签覆盖'?<InputNumber min={Number(row.pass||0)} max={100000} value={targetConfigFor(row).target??row.target} addonAfter="条" onChange={value=>setExpansionTargetConfig(config=>({...config,[row.key]:{...config[row.key],target:value}}))}/>:<InputNumber min={0} max={100} value={targetConfigFor(row).targetScore??row.defaultTargetScore} addonAfter="分" onChange={value=>setExpansionTargetConfig(config=>({...config,[row.key]:{...config[row.key],targetScore:value}}))}/>},
      {title:'建议扩增数',width:140,render:(_,row)=><Text strong>{suggestedGapFor(row).toLocaleString()} 条</Text>},
    ]}/>
    <Row gutter={16} className="section-title"><Col span={12}><Form.Item name="targetCount" label="最大新增样本数" rules={[{required:true}]}><InputNumber min={Math.max(1,selectedGapTotal)} max={100000} style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item label="已选目标建议合计"><Input value={`${selectedGapTotal.toLocaleString()} 条`} disabled/></Form.Item></Col></Row>
    <Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义扩增设置</Text><div><Text type="secondary">可添加多组目标标签或低质项、数量、指令和独立模型配置</Text></div></div><Form.Item name="customExpansionEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>{customExpansionEnabled&&<Form.List name="customExpansionSettings">{(fields,{add,remove})=><Space direction="vertical" size={12} style={{width:'100%'}}>{fields.map((field,index)=><Card key={field.key} size="small" title={`自定义设置 ${index+1}`} extra={<Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>remove(field.name)}>删除</Button>}><Row gutter={16}><Col span={6}><Form.Item name={[field.name,'name']} label="设置名称" rules={[{required:true}]}><Input/></Form.Item></Col><Col span={8}><Form.Item name={[field.name,'labels']} label="扩增目标组合" rules={[{required:true}]}><Select mode="multiple" options={expansionTargetRows.map(item=>({value:item.label,label:`${item.kind} · ${item.label}`}))}/></Form.Item></Col><Col span={4}><Form.Item name={[field.name,'count']} label="目标数量" rules={[{required:true}]}><InputNumber min={1} style={{width:'100%'}}/></Form.Item></Col><Col span={6}><Form.Item name={[field.name,'model']} label={draft.modality==='文档图像'?'图像生成模型':'生成模型'} rules={[{required:true}]}><Select options={['Qwen3-14B','Qwen3-VL-8B-Instruct','Doubao-Seedream-4.0','DeepSeek-V3.1'].map(value=>({value,label:value}))}/></Form.Item></Col></Row><Form.Item name={[field.name,'prompt']} label="扩增指令" rules={[{required:true}]}><Input.TextArea rows={3}/></Form.Item><Form.Item name={[field.name,'parameters']} label="生成参数 JSON（可选）" rules={[{validator:(_,value)=>{if(!value)return Promise.resolve();try{JSON.parse(value);return Promise.resolve();}catch{return Promise.reject(new Error('请输入合法 JSON'));}}}]}><Input.TextArea rows={3} className="json-textarea" placeholder={'{\n  "temperature": 0.8\n}'}/></Form.Item></Card>)}<Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({model:draft.modality==='文档图像'?'Doubao-Seedream-4.0':'Qwen3-14B',parameters:'{\n  "temperature": 0.8\n}'})}>新增自定义扩增设置</Button></Space>}</Form.List>}
    <Divider orientation="left">{draft.modality==='文档图像'?'图像生成模型':'生成模型'}</Divider><ModelWithParameters form={form} modelName="expansionModel" parameterSwitchName="expansionParametersEnabled" parameterName="expansionParameters" label={draft.modality==='文档图像'?'图像生成模型':'生成模型'}/>
    <Divider orientation="left">结果写入与自动复检</Divider><Form.Item name="targetDataset" label="目标数据集"><Input disabled/></Form.Item><Form.Item name="versionNote" label="扩增版本描述" rules={[{required:true}]}><Input/></Form.Item><Alert type="success" showIcon message="扩增和自动复检完成后只创建 1 个扩增版本" description="扩增数据、样本级复检标签和复检报告写入同一个版本；不会额外创建复检版本。"/>
    <Divider orientation="left">API 调用次数预估</Divider><ApiEstimate items={[{label:draft.modality==='文档图像'?'图像生成模型':'生成模型',value:expansionEstimate},{label:'语义复检',value:expansionEstimate*semanticRuleCount}]}/>
  </Card>;

  const submit=async()=>{
    if(submitting)return;setSubmitting(true);
    try{
      const values=await form.validateFields();
      if(!isSynthesis&&!selectedVersion)throw new Error('请选择有效的输入数据集版本');
      if(isAugmentation&&draft.modality==='文档图像'&&values.documentEnhancementTypes?.includes('语义增强')&&!values.documentSemanticRules?.length&&!values.documentSemanticCustomEnabled)throw new Error('语义增强至少选择一条预置规则或配置一条自定义规则');
      if(isAugmentation&&draft.modality==='文档图像'&&values.documentEnhancementTypes?.includes('背景增强')&&!values.documentBackgroundMethods?.length&&!values.documentBackgroundCustomEnabled)throw new Error('背景增强至少选择一种预置方式或配置一条自定义规则');
      if(isAugmentation&&draft.modality==='对话文本'&&!values.conversationSemanticMethods?.length&&!values.customEnhancementEnabled)throw new Error('请选择至少一条预置语义增强规则，或添加一条自定义语义增强规则');
      if(isAugmentation&&draft.modality==='时序数据'&&!values.timeseriesEventMethods?.length&&!values.timeseriesParameterMethods?.length&&!values.timeseriesEventCustomEnabled&&!values.timeseriesParameterCustomEnabled)throw new Error('请至少选择或添加一条事件语义增强或输出参数增强规则');
      if(isExpansion&&!selectedGapKeys.length&&!values.customExpansionEnabled)throw new Error('请选择至少一个系统建议项，或开启自定义扩增设置');
      if(isExpansion&&targetCount<selectedGapTotal+customExpansionTotal)throw new Error('最大新增样本数不能小于系统建议与自定义设置的目标数量合计');
      const template=isSynthesis?PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===values.templateId):selectedTemplate;
      const output=isSynthesis?values.outputMode==='newVersion'?`${values.targetDataset} / 新版本`:values.outputDatasetName:`${selectedDataset.name} / 新版本`;
      const input=isSynthesis?`${template.name} / ${template.version}`:`${selectedDataset.name} / ${selectedVersion.version}`;
      onSubmit({...draft,...values,expansionTargetConfig,effectiveTargetCount:isExpansion?expansionEstimate:targetCount,qualityCheckedSampleCount:isQuality?qualityCheckedSampleCount:undefined,qualityUncheckedSampleCount:isQuality?qualityUncheckedSampleCount:undefined,businessType:template.businessType,stages:[draft.taskType],input,output,templateProfile:template,qualityRules:TEMPLATE_QUALITY_RULES[draft.modality]||[],inputDatasetId:selectedDataset?.id,inputVersionId:selectedVersion?.version,sourceVersion:selectedVersion});
    }catch(error){if(!error?.errorFields)message.error(error.message||'任务提交失败');else message.warning('请完成必填配置');}finally{setSubmitting(false);}
  };
  const initialTemplate=templatesForModality(draft.modality)[0];
  const evidenceContent=isSynthesis?<TemplateEvidence template={selectedTemplate} modality={draft.modality}/>:isQuality?<QualityRulesEvidence template={selectedTemplate} modality={draft.modality}/>:<QualityReportEvidence dataset={selectedDataset} version={selectedVersion}/>;
  const configurationContent=isSynthesis?synthesisFields:<>{inputCard}{selectedVersion?(isQuality?qualityFields:isAugmentation?augmentationFields:expansionFields):<Card className="task-step-card section-title"><Empty description="选择输入数据集和版本后显示本次任务配置"/></Card>}</>;
  return <div className="create-task-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label={`返回${modalityLabel}任务列表`} onClick={onCancel}/><Title level={3}>{taskPageTitle}</Title></Space><Space><Button disabled={submitting} onClick={()=>message.success('草稿已保存')}>保存草稿</Button><Button type="primary" loading={submitting} onClick={submit}>提交任务</Button></Space></Flex>
    <Form form={form} layout="vertical" initialValues={{name:draft.name,description:draft.description,templateId:draft.templateId||initialTemplate?.id,businessType:initialTemplate?.businessType,sampleCount:20,resolution:'2480 × 1754',patternRatio:60,minTurns:3,maxTurns:8,timeSteps:100,timeInterval:'5分钟',generationModel:initialTemplate?.defaultModel||'Qwen3-14B',generationParametersEnabled:false,generationParameters:'{\n  "temperature": 0.7,\n  "top_p": 0.9\n}',overrideBackgroundGeneration:false,imageGenerationModel:initialTemplate?.imageModel,backgroundPrompt:initialTemplate?.backgroundPrompt,qualityScope:'full',samplingRatio:10,qualityModel:'Qwen3-VL-8B-Instruct',qualityParametersEnabled:false,qualityParameters:'{\n  "temperature": 0.1\n}',enhancementModel:'Qwen3-14B',enhancementParametersEnabled:false,enhancementParameters:'{\n  "temperature": 0.7\n}',expansionModel:'Qwen3-14B',expansionParametersEnabled:false,expansionParameters:'{\n  "temperature": 0.8\n}',outputMode:'newDataset',outputDatasetName:`${initialTemplate?.businessType||''}数据集`,versionNote:isQuality?'质检标注版本':isAugmentation?'数据增强与自动复检版本':isExpansion?'定向扩增与自动复检版本':'数据合成结果',sampleSelection:'pass',selectionThreshold:75,targetCount:100,enhancementIntensity:'中等',customEnhancementEnabled:false,customExpansionEnabled:false,customExpansionSettings:[{name:'',labels:[],count:20,prompt:'',model:'Qwen3-14B',parameters:'{\n  "temperature": 0.8\n}'}],...(draft.configSnapshot||{}),inputDatasetId:draft.inputDatasetId,inputVersionId:draft.inputVersionId}}>
      <Card className="task-fixed-header"><Row gutter={20} align="bottom"><Col span={12}><Form.Item name="name" label="任务名称" rules={[{required:true,message:'请输入任务名称'}]}><Input maxLength={50}/></Form.Item></Col><Col span={12}><Form.Item name="description" label="任务描述"><Input maxLength={200} placeholder="可选，最多 200 字"/></Form.Item></Col></Row></Card>
      <div className="task-two-column-layout"><section className="task-configuration-column"><div className="task-column-heading"><div><Title level={5}>本次任务配置</Title><Text type="secondary">以下内容会写入本次任务配置快照</Text></div></div>{configurationContent}</section><aside className="task-evidence-column"><div className="task-column-heading"><div><Title level={5}>任务依据</Title><Text type="secondary">来自上游模板或质检结果，不可在本任务中修改</Text></div></div>{evidenceContent}</aside></div>
    </Form>
  </div>;
}

function prototypeTaskId(seed=Date.now()) {
  const stamp=nowDateTime().slice(0,10).replaceAll('-','');
  return `TASK-${stamp}-${String(parseInt(fixedHashId(seed).slice(0,6),16)%10000).padStart(4,'0')}`;
}

function commitPrototypeTaskOutput(values, taskId, versionId, setDatasets) {
  const now=nowDateTime();
  const template=values.templateProfile;
  setDatasets(items=>{
    const selectedDataset=items.find(dataset=>dataset.id===values.inputDatasetId);
    const selectedVersion=selectedDataset?.versions.find(version=>version.version===values.inputVersionId);
    const sourceForSynthesis=values.outputMode==='newVersion'?items.find(dataset=>dataset.name===values.targetDataset):null;
    const sourceDataset=values.taskType==='数据合成'?sourceForSynthesis:selectedDataset;
    const sourceVersion=values.taskType==='数据合成'?sourceForSynthesis?.versions.find(version=>version.version===sourceForSynthesis.defaultVersion):selectedVersion;
    const sampleCount=values.taskType==='数据质检'?numericSampleCount(sourceVersion?.samples):values.taskType==='数据合成'?Number(values.sampleCount||0):Number(values.effectiveTargetCount||values.targetCount||0);
    const partialQuality=values.taskType==='数据质检'&&values.qualityScope==='sample';
    const versionKind=values.taskType==='数据质检'?(partialQuality?'抽检标注':'质检标注'):{数据合成:'合成',数据增强:'增强',定向扩增:'定向扩增'}[values.taskType];
    const qualityChecked=values.taskType!=='数据合成';
    const checkedSampleCount=partialQuality?Math.min(sampleCount,Number(values.qualityCheckedSampleCount||0)):qualityChecked?sampleCount:0;
    const nextVersion={
      id:versionId,version:versionId,note:values.versionNote,versionKind,source:taskId,sourceName:values.name,
      samples:sampleCount,created:now,updatedAt:now,consumers:[],qualityChecked,fullQualityChecked:qualityChecked&&!partialQuality,checkedSampleCount,
      templateId:template?.id,templateVersion:template?.version,
      sourceDatasetId:sourceDataset?.id||null,sourceVersionId:sourceVersion?.version||null,
      taskConfigSnapshot:values,
    };
    if(qualityChecked){
      nextVersion.quality=93.6;
      nextVersion.qualityReportId=`QREPORT-${fixedHashId(`${taskId}-${versionId}`)}`;
      nextVersion.qualityReport=buildVersionQualityReport(values.modality,nextVersion);
      nextVersion.qualityReport={...nextVersion.qualityReport,reportId:nextVersion.qualityReportId,inputVersionId:sourceVersion?.version,outputVersionId:versionId,templateId:template?.id,templateVersion:template?.version,executionRange:partialQuality?'sample':'full',samplingRatio:partialQuality?Number(values.samplingRatio):100,checkedSampleCount,uncheckedSampleCount:Math.max(0,sampleCount-checkedSampleCount),ruleSnapshot:values.qualityRules||[]};
      nextVersion.sampleQualityLabels={schemaVersion:'sample-quality/v1',coverage:partialQuality?'partial':'full',checkedSampleCount,uncheckedSampleCount:Math.max(0,sampleCount-checkedSampleCount),uncheckedLabel:'未质检',fields:['overall_score','overall_result','rule_results','issue_labels']};
      if(values.taskType==='数据增强')nextVersion.enhancementSettings={sampleSelection:values.sampleSelection,selectionThreshold:values.selectionThreshold,directions:null,methods:values.modality==='文档图像'?['隐私增强',...(values.documentEnhancementTypes||[])]:values.modality==='对话文本'?['隐私增强',...(values.conversationSemanticMethods||[])]:['隐私增强',...(values.timeseriesEventMethods||[]),...(values.timeseriesParameterMethods||[])],mandatoryPrivacy:true,documentConfig:values.modality==='文档图像'?{semanticRuleIds:values.documentSemanticRules||[],imageMethods:values.documentImageMethods||[],backgroundMethods:values.documentBackgroundMethods||[],semanticCustom:values.documentSemanticCustomEnabled?{name:values.documentSemanticCustomName,prompt:values.documentSemanticCustomPrompt}:null,backgroundCustom:values.documentBackgroundCustomEnabled?{name:values.documentBackgroundCustomName,prompt:values.documentBackgroundCustomPrompt}:null,semanticModel:values.documentEnhancementTypes?.includes('语义增强')?{model:values.semanticEnhancementModel,parametersEnabled:values.semanticEnhancementParametersEnabled,parameters:values.semanticEnhancementParameters}:null,backgroundModel:values.documentEnhancementTypes?.includes('背景增强')?values.backgroundEnhancementModel:null}:null,timeseriesConfig:values.modality==='时序数据'?{eventMethods:values.timeseriesEventMethods||[],parameterMethods:values.timeseriesParameterMethods||[],eventCustom:values.timeseriesEventCustomEnabled?{name:values.timeseriesEventCustomName,prompt:values.timeseriesEventCustomPrompt}:null,parameterCustom:values.timeseriesParameterCustomEnabled?{name:values.timeseriesParameterCustomName,prompt:values.timeseriesParameterCustomPrompt}:null}:null,custom:values.modality==='对话文本'&&values.customEnhancementEnabled?{name:values.customEnhancementName,prompt:values.customEnhancementPrompt}:null,privacyMethod:values.modality==='对话文本'?values.conversationPrivacyMethod:values.modality==='时序数据'?values.timeseriesPrivacyMethod:null,privacyMethods:values.privacyMethods||null};
      if(values.taskType==='定向扩增')nextVersion.expansionSettings={targetKeys:values.coverageGapKeys,targetConfig:values.expansionTargetConfig||{},coverageGapKeys:(values.coverageGapKeys||[]).filter(key=>!String(key).startsWith('quality-')),qualityRuleKeys:(values.coverageGapKeys||[]).filter(key=>String(key).startsWith('quality-')),customSettings:values.customExpansionEnabled?values.customExpansionSettings||[]:[]};
    }
    const linkConsumer=dataset=>({...dataset,versions:dataset.versions.map(version=>version.version===sourceVersion?.version?{...version,consumers:[{id:taskId,name:values.name,taskType:values.taskType,updatedAt:now,status:'已完成'},...(version.consumers||[])]}:version)});
    if(values.taskType==='数据合成'&&values.outputMode==='newDataset'){
      const datasetId=createDatasetId(`${taskId}-${values.outputDatasetName}`,now);
      return [{id:datasetId,name:values.outputDatasetName,modality:values.modality,businessType:template?.businessType,status:'可用',desc:values.description||`由${template?.name||'已发布模板'}批量合成。`,defaultVersion:versionId,totalSamples:sampleCount,reference:true,sourceType:'任务生成',updatedAt:now,templateId:template?.id,templateVersion:template?.version,versions:[nextVersion]},...items];
    }
    return items.map(dataset=>{
      if(dataset.id!==sourceDataset?.id)return dataset;
      const linked=linkConsumer(dataset);
      return {...linked,defaultVersion:versionId,totalSamples:values.taskType==='数据质检'?numericSampleCount(dataset.totalSamples):numericSampleCount(dataset.totalSamples)+sampleCount,updatedAt:now,templateId:template?.id||dataset.templateId,templateVersion:template?.version||dataset.templateVersion,versions:[nextVersion,...linked.versions]};
    });
  });
}

function ProductTaskDetail({ task }) {
  const config=task.configSnapshot||{};
  const configJson=JSON.stringify(config,(key,value)=>key==='fingerprint'||key==='templateFingerprint'?undefined:value,2);
  const template=config.templateProfile||templateForDataset({modality:task.modality,businessType:task.businessType,templateId:config.templateId});
  const resultItems=[
    {key:'output',label:'正式输出',children:task.output},{key:'version',label:'输出版本 ID',children:<Text copyable>{task.outputVersionId||'-'}</Text>},
    {key:'source',label:'来源数据集版本',children:task.sourceVersionId?<Text copyable>{task.sourceVersionId}</Text>:'-'},{key:'report',label:'质检 / 复检报告',children:task.taskType==='数据合成'?'-':`QREPORT-${fixedHashId(`${task.id}-${task.outputVersionId}`)}`},
  ];
  return <Tabs className="task-detail-tabs" defaultActiveKey="info" items={[
    {key:'info',label:'基础信息',children:<><Descriptions bordered size="small" column={2} className="detail-descriptions" items={[{key:'id',label:'任务 ID',children:<Text copyable>{task.id}</Text>},{key:'type',label:'任务类型',children:<Tag color={taskTypeColor(task.taskType)}>{task.taskType}</Tag>},{key:'status',label:'状态',children:<StatusTag value={task.status}/>},{key:'updated',label:'更新时间',children:formatDateTime(task.updated||task.created)},{key:'description',label:'任务描述',span:2,children:task.description||'-'},{key:'input',label:'输入引用',children:task.input},{key:'output',label:'输出引用',children:task.output}]}/><Divider orientation="left">输入血缘</Divider><TemplateSnapshot template={template}/></>},
    ...(task.taskType==='数据合成'?[]:[{key:'rules',label:'模板质检规则',children:<TemplateRulesTable modality={task.modality} template={template} title={task.taskType==='数据质检'?'已执行的模板质检规则':'输入报告依据与自动复检规则'}/> }]),
    {key:'config',label:'配置快照',children:<div className="task-rule-expanded"><pre>{configJson}</pre><Text copyable={{text:configJson}}>复制配置快照</Text></div>},
    {key:'logs',label:'运行日志',children:<Timeline items={[{color:'green',children:`${task.taskType}配置校验通过`},{color:'green',children:task.taskType==='数据质检'?(config.qualityScope==='sample'?`${config.qualityCheckedSampleCount||0} 条抽检样本质检完成，其余样本写入未质检标签`:'全量样本质检与标签写入完成'):task.taskType==='数据增强'?'增强处理与自动复检完成':task.taskType==='定向扩增'?'定向扩增与自动复检完成':'批量推理与结果写入完成'},{color:'green',children:'正式版本已原子化提交'}]}/>},
    {key:'usage',label:'API 用量',children:<ApiUsageSummary usage={task.apiUsage}/>},
    {key:'result',label:'运行结果',children:<Descriptions bordered size="small" column={2} items={resultItems}/>},
  ]}/>;
}

function TaskCenter({ datasets, setDatasets, modality, pageTitle, startCreate, onStartConsumed, onNavigate }) {
  const [tasks,setTasks]=useState(()=>normalizeTaskTimes(initialTasks)); const [tab,setTab]=useState('all'); const [taskType,setTaskType]=useState('all'); const [businessTypeFilter,setBusinessTypeFilter]=useState('all'); const [query,setQuery]=useState(''); const [draft,setDraft]=useState(null); const [detail,setDetail]=useState(null); const [detailTab,setDetailTab]=useState('info'); const [storeReady,setStoreReady]=useState(false);
  const modalityTasks=useMemo(()=>tasks.filter(t=>t.modality===modality),[tasks,modality]);
  const businessTypeOptions=useMemo(()=>[...new Set(modalityTasks.map(task=>task.businessType).filter(Boolean))].sort(),[modalityTasks]);
  const filtered=useMemo(()=>modalityTasks.filter(t=>(tab==='all'||t.status===tab)&&(taskType==='all'||t.taskType===taskType)&&(businessTypeFilter==='all'||t.businessType===businessTypeFilter)&&(!query||t.name.includes(query)||t.id.includes(query))),[modalityTasks,tab,taskType,businessTypeFilter,query]);
  const activeCustomsIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('CUSTOMS-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeSyntheticDocumentIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('FICTIONAL-DOC-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeConversationIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('CONV-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeColdChainIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('COLDCHAIN-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeDetail=detail?tasks.find(item=>item.id===detail.id)||detail:null;
  const openDetail=task=>{setDetail(task);setDetailTab('info');};
  const refreshTasks=async()=>{try{const [state,validations]=await Promise.all([localStoreApi.getState(),localStoreApi.getValidations()]);const saved=state.exists&&Array.isArray(state.tasks)?state.tasks:initialTasks;setTasks(normalizeTaskTimes(mergeValidationTasks(saved,validations.items||[])));}catch(error){message.warning(`本地历史恢复失败：${error.message}`);}finally{setStoreReady(true);}};
  useEffect(()=>{refreshTasks();},[]);
  useEffect(()=>{if(!storeReady)return;localStoreApi.saveState({tasks}).catch(error=>console.warn('任务状态保存失败',error));},[tasks,storeReady]);
  useEffect(()=>{setTab('all');setTaskType('all');setBusinessTypeFilter('all');setQuery('');setDetail(null);setDraft(null);},[modality]);
  useEffect(()=>{if(!startCreate)return;setDraft(typeof startCreate==='object'?{...startCreate,modality,taskType:startCreate.taskType}:{modality,taskType:startCreate});onStartConsumed?.();},[startCreate,modality]);
  useEffect(()=>{
    if(!activeCustomsIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeCustomsIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>customsApi.getJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,1000);
      }catch(error){if(!cancelled){console.warn('报关单任务轮询失败',error);timer=window.setTimeout(poll,1800);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeCustomsIds]);
  useEffect(()=>{
    if(!activeSyntheticDocumentIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeSyntheticDocumentIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>syntheticTemplateApi.getGenerationJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          const latestEvent=Array.isArray(job.events)&&job.events.length?job.events[job.events.length-1]:null;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:latestEvent?.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,700);
      }catch(error){if(!cancelled){console.warn('虚构文档任务轮询失败',error);timer=window.setTimeout(poll,1600);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeSyntheticDocumentIds]);
  useEffect(()=>{
    if(!activeConversationIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeConversationIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>conversationApi.getJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,800);
      }catch(error){if(!cancelled){console.warn('对话任务轮询失败',error);timer=window.setTimeout(poll,1600);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeConversationIds]);
  useEffect(()=>{
    if(!activeColdChainIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeColdChainIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>coldchainApi.getJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,1000);
      }catch(error){if(!cancelled){console.warn('冷链时序任务轮询失败',error);timer=window.setTimeout(poll,1800);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeColdChainIds]);
  const createMenuItems=[
    {key:'数据合成',label:<div className="create-menu-item"><Text strong>数据合成</Text><Text type="secondary">选择模板并配置现有合成参数</Text></div>},
    {key:'数据质检',label:<div className="create-menu-item"><Text strong>数据质检</Text><Text type="secondary">对已有版本执行质量、隐私与覆盖检查</Text></div>},
    {key:'数据增强',label:<div className="create-menu-item"><Text strong>数据增强</Text><Text type="secondary">使用现有增强方式增加数据多样性</Text></div>},
    {key:'定向扩增',label:<div className="create-menu-item"><Text strong>定向扩增</Text><Text type="secondary">根据已有低质标签和覆盖短板补充样本</Text></div>},
  ];
  const editTask=task=>setDraft({
    ...(task.configSnapshot||{}),
    modality:task.modality,
    taskType:task.taskType,
    businessType:task.businessType,
    name:task.name,
    description:task.description,
    configSnapshot:task.configSnapshot,
    editingTaskId:task.id,
  });
  const publishTask=task=>{
    setTasks(items=>items.map(item=>item.id===task.id?{...item,status:'排队中',progress:0,currentStage:'等待资源'}:item));
    message.success(`任务“${task.name}”已发布并进入队列`);
  };
  const rerunTask=task=>{
    const now=Date.now();
    const rerun={...task,key:`rerun-${now}`,id:`TASK-${now}`,status:'排队中',progress:0,currentStage:'等待资源',created:nowDateTime(),backendJob:undefined,pendingDatasetWrite:false,datasetWritten:false};
    setTasks(items=>[rerun,...items]);
    message.success(`已创建“${task.name}”的重跑任务`);
  };
  const terminateTask=task=>Modal.confirm({
    title:`终止任务“${task.name}”？`,
    content:'终止后当前执行将停止在现有进度，已产生的中间文件仍会保留，可从任务详情中查看。',
    okText:'确认终止',okType:'danger',cancelText:'取消',
    onOk:()=>{
      setTasks(items=>items.map(item=>item.id===task.id?{...item,status:'已终止',currentStage:'用户手动终止',backendJob:item.backendJob?{...item.backendJob,status:'cancelled',message:'用户手动终止'}:item.backendJob}:item));
      message.success('任务已终止');
    },
  });
  const copyTask=task=>{
    const now=Date.now();
    const copied={...task,key:`copy-${now}`,id:`DRAFT-${now}`,name:`${task.name}（副本）`,status:'草稿',progress:0,currentStage:'尚未发布',created:nowDateTime(),backendJob:undefined,pendingDatasetWrite:false,datasetWritten:false};
    setTasks(items=>[copied,...items]);
    message.success('任务已复制为草稿');
  };
  const deleteTask=task=>Modal.confirm({
    title:`删除任务“${task.name}”？`,
    content:'删除后该任务将从任务中心移除；已经写入数据中心的数据集不受影响。',
    okText:'确认删除',okType:'danger',cancelText:'取消',
    onOk:()=>{setTasks(items=>items.filter(item=>item.id!==task.id));if(detail?.id===task.id)setDetail(null);message.success('任务已删除');},
  });
  const renderTaskActions=task=>{
    const canEdit=['草稿','失败'].includes(task.status);
    const canPublish=task.status==='草稿';
    const canRerun=['已完成','失败','已终止'].includes(task.status);
    const canTerminate=task.status==='运行中';
    const canDelete=['草稿','已完成','失败','已终止'].includes(task.status);
    return <Space size={0} className="task-row-actions">
      <Button type="link" size="small" onClick={()=>openDetail(task)}>详情</Button>
      <Button type="link" size="small" disabled={!canEdit} title={canEdit?'编辑任务配置':'仅草稿或失败任务可编辑'} onClick={()=>editTask(task)}>编辑</Button>
      <Button type="link" size="small" disabled={!canPublish} title={canPublish?'发布任务':'仅草稿任务可发布'} onClick={()=>publishTask(task)}>发布</Button>
      <Button type="link" size="small" disabled={!canRerun} title={canRerun?'重新运行任务':'仅已完成或失败任务可重跑'} onClick={()=>rerunTask(task)}>重跑</Button>
      <Button type="link" size="small" danger disabled={!canTerminate} title={canTerminate?'终止正在运行的任务':'仅运行中的任务可终止'} onClick={()=>terminateTask(task)}>终止</Button>
      <Button type="link" size="small" danger disabled={!canDelete} title={canDelete?'删除任务':'排队中或运行中的任务不可删除'} onClick={()=>deleteTask(task)}>删除</Button>
      <Button type="link" size="small" onClick={()=>copyTask(task)}>复制</Button>
    </Space>;
  };
  const columns=[
    {title:'任务名称 / ID',dataIndex:'name',width:250,render:(v,r)=><div><Button type="link" className="name-link" onClick={()=>openDetail(r)}>{v}</Button><div className="muted-id">{r.id}</div></div>},
    {title:'任务类型',dataIndex:'taskType',width:145,render:v=><Tag color={taskTypeColor(v)}>{v}</Tag>},
    {title:'业务子类型',dataIndex:'businessType',width:110},
    {title:'处理流程',dataIndex:'stages',width:240,render:v=><StageTags stages={v}/>},
    {title:'状态',dataIndex:'status',width:95,render:v=><Badge status={statusMap[v]} text={v}/>},
    {title:'进度',dataIndex:'progress',width:145,render:(v,r)=><Tooltip title={`当前执行：${r.currentStage||'等待资源'}`}><div className="task-progress-cell"><Progress percent={v} size="small" status={r.status==='失败'?'exception':r.status==='已完成'?'success':'active'}/></div></Tooltip>},
    {title:'更新时间',width:185,render:(_,r)=>formatDateTime(r.updated||r.backendJob?.updated_at||r.created)},
    {title:'操作',fixed:'right',width:370,render:(_,r)=>renderTaskActions(r)}
  ];
  const writeDataset = v => {
    if(!v.backendJob || !v.outputMode) return;
    const result=v.backendJob.result||{};
    if(v.backendJob.id?.startsWith('FICTIONAL-DOC-')){
      const samples=result.sample_count??v.count??0;
      const quality=result.quality_status||'未质检';
      const urls=v.backendJob.artifact_urls||{};
      const firstImage=Array.isArray(urls.images)?urls.images[0]:null;
      const artifactUrl=urls.manifest||firstImage||null;
      const qualityReportUrl=urls.quality_report||null;
      const created=nowDateTime();
      setDatasets(items=>{
        if(v.outputMode==='newVersion'){
          return items.map(dataset=>{
            if(dataset.name!==v.targetDataset)return dataset;
            const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
            const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl,previewUrl:firstImage};
            newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
            return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
          });
        }
        const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
        const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
        const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl,previewUrl:firstImage};
        version.qualityReport=buildVersionQualityReport(v.modality,version);
        return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由虚构文档模板生成服务写入，包含图片、标注、manifest 与质检报告。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
      });
      return;
    }
    if(v.backendJob.id?.startsWith('CUSTOMS-')){
      const finalQc=result.expanded_qc_summary||result.qc_summary||{};
      const statusCounts=finalQc.status_counts||{};
      const checked=Object.values(statusCounts).reduce((sum,value)=>sum+Number(value||0),0);
      const quality=checked?Number((Number(statusCounts.PASS||0)*100/checked).toFixed(1)):'未质检';
      const samples=result.generation_summary?.sample_count??v.count??0;
      const artifactUrl=result.preview_url||null;
      const qualityReportUrl=result.quality_report_url?`/reports/customs/${encodeURIComponent(v.backendJob.id)}/quality`:null;
      const created=nowDateTime();
      setDatasets(items=>{
        if(v.outputMode==='newVersion'){
          return items.map(dataset=>{
            if(dataset.name!==v.targetDataset)return dataset;
            const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
            const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
            newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
            return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
          });
        }
        const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
        const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
        const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
        version.qualityReport=buildVersionQualityReport(v.modality,version);
        return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由进口报关单合成、质检与扩增管线写入。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
      });
      return;
    }
    if(v.backendJob.id?.startsWith('CONV-')){
      const finalQuality=result.final_quality||{};
      const samples=finalQuality.sample_count??result.generation?.final_count??v.count??0;
      const quality=finalQuality.average_score??'未质检';
      const artifactUrl=result.artifact_urls?.train_pass||null;
      const qualityReportUrl=`/reports/conversations/${encodeURIComponent(v.backendJob.id)}/quality`;
      const created=nowDateTime();
      setDatasets(items=>{
        if(v.outputMode==='newVersion'){
          return items.map(dataset=>{
            if(dataset.name!==v.targetDataset)return dataset;
            const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
            const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
            newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
            return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
          });
        }
        const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
        const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
        const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
        version.qualityReport=buildVersionQualityReport(v.modality,version);
        return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由智能客服对话合成、质检与扩增管线写入。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
      });
      return;
    }
    const summary=result.final_qc||result.generation_summary||{};
    const samples=summary.shipment_count??v.count??0;
    const rows=summary.row_count??result.generation_summary?.row_count??0;
    const quality=summary.average_score??'未质检';
    const created=nowDateTime();
    setDatasets(items=>{
      if(v.outputMode==='newVersion'){
        return items.map(dataset=>{
          if(dataset.name!==v.targetDataset)return dataset;
          const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
          const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),rowCount:numericSampleCount(rows),quality,created,updatedAt:created,consumers:[],artifactUrl:result.final_delivery_url,qualityReportUrl:result.quality_enabled?`/reports/cold-chain/${encodeURIComponent(v.backendJob.id)}/quality`:null};
          newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
          return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
        });
      }
      const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
      const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
      const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),rowCount:numericSampleCount(rows),quality,created,updatedAt:created,consumers:[],artifactUrl:result.final_delivery_url,qualityReportUrl:result.quality_enabled?`/reports/cold-chain/${encodeURIComponent(v.backendJob.id)}/quality`:null};
      version.qualityReport=buildVersionQualityReport(v.modality,version);
      return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由冷藏集装箱国际运输生成管线写入。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
    });
  };
  useEffect(()=>{
    const ready=tasks.filter(task=>task.pendingDatasetWrite&&!task.datasetWritten&&task.backendJob?.status==='completed');
    if(!ready.length)return;
    ready.forEach(task=>writeDataset({...task.configSnapshot,name:task.name,description:task.description,taskType:task.taskType,modality:task.modality,businessType:task.businessType,backendJob:task.backendJob}));
    const ids=new Set(ready.map(task=>task.id));
    setTasks(items=>items.map(task=>ids.has(task.id)?{...task,pendingDatasetWrite:false,datasetWritten:true}:task));
  },[tasks]);
  if(draft) return <CreateTaskPage draft={draft} datasets={datasets} onCancel={()=>setDraft(null)} onSubmit={v=>{
    const taskId=prototypeTaskId(`${Date.now()}-${v.name}`);
    const outputVersionId=createVersionId(`${taskId}-${v.taskType}`);
    const sampleTotal=Number(v.sampleCount||v.effectiveTargetCount||v.targetCount||numericSampleCount(v.sourceVersion?.samples));
    const executedSampleTotal=v.taskType==='数据质检'?Number(v.qualityCheckedSampleCount||sampleTotal):sampleTotal;
    const semanticRules=(v.qualityRules||[]).filter(rule=>rule.method==='语义判断').length;
    const documentSemanticEnhancementCalls=v.modality==='文档图像'&&v.taskType==='数据增强'&&v.documentEnhancementTypes?.includes('语义增强')?sampleTotal:0;
    const imageCalls=v.modality==='文档图像'?(v.taskType==='数据合成'&&v.templateProfile?.method==='底图生成法'||v.taskType==='定向扩增'||v.taskType==='数据增强'&&v.documentEnhancementTypes?.includes('背景增强')?sampleTotal:0):0;
    const outputDatasetName=v.taskType==='数据合成'?(v.outputMode==='newVersion'?v.targetDataset:v.outputDatasetName):datasets.find(dataset=>dataset.id===v.inputDatasetId)?.name;
    const nextTask={key:taskId,id:taskId,name:v.name,description:v.description,taskType:v.taskType,modality:v.modality,businessType:v.businessType,stages:[v.taskType],input:v.input,output:`${outputDatasetName||'数据集'} / ${outputVersionId}`,currentStage:'结果写入完成',status:'已完成',progress:100,created:nowDateTime(),updated:nowDateTime(),configSnapshot:v,outputVersionId,sourceDatasetId:v.inputDatasetId||null,sourceVersionId:v.inputVersionId||null,apiUsage:{model:v.taskType==='数据合成'?executedSampleTotal:executedSampleTotal*semanticRules+documentSemanticEnhancementCalls,image:imageCalls,tokens:Math.max(1,executedSampleTotal)*(v.modality==='对话文本'?1800:v.modality==='时序数据'?900:450)}};
    commitPrototypeTaskOutput(v,taskId,outputVersionId,setDatasets);
    setTasks(items=>[nextTask,...items.filter(item=>item.id!==draft.editingTaskId)]);
    message.success(`${v.taskType}任务已完成，并创建 1 个正式数据集版本`);
    setDraft(null);
  }}/>;
  const isSyntheticDocumentDetail=Boolean(activeDetail?.backendJob?.id?.startsWith('FICTIONAL-DOC-'));
  const isCustomsDetail=Boolean(activeDetail&&(activeDetail.backendJob?.id?.startsWith('CUSTOMS-')||!isSyntheticDocumentDetail&&activeDetail.businessType==='报关单'&&activeDetail.taskType==='数据合成'));
  const isConversationDetail=Boolean(activeDetail&&(activeDetail.backendJob?.id?.startsWith('CONV-')||activeDetail.modality==='对话文本'&&activeDetail.taskType==='数据合成'));
  const isColdChainDetail=Boolean(activeDetail&&(activeDetail.backendJob?.id?.startsWith('COLDCHAIN-')||activeDetail.modality==='时序数据'&&activeDetail.businessType==='冷链冷藏集装箱国际运输'));
  return <>
    <PageHeader title={`${pageTitle}任务`} description={`独立管理${pageTitle}的数据合成、质检、增强和定向扩增任务`} actions={<Dropdown trigger={['click']} placement="bottomRight" menu={{items:createMenuItems,onClick:({key})=>setDraft({modality,taskType:key})}}><Button type="primary" icon={<PlusOutlined/>}>新建任务 <DownOutlined/></Button></Dropdown>}/>
    <StatCards items={[{title:'任务总数',value:modalityTasks.length,icon:<AppstoreOutlined/>,foot:`仅统计${pageTitle}任务`},{title:'运行中',value:modalityTasks.filter(item=>item.status==='运行中').length,icon:<PlayCircleOutlined/>,foot:'状态来自本地任务日志'},{title:'已完成',value:modalityTasks.filter(item=>item.status==='已完成').length,icon:<CheckCircleOutlined/>,foot:'刷新页面后仍会保留'},{title:'待处理异常',value:modalityTasks.filter(item=>item.status==='失败').length,icon:<ExclamationCircleOutlined/>,foot:'可在详情中查看失败阶段'}]}/>
    <Card className="main-card" styles={{body:{padding:0}}}><div>
      <Flex justify="space-between" align="center" className="toolbar task-list-toolbar"><Space><Segmented value={taskType} onChange={setTaskType} options={[{label:'全部',value:'all'},{label:'合成',value:'数据合成'},{label:'质检',value:'数据质检'},{label:'增强',value:'数据增强'},{label:'定向扩增',value:'定向扩增'}]}/><Select value={tab} onChange={setTab} style={{width:150}} options={[{label:'全部任务状态',value:'all'},...['草稿','排队中','运行中','已完成','失败','已终止'].map(v=>({label:v==='失败'?'异常':v,value:v}))]}/><Select value={businessTypeFilter} onChange={setBusinessTypeFilter} style={{width:170}} options={[{label:'全部业务子类型',value:'all'},...businessTypeOptions.map(value=>({label:value,value}))]}/></Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索任务名称或ID" value={query} onChange={e=>setQuery(e.target.value)} style={{width:250}}/></Flex>
      <Table columns={columns} dataSource={filtered} scroll={{x:1490}} pagination={{pageSize:8,showTotal:t=>`共 ${t} 条`}}/>
    </div></Card>
    <Drawer title="任务详情" size={1100} open={!!activeDetail} onClose={()=>{setDetail(null);setDetailTab('info');}}>{activeDetail&&<><Title level={4}>{activeDetail.name}</Title><Paragraph type="secondary">{activeDetail.description}</Paragraph><Space className="task-detail-tags"><Tag color={taskTypeColor(activeDetail.taskType)}>{activeDetail.taskType}</Tag><Tag color={modalityColor[activeDetail.modality]}>{activeDetail.modality}</Tag><Tag>{activeDetail.businessType}</Tag><StatusTag value={activeDetail.status}/></Space>{activeDetail.configSnapshot&&!activeDetail.backendJob?<ProductTaskDetail task={activeDetail}/>:isSyntheticDocumentDetail?<Tabs className="task-detail-tabs" activeKey={detailTab} onChange={setDetailTab} items={[
      {key:'info',label:'任务信息',children:<><Descriptions bordered size="small" column={2} className="detail-descriptions" items={[{key:'1',label:'任务ID',children:<Text copyable>{activeDetail.id}</Text>},{key:'2',label:'模板版本',children:activeDetail.input},{key:'3',label:'业务类型',children:activeDetail.businessType},{key:'4',label:'输出',children:activeDetail.output},{key:'5',label:'创建时间',children:activeDetail.created},{key:'6',label:'随机种子',children:activeDetail.backendJob?.config?.seed??'-'}]}/><SyntheticDocumentTaskDetail job={activeDetail.backendJob}/></>},
      {key:'logs',label:<Space size={6}>运行日志{activeDetail.status==='运行中'&&<Badge status="processing"/>}</Space>,children:<SyntheticDocumentTaskDetail job={activeDetail.backendJob}/>},
      {key:'result',label:'运行结果',children:<SyntheticDocumentTaskDetail job={activeDetail.backendJob}/>},
    ]}/>:isCustomsDetail?<Tabs className="task-detail-tabs" activeKey={detailTab} onChange={setDetailTab} items={[
      {key:'info',label:'任务信息',children:<CustomsTaskInformation task={activeDetail}/>},
      {key:'logs',label:<Space size={6}>运行日志{activeDetail.status==='运行中'&&<Badge status="processing"/>}</Space>,children:<CustomsTaskLogs task={activeDetail}/>},
      {key:'result',label:'运行结果',children:<CustomsTaskDetail job={activeDetail.backendJob}/>},
    ]}/>:isConversationDetail?<Tabs className="task-detail-tabs" activeKey={detailTab} onChange={setDetailTab} items={[
      {key:'info',label:'任务信息',children:<ConversationTaskInformation task={activeDetail}/>},
      {key:'logs',label:<Space size={6}>运行日志{activeDetail.status==='运行中'&&<Badge status="processing"/>}</Space>,children:<ConversationTaskLogs task={activeDetail}/>},
      {key:'result',label:'运行结果',children:<ConversationTaskResults job={activeDetail.backendJob}/>},
    ]}/>:isColdChainDetail?<Tabs className="task-detail-tabs" activeKey={detailTab} onChange={setDetailTab} items={[
      {key:'info',label:'任务信息',children:<ColdChainTaskInformation task={activeDetail}/>},
      {key:'logs',label:<Space size={6}>运行日志{activeDetail.status==='运行中'&&<Badge status="processing"/>}</Space>,children:<ColdChainTaskLogs task={activeDetail}/>},
      {key:'result',label:'运行结果',children:<ColdChainTaskDetail job={activeDetail.backendJob} onOpenDataset={activeDetail.validationOnly?undefined:()=>{setDetail(null);onNavigate?.('data');}}/>},
    ]}/>:<><Descriptions bordered size="small" column={2} className="detail-descriptions" items={[{key:'1',label:'任务ID',children:activeDetail.id},{key:'2',label:'当前节点',children:activeDetail.currentStage},{key:'3',label:'输入',children:activeDetail.input},{key:'4',label:'输出',children:activeDetail.output},{key:'5',label:'创建时间',children:activeDetail.created},{key:'6',label:'参数快照',children:activeDetail.backendJob?.parameters?'已保存到 job.json':'已保存'},...(activeDetail.backendJob?.storage_path?[{key:'7',label:'本地文件目录',span:2,children:<Text copyable>{activeDetail.backendJob.storage_path}</Text>}]:[])]}/>{activeDetail.backendJob?(activeDetail.backendJob.id?.startsWith('COLDCHAIN-')?<ColdChainTaskDetail job={activeDetail.backendJob} onOpenDataset={activeDetail.validationOnly?undefined:()=>{setDetail(null);onNavigate?.('data');}}/>:<CustomsTaskDetail job={activeDetail.backendJob}/>):<><Title level={5}>系统执行流程</Title><Timeline items={activeDetail.stages.map((s,i)=>({color:i===0?'green':i===1?'blue':'gray',children:`${s} · ${i===0?'已完成':i===1?'运行中':'等待中'}`}))}/><Alert type="info" showIcon message="任务通过输入版本、输出版本和参数快照形成数据血缘。"/></>}</>}</>}</Drawer>
  </>;
}

function HomePage({ onNavigate, onCreate }) {
  const journey=[
    {step:'Step 1',icon:<ApartmentOutlined/>,title:'制作数据模板',desc:'上传种子数据并配置版式、字段和生成规则，沉淀可复用的数据模板。',tags:['模板制作','版式分析','字段规则'],action:'进入模板中心',onClick:()=>onNavigate('templates')},
    {step:'Step 2',icon:<PlayCircleOutlined/>,title:'生成业务数据',desc:'选择文档图像、对话文本或时序数据模板，通过单页表单配置合成规则并生成新数据。',tags:['文档图像','对话文本','时序数据'],action:'创建合成任务',onClick:()=>onCreate('数据合成')},
    {step:'Step 3',icon:<SafetyCertificateOutlined/>,title:'评估并持续优化',desc:'对已有版本分别发起数据质检、数据增强或定向扩增任务。',tags:['数据质检','数据增强','定向扩增'],action:'创建质检任务',onClick:()=>onCreate('数据质检')},
    {step:'Step 4',icon:<DatabaseOutlined/>,title:'复用数据资产',desc:'在数据中心查看、预览和下载不可变版本，也可以将已有版本作为参考样例或继续发起评估任务。',tags:['版本管理','数据血缘','预览下载'],action:'查看数据',onClick:()=>onNavigate('data')}
  ];
  return <div className="home-page">
    <section className="home-intro"><Title>你好，{CURRENT_USER}</Title><Paragraph>数据生成工具平台是一个提供生成、评估并持续优化文档图像、对话文本和时序数据的平台</Paragraph></section>
    <section className="journey-section"><div className="journey-heading"><Title level={4}>四步完成数据生产与优化</Title><Text type="secondary">从制作模板到复用数据资产，每一步都可以直接开始</Text></div><div className="journey-grid">{journey.map((item,index)=><Card key={item.step} className="journey-card" hoverable onClick={item.onClick}><div className={`journey-icon journey-icon-${index+1}`}>{item.icon}</div><Text className="journey-step">Step {index+1}</Text><Title level={4}>{item.title}</Title><Paragraph type="secondary">{item.desc}</Paragraph><Space wrap className="journey-tags">{item.tags.map(tag=><Tag key={tag}>{tag}</Tag>)}</Space><Button type="primary" onClick={e=>{e.stopPropagation();item.onClick();}}>{item.action}</Button></Card>)}</div></section>
  </div>;
}

const UPLOAD_TEMPLATE_BY_MODALITY = {
  文档图像: { key: 'document', label: '文档类图像', hint: '文件夹需包含 images 和 annotations 两个目录，图片与标注 JSON 文件名一一对应。' },
  对话文本: { key: 'conversation', label: '对话', hint: '文件夹需包含 JSONL 或 JSON 文件，每条数据必须包含 messages 对话数组。' },
  时序数据: { key: 'timeseries', label: '时序', hint: '文件夹需包含 CSV 文件，表头至少包含 series_id、timestamp 和 value。' },
};

const uploadEntryPath = entry => String(entry?.originFileObj?.webkitRelativePath || entry?.webkitRelativePath || entry?.name || '').replaceAll('\\', '/');
const uploadEntryText = async entry => entry?.originFileObj?.text ? entry.originFileObj.text() : entry?.text ? entry.text() : '';

async function validateUploadFolder(modality, fileList) {
  // 纯前端演示：不读取或解析用户文件，选择任意文件夹即视为通过。
  return { status: 'passed', message: 'Mock 格式校验通过（演示模式）' };
  const files = (fileList || []).filter(item => item?.name && !item.name.startsWith('.'));
  if (!modality) return { status: 'idle', message: '请先选择数据类型' };
  if (!files.length) return { status: 'idle', message: '选择文件夹后将自动校验格式' };
  const errors = [];
  if (modality === '文档图像') {
    const images = files.filter(item => /\.(png|jpe?g|webp|tiff?)$/i.test(item.name) && /(^|\/)images\//i.test(uploadEntryPath(item)));
    const annotations = files.filter(item => /\.json$/i.test(item.name) && /(^|\/)annotations\//i.test(uploadEntryPath(item)));
    if (!images.length) errors.push('images 目录中未找到 PNG、JPG、WEBP 或 TIFF 图片');
    if (!annotations.length) errors.push('annotations 目录中未找到 JSON 标注文件');
    const imageNames = new Set(images.map(item => item.name.replace(/\.[^.]+$/, '').toLowerCase()));
    const annotationNames = new Set(annotations.map(item => item.name.replace(/\.json$/i, '').toLowerCase()));
    if (images.length && annotations.length && ![...imageNames].some(name => annotationNames.has(name))) errors.push('图片与标注 JSON 的文件名无法对应');
    for (const item of annotations.slice(0, 20)) {
      try { JSON.parse(await uploadEntryText(item)); }
      catch { errors.push(`标注文件 ${item.name} 不是合法 JSON`); break; }
    }
    return errors.length ? { status: 'failed', errors } : { status: 'passed', message: `格式校验通过：${images.length} 张图片，${annotations.length} 个标注文件` };
  }
  if (modality === '对话文本') {
    const dataFiles = files.filter(item => /\.(jsonl|json)$/i.test(item.name));
    if (!dataFiles.length) errors.push('未找到 JSONL 或 JSON 对话数据文件');
    let sampleCount = 0;
    for (const item of dataFiles.slice(0, 20)) {
      try {
        const text = await uploadEntryText(item);
        const samples = item.name.toLowerCase().endsWith('.jsonl')
          ? text.split(/\r?\n/).filter(Boolean).slice(0, 50).map(line => JSON.parse(line))
          : (() => { const parsed = JSON.parse(text); return Array.isArray(parsed) ? parsed : parsed.items || [parsed]; })();
        if (!samples.length || samples.some(sample => !Array.isArray(sample?.messages) || sample.messages.length < 2 || sample.messages.some(messageItem => !messageItem?.role || typeof messageItem?.content !== 'string'))) {
          errors.push(`${item.name} 中存在缺少 messages、role 或 content 的数据`); break;
        }
        sampleCount += samples.length;
      } catch { errors.push(`${item.name} 不是合法的 JSONL / JSON 文件`); break; }
    }
    return errors.length ? { status: 'failed', errors } : { status: 'passed', message: `格式校验通过：${dataFiles.length} 个文件，已抽检 ${sampleCount} 条对话` };
  }
  const csvFiles = files.filter(item => /\.csv$/i.test(item.name));
  if (!csvFiles.length) errors.push('未找到 CSV 时序数据文件');
  let rowCount = 0;
  for (const item of csvFiles.slice(0, 20)) {
    try {
      const lines = (await uploadEntryText(item)).split(/\r?\n/).filter(Boolean);
      const headers = (lines[0] || '').split(',').map(value => value.trim().toLowerCase());
      const missing = ['series_id', 'timestamp', 'value'].filter(field => !headers.includes(field));
      if (missing.length) { errors.push(`${item.name} 缺少表头：${missing.join('、')}`); break; }
      if (lines.length < 2) { errors.push(`${item.name} 没有数据行`); break; }
      rowCount += lines.length - 1;
    } catch { errors.push(`${item.name} 无法读取`); break; }
  }
  return errors.length ? { status: 'failed', errors } : { status: 'passed', message: `格式校验通过：${csvFiles.length} 个 CSV 文件，共 ${rowCount} 行数据` };
}

function UploadDatasetPage({ onCancel, onSubmit, datasets }) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [formatValidation, setFormatValidation] = useState({ status: 'idle', message: '请选择数据类型并上传文件夹' });
  const uploadMode = Form.useWatch('uploadMode', form) || 'newDataset';
  const modality = Form.useWatch('modality', form);
  const templateId = Form.useWatch('templateId', form);
  const templateInfo = UPLOAD_TEMPLATE_BY_MODALITY[modality];
  const selectedTemplate = PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===templateId);
  useEffect(() => {
    let active = true;
    if (!modality || !templateId || !fileList.length) {
      setFormatValidation({ status: 'idle', message: !modality ? '请先选择数据类型' : !templateId ? '请选择已发布模板' : '选择文件夹后将按模板契约自动校验格式' });
      return () => { active = false; };
    }
    setFormatValidation({ status: 'checking', message: '正在校验文件夹结构和数据格式…' });
    validateUploadFolder(modality, fileList).then(result => { if (active) setFormatValidation(result); });
    return () => { active = false; };
  }, [modality, templateId, fileList]);
  const submit = async () => {
    try {
      if (formatValidation.status !== 'passed') { message.warning('文件夹格式校验通过后才可上传'); return; }
      const values = await form.validateFields();
      if (!fileList.length) { message.warning('请选择包含数据文件的文件夹'); return; }
      onSubmit({ ...values, fileList });
      form.resetFields(); setFileList([]); setFormatValidation({ status: 'idle', message: '请选择数据类型并上传文件夹' });
    } catch { /* validation message is shown by Form */ }
  };
  const downloadTemplate = type => {
    const examples = {
      document: { name: 'document-image-upload-template.json', type: '文档图像', files: ['images/sample-001.png'], annotations: ['annotations/sample-001.json'] },
      conversation: { name: 'conversation-upload-template.jsonl', text: JSON.stringify({ id: 'dialogue-001', messages: [{ role: 'user', content: '示例问题' }, { role: 'assistant', content: '示例回答' }] }) },
      timeseries: { name: 'timeseries-upload-template.csv', text: 'series_id,timestamp,value,label\nseries-001,2026-08-01 00:00:00,4.2,normal\n' },
    };
    const example = examples[type];
    const content = example.text || JSON.stringify(example, null, 2);
    const blob = new Blob([content], { type: type === 'timeseries' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = example.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    message.success('上传模板已生成');
  };
  return <div className="create-task-page dataset-upload-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label="返回数据中心" onClick={onCancel}/><Title level={3}>上传数据集</Title></Space><Button type="primary" icon={<CloudUploadOutlined/>} disabled={formatValidation.status !== 'passed'} onClick={submit}>上传并处理</Button></Flex>
    <Card>
      <Alert type="info" showIcon message="上传后自动执行入库隐私检查与脱敏" description="该检查只负责入库安全，不等同于模板正式质检；系统只保存脱敏后的数据，不保存原始数据。" style={{ marginBottom: 16 }}/>
      <Form form={form} layout="vertical">
      <Form.Item name="modality" label="数据类型" rules={[{ required: true, message: '请选择数据类型' }]}>
        <Radio.Group optionType="button" buttonStyle="solid" onChange={()=>{form.setFieldsValue({templateId:undefined,targetDataset:undefined});setFileList([]);}} options={[{ label: '文档类图像', value: '文档图像' }, { label: '对话', value: '对话文本' }, { label: '时序', value: '时序数据' }]} />
      </Form.Item>
      <Flex align="center" wrap="wrap" gap={6} className="dataset-upload-template-tip"><Text type="secondary">{templateInfo ? templateInfo.hint : '选择数据类型后，可下载对应的文件夹结构与数据格式模板。'}</Text>{templateInfo && <Button type="link" size="small" onClick={() => downloadTemplate(templateInfo.key)}>下载{templateInfo.label}模板</Button>}</Flex>
      <Form.Item name="templateId" label="绑定已发布模板" rules={[{required:true,message:'请选择已发布模板'}]}><Select showSearch optionFilterProp="label" disabled={!modality} placeholder="模板用于格式校验、正式质检和后续血缘追溯" options={templatesForModality(modality).map(template=>({value:template.id,label:`${template.name} · ${template.businessType} · ${template.version}`}))}/></Form.Item>
      {selectedTemplate&&<TemplateSnapshot template={selectedTemplate}/>} 
      <Form.Item name="uploadMode" label="上传方式" initialValue="newDataset" className="section-title">
        <Radio.Group optionType="button" buttonStyle="solid" options={[{ label: '创建新数据集', value: 'newDataset' }, { label: '上传为已有数据集新版本', value: 'newVersion' }]} />
      </Form.Item>
      {uploadMode === 'newVersion' && <Form.Item name="targetDataset" label="目标数据集" rules={[{ required: true, message: '请选择目标数据集' }]}><Select showSearch optionFilterProp="label" options={(datasets || []).filter(dataset=>dataset.modality===modality&&dataset.templateId===templateId).map(d => ({ label: `${d.name}（当前${d.defaultVersion}）`, value: d.name }))} placeholder="仅显示数据类型、业务类型和模板契约一致的数据集" /></Form.Item>}
      <Form.Item name="name" label="数据集名称" rules={[{ required: true, message: '请输入数据集名称' }]}><Input placeholder="例如：客户上传的报关单样本" /></Form.Item>
      <Form.Item name="description" label="描述"><Input.TextArea rows={2} placeholder="说明数据来源、用途或版本信息" /></Form.Item>
      <Form.Item label="数据文件夹" required>
        <Upload directory multiple beforeUpload={() => false} fileList={fileList} onChange={({ fileList: next }) => setFileList(next)} showUploadList={{ showRemoveIcon: true }}>
          <Button icon={<CloudUploadOutlined/>}>选择文件夹</Button>
        </Upload>
        <Text type="secondary">请选择与当前数据类型模板一致的完整文件夹，选择后系统会自动执行格式校验。</Text>
      </Form.Item>
      {formatValidation.status === 'checking' && <Alert type="info" showIcon message={formatValidation.message}/>} 
      {formatValidation.status === 'passed' && <Alert type="success" showIcon message={formatValidation.message} description="格式校验已通过，可以上传并进入隐私检查与自动脱敏。"/>}
      {formatValidation.status === 'failed' && <Alert type="error" showIcon message="格式校验未通过" description={<ul className="dataset-upload-validation-errors">{formatValidation.errors.map(error => <li key={error}>{error}</li>)}</ul>}/>} 
      </Form>
    </Card>
  </div>;
}

const percentText = value => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : '-';

function QualityStatusSummary({ counts = {}, total = 0 }) {
  const colors = { PASS: '#52c41a', REVIEW: '#faad14', REJECT: '#ff4d4f', UNCHECKED:'#8c8c8c' };
  const labels = { PASS:'PASS', REVIEW:'REVIEW', REJECT:'REJECT', UNCHECKED:'未质检' };
  const statuses=Number(counts.UNCHECKED||0)>0?['PASS','REVIEW','REJECT','UNCHECKED']:['PASS','REVIEW','REJECT'];
  return <Row gutter={[12,12]}>{statuses.map(status=><Col span={statuses.length===4?6:8} key={status}><Card size="small"><Flex justify="space-between" align="center"><div><Text type="secondary">{labels[status]}</Text><Title level={4} style={{margin:'4px 0 0',color:colors[status]}}>{Number(counts[status] || 0).toLocaleString()}</Title></div><Progress type="circle" size={54} percent={total?Math.round(Number(counts[status]||0)/total*100):0} strokeColor={colors[status]}/></Flex></Card></Col>)}</Row>;
}

function VersionQualityReport({ dataset, version }) {
  const report = buildVersionQualityReport(dataset.modality, version);
  if (!report) return <Empty description="该版本尚未生成质检报告"/>;
  const total = report.sampleCount ?? report.shipmentCount ?? numericSampleCount(version.samples);
  const checkedSampleCount=report.checkedSampleCount??Math.max(0,total-Number(report.statusCounts?.UNCHECKED||0));
  const uncheckedSampleCount=report.uncheckedSampleCount??Number(report.statusCounts?.UNCHECKED||0);
  const statusSection = <><Alert type={Number(report.statusCounts?.REJECT||0)?'warning':'success'} showIcon message={`${report.executionRange==='sample'?'部分抽检':'全量质检'}完成，共检查 ${Number(checkedSampleCount).toLocaleString()} 条数据`} description={`当前版本共 ${Number(total).toLocaleString()} 条：PASS ${Number(report.statusCounts?.PASS||0).toLocaleString()}，REVIEW ${Number(report.statusCounts?.REVIEW||0).toLocaleString()}，REJECT ${Number(report.statusCounts?.REJECT||0).toLocaleString()}，未质检 ${Number(uncheckedSampleCount).toLocaleString()}。`}/><div className="section-title"><QualityStatusSummary counts={report.statusCounts} total={total}/></div></>;
  if (dataset.modality === '文档图像') return <>{statusSection}<Title level={5}>核心识别指标</Title><Descriptions bordered size="small" column={3} items={[
    {key:'cer',label:'CER',children:Number(report.ocrAverages.cer).toFixed(4)},
    {key:'exact',label:'字段完全一致率',children:percentText(report.ocrAverages.fieldExactRate)},
    {key:'numeric',label:'数字代码准确率',children:percentText(report.ocrAverages.numericCodeAccuracy)},
    {key:'coverage',label:'检测覆盖率',children:percentText(report.ocrAverages.detectionCoverage)},
    {key:'confidence',label:'平均识别置信度',children:percentText(report.ocrAverages.meanRecognitionConfidence)},
    {key:'low',label:'低置信字段率',children:percentText(report.ocrAverages.lowConfidenceRate)},
  ]}/><Title level={5} className="section-title">图片与几何质量</Title><Descriptions bordered size="small" column={3} items={[
    {key:'brightness',label:'平均亮度',children:report.imageQuality.brightness},
    {key:'contrast',label:'平均对比度',children:report.imageQuality.contrast},
    {key:'sharpness',label:'平均清晰度',children:report.imageQuality.sharpness},
    {key:'polygon',label:'有效 polygon',children:percentText(report.geometry.validPolygonRate)},
    {key:'bbox',label:'最大几何误差',children:`${report.geometry.bboxPolygonErrorPx} px`},
    {key:'rmse',label:'重投影 RMSE',children:`${report.geometry.reprojectionRmsePx} px`},
    {key:'bounds',label:'最大越界比例',children:percentText(report.geometry.outOfBoundsRate)},
    {key:'p10',label:'字段高度 P10',children:`${report.geometry.fieldHeightP10Px} px`},
    {key:'median',label:'字段高度中位数',children:`${report.geometry.fieldHeightMedianPx} px`},
  ]}/><Title level={5} className="section-title">隐私检查与自动脱敏</Title><Descriptions bordered size="small" column={3} items={[
    {key:'initial',label:'初检隐私风险',children:report.privacy.initialRiskCount},{key:'masked',label:'自动脱敏',children:report.privacy.maskedCount},{key:'residual',label:'复检残留风险',children:report.privacy.residualRiskCount},
  ]}/><Title level={5} className="section-title">标签覆盖缺口</Title><Table rowKey="key" size="small" pagination={false} dataSource={report.coverageGaps||[]} columns={[{title:'维度',dataIndex:'dimension'},{title:'标签',dataIndex:'label'},{title:'当前 PASS',dataIndex:'pass'},{title:'目标',dataIndex:'target'},{title:'缺口',dataIndex:'gap'}]}/></>;
  if (dataset.modality === '对话文本') return <>{statusSection}<Title level={5}>核心质量指标</Title><Row gutter={[12,12]}>
    <Col span={6}><Card size="small"><Statistic title="Schema 合法率" value={percentText(report.schemaValidRate)}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="状态转移合法率" value={percentText(report.stateLegalRate)}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="工具调用准确率" value={percentText(report.toolAccuracyRate)}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="证据可解析率" value={percentText(report.evidenceResolvableRate)}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="角色稳定率" value={percentText(report.roleStableRate)}/></Card></Col>
    <Col span={6}><Card size="small"><Statistic title="非重复样本率" value={percentText(report.nonDuplicateRate)}/></Card></Col>
  </Row><Title level={5} className="section-title">隐私检查与自动脱敏</Title><Descriptions bordered size="small" column={3} items={[
    {key:'initial',label:'初检隐私风险',children:report.privacy.initialRiskCount},
    {key:'masked',label:'自动脱敏',children:report.privacy.maskedCount},
    {key:'residual',label:'复检残留风险',children:report.privacy.residualRiskCount},
  ]}/><Title level={5} className="section-title">标签覆盖缺口</Title><Table rowKey="key" size="small" pagination={false} dataSource={report.coverageGaps||[]} columns={[{title:'维度',dataIndex:'dimension'},{title:'标签',dataIndex:'label'},{title:'当前 PASS',dataIndex:'pass'},{title:'目标',dataIndex:'target'},{title:'缺口',dataIndex:'gap'}]}/></>;
  const dimensionLabels = { contract:'字段契约', temporal:'时间连续性', physical:'温湿度物理规则', geospatial:'GPS 与运输阶段', ground_truth:'事件与 Ground Truth', privacy:'隐私契约', template_rules:'模板字段规则', coverage_labels:'覆盖标签一致性' };
  return <>{statusSection}<Row gutter={[12,12]} className="section-title"><Col span={8}><Card size="small"><Statistic title="平均质量分" value={report.averageScore} suffix="/100"/></Card></Col><Col span={8}><Card size="small"><Statistic title="PASS 标签覆盖率" value={report.coverageScore} suffix="%"/></Card></Col><Col span={8}><Card size="small"><Statistic title="低质数据" value={report.lowQualityCount}/></Card></Col></Row><Title level={5}>各维度平均得分</Title><Table size="small" pagination={false} rowKey="key" dataSource={Object.entries(report.dimensionScores).map(([key,value])=>({key,name:dimensionLabels[key]||key,value}))} columns={[{title:'质检维度',dataIndex:'name'},{title:'得分',dataIndex:'value',width:140,render:value=><Progress percent={value} size="small"/>}]}/><Title level={5} className="section-title">单位与字段契约</Title><Descriptions bordered size="small" column={3} items={[{key:'temp',label:'温度单位',children:report.units.temperature},{key:'interval',label:'采样间隔',children:`${report.units.sampleIntervalMinutes} 分钟`},{key:'humidity',label:'湿度单位',children:report.units.humidity}]}/><Title level={5} className="section-title">隐私质检</Title><Descriptions bordered size="small" column={3} items={[{key:'checked',label:'检查数据',children:report.privacy.checkedSampleCount},{key:'failed',label:'失败数据',children:report.privacy.failedSampleCount},{key:'status',label:'结果分布',children:Object.entries(report.privacy.statusCounts||{}).map(([key,value])=><Tag key={key}>{key} · {value}</Tag>)}]}/></>;
}

function DownstreamTaskDetailPage({ task, dataset, version }) {
  if (!task) return <main className="standalone-task-detail"><Empty description="未找到下游任务记录"/><Button onClick={()=>window.close()}>关闭页面</Button></main>;
  return <main className="standalone-task-detail"><Flex justify="space-between" align="center"><div><Text type="secondary">下游任务详情</Text><Title level={2}>{task.name}</Title></div><Button onClick={()=>window.close()}>关闭页面</Button></Flex><Card><Descriptions bordered column={2} items={[
    {key:'name',label:'任务名称',children:task.name},{key:'id',label:'任务 ID',children:<Text copyable>{task.id}</Text>},
    {key:'type',label:'任务类型',children:<Tag color={taskTypeColor(task.taskType)}>{task.taskType}</Tag>},{key:'status',label:'任务状态',children:<StatusTag value={task.status||'已完成'}/>},
    {key:'dataset',label:'输入数据集',children:`${dataset?.name || '-'} / ${dataset?.id || '-'}`},{key:'version',label:'输入版本 ID',children:<Text copyable>{version?.version || '-'}</Text>},
    {key:'updated',label:'更新时间',children:formatDateTime(task.updatedAt)},{key:'description',label:'任务说明',children:`基于指定数据集版本执行${task.taskType}处理。`},
  ]}/></Card></main>;
}

function DataCenter({ datasets, setDatasets, uploading, onUploadingChange, onStartTask }) {
  const [modality,setModality]=useState('全部');
  const [sourceFilter,setSourceFilter]=useState('全部');
  const [businessTypeFilter,setBusinessTypeFilter]=useState('全部');
  const [query,setQuery]=useState('');
  const [detail,setDetail]=useState(null);
  const [versionDetail,setVersionDetail]=useState(null);
  const [sourceTaskDetail,setSourceTaskDetail]=useState(null);
  const [descriptionEditing,setDescriptionEditing]=useState(false);
  const [descriptionDraft,setDescriptionDraft]=useState('');

  const updateDataset = (datasetId, updater) => {
    setDatasets(items=>items.map(dataset=>dataset.id===datasetId?updater(dataset):dataset));
    setDetail(current=>current?.id===datasetId?updater(current):current);
    setVersionDetail(current=>current?.dataset.id===datasetId?{...current,dataset:updater(current.dataset),version:updater(current.dataset).versions.find(item=>item.id===current.version.id)||current.version}:current);
  };
  const createUploadedDataset = values => {
    const uploadId = `UPLOAD-${Date.now()}`;
    const now = nowDateTime();
    const id = createDatasetId(uploadId, now);
    const inspectedCount = values.fileList.length;
    const desensitizedCount = inspectedCount ? Math.max(1, Math.round(inspectedCount * 0.2)) : 0;
    const privacyReportId=`UPRIV-${fixedHashId(uploadId)}`;
    const privacyCheck = { reportId:privacyReportId,status:'通过',inspectedCount,sensitiveCount:desensitizedCount,desensitizedCount,recheckStatus:'通过',storagePolicy:'仅保存脱敏后数据',originalRetained:false,findings:['姓名','手机号','证件号'] };
    const versionId = createVersionId(uploadId);
    const template=PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===values.templateId);
    const version = { id:versionId,version:versionId,note:'用户上传并完成入库隐私检查与自动脱敏',versionKind:'上传脱敏',sourceType:'用户上传',source:uploadId,sourceName:'用户上传处理',uploadJobId:uploadId,uploadPrivacyReportId:privacyReportId,desensitizedSampleCount:desensitizedCount,samples:inspectedCount,updatedAt:now,created:now,consumers:[],privacyCheck,artifactUrl:null,qualityChecked:false,qualityReport:null,qualityReportId:null,sampleQualityLabels:null,templateId:template.id,templateVersion:template.version };
    if (values.uploadMode === 'newVersion' && values.targetDataset) {
      setDatasets(items=>items.map(dataset=>dataset.name!==values.targetDataset?dataset:(()=>{const nextVersion={...version,note:values.description||version.note,sourceDatasetId:dataset.id,sourceVersionId:dataset.defaultVersion};return {...dataset,defaultVersion:versionId,totalSamples:numericSampleCount(dataset.totalSamples)+inspectedCount,updatedAt:now,versions:[nextVersion,...dataset.versions]};})()));
      onUploadingChange(false); message.success(`入库隐私检查与脱敏已完成，已脱敏 ${desensitizedCount} 条数据并创建上传版本`); return;
    }
    const dataset = normalizeDatasets([{id,name:values.name,modality:values.modality,businessType:template.businessType,status:'可用',desc:values.description||'用户上传并完成入库隐私检查与自动脱敏的数据集。',defaultVersion:versionId,totalSamples:inspectedCount,reference:false,sourceType:'用户上传',updatedAt:now,templateId:template.id,templateVersion:template.version,versions:[version]}])[0];
    setDatasets(items=>[dataset,...items]); onUploadingChange(false); message.success(`入库隐私检查与脱敏已完成，已脱敏 ${desensitizedCount} 条数据并创建数据集`);
  };
  const datasetBusinessTypeOptions=useMemo(()=>[...new Set(datasets.map(dataset=>dataset.businessType).filter(Boolean))].sort(),[datasets]);
  const list=datasets.filter(dataset=>(modality==='全部'||dataset.modality===modality)&&(sourceFilter==='全部'||(dataset.sourceType||'任务生成')===sourceFilter)&&(businessTypeFilter==='全部'||dataset.businessType===businessTypeFilter)&&(!query||String(dataset.name||'').includes(query)||String(dataset.id||'').includes(query)||String(dataset.businessType||'').includes(query)));
  const downloadUrl=(dataset,version)=>version.artifactUrl||`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({dataset:{id:dataset.id,name:dataset.name,type:dataset.modality},version:{id:version.version,kind:version.versionKind,description:version.note,dataCount:numericSampleCount(version.samples),sourceTask:{name:version.sourceName,id:version.source},sourceDatasetVersion:{datasetId:version.sourceDatasetId,versionId:version.sourceVersionId},template:{id:version.templateId,version:version.templateVersion},updatedAt:version.updatedAt}},null,2))}`;
  const startVersionTask=(dataset,version,taskType)=>Modal.confirm({title:`创建${taskType}任务？`,content:`将锁定“${dataset.name} / ${version.version}”及其模板、质检报告作为任务输入。`,okText:'进入配置',cancelText:'取消',onOk:()=>{setVersionDetail(null);setDetail(null);onStartTask?.(dataset,version,taskType);}});
  const taskDetailUrl=(dataset,version,task)=>{const params=new URLSearchParams({downstreamTask:task.id,datasetId:String(dataset.id),versionId:version.version});return `${window.location.pathname}?${params.toString()}`;};
  const deleteVersion=(dataset,version)=>Modal.confirm({title:`删除 ${dataset.name} / ${version.version}？`,icon:<ExclamationCircleOutlined/>,width:580,content:<Alert type="error" showIcon message="删除后将永久移除该版本的数据、预览、报告和下游任务关联。历史任务仍保留，但对应版本将显示为“已删除”。此操作不可恢复。"/>,okText:'确认删除版本',okType:'danger',cancelText:'取消',onOk:()=>{updateDataset(dataset.id,current=>{const versions=current.versions.filter(item=>item.id!==version.id);return {...current,versions,defaultVersion:current.defaultVersion===version.version?(versions[0]?.version||'-'):current.defaultVersion,updatedAt:versions[0]?.updatedAt||current.updatedAt};});setVersionDetail(null);message.success('数据集版本已删除');}});
  const deleteDataset=dataset=>Modal.confirm({title:'是否删除该数据集及所有版本？',icon:<ExclamationCircleOutlined/>,width:600,content:<><Paragraph>数据集“<Text strong>{dataset.name}</Text>”包含 <Text strong>{dataset.versions.length}</Text> 个不可变版本。</Paragraph><Alert type="error" showIcon message="确认后将删除数据集及其全部版本，此操作不可恢复。"/></>,okText:'删除全部版本',okType:'danger',cancelText:'取消',onOk:()=>{setDatasets(items=>items.filter(item=>item.id!==dataset.id));setDetail(null);message.success('数据集及其全部版本已删除');}});
  const saveDescription=()=>{const next=descriptionDraft.trim();if(!next){message.warning('数据集描述不能为空');return;}updateDataset(detail.id,dataset=>({...dataset,desc:next,updatedAt:nowDateTime()}));setDescriptionEditing(false);message.success('数据集描述已更新');};
  const datasetColumns=[
    {title:'数据集名称 / ID',dataIndex:'name',width:260,render:(value,row)=><div><Button type="link" className="name-link" onClick={()=>setDetail(row)}>{value}</Button><div className="muted-id">{row.id}</div></div>},
    {title:'数据类型',dataIndex:'modality',width:120,render:value=><Tag color={modalityColor[value]}>{value}</Tag>},
    {title:'业务类型',dataIndex:'businessType',width:130},{title:'来源',dataIndex:'sourceType',width:120},{title:'版本数',width:110,render:(_,row)=>row.versions?.length??0},
    {title:'总样本数',dataIndex:'totalSamples',width:130,render:value=>numericSampleCount(value).toLocaleString()},{title:'更新时间',width:185,render:(_,row)=>formatDateTime(row.updatedAt||row.versions?.[0]?.updatedAt)},
    {title:'操作',fixed:'right',width:130,render:(_,row)=><Space size={0}><Button type="link" size="small" onClick={()=>setDetail(row)}>详情</Button><Button type="link" size="small" danger onClick={()=>deleteDataset(row)}>删除</Button></Space>},
  ];
  const versionColumns=detail?[
    {title:'版本 ID',dataIndex:'version',width:150,render:value=><Text code copyable>{value}</Text>},{title:'版本描述',dataIndex:'note',width:230},{title:'数据量',dataIndex:'samples',width:120,render:value=>numericSampleCount(value).toLocaleString()},
    {title:'来源任务',width:230,render:(_,version)=>version.sourceType==='用户上传'?'-':<Button type="link" className="trace-link" onClick={()=>setSourceTaskDetail({id:version.source,name:version.sourceName,taskType:version.versionKind,updatedAt:version.updatedAt,inputVersionId:version.sourceVersionId,outputVersionId:version.version})}><div><span>{version.sourceName||'-'}</span><div className="muted-id">{version.source||'-'}</div></div></Button>},
    {title:'来源数据集版本',width:250,render:(_,version)=>version.sourceVersionId?<Button type="link" className="trace-link" onClick={()=>{const sourceDataset=datasets.find(item=>item.id===version.sourceDatasetId)||detail;const sourceVersion=sourceDataset?.versions.find(item=>item.version===version.sourceVersionId);if(sourceVersion)setVersionDetail({dataset:sourceDataset,version:sourceVersion});}}><div><span>{(datasets.find(item=>item.id===version.sourceDatasetId)||detail)?.name}</span><div className="muted-id">{version.sourceVersionId}</div></div></Button>:'-'},
    {title:'更新时间',dataIndex:'updatedAt',width:185,render:formatDateTime},
    {title:'操作',fixed:'right',width:430,render:(_,version)=>{const canQuality=Boolean(version.templateId);const canEnhance=isFullQualityVersion(version);const canExpand=canEnhance;const hasCoverageGaps=Boolean(version.qualityReport?.coverageGaps?.length);return <Space size={0} className="dataset-version-actions"><Button type="link" size="small" onClick={()=>setVersionDetail({dataset:detail,version})}>详情</Button><Button type="link" size="small" href={downloadUrl(detail,version)} download={`${detail.name}-${version.version}.json`}>下载</Button><Button type="link" size="small" disabled={!canQuality} title={canQuality?'按绑定模板发起全量或部分质检':'该版本缺少模板血缘，请先绑定模板'} onClick={()=>startVersionTask(detail,version,'数据质检')}>质检</Button><Button type="link" size="small" disabled={!canEnhance} title={canEnhance?'基于正式全量质检结果发起增强':'部分抽检不能作为下游准入依据，请先完成正式全量质检'} onClick={()=>startVersionTask(detail,version,'数据增强')}>增强</Button><Button type="link" size="small" disabled={!canExpand} title={canExpand?(hasCoverageGaps?'基于覆盖缺口或自定义设置发起扩增':'当前无系统覆盖缺口，可使用自定义扩增设置'):'需先完成正式全量质检'} onClick={()=>startVersionTask(detail,version,'定向扩增')}>扩增</Button><Button type="link" size="small" danger onClick={()=>deleteVersion(detail,version)}>删除</Button></Space>;}},
  ]:[];
  const downstreamColumns=versionDetail?[
    {title:'任务名称 / ID',width:280,render:(_,task)=><div><Text>{task.name}</Text><div className="muted-id">{task.id}</div></div>},{title:'任务类型',dataIndex:'taskType',width:110,render:value=><Tag color={taskTypeColor(value)}>{value}</Tag>},{title:'更新时间',dataIndex:'updatedAt',width:185,render:formatDateTime},{title:'操作',fixed:'right',width:90,render:(_,task)=><Button type="link" size="small" href={taskDetailUrl(versionDetail.dataset,versionDetail.version,task)} target="_blank" rel="noreferrer">详情</Button>},
  ]:[];
  if(uploading)return <UploadDatasetPage onCancel={()=>onUploadingChange(false)} onSubmit={createUploadedDataset} datasets={datasets}/>;
  return <>
    <PageHeader title="数据中心" description="集中查看、预览和下载任务产生的数据集及不可变版本" actions={<Button type="primary" icon={<CloudUploadOutlined/>} onClick={()=>onUploadingChange(true)}>上传数据</Button>}/>
    <Card className="main-card" styles={{body:{padding:0}}}><Flex justify="space-between" align="center" className="toolbar"><Space><Segmented value={modality} onChange={value=>{setModality(value);setBusinessTypeFilter('全部');}} options={[{label:'全部',value:'全部'},{label:'文档类图像',value:'文档图像'},{label:'对话',value:'对话文本'},{label:'时序',value:'时序数据'}]}/><Select value={sourceFilter} onChange={setSourceFilter} style={{width:140}} options={[{label:'全部来源',value:'全部'},{label:'任务生成',value:'任务生成'},{label:'用户上传',value:'用户上传'}]}/><Select value={businessTypeFilter} onChange={setBusinessTypeFilter} style={{width:170}} options={[{label:'全部业务类型',value:'全部'},...datasetBusinessTypeOptions.map(value=>({label:value,value}))]}/></Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索名称、ID或业务类型" value={query} onChange={event=>setQuery(event.target.value)} style={{width:250}}/></Flex><Table rowKey="id" columns={datasetColumns} dataSource={list} scroll={{x:1180}} pagination={{pageSize:8,showTotal:total=>`共 ${total} 条`}}/></Card>
    <Drawer title="数据集详情" size={1240} open={!!detail} onClose={()=>setDetail(null)}>{detail&&<><Title level={4}>{detail.name}</Title><Descriptions bordered size="small" column={2} className="dataset-kv-details" items={[
      {key:'modality',label:'数据类型',children:detail.modality},{key:'business',label:'业务类型',children:detail.businessType},{key:'source',label:'来源',children:detail.sourceType||'任务生成'},{key:'samples',label:'总样本数',children:numericSampleCount(detail.totalSamples).toLocaleString()},{key:'updated',label:'更新时间',children:formatDateTime(detail.updatedAt||detail.versions?.[0]?.updatedAt)},{key:'description',label:'数据集描述',span:2,children:<Flex justify="space-between" align="center" gap={16}><Text>{detail.desc}</Text><Button type="link" size="small" onClick={()=>{setDescriptionDraft(detail.desc||'');setDescriptionEditing(true);}}>编辑</Button></Flex>},
    ]}/><Title level={5} className="section-title">数据集版本</Title><Table rowKey="id" scroll={{x:1620}} dataSource={detail.versions} columns={versionColumns} pagination={{pageSize:5,showSizeChanger:false,hideOnSinglePage:true,showTotal:total=>`共 ${total} 个版本`}}/></>}</Drawer>
    <Modal title="编辑数据集描述" open={descriptionEditing} onCancel={()=>setDescriptionEditing(false)} onOk={saveDescription} okText="保存" cancelText="取消"><Input.TextArea rows={5} value={descriptionDraft} maxLength={300} showCount onChange={event=>setDescriptionDraft(event.target.value)}/></Modal>
    <Drawer title="数据集版本详情" size={900} open={!!versionDetail} onClose={()=>setVersionDetail(null)}>{versionDetail&&<><Title level={4}>{versionDetail.dataset.name} / {versionDetail.version.version}</Title><Tabs defaultActiveKey="base" items={[
      {key:'base',label:'基础信息',children:<><Descriptions bordered column={2} className="detail-descriptions" items={[
        {key:'description',label:'版本描述',children:versionDetail.version.note},{key:'count',label:'数据量',children:numericSampleCount(versionDetail.version.samples).toLocaleString()},{key:'kind',label:'版本类型',children:<Tag>{versionDetail.version.versionKind||'-'}</Tag>},{key:'updated',label:'更新时间',children:formatDateTime(versionDetail.version.updatedAt||versionDetail.version.created)},
        {key:'source',label:'来源任务',children:<Button type="link" className="trace-link" onClick={()=>setSourceTaskDetail({id:versionDetail.version.source,name:versionDetail.version.sourceName,taskType:versionDetail.version.versionKind,updatedAt:versionDetail.version.updatedAt,inputVersionId:versionDetail.version.sourceVersionId,outputVersionId:versionDetail.version.version})}><div><span>{versionDetail.version.sourceName||'-'}</span><div className="muted-id">{versionDetail.version.source||'-'}</div></div></Button>},
        {key:'source-version',label:'来源数据集版本',children:versionDetail.version.sourceVersionId?<Button type="link" className="trace-link" onClick={()=>{const sourceDataset=datasets.find(item=>item.id===versionDetail.version.sourceDatasetId)||versionDetail.dataset;const sourceVersion=sourceDataset?.versions.find(item=>item.version===versionDetail.version.sourceVersionId);if(sourceVersion)setVersionDetail({dataset:sourceDataset,version:sourceVersion});}}><div><span>{(datasets.find(item=>item.id===versionDetail.version.sourceDatasetId)||versionDetail.dataset)?.name}</span><div className="muted-id">{versionDetail.version.sourceVersionId}</div></div></Button>:'-'},
        {key:'template',label:'模板血缘',span:2,children:<Text>{PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===versionDetail.version.templateId)?.name||versionDetail.version.templateId||'-'} / {versionDetail.version.templateVersion||'-'}</Text>},
        {key:'relation',label:'版本生成关系',span:2,children:<Space wrap><Tag>{versionDetail.version.sourceVersionId||'无来源版本'}</Tag><Text>→</Text><Tag color="blue">{versionDetail.version.sourceName||versionDetail.version.source||'-'}</Tag><Text>→</Text><Tag color="green">{versionDetail.version.version}</Tag></Space>},
      ]}/>{versionDetail.version.privacyCheck&&<><Title level={5}>上传隐私检查与脱敏结果</Title><Alert type="success" showIcon message={`隐私复检${versionDetail.version.privacyCheck.recheckStatus}，已脱敏 ${versionDetail.version.privacyCheck.desensitizedCount} 条数据`} description="这是上传入库安全门禁，不等同于模板正式质检；当前版本只包含脱敏后的数据，原始数据未被保留。"/><Descriptions bordered column={2} className="detail-descriptions" items={[
        {key:'privacy-id',label:'上传隐私报告 ID',children:<Text copyable>{versionDetail.version.uploadPrivacyReportId||versionDetail.version.privacyCheck.reportId}</Text>},{key:'privacy-status',label:'检查结果',children:<Tag color="green">{versionDetail.version.privacyCheck.status}</Tag>},{key:'privacy-inspected',label:'检查数据数',children:versionDetail.version.privacyCheck.inspectedCount},{key:'privacy-sensitive',label:'发现敏感数据',children:versionDetail.version.privacyCheck.sensitiveCount},{key:'privacy-masked',label:'完成脱敏数据',children:versionDetail.version.privacyCheck.desensitizedCount},{key:'privacy-types',label:'敏感信息类型',children:versionDetail.version.privacyCheck.findings.join('、')},{key:'privacy-storage',label:'数据保存策略',children:versionDetail.version.privacyCheck.storagePolicy},
      ]}/></>}<Title level={5}>下游任务</Title><Table rowKey="id" size="small" scroll={{x:720}} dataSource={versionDetail.version.consumers||[]} columns={downstreamColumns} pagination={{pageSize:5,showSizeChanger:false}} locale={{emptyText:'暂无下游任务'}}/></>},
      {key:'quality',label:'质检报告',children:<><VersionQualityReport dataset={versionDetail.dataset} version={versionDetail.version}/>{versionDetail.version.enhancementSettings&&<><Title level={5} className="section-title">本版本增强设置</Title><Descriptions bordered size="small" column={2} items={[{key:'selection',label:'选样方式',children:versionDetail.version.enhancementSettings.sampleSelection==='pass'?'全部 PASS 样本':`综合分不低于 ${versionDetail.version.enhancementSettings.selectionThreshold}`},{key:'methods',label:'增强方法',children:(versionDetail.version.enhancementSettings.methods||[]).join('、')||'-'},{key:'custom',label:'自定义方案',children:versionDetail.version.enhancementSettings.custom?.name||'-'},{key:'privacy',label:'隐私脱敏方式',children:versionDetail.version.enhancementSettings.privacyMethods?Object.entries(versionDetail.version.enhancementSettings.privacyMethods).map(([type,method])=>`${type}：${method}`).join('；'):'-'}]}/></>}{versionDetail.version.expansionSettings&&<><Title level={5} className="section-title">本版本定向扩增设置</Title><Descriptions bordered size="small" column={2} items={[{key:'gaps',label:'系统建议项',children:(versionDetail.version.expansionSettings.coverageGapKeys||[]).join('、')||'-'},{key:'custom',label:'自定义设置',children:(versionDetail.version.expansionSettings.customSettings||[]).map(item=>`${item.name}（${item.count}）`).join('；')||'-'}]}/></>}</>},
    ]}/></>}</Drawer>
    <Drawer title="来源任务详情" size={680} open={!!sourceTaskDetail} onClose={()=>setSourceTaskDetail(null)}>{sourceTaskDetail&&<Descriptions bordered column={1} items={[{key:'name',label:'任务名称',children:sourceTaskDetail.name||'-'},{key:'id',label:'任务 ID',children:<Text copyable>{sourceTaskDetail.id||'-'}</Text>},{key:'type',label:'任务类型',children:<Tag>{sourceTaskDetail.taskType||'-'}</Tag>},{key:'input',label:'输入版本 ID',children:sourceTaskDetail.inputVersionId||'-'},{key:'output',label:'输出版本 ID',children:sourceTaskDetail.outputVersionId||'-'},{key:'updated',label:'更新时间',children:formatDateTime(sourceTaskDetail.updatedAt)}]}/>}</Drawer>
  </>;
}

const DATASET_STORAGE_KEY='data-factory-datasets-v3';
function loadDatasets(){try{const value=window.localStorage.getItem(DATASET_STORAGE_KEY);return normalizeDatasets(value?JSON.parse(value):initialDatasets);}catch{return normalizeDatasets(initialDatasets);}}

function PrototypeApp(){
  const [view,setView]=useState('home'); const [datasets,setDatasets]=useState(loadDatasets); const [quickCreate,setQuickCreate]=useState(null); const [datasetStoreReady,setDatasetStoreReady]=useState(false); const [templateCreating,setTemplateCreating]=useState(false); const [datasetUploading,setDatasetUploading]=useState(false); const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  useEffect(()=>{let active=true;localStoreApi.getState().then(state=>{if(active&&state.exists&&Array.isArray(state.datasets))setDatasets(normalizeDatasets(state.datasets));}).catch(error=>console.warn('数据集状态恢复失败',error)).finally(()=>{if(active)setDatasetStoreReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(!datasetStoreReady)return;window.localStorage.setItem(DATASET_STORAGE_KEY,JSON.stringify(datasets));localStoreApi.saveState({datasets}).catch(error=>console.warn('数据集状态保存失败',error));},[datasets,datasetStoreReady]);
  useEffect(()=>{if(view!=='data')setDatasetUploading(false);},[view]);
  const menuItems=[{key:'home',icon:<HomeOutlined/>,label:'首页'},{key:'data',icon:<DatabaseOutlined/>,label:'数据中心'},{key:'tasks',icon:<AppstoreOutlined/>,label:'任务中心',children:Object.entries(taskPageConfig).map(([key,item])=>({key,icon:item.icon,label:item.label}))},{key:'templates',icon:<ApartmentOutlined/>,label:'模板中心'}];
  const bottomMenuItems=[{key:'apiKeys',icon:<KeyOutlined/>,label:'API Keys'}];
  const nameMap={home:'首页',data:'数据中心',templates:'模板中心',apiKeys:'API Keys'};
  const activeTaskPage=taskPageConfig[view];
  const createTask=type=>{setQuickCreate(type);setView('tasks-document');};
  const breadcrumbItems=view==='home'?[{title:'首页'}]:activeTaskPage?[{title:'首页',onClick:()=>setView('home')},{title:'任务中心'},{title:activeTaskPage.label}]:[{title:'首页',onClick:()=>setView('home')},{title:nameMap[view],onClick:view==='templates'?()=>{setTemplateCreating(false);setView('templates');}:view==='data'?()=>{setDatasetUploading(false);setView('data');}:undefined},...(view==='templates'&&templateCreating?[{title:typeof templateCreating==='string'?templateCreating:'新建模板'}]:[]),...(view==='data'&&datasetUploading?[{title:'上传数据集'}]:[])];
  const handleUserMenuClick=({key})=>{
    if(key==='profile')Modal.info({
      title:'个人信息',width:520,okText:'关闭',
      content:<Flex vertical align="center" gap={18} className="profile-modal-content"><Avatar size={72}>FD</Avatar><Descriptions bordered size="small" column={1} style={{width:'100%'}} items={[{key:'username',label:'用户名',children:CURRENT_USER},{key:'account',label:'账号',children:'feidongni'}]}/></Flex>,
    });
    if(key==='logout')Modal.confirm({
      title:'确认退出登录？',content:'退出后需要重新登录才能继续使用数据生成工具。',okText:'确认退出',okType:'danger',cancelText:'取消',onOk:()=>{},
    });
  };
  const routeParams=new URLSearchParams(window.location.search);
  const downstreamTaskId=routeParams.get('downstreamTask');
  if(downstreamTaskId){
    const dataset=datasets.find(item=>String(item.id)===routeParams.get('datasetId'))||datasets.find(item=>item.versions.some(version=>version.consumers?.some(task=>task.id===downstreamTaskId)));
    const version=dataset?.versions.find(item=>item.version===routeParams.get('versionId'))||dataset?.versions.find(item=>item.consumers?.some(task=>task.id===downstreamTaskId));
    const task=version?.consumers?.find(item=>item.id===downstreamTaskId);
    return <ConfigProvider locale={zhCN}><AntApp><DownstreamTaskDetailPage task={task} dataset={dataset} version={version}/></AntApp></ConfigProvider>;
  }
  return <ConfigProvider locale={zhCN} theme={{token:{colorPrimary:'#1677ff',borderRadius:6,colorBgLayout:'#f5f5f5',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'},components:{Layout:{siderBg:'#001529',headerBg:'#fff'},Menu:{darkItemBg:'#001529',darkItemSelectedBg:'#1677ff'}}}}><AntApp><Layout className={`app-layout${sidebarCollapsed?' app-layout-collapsed':''}`}><Sider width={224} collapsedWidth={72} collapsed={sidebarCollapsed} trigger={null} theme="dark" className="app-sider"><div className="brand"><Avatar shape="square" size={36} className="brand-logo">数</Avatar>{!sidebarCollapsed&&<div className="brand-name">数据生成工具</div>}<Button type="text" className="brand-collapse-button" icon={sidebarCollapsed?<MenuUnfoldOutlined/>:<MenuFoldOutlined/>} aria-label={sidebarCollapsed?'展开左侧菜单':'收起左侧菜单'} onClick={()=>setSidebarCollapsed(value=>!value)}/></div><Menu className="app-main-menu" theme="dark" mode="inline" defaultOpenKeys={['tasks']} selectedKeys={[view]} items={menuItems} onClick={({key})=>{setQuickCreate(null);setView(key);}}/><Menu className="app-bottom-menu" theme="dark" mode="inline" selectedKeys={[view]} items={bottomMenuItems} onClick={({key})=>{setQuickCreate(null);setView(key);}}/><Dropdown trigger={['click']} placement={sidebarCollapsed?'topRight':'topLeft'} menu={{items:[{key:'profile',label:'个人信息'},{key:'logout',label:'退出登录'}],onClick:handleUserMenuClick}}><div className={`sidebar-user${sidebarCollapsed?' collapsed':''}`}><Avatar size={32}>FD</Avatar>{!sidebarCollapsed&&<><div className="sidebar-user-text"><Text>{CURRENT_USER}</Text><span>当前用户</span></div><DownOutlined/></>}</div></Dropdown></Sider><Layout><Header className="app-header"><Flex align="center"><Breadcrumb items={breadcrumbItems}/></Flex></Header><Content className="app-content">{view==='home'?<HomePage onNavigate={setView} onCreate={createTask}/>:activeTaskPage?<TaskCenter datasets={datasets} setDatasets={setDatasets} modality={activeTaskPage.modality} pageTitle={activeTaskPage.label} startCreate={quickCreate} onStartConsumed={()=>setQuickCreate(null)} onNavigate={setView}/>:view==='templates'?<TemplateCenter creating={templateCreating} onCreatingChange={setTemplateCreating}/>:view==='apiKeys'?<ApiKeysManager/>:<DataCenter datasets={datasets} setDatasets={setDatasets} uploading={datasetUploading} onUploadingChange={setDatasetUploading} onStartTask={(dataset,version,taskType)=>{const target=Object.entries(taskPageConfig).find(([,item])=>item.modality===dataset.modality)?.[0]||'tasks-document';setQuickCreate({taskType,inputDatasetId:dataset.id,inputVersionId:version.version});setView(target);}}/>}</Content></Layout></Layout></AntApp></ConfigProvider>;
}

const qualityReportMatch = window.location.pathname.match(/^\/reports\/customs\/([^/]+)\/quality\/?$/);
const coldChainQualityReportMatch = window.location.pathname.match(/^\/reports\/cold-chain\/([^/]+)\/quality\/?$/);
const conversationQualityReportMatch = window.location.pathname.match(/^\/reports\/conversations\/([^/]+)\/quality\/?$/);
createRoot(document.getElementById('root')).render(
  qualityReportMatch
    ? <ConfigProvider locale={zhCN}><AntApp><CustomsQualityReportPage jobId={decodeURIComponent(qualityReportMatch[1])}/></AntApp></ConfigProvider>
    : coldChainQualityReportMatch
      ? <ConfigProvider locale={zhCN}><AntApp><ColdChainQualityReportPage jobId={decodeURIComponent(coldChainQualityReportMatch[1])}/></AntApp></ConfigProvider>
      : conversationQualityReportMatch
        ? <ConfigProvider locale={zhCN}><AntApp><ConversationQualityReportPage jobId={decodeURIComponent(conversationQualityReportMatch[1])}/></AntApp></ConfigProvider>
        : <PrototypeApp/>
);
