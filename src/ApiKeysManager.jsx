import React, { useEffect, useState } from 'react';
import {
  Alert, Avatar, Button, Card, Col, Flex, Form, Input, Modal, Row, Select,
  Space, Table, Typography, message,
} from 'antd';
import { KeyOutlined, LinkOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { readStore, writeStore } from './mockStore';

const { Title, Text } = Typography;
const KEY_MASK = '••••••••••••••••';

export const PROVIDERS = {
  intern: {
    key: 'intern', name: 'Intern', subtitle: 'Intern 官方服务', badge: '官方',
    initials: 'IN', color: '#6750a4', background: '#f1edff',
    baseUrl: 'https://chat.intern-ai.org.cn/api/v1',
    hint: '使用 Intern 官方 API Key，填写需要调用的模型名称。',
  },
  qwen: {
    key: 'qwen', name: 'Qwen', subtitle: '阿里云百炼', badge: '官方',
    initials: 'QW', color: '#5b5bd6', background: '#eeeeff',
    baseUrl: 'https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    hint: 'Base URL 与 API Key 地域必须一致，并替换业务空间 WorkspaceId。',
  },
  zhilian: {
    key: 'zhilian', name: '智链', subtitle: '客户内部基模', badge: '内部',
    initials: 'ZL', color: '#1677ff', background: '#e6f4ff',
    baseUrl: 'https://llm-gateway.company.internal/v1',
    hint: '由客户提供内网地址、鉴权密钥和部署模型名称。',
  },
  deepseek: {
    key: 'deepseek', name: 'DeepSeek', subtitle: 'DeepSeek 官方', badge: '官方',
    initials: 'DS', color: '#245bdb', background: '#eaf1ff',
    baseUrl: 'https://api.deepseek.com',
    hint: '使用 DeepSeek 官方 API Key，通过 OpenAI 兼容协议调用。',
  },
  custom: {
    key: 'custom', name: '自定义 API', subtitle: 'OpenAI 兼容服务', badge: '通用',
    initials: 'API', color: '#08979c', background: '#e6fffb', baseUrl: '',
    hint: '填写服务地址、API Key 和模型名称，接入其他 OpenAI 兼容服务。',
  },
};

export const INITIAL_KEYS = [
  {
    id: 'KEY-0001', name: 'Intern 生产环境', provider: 'intern',
    baseUrl: PROVIDERS.intern.baseUrl, protocol: 'OpenAI 兼容',
    models: ['intern-s2-preview-397b'], keyTail: '7J2A',
    createdBy: 'feidongni', description: '通用文本生成与复杂推理',
  },
  {
    id: 'KEY-0002', name: '百炼主账号', provider: 'qwen',
    baseUrl: 'https://llm-demo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    protocol: 'OpenAI 兼容', models: ['qwen3.7-max', 'qwen-vl-max'], keyTail: 'M8QK',
    createdBy: 'feidongni', description: '文档理解和多模态任务',
  },
  {
    id: 'KEY-0003', name: '智链 UAT', provider: 'zhilian',
    baseUrl: 'https://zhilian-uat.internal.example/v1', protocol: 'OpenAI 兼容',
    models: ['zhilian-base-v1'], keyTail: '91XL', createdBy: 'feidongni', description: '客户验收环境',
  },
  {
    id: 'KEY-0004', name: 'DeepSeek 备用通道', provider: 'deepseek',
    baseUrl: PROVIDERS.deepseek.baseUrl, protocol: 'OpenAI 兼容',
    models: ['deepseek-v4-flash', 'deepseek-reasoner'], keyTail: '2P9D',
    createdBy: 'feidongni', description: '推理任务备用通道',
  },
];

export function ProviderMark({ provider, size = 42 }) {
  const preset = PROVIDERS[provider] || PROVIDERS.custom;
  return <Avatar shape="square" size={size} className="api-provider-mark" style={{ color: preset.color, background: preset.background }}>{preset.initials}</Avatar>;
}

export function KeyEditor({ open, record, onCancel, onSave }) {
  const [form] = Form.useForm();
  const providerKey = Form.useWatch('provider', form) || 'intern';
  const provider = PROVIDERS[providerKey];

  React.useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({
        provider: record.provider, name: record.name, baseUrl: record.baseUrl,
        models: record.models?.length ? record.models : [record.defaultModel].filter(Boolean),
        description: record.description ?? record.note ?? '', apiKey: '',
      });
    } else {
      form.setFieldsValue({
        provider: 'intern', name: '', baseUrl: PROVIDERS.intern.baseUrl,
        models: [''], description: '', apiKey: '',
      });
    }
  }, [form, open, record]);

  const changeProvider = value => {
    const preset = PROVIDERS[value];
    form.setFieldsValue({
      provider: value, baseUrl: preset.baseUrl,
      name: record ? form.getFieldValue('name') : `${preset.name} 配置`,
    });
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const models = (values.models || []).map(item => String(item || '').trim()).filter(Boolean);
      if (!models.length) {
        message.warning('至少配置一个模型名称');
        return;
      }
      onSave({ ...values, models });
      form.resetFields();
    } catch {
      message.warning('请检查必填配置');
    }
  };

  return <Modal
    title={record ? '编辑 API Key' : '添加 API Key'} width={700} open={open}
    onCancel={onCancel} onOk={submit} okText={record ? '保存修改' : '保存配置'}
    cancelText="取消" destroyOnHidden
  >
    <Alert
      type="info" showIcon className="api-form-note"
      title="仅支持 OpenAI 兼容协议"
      description="前端原型不会连接外部服务；正式产品应由服务端加密保存完整密钥。"
    />
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="provider" label="服务商" rules={[{ required: true }]}>
            <Select onChange={changeProvider} options={Object.values(PROVIDERS).map(item => ({
              value: item.key, label: `${item.name} · ${item.subtitle}`,
            }))}/>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入便于识别的名称' }, { max: 40 }]}>
            <Input placeholder="例如：百炼生产环境"/>
          </Form.Item>
        </Col>
      </Row>
      <Alert className="api-provider-hint" type={providerKey === 'zhilian' ? 'warning' : 'success'} showIcon title={provider.hint}/>
      <Form.Item
        name="baseUrl" label="Base URL"
        rules={[
          { required: true, message: '请输入服务地址' },
          { validator: (_, value) => !value || /^https?:\/\//i.test(value) ? Promise.resolve() : Promise.reject(new Error('请输入以 http:// 或 https:// 开头的地址')) },
        ]}
        extra={providerKey === 'qwen' ? '请将 {WorkspaceId} 替换为百炼业务空间 ID，并确认地域与 API Key 一致。' : '仅填写 API 根地址，不需要追加 /chat/completions。'}
      >
        <Input prefix={<LinkOutlined/>} placeholder="https://api.example.com/v1"/>
      </Form.Item>
      <Form.Item
        name="apiKey" label={record ? '更新 API Key' : 'API Key'}
        rules={record ? [] : [{ required: true, message: '请输入 API Key' }]}
        extra={record ? `当前凭据：${KEY_MASK}；留空表示不更新。` : '保存后无法再次查看完整密钥。'}
      >
        <Input.Password prefix={<KeyOutlined/>} placeholder={record ? '留空表示不更新' : '粘贴 API Key'}/>
      </Form.Item>
      <Form.List name="models" rules={[{ validator: async (_, values) => {
        if (!values || !values.some(value => String(value || '').trim())) throw new Error('至少配置一个模型名称');
      } }] }>
        {(fields, { add, remove }, { errors }) => <>
          <Form.Item label="模型名称" required>
            {fields.map((field, index) => <Space key={field.key} align="baseline" className="api-model-row">
              <Form.Item {...field} noStyle rules={[{ required: true, whitespace: true, message: '请输入模型名称' }]}>
                <Input placeholder={index === 0 ? '例如：qwen-plus' : '输入另一个模型名称'} style={{ width: 480 }}/>
              </Form.Item>
              {fields.length > 1 && <Button type="text" danger onClick={() => remove(field.name)}>删除</Button>}
            </Space>)}
            <Button type="dashed" onClick={() => add('')} icon={<PlusOutlined/>}>新增模型</Button>
            <Form.ErrorList errors={errors}/>
          </Form.Item>
        </>}
      </Form.List>
      <Form.Item name="description" label="描述"><Input.TextArea rows={2} maxLength={120} showCount placeholder="说明使用环境、用途或负责人（可选）"/></Form.Item>
    </Form>
  </Modal>;
}

