# Utils 目录说明

## 目录结构

- `internal.ts` - 框架核心工具函数（由 befly-admin 管理）
- `index.ts` - 用户自定义工具函数

## 使用说明

### 框架工具函数

```typescript
import { arrayToTree } from '@/utils/internal';
// 或者
import { arrayToTree } from '@/utils';
```

### 自定义工具函数

在 `index.ts` 中添加您的工具函数：

```typescript
/**
 * 格式化日期
 */
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}
```

## 注意事项

⚠️ **请勿修改** `internal.ts` 文件，运行 `befly sync:admin` 会自动更新此文件

---

📚 更多信息请查看项目文档
