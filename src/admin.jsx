import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert, App as AntApp, Avatar, Badge, Breadcrumb, Button, Card, Col, ConfigProvider, DatePicker,
  Descriptions, Divider, Drawer, Dropdown, Empty, Flex, Form, Input, InputNumber,
  Layout, Menu, Modal, Progress, Radio, Row, Segmented, Select, Space, Statistic,
  Table, Tabs, Tag, Timeline, Tooltip, Typography, message
} from 'antd';
import {
  ApiOutlined, AppstoreOutlined, AuditOutlined, BarChartOutlined,
  CheckCircleOutlined, CloudServerOutlined, DashboardOutlined, DatabaseOutlined,
  DeleteOutlined, DownOutlined, EditOutlined, ExclamationCircleOutlined,
  EyeOutlined, FileSearchOutlined, FileTextOutlined, FilterOutlined, FundOutlined,
  KeyOutlined, MenuFoldOutlined, PauseCircleOutlined, PlayCircleOutlined,
  PlusOutlined, ReloadOutlined, SearchOutlined,
  TeamOutlined, UserOutlined, WarningOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { INITIAL_KEYS, KeyEditor, PROVIDERS, ProviderMark } from './ApiKeysManager';
import { formatDateTime, nowDateTime } from './timeUtils';
import './admin-styles.css';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const ADMIN_USER = 'admin';

/* ─── Mock Data ────────────────────────────────────────────────── */
const mockUsers = [
  { id: 'U001', name: 'feidongni', email: 'feidongni@company.com', role: '管理员', department: '数据产品部', status: '正常', taskCount: 128, quota: 500, quotaUsed: 312, apiQuota: 10000, apiQuotaUsed: 6820, storageQuota: 100, storageUsed: 43.6, lastActive: '2026-08-27 09:12:00', created: '2025-11-02 00:00:00', allowPaidApi: true, paidBudget: 500 },
  { id: 'U002', name: 'zhangsan', email: 'zhangsan@company.com', role: '普通用户', department: '算法研发部', status: '正常', taskCount: 86, quota: 300, quotaUsed: 241, apiQuota: 5000, apiQuotaUsed: 4650, storageQuota: 50, storageUsed: 38.2, lastActive: '2026-08-27 08:45:00', created: '2025-12-10 00:00:00', allowPaidApi: true, paidBudget: 200 },
  { id: 'U003', name: 'lisi', email: 'lisi@company.com', role: '普通用户', department: '算法研发部', status: '正常', taskCount: 53, quota: 300, quotaUsed: 127, apiQuota: 5000, apiQuotaUsed: 2100, storageQuota: 50, storageUsed: 19.8, lastActive: '2026-08-26 17:30:00', created: '2026-01-08 00:00:00', allowPaidApi: false, paidBudget: 0 },
  { id: 'U004', name: 'wangwu', email: 'wangwu@company.com', role: '普通用户', department: '质量工程部', status: '已禁用', taskCount: 22, quota: 200, quotaUsed: 198, apiQuota: 3000, apiQuotaUsed: 2950, storageQuota: 30, storageUsed: 28.4, lastActive: '2026-08-15 14:22:00', created: '2026-02-20 00:00:00', allowPaidApi: false, paidBudget: 0 },
  { id: 'U005', name: 'zhaoliu', email: 'zhaoliu@company.com', role: '只读用户', department: '项目管理部', status: '正常', taskCount: 0, quota: 50, quotaUsed: 12, apiQuota: 500, apiQuotaUsed: 80, storageQuota: 10, storageUsed: 2.1, lastActive: '2026-08-27 07:58:00', created: '2026-03-15 00:00:00', allowPaidApi: false, paidBudget: 0 },
  { id: 'U006', name: 'sunqi', email: 'sunqi@company.com', role: '普通用户', department: '数据产品部', status: '待审批', taskCount: 0, quota: 0, quotaUsed: 0, apiQuota: 0, apiQuotaUsed: 0, storageQuota: 0, storageUsed: 0, lastActive: '-', created: '2026-08-26', allowPaidApi: false, paidBudget: 0 },
  { id: 'U007', name: 'zhouba', email: 'zhouba@company.com', role: '管理员', department: '基础架构部', status: '正常', taskCount: 64, quota: 500, quotaUsed: 88, apiQuota: 10000, apiQuotaUsed: 1320, storageQuota: 100, storageUsed: 12.5, lastActive: '2026-08-27 10:05:00', created: '2025-11-02 00:00:00', allowPaidApi: true, paidBudget: 800 },
  { id: 'U008', name: 'qianjiu', email: 'qianjiu@company.com', role: '普通用户', department: '算法研发部', status: '正常', taskCount: 41, quota: 300, quotaUsed: 155, apiQuota: 5000, apiQuotaUsed: 3200, storageQuota: 50, storageUsed: 22.7, lastActive: '2026-08-26 19:40:00', created: '2026-04-11 00:00:00', allowPaidApi: true, paidBudget: 200 },
];

const actionTypeColors = { 登录: 'blue', 创建任务: 'cyan', 删除数据集: 'red', 修改配置: 'orange', 导出数据: 'green', 用户管理: 'purple', 系统操作: 'default' };
const mockOperationLogs = [
  { id: 1, time: '2026-08-27 10:12:33', user: 'feidongni', avatar: 'FD', actionType: '创建任务', target: '任务 TASK-20260827-0051', detail: '创建文档图像数据生成任务"物流运单批量生成 V4"', ip: '10.20.3.45', result: '成功' },
  { id: 2, time: '2026-08-27 10:08:17', user: 'zhangsan', avatar: 'ZS', actionType: '导出数据', target: '数据集 报关单与合同数据集 / V3', detail: '导出报关单数据集 V3，共 126K 条', ip: '10.20.3.88', result: '成功' },
  { id: 3, time: '2026-08-27 09:55:42', user: 'lisi', avatar: 'LS', actionType: '创建任务', target: '任务 TASK-20260827-0050', detail: '创建对话文本数据评估与优化任务', ip: '10.20.3.91', result: '成功' },
  { id: 4, time: '2026-08-27 09:42:10', user: 'feidongni', avatar: 'FD', actionType: '修改配置', target: 'API Key Intern 生产环境', detail: '更新 Intern API 模型配置，新增模型 intern-s3-preview', ip: '10.20.3.45', result: '成功' },
  { id: 5, time: '2026-08-27 09:30:05', user: 'zhouba', avatar: 'ZB', actionType: '用户管理', target: '用户 wangwu', detail: '禁用用户 wangwu，原因：月度额度已用尽', ip: '10.20.1.12', result: '成功' },
  { id: 6, time: '2026-08-27 09:15:22', user: 'qianjiu', avatar: 'QJ', actionType: '创建任务', target: '任务 TASK-20260827-0049', detail: '创建时序数据生成任务"GPS 轨迹扩增"', ip: '10.20.3.107', result: '成功' },
  { id: 7, time: '2026-08-27 08:58:44', user: 'zhangsan', avatar: 'ZS', actionType: '删除数据集', target: '数据集 测试用临时数据', detail: '删除数据集"测试用临时数据"及其全部 2 个版本', ip: '10.20.3.88', result: '成功' },
  { id: 8, time: '2026-08-27 08:45:30', user: 'zhangsan', avatar: 'ZS', actionType: '登录', target: '-', detail: '登录平台，IP: 10.20.3.88', ip: '10.20.3.88', result: '成功' },
  { id: 9, time: '2026-08-27 08:30:12', user: 'feidongni', avatar: 'FD', actionType: '登录', target: '-', detail: '登录平台，IP: 10.20.3.45', ip: '10.20.3.45', result: '成功' },
  { id: 10, time: '2026-08-27 08:12:05', user: 'sunqi', avatar: 'SQ', actionType: '登录', target: '-', detail: '新用户注册后首次登录', ip: '10.20.5.22', result: '成功' },
  { id: 11, time: '2026-08-26 18:42:33', user: 'lisi', avatar: 'LS', actionType: '创建任务', target: '任务 TASK-20260826-0048', detail: '创建冷链时序数据生成任务', ip: '10.20.3.91', result: '失败' },
  { id: 12, time: '2026-08-26 17:55:10', user: 'qianjiu', avatar: 'QJ', actionType: '修改配置', target: '模板 进口报关单标准模板 V1', detail: '更新报关单模板字段规则配置', ip: '10.20.3.107', result: '成功' },
  { id: 13, time: '2026-08-26 17:30:22', user: 'lisi', avatar: 'LS', actionType: '导出数据', target: '数据集 物流客服多轮对话 / V4', detail: '导出对话数据集 V4 用于外部训练', ip: '10.20.3.91', result: '成功' },
  { id: 14, time: '2026-08-26 16:20:45', user: 'zhouba', avatar: 'ZB', actionType: '用户管理', target: '用户 sunqi', detail: '创建新用户 sunqi，角色：普通用户，待审批', ip: '10.20.1.12', result: '成功' },
  { id: 15, time: '2026-08-26 15:10:08', user: 'feidongni', avatar: 'FD', actionType: '修改配置', target: '平台 API OCR 质检服务', detail: '更新 OCR 质检 API 速率限制从 10 QPS 调整为 20 QPS', ip: '10.20.3.45', result: '成功' },
  { id: 16, time: '2026-08-26 14:05:33', user: 'wangwu', avatar: 'WW', actionType: '创建任务', target: '任务 TASK-20260826-0046', detail: '创建文档图像数据生成任务，因额度不足被拒绝', ip: '10.20.3.66', result: '失败' },
  { id: 17, time: '2026-08-26 11:30:18', user: 'zhangsan', avatar: 'ZS', actionType: '系统操作', target: '数据中心', detail: '批量清理过期数据集版本（3 个版本）', ip: '10.20.3.88', result: '成功' },
  { id: 18, time: '2026-08-26 10:15:44', user: 'feidongni', avatar: 'FD', actionType: '用户管理', target: '用户 zhaoliu', detail: '将 zhaoliu 角色从普通用户变更为只读用户', ip: '10.20.1.12', result: '成功' },
];

const statusMap = { 运行中: 'processing', 已完成: 'success', 失败: 'error', 排队中: 'warning' };
const modalityColor = { 文档图像: 'blue', 对话文本: 'geekblue', 时序数据: 'green' };
const mockTaskLogs = [
  { key: '1', id: 'TASK-20260827-0051', name: '物流运单批量生成 V4', owner: 'feidongni', modality: '文档图像', taskType: '数据生成', status: '运行中', progress: 45, startTime: '2026-08-27 10:12:00', duration: '18 分钟', stages: ['生成', '增强'], currentStage: '图像增强中' },
  { key: '2', id: 'TASK-20260827-0050', name: '客服对话质量评估', owner: 'lisi', modality: '对话文本', taskType: '数据评估与优化', status: '运行中', progress: 72, startTime: '2026-08-27 09:55:00', duration: '35 分钟', stages: ['质量评估', '覆盖评估'], currentStage: '覆盖评估分析中' },
  { key: '3', id: 'TASK-20260827-0049', name: 'GPS 轨迹扩增', owner: 'qianjiu', modality: '时序数据', taskType: '数据生成', status: '排队中', progress: 0, startTime: '2026-08-27 09:15:00', duration: '-', stages: ['生成', '增强', '质量评估'], currentStage: '等待资源分配' },
  { key: '4', id: 'TASK-20260826-0048', name: '冷链温湿度异常序列 V4', owner: 'lisi', modality: '时序数据', taskType: '数据生成', status: '失败', progress: 34, startTime: '2026-08-26 18:42:00', duration: '12 分钟', stages: ['生成'], currentStage: 'API 调用超时' },
  { key: '5', id: 'TASK-20260826-0047', name: '报关单覆盖短板优化 V3', owner: 'feidongni', modality: '文档图像', taskType: '数据评估与优化', status: '已完成', progress: 100, startTime: '2026-08-26 16:30:00', duration: '1 小时 22 分钟', stages: ['质量评估', '覆盖评估', '定向扩增'], currentStage: '已完成' },
  { key: '6', id: 'TASK-20260826-0046', name: '合同图像批量生成', owner: 'wangwu', modality: '文档图像', taskType: '数据生成', status: '失败', progress: 0, startTime: '2026-08-26 14:05:00', duration: '-', stages: ['生成'], currentStage: '额度不足被拒绝' },
  { key: '7', id: 'TASK-20260826-0045', name: '投诉对话隐私优化', owner: 'zhangsan', modality: '对话文本', taskType: '数据评估与优化', status: '已完成', progress: 100, startTime: '2026-08-26 11:20:00', duration: '48 分钟', stages: ['隐私评估', '隐私处理'], currentStage: '已完成' },
  { key: '8', id: 'TASK-20260825-0044', name: '冷链传感器时序生成', owner: 'qianjiu', modality: '时序数据', taskType: '数据生成', status: '已完成', progress: 100, startTime: '2026-08-25 09:30:00', duration: '2 小时 15 分钟', stages: ['生成', '增强', '质量评估'], currentStage: '已完成' },
  { key: '9', id: 'TASK-20260825-0043', name: '运单隐私处理', owner: 'lisi', modality: '文档图像', taskType: '数据评估与优化', status: '已完成', progress: 100, startTime: '2026-08-25 08:10:00', duration: '35 分钟', stages: ['隐私评估', '隐私处理'], currentStage: '已完成' },
  { key: '10', id: 'TASK-20260824-0042', name: '异常反馈对话生成 V3', owner: 'zhangsan', modality: '对话文本', taskType: '数据生成', status: '已完成', progress: 100, startTime: '2026-08-24 15:40:00', duration: '1 小时 50 分钟', stages: ['生成', '增强', '隐私处理'], currentStage: '已完成' },
];

const mockPublicApis = [
  { id: 'API-001', name: '文档图像生成 API', endpoint: '/api/v1/document/generate', protocol: 'REST', auth: 'API Key', status: '正常', dailyLimit: 5000, dailyUsed: 2847, rateLimit: 20, timeout: 30000, successRate: 99.2, avgResponse: 1250, p99Response: 3800, totalCalls: 156420, description: '根据模板和参数生成文档类图像' },
  { id: 'API-002', name: '对话数据合成 API', endpoint: '/api/v1/conversation/generate', protocol: 'REST', auth: 'API Key', status: '正常', dailyLimit: 3000, dailyUsed: 1523, rateLimit: 10, timeout: 60000, successRate: 98.7, avgResponse: 2800, p99Response: 8500, totalCalls: 89340, description: '基于模板驱动的多轮对话数据合成' },
  { id: 'API-003', name: '时序数据生成 API', endpoint: '/api/v1/timeseries/generate', protocol: 'REST', auth: 'API Key', status: '正常', dailyLimit: 2000, dailyUsed: 680, rateLimit: 15, timeout: 45000, successRate: 99.5, avgResponse: 1800, p99Response: 5200, totalCalls: 42180, description: '冷链、GPS 等时序数据生成服务' },
  { id: 'API-004', name: 'OCR 质检服务 API', endpoint: '/api/v1/quality/ocr-check', protocol: 'REST', auth: 'API Key', status: '正常', dailyLimit: 8000, dailyUsed: 4210, rateLimit: 30, timeout: 15000, successRate: 99.8, avgResponse: 450, p99Response: 1200, totalCalls: 234560, description: '基于 PP-OCRv5 的文档图像质量检测' },
  { id: 'API-005', name: '隐私评估 API', endpoint: '/api/v1/quality/privacy-check', protocol: 'REST', auth: 'API Key', status: '维护中', dailyLimit: 3000, dailyUsed: 0, rateLimit: 10, timeout: 30000, successRate: 0, avgResponse: 0, p99Response: 0, totalCalls: 67890, description: '对话文本和文档中的敏感信息检测（升级中）' },
  { id: 'API-006', name: '数据导出 API', endpoint: '/api/v1/data/export', protocol: 'REST', auth: 'API Key', status: '正常', dailyLimit: 1000, dailyUsed: 342, rateLimit: 5, timeout: 120000, successRate: 99.1, avgResponse: 5200, p99Response: 15000, totalCalls: 18920, description: '数据集版本打包导出服务' },
];

const hourlyCalls = [120,85,60,45,30,25,40,180,520,780,920,1050,980,870,950,1020,890,760,580,420,350,280,210,160];
const weeklyTasks = [
  { day: '2026-08-21', count: 18 }, { day: '2026-08-22', count: 24 }, { day: '2026-08-23', count: 15 },
  { day: '2026-08-24', count: 32 }, { day: '2026-08-25', count: 28 }, { day: '2026-08-26', count: 21 }, { day: '2026-08-27', count: 14 },
];

const userCallRanks = [
  { user: 'feidongni', avatar: 'FD', calls: 3420, apiCount: 5, quotaRatio: 50 },
  { user: 'zhangsan', avatar: 'ZS', calls: 2650, apiCount: 4, quotaRatio: 93 },
  { user: 'qianjiu', avatar: 'QJ', calls: 1520, apiCount: 3, quotaRatio: 64 },
  { user: 'lisi', avatar: 'LS', calls: 1100, apiCount: 3, quotaRatio: 42 },
  { user: 'zhouba', avatar: 'ZB', calls: 680, apiCount: 2, quotaRatio: 13 },
  { user: 'zhaoliu', avatar: 'ZL', calls: 80, apiCount: 1, quotaRatio: 16 },
];

/* ─── Utility ──────────────────────────────────────────────────── */
function StatusTag({ value }) {
  const map = { 正常: 'green', 已禁用: 'red', 待审批: 'gold', 维护中: 'orange' };
  return <Tag color={map[value] || 'default'}>{value}</Tag>;
}

function PageHeader({ title, description, actions }) {
  return <Flex justify="space-between" align="flex-start" className="page-header"><div><Title level={3}>{title}</Title><Text type="secondary">{description}</Text></div><Space>{actions}</Space></Flex>;
}

/* ─── Operation Logs ───────────────────────────────────────────── */
function OperationLogsPage() {
  const [timeRange, setTimeRange] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const operationJson = record => JSON.stringify({schema_version:'operation-log/v1',operation_id:`OPLOG-${String(record.id).padStart(6,'0')}`,...record,time:formatDateTime(record.time),updated_at:formatDateTime(record.time)},null,2);
  const copyOperationJson = async () => { await navigator.clipboard.writeText(operationJson(detail)); message.success('JSON 已复制'); };
  const filtered = useMemo(() => mockOperationLogs.filter(log =>
    (actionFilter === 'all' || log.actionType === actionFilter) &&
    (!query || log.user.includes(query) || log.detail.includes(query) || log.target.includes(query))
  ), [actionFilter, query]);
  const columns = [
    { title: 'Operation ID', dataIndex: 'id', width: 150, render: value => <Text copyable>{`OPLOG-${String(value).padStart(6,'0')}`}</Text> },
    { title: '用户', dataIndex: 'user', width: 130, render: (v, r) => <div className="user-cell"><Avatar size={28}>{r.avatar}</Avatar><Text>{v}</Text></div> },
    { title: '操作类型', dataIndex: 'actionType', width: 120, render: v => <Tag color={actionTypeColors[v]}>{v}</Tag> },
    { title: '操作对象', dataIndex: 'target', width: 220, render: v => <Text>{v}</Text> },
    { title: 'IP 地址', dataIndex: 'ip', width: 130 },
    { title: '结果', dataIndex: 'result', width: 90, render: v => <Tag color={v === '成功' ? 'green' : 'red'}>{v}</Tag> },
    { title: '更新时间', dataIndex: 'time', width: 185, render:formatDateTime, sorter: (a, b) => a.time.localeCompare(b.time) },
    { title: '操作', fixed: 'right', width: 80, render: (_, record) => <Button type="link" size="small" onClick={() => setDetail(record)}>详情</Button> },
  ];
  return <>
    <PageHeader title="用户操作日志" description="记录所有用户在平台上的操作行为"/>
    <Card className="main-card" styles={{ body: { padding: 0 } }}>
      <Flex justify="space-between" align="center" className="toolbar"><Space>
        <Select value={timeRange} onChange={setTimeRange} style={{ width: 140 }} options={[{ label: '全部时间', value: 'all' }, { label: '今天', value: 'today' }, { label: '最近 7 天', value: '7d' }, { label: '最近 30 天', value: '30d' }]} />
        <Select value={actionFilter} onChange={setActionFilter} style={{ width: 150 }} options={[{ label: '全部操作类型', value: 'all' }, ...Object.keys(actionTypeColors).map(k => ({ label: k, value: k }))]} />
      </Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索用户、对象或详情" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 280 }} /></Flex>
      <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }} scroll={{ x: 1090 }} />
    </Card>
    <Drawer title="用户操作日志详情" size={720} open={!!detail} onClose={() => setDetail(null)} extra={<Button onClick={copyOperationJson}>复制 JSON</Button>}>{detail&&<pre className="admin-json-code"><code>{operationJson(detail)}</code></pre>}</Drawer>
  </>;
}

