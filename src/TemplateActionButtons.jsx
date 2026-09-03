import React from 'react';
import { Button, Space } from 'antd';

export function TemplateActionButtons({
  onDetail,
  onEdit,
  onPublish,
  onCopy,
  onDelete,
  canEdit = true,
  canPublish = true,
  canCopy = true,
  canDelete = true,
  editReason = '当前状态不可编辑',
  publishReason = '当前状态不可发布',
  copyReason = '当前状态不可复制',
  deleteReason = '当前状态不可删除',
}) {
  return <Space size={0} className="template-row-actions">
    <Button type="link" size="small" onClick={onDetail}>详情</Button>
    <Button type="link" size="small" disabled={!canEdit} title={canEdit ? '编辑模板' : editReason} onClick={onEdit}>编辑</Button>
    <Button type="link" size="small" disabled={!canPublish} title={canPublish ? '发布模板' : publishReason} onClick={onPublish}>发布</Button>
    <Button type="link" size="small" disabled={!canCopy} title={canCopy ? '复制为草稿' : copyReason} onClick={onCopy}>复制</Button>
    <Button type="link" size="small" danger disabled={!canDelete} title={canDelete ? '删除模板' : deleteReason} onClick={onDelete}>删除</Button>
  </Space>;
}