export function ApiKeysManager() {
  const [records, setRecords] = useState(() => readStore('api-keys', INITIAL_KEYS));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => { writeStore('api-keys', records); }, [records]);

  const visibleRecords = records.filter(record => {
    const provider = PROVIDERS[record.provider] || PROVIDERS.custom;
    const models = record.models || [record.defaultModel].filter(Boolean);
    const description = record.description ?? record.note ?? '';
    return !query || [record.name, provider.name, description, ...models].join(' ').toLowerCase().includes(query.toLowerCase());
  });

  const openCreate = () => { setEditing(undefined); setEditorOpen(true); };
  const openEdit = record => { setEditing(record); setEditorOpen(true); };
  const save = values => {
    const tail = values.apiKey ? values.apiKey.trim().slice(-4).padStart(4, '•') : editing?.keyTail;
    const next = {
      ...(editing || {}), ...values, protocol: 'OpenAI 兼容', apiKey: undefined,
      keyTail: tail, description: values.description?.trim() || '',
    };
    if (editing) {
      setRecords(items => items.map(item => item.id === editing.id ? { ...item, ...next } : item));
      message.success('配置已更新；完整密钥未保存在前端');
    } else {
      setRecords(items => [{ ...next, id: `KEY-${String(items.length + 1).padStart(4, '0')}`, createdBy: 'feidongni' }, ...items]);
      message.success('配置已添加');
    }
    setEditorOpen(false);
  };

  const remove = record => Modal.confirm({
    title: `删除“${record.name}”？`,
    content: '正式产品中，删除前需要检查是否存在任务引用。当前操作只删除前端原型数据。',
    okText: '确认删除', okType: 'danger', cancelText: '取消',
    onOk: () => {
      setRecords(items => items.filter(item => item.id !== record.id));
      message.success('API Key 配置已删除');
    },
  });

  const columns = [
    {
      title: '名称', dataIndex: 'name', width: 280,
      render: (value, record) => <Flex align="center" gap={10}><ProviderMark provider={record.provider}/><Text strong>{value}</Text></Flex>,
    },
    {
      title: '描述', dataIndex: 'description',
      render: (_, record) => <Text type={record.description || record.note ? undefined : 'secondary'}>{record.description ?? record.note ?? '—'}</Text>,
    },
    {
      title: '操作', fixed: 'right', width: 150,
      render: (_, record) => <Space size={0}>
        <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
        <Button type="link" size="small" danger onClick={() => remove(record)}>删除</Button>
      </Space>,
    },
  ];

  return <>
    <Flex className="page-header" justify="space-between" align="flex-start">
      <div><Title level={3}>API Keys</Title><Text type="secondary">管理外部模型服务凭据和可用模型</Text></div>
      <Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>添加 API Key</Button>
    </Flex>
    <Card className="main-card" styles={{ body: { padding: 0 } }}>
      <Flex justify="flex-end" align="center" className="toolbar">
        <Input allowClear prefix={<SearchOutlined/>} placeholder="搜索名称、描述或模型" value={query} onChange={event => setQuery(event.target.value)} style={{ width: 280 }}/>
      </Flex>
      <Table rowKey="id" columns={columns} dataSource={visibleRecords} pagination={{ pageSize: 8, showTotal: total => `共 ${total} 条` }} scroll={{ x: 650 }}/>
    </Card>
    <KeyEditor open={editorOpen} record={editing} onCancel={() => setEditorOpen(false)} onSave={save}/>
  </>;
}