/* ─── Task Execution Logs ──────────────────────────────────────── */
function TaskLogsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('全部');
  const [taskTypeFilter, setTaskTypeFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const taskJson = record => JSON.stringify({schema_version:'task-execution-log/v1',...record,startTime:formatDateTime(record.startTime),updatedAt:record.updatedAt?formatDateTime(record.updatedAt):undefined,updated_at:formatDateTime(record.updatedAt||record.startTime)},null,2);
  const copyTaskJson = async () => { await navigator.clipboard.writeText(taskJson(detail)); message.success('JSON 已复制'); };
  const filtered = useMemo(() => mockTaskLogs.filter(t =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (modalityFilter === '全部' || t.modality === modalityFilter) &&
    (taskTypeFilter === '全部' || t.taskType === taskTypeFilter) &&
    (!query || t.name.includes(query) || t.id.includes(query) || t.owner.includes(query))
  ), [statusFilter, modalityFilter, taskTypeFilter, query]);
  const columns = [
    { title: '任务名称 / ID', dataIndex: 'name', width: 250, render: (v, r) => <div><Button type="link" className="name-link" onClick={() => setDetail(r)}>{v}</Button><div className="muted-id">{r.id}</div></div> },
    { title: '所属用户', dataIndex: 'owner', width: 120, render: v => <Text>{v}</Text> },
    { title: '数据类型', dataIndex: 'modality', width: 110, render: v => <Tag color={modalityColor[v]}>{v}</Tag> },
    { title: '任务类型', dataIndex: 'taskType', width: 130, render: v => <Tag color={v === '数据生成' ? 'blue' : 'purple'}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, render: v => <Badge status={statusMap[v]} text={v}/> },
    { title: '更新时间', width: 185, render: (_, record) => formatDateTime(record.updatedAt || record.startTime) },
    { title: '操作', fixed: 'right', width: 80, render: (_, r) => <Button type="link" size="small" onClick={() => setDetail(r)}>详情</Button> },
  ];
  return <>
    <PageHeader title="任务执行日志" description="记录全部数据生成与评估任务的执行过程"/>
    <Card className="main-card" styles={{ body: { padding: 0 } }}>
      <Flex justify="space-between" align="center" className="toolbar"><Space>
        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }} options={[{ label: '全部状态', value: 'all' }, { label: '运行中', value: '运行中' }, { label: '已完成', value: '已完成' }, { label: '失败', value: '失败' }, { label: '排队中', value: '排队中' }]} />
        <Select value={modalityFilter} onChange={setModalityFilter} style={{width:140}} options={['全部','文档图像','对话文本','时序数据'].map(value=>({label:value==='全部'?'全部数据类型':value,value}))}/>
        <Select value={taskTypeFilter} onChange={setTaskTypeFilter} style={{width:170}} options={['全部','数据生成','数据评估与优化'].map(value=>({label:value==='全部'?'全部任务类型':value,value}))}/>
      </Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索任务名称、ID 或用户" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 260 }} /></Flex>
      <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }} scroll={{ x: 1000 }} />
    </Card>
    <Drawer title="任务执行详情" size={720} open={!!detail} onClose={() => setDetail(null)} extra={<Button onClick={copyTaskJson}>复制 JSON</Button>}>{detail&&<pre className="admin-json-code"><code>{taskJson(detail)}</code></pre>}</Drawer>
  </>;
}

