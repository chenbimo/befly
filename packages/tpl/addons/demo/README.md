# Demo Addon

这是一个完整的 Befly Addon 演示组件，展示了如何创建一个功能完整的组件。

## 功能说明

Demo 组件提供了一个简单的待办事项（Todo）管理功能：

-   ✅ **API**：创建待办、查询待办列表
-   ✅ **插件**：提供工具函数
-   ✅ **检查**：启动时验证配置
-   ✅ **表定义**：自动创建 `demo_todo` 表
-   ✅ **类型定义**：TypeScript 类型支持

## 路由

-   `POST /api/demo/create` - 创建待办事项
-   `GET /api/demo/list` - 获取待办列表

## 数据库表

-   `demo_todo` - 待办事项表
    -   id (自增主键)
    -   title (标题)
    -   content (内容)
    -   completed (是否完成)
    -   priority (优先级)
    -   createdAt (创建时间)

## 插件

-   `demo.tool` - 工具插件，提供：
    -   `formatTodo()` - 格式化待办数据
    -   `validatePriority()` - 验证优先级

## 使用示例

### 创建待办

```bash
curl -X POST http://localhost:3001/api/demo/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "学习 Befly",
    "content": "阅读文档并实践",
    "priority": "high"
  }'
```

### 查询待办列表

```bash
curl http://localhost:3001/api/demo/list
```

## 环境变量

```env
# Demo 组件配置
DEMO_ENABLE=true
DEMO_DEFAULT_PRIORITY=medium
```
