# Internal Utils

⚠️ **框架核心工具目录**

此目录由 `befly-admin` 包管理，请勿手动修改。

运行 `befly sync:admin` 会自动更新此目录。

## 文件说明

- `index.ts` - 核心工具函数（如 `arrayToTree`）

## 使用方式

```typescript
// 从 utils 导入（推荐）
import { arrayToTree } from '@/utils';

// 直接从 internal 导入
import { arrayToTree } from '@/utils/internal';
```