/* ─── User Management ──────────────────────────────────────────── */
function UserManagementPage() {
  const [users, setUsers] = useState(()=>mockUsers.map(user=>({...user,created:formatDateTime(user.created),lastActive:formatDateTime(user.lastActive)})));
  const [query, setQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [quotaUser, setQuotaUser] = useState(null);
  const [form] = Form.useForm();

  const filtered = useMemo(() => users.filter(u =>
    !query || u.name.includes(query) || u.email.includes(query)
  ), [users, query]);

  const openCreate = () => { setEditingUser(null); form.resetFields(); setEditorOpen(true); };
  const openEdit = user => { setEditingUser(user); form.setFieldsValue(user); setEditorOpen(true); };
  const saveUser = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        setUsers(items => items.map(u => u.id === editingUser.id ? { ...u, ...values } : u));
        message.success('用户信息已更新');
      } else {
        setUsers(items => [{ ...values, id: `U${String(items.length + 1).padStart(3, '0')}`, status: '正常', taskCount: 0, monthlyTokensLimit: 1000000, created: nowDateTime() }, ...items]);
        message.success('新用户已创建');
      }
      setEditorOpen(false);
    } catch { message.warning('请检查必填项'); }
  };
  const deleteUser = user => Modal.confirm({
    title: `删除用户“${user.name}”？`, content: '删除后该用户将从用户列表中移除，此操作不可恢复。',
    okText: '确认删除', okType: 'danger', cancelText: '取消',
    onOk: () => { setUsers(items => items.filter(item => item.id !== user.id)); message.success('用户已删除'); },
  });

  const [quotaForm] = Form.useForm();
  const openQuota = user => { setQuotaUser(user); quotaForm.setFieldsValue({ monthlyTokensLimit: user.monthlyTokensLimit ?? 1000000 }); };
  const saveQuota = async () => {
    try {
      const values = await quotaForm.validateFields();
      setUsers(items => items.map(u => u.id === quotaUser.id ? { ...u, ...values } : u));
      message.success(`${quotaUser.name} 的额度配置已保存`);
      setQuotaUser(null);
    } catch { message.warning('请检查配置'); }
  };

  const columns = [
    { title: '用户', dataIndex: 'name', width: 200, render: (v, r) => <div className="user-cell"><Avatar size={36} style={{ background: '#1677ff' }}>{v.slice(0, 2).toUpperCase()}</Avatar><div className="user-cell-info"><Text strong>{v}</Text><span className="user-cell-email">{r.email}</span></div></div> },
    { title: '角色', dataIndex: 'role', width: 110, render: v => <Tag color={v === '管理员' ? 'purple' : v === '只读用户' ? 'default' : 'blue'}>{v}</Tag> },
    { title: '月度 Tokens 上限', width: 170, render: (_, r) => (r.monthlyTokensLimit ?? 1000000).toLocaleString() },
    { title: '创建时间', dataIndex: 'created', width: 185, render:formatDateTime },
    { title: '操作', fixed: 'right', width: 190, render: (_, r) => <Space size={0}>
      <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
      <Button type="link" size="small" onClick={() => openQuota(r)}>额度配置</Button>
      <Button type="link" size="small" danger onClick={() => deleteUser(r)}>删除</Button>
    </Space> },
  ];

  return <>
    <PageHeader title="用户管理" description="管理平台用户账号、权限和资源额度" actions={<Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>新建用户</Button>}/>
    <Card className="main-card" styles={{ body: { padding: 0 } }}>
      <Flex justify="flex-end" align="center" className="toolbar"><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索用户名或邮箱" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 280 }} /></Flex>
      <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 8, showTotal: t => `共 ${t} 条` }} scroll={{ x: 850 }} />
    </Card>

    {/* Create / Edit user modal */}
    <Modal title={editingUser ? '编辑用户' : '新建用户'} width={580} open={editorOpen} onCancel={() => setEditorOpen(false)} onOk={saveUser} okText="保存" cancelText="取消" destroyOnHidden>
      <Form form={form} layout="vertical" initialValues={{ role: '普通用户' }}>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="name" label="用户名" rules={[{ required: true }]}><Input disabled={Boolean(editingUser)} placeholder="英文或拼音"/></Form.Item></Col>
          <Col span={12}><Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input disabled={Boolean(editingUser)} placeholder="name@company.com"/></Form.Item></Col>
        </Row>
        <Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={[{ label: '管理员', value: '管理员' }, { label: '普通用户', value: '普通用户' }, { label: '只读用户', value: '只读用户' }]}/></Form.Item>
      </Form>
    </Modal>

    {/* Quota drawer */}
    <Drawer title={`额度配置 — ${quotaUser?.name || ''}`} size={580} open={!!quotaUser} onClose={() => setQuotaUser(null)} extra={<Button type="primary" onClick={saveQuota}>保存配置</Button>}>
      {quotaUser && <>
        <Form form={quotaForm} layout="vertical">
          <Alert type="info" showIcon message="按用户配置每月可使用的模型 Tokens 总量" description="新用户默认额度为 1,000,000 Tokens；额度按自然月统计。" style={{ marginBottom: 20 }}/>
          <Form.Item name="monthlyTokensLimit" label="月度 Tokens 上限" rules={[{ required: true, message: '请输入月度 Tokens 上限' }]}><InputNumber min={0} max={1000000000} step={100000} style={{ width: '100%' }} addonAfter="Tokens"/></Form.Item>
        </Form>
      </>}
    </Drawer>
  </>;
}

