# Data Factory Frontend v3

这是从 `Data_Factory_Frontend_v2` 复制并按任务中心适配模板中心 PRD 升级的纯前端原型，不包含 Python、FastAPI、数据库或本地文件服务。

所有原后端 API 已替换为浏览器端 Mock：

- 模板创建、保存、校验、试运行和发布；
- 文档图像、对话和时序数据的合成、质检、增强和定向扩增任务创建与结果展示；
- 任务对已发布模板、模板规则快照、输入数据版本及质检报告的准入和血缘联动；
- 质检标注、增强及扩增结果以不可变版本写回原数据集，并展示来源任务和来源版本；
- 质检报告、预览图、JSON、JSONL、CSV 和 Markdown 下载；
- 任务、数据集和页面状态持久化。

Mock 状态保存在浏览器 `localStorage`，因此刷新页面后仍然存在。清除该站点的浏览器数据即可恢复初始样例。

已执行的页面与流程检查见 [`QA_CHECKLIST.md`](./QA_CHECKLIST.md)。

## 启动

双击 `start_frontend.cmd`，或在当前目录运行：

```powershell
npm install
npm run dev
```

- 用户端：<http://127.0.0.1:8767/>
- 运营端：<http://127.0.0.1:8767/admin.html>

## 构建

```powershell
npm run build
```