/* ─── API Config Management ────────────────────────────────────── */
function ApiConfigPage() {
  const [apis, setApis] = useState(() => INITIAL_KEYS.map((item, index) => ({ ...item, createdBy: ['admin', 'zhouba', 'admin', 'feidongni'][index] })));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const filtered = apis.filter(record => {
    const provider = PROVIDERS[record.provider] || PROVIDERS.custom;
    return !query || [record.name, provider.name, record.description, ...(record.models || [])].join(' ').toLowerCase().includes(query.toLowerCase());
  });
  const openCreate = () => { setEditing(undefined); setEditorOpen(true); };
  const openEdit = record => { setEditing(record); setEditorOpen(true); };
  const saveApi = values => {
    const next = { ...(editing || {}), ...values, protocol:'OpenAI 兼容', apiKey:undefined, description:values.description?.trim() || '', createdBy:editing?.createdBy || ADMIN_USER };
    if (editing) {
      setApis(items => items.map(item => item.id === editing.id ? { ...item, ...next } : item));
      message.success('公共 API 配置已更新');
    } else {
      setApis(items => [{ ...next, id:`API-${String(items.length + 1).padStart(4,'0')}` }, ...items]);
      message.success('公共 API 配置已添加');
    }
    setEditorOpen(false);
  };
  const remove = record => Modal.confirm({title:`删除“${record.name}”？`,content:'删除前请确认没有平台任务引用该配置。',okText:'确认删除',okType:'danger',cancelText:'取消',onOk:()=>{setApis(items=>items.filter(item=>item.id!==record.id));message.success('公共 API 配置已删除');}});
  const columns = [
    {title:'名称',dataIndex:'name',width:280,render:(value,record)=><Flex align="center" gap={10}><ProviderMark provider={record.provider}/><Text strong>{value}</Text></Flex>},
    {title:'描述',dataIndex:'description',render:value=><Text type={value?undefined:'secondary'}>{value||'—'}</Text>},
    {title:'创建人',dataIndex:'createdBy',width:130},
    {title:'操作',fixed:'right',width:150,render:(_,record)=><Space size={0}><Button type="link" size="small" onClick={()=>openEdit(record)}>编辑</Button><Button type="link" size="small" danger onClick={()=>remove(record)}>删除</Button></Space>},
  ];

  return <>
    <PageHeader title="平台公共 API 配置" description="管理平台统一提供的公共 API 端点" actions={<Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>新增 API</Button>}/>
    <Card className="main-card" styles={{body:{padding:0}}}><Flex justify="flex-end" align="center" className="toolbar"><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索名称、描述或模型" value={query} onChange={event=>setQuery(event.target.value)} style={{width:280}}/></Flex><Table rowKey="id" columns={columns} dataSource={filtered} pagination={{pageSize:8,showTotal:total=>`共 ${total} 条`}} scroll={{x:800}}/></Card>
    <KeyEditor open={editorOpen} record={editing} onCancel={()=>setEditorOpen(false)} onSave={saveApi}/>
  </>;
}

/* ─── API Usage Stats ──────────────────────────────────────────── */
function ApiUsageStatsPage() {
  const [timeRange, setTimeRange] = useState('today');
  const [selectedApi, setSelectedApi] = useState('all');
  const [userQuery, setUserQuery] = useState('');
  const hourlyTokens = hourlyCalls.map(value => value * 1200);
  const maxH = Math.max(...hourlyTokens);
  const totalCalls = hourlyCalls.reduce((a, b) => a + b, 0);
  const totalTokens = hourlyTokens.reduce((a, b) => a + b, 0);
  const successCalls = Math.round(totalCalls * 0.997);
  const failCalls = totalCalls - successCalls;
  const rankedApis = mockPublicApis.filter(api => selectedApi === 'all' || api.id === selectedApi).sort((a, b) => b.dailyUsed - a.dailyUsed);
  const rankedUsers = userCallRanks.filter(record => !userQuery || record.user.toLowerCase().includes(userQuery.trim().toLowerCase()));

  return <>
    <PageHeader title="API 用量统计" description="监控平台公共 API 的调用量、成功率和响应性能"/>
    <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}><Space>
      <Segmented value={timeRange} onChange={setTimeRange} options={[{ label: '今天', value: 'today' }, { label: '最近 7 天', value: '7d' }, { label: '最近 30 天', value: '30d' }]} />
      <DatePicker.RangePicker onChange={dates => dates?.length && setTimeRange('custom')} placeholder={['开始日期','结束日期']}/>
      <Select value={selectedApi} onChange={setSelectedApi} style={{ width: 220 }} options={[{ label: '全部 API', value: 'all' }, ...mockPublicApis.map(a => ({ label: a.name, value: a.id }))]} />
    </Space></Flex>
    <Row gutter={16} className="usage-metric-row">
      {[
        { title: '总调用次数', value: totalCalls.toLocaleString(), icon: <ApiOutlined/>, color: '#1677ff' },
        { title: '总调用 Tokens 数', value: totalTokens.toLocaleString(), icon: <DatabaseOutlined/>, color: '#13a8a8' },
        { title: '成功次数', value: successCalls.toLocaleString(), icon: <CheckCircleOutlined/>, color: '#52c41a' },
        { title: '失败次数', value: failCalls, icon: <ExclamationCircleOutlined/>, color: '#ff4d4f' },
        { title: '成功率', value: '99.7', suffix: '%', icon: <FundOutlined/>, color: '#52c41a' },
      ].map((m, i) => <Col flex="1 1 0" key={i}><Card><Statistic title={m.title} value={m.value} suffix={m.suffix} prefix={<span style={{ color: m.color }}>{m.icon}</span>}/></Card></Col>)}
    </Row>
    <Card title="总 Tokens 用量趋势" className="usage-chart-card">
      <div className="usage-hourly-bars">{hourlyTokens.map((v, i) => <Tooltip key={i} title={`${String(i).padStart(2, '0')}:00 — ${v.toLocaleString()} Tokens`}><div className="usage-hourly-bar" style={{ height: `${(v / maxH) * 140}px` }}/></Tooltip>)}</div>
      <div className="usage-hourly-labels">{hourlyTokens.map((_, i) => <span key={i}>{i % 3 === 0 ? `${String(i).padStart(2, '0')}:00` : ''}</span>)}</div>
    </Card>
    <Card title="各 API 用量排行" className="usage-table-card"><Table rowKey="id" pagination={{pageSize:5,showTotal:total=>`共 ${total} 条`}} dataSource={rankedApis} columns={[
      { title: 'API 名称', dataIndex: 'name', width: 220, render: (v, r) => <div><Text strong>{v}</Text><div className="muted-id">{r.endpoint}</div></div> },
      { title: '调用次数', dataIndex: 'dailyUsed', width: 130, render: value => value.toLocaleString() },
      { title: '调用 Tokens 数', width: 160, render: (_, record) => (record.dailyUsed * 1200).toLocaleString() },
      { title: '成功次数', dataIndex: 'dailyUsed', width: 110, render: (v, r) => <Text>{Math.round(v * r.successRate / 100).toLocaleString()}</Text> },
      { title: '失败次数', width: 100, render: (_, r) => <Text type={r.dailyUsed - Math.round(r.dailyUsed * r.successRate / 100) > 50 ? 'danger' : undefined}>{(r.dailyUsed - Math.round(r.dailyUsed * r.successRate / 100)).toLocaleString()}</Text> },
      { title: '成功率', dataIndex: 'successRate', width: 100, render: v => <Progress type="circle" percent={v} size={40} strokeColor={v > 99 ? '#52c41a' : v > 95 ? '#faad14' : '#ff4d4f'} format={v => `${v}%`}/> },
    ]}/></Card>
    <Card title="用户调用量排行" extra={<Input allowClear prefix={<SearchOutlined/>} placeholder="搜索用户名" value={userQuery} onChange={event=>setUserQuery(event.target.value)} style={{width:240}}/>} className="usage-table-card"><Table rowKey="user" pagination={{pageSize:5,showTotal:total=>`共 ${total} 条`}} dataSource={rankedUsers} columns={[
      { title: '用户', dataIndex: 'user', render: (v, r) => <div className="user-cell"><Avatar size={32} style={{ background: '#1677ff' }}>{r.avatar}</Avatar><Text strong>{v}</Text></div> },
      { title: '调用次数', dataIndex: 'calls', sorter: (a, b) => a.calls - b.calls, render: v => <Text strong>{v.toLocaleString()}</Text> },
      { title: '调用 Tokens 数', width: 180, render: (_, record) => (record.calls * 1200).toLocaleString() },
    ]}/></Card>
  </>;
}

/* ─── Admin App ────────────────────────────────────────────────── */
function AdminApp() {
  const [view, setView] = useState('logs-operation');

  const menuItems = [
    { key: 'logs', icon: <FileSearchOutlined/>, label: '日志中心', children: [
      { key: 'logs-operation', icon: <FileTextOutlined/>, label: '用户操作日志' },
      { key: 'logs-task', icon: <PlayCircleOutlined/>, label: '任务执行日志' },
    ]},
    { key: 'users', icon: <TeamOutlined/>, label: '用户管理' },
  ];

  const nameMap = { 'logs-operation': '用户操作日志', 'logs-task': '任务执行日志', users: '用户管理' };
  const parentMap = { 'logs-operation': '日志中心', 'logs-task': '日志中心' };

  const breadcrumbItems = [{ title: '运营端', onClick: () => setView('logs-operation') }];
  if (parentMap[view]) breadcrumbItems.push({ title: parentMap[view] });
  if (nameMap[view]) breadcrumbItems.push({ title: nameMap[view] });

  const renderPage = () => {
    switch (view) {
      case 'logs-operation': return <OperationLogsPage/>;
      case 'logs-task': return <TaskLogsPage/>;
      case 'users': return <UserManagementPage/>;
      default: return <OperationLogsPage/>;
    }
  };
  const handleAdminMenuClick = ({key}) => {
    if (key === 'profile') Modal.info({
      title:'管理员信息', width:520, okText:'关闭',
      content:<Flex vertical align="center" gap={18} className="profile-modal-content"><Avatar size={72} style={{background:'#722ed1'}}>AD</Avatar><Descriptions bordered size="small" column={1} style={{width:'100%'}} items={[{key:'username',label:'用户名',children:ADMIN_USER},{key:'account',label:'账号',children:'admin'}]}/></Flex>,
    });
    if (key === 'logout') Modal.confirm({
      title:'确认退出登录？', content:'退出后需要重新登录才能继续使用数据生成工具运营端。', okText:'确认退出', okType:'danger', cancelText:'取消', onOk:()=>{},
    });
  };

  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6, colorBgLayout: '#f5f5f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif' }, components: { Layout: { siderBg: '#001529', headerBg: '#fff' }, Menu: { darkItemBg: '#001529', darkItemSelectedBg: '#1677ff' } } }}>
    <AntApp><Layout className="app-layout">
      <Sider width={224} theme="dark" className="app-sider">
        <div className="brand"><Avatar shape="square" size={36} className="brand-logo">运</Avatar><div className="brand-name">数据生成工具</div></div>
        <Menu className="admin-main-menu" theme="dark" mode="inline" defaultOpenKeys={['logs']} selectedKeys={[view]} items={menuItems} onClick={({ key }) => setView(key)}/>
        <Dropdown trigger={['click']} placement="topLeft" menu={{items:[{key:'profile',label:'管理员信息'},{key:'logout',label:'退出登录'}],onClick:handleAdminMenuClick}}><div className="sidebar-user"><Avatar size={32} style={{background:'#722ed1'}}>AD</Avatar><div className="sidebar-user-text"><Text>{ADMIN_USER}</Text><span>管理员</span></div><DownOutlined/></div></Dropdown>
      </Sider>
      <Layout>
        <Header className="app-header"><Flex align="center"><Space><Button type="text" icon={<MenuFoldOutlined/>}/><Breadcrumb items={breadcrumbItems}/></Space></Flex></Header>
        <Content className="app-content">{renderPage()}</Content>
      </Layout>
    </Layout></AntApp>
  </ConfigProvider>;
}

createRoot(document.getElementById('root')).render(<AdminApp/>);
