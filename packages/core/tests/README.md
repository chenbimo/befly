# Befly 核心测试

本目录包含 Befly 框架核心功能的测试文件。

## 测试文件

-   `utils.test.ts` - 核心工具函数测试
-   `crypto.test.ts` - 加密工具测试
-   `jwt.test.ts` - JWT 认证测试
-   `validate.test.ts` - 数据验证测试

## 运行测试

### 运行所有测试

```bash
bun test
```

### 运行特定测试文件

```bash
bun test tests/utils.test.ts
bun test tests/crypto.test.ts
bun test tests/jwt.test.ts
bun test tests/validate.test.ts
```

### 运行测试并显示覆盖率

```bash
bun test --coverage
```

### 监视模式

```bash
bun test --watch
```

## 测试约束

根据 `AGENTS.md` 的要求：

> 测试中不使用任何环境变量读取（包括 `process.env`）。如需配置，请：
>
> -   在测试中写死常量（仅用于测试场景），或
> -   通过依赖注入/桩（mock）将配置传入被测单元。

所有测试文件都遵循此约束，使用固定的测试数据和配置。

## 测试结构

每个测试文件都采用标准的 BDD 风格：

```typescript
import { describe, test, expect } from 'bun:test';

describe('功能模块', () => {
    test('应该测试某个行为', () => {
        // 准备
        const input = 'test';

        // 执行
        const result = someFunction(input);

        // 断言
        expect(result).toBe('expected');
    });
});
```

## TypeScript 支持

所有测试文件都使用 TypeScript 编写，提供：

-   ✅ 完整的类型检查
-   ✅ IDE 智能提示
-   ✅ 编译时错误检测
-   ✅ 清晰的类型定义

## 注意事项

1. **不依赖外部服务**：测试应该能够在没有数据库、Redis 等外部服务的情况下运行
2. **独立性**：每个测试应该独立运行，不依赖其他测试的状态
3. **确定性**：测试结果应该是可预测和可重复的
4. **快速执行**：测试应该快速执行，避免长时间等待

## 添加新测试

创建新的测试文件时，请遵循以下命名规范：

-   文件名：`<module>.test.ts`
-   位置：`core/tests/`
-   导入：从 `bun:test` 导入测试工具
-   类型：使用 TypeScript 类型定义

示例：

```typescript
import { describe, test, expect } from 'bun:test';
import { MyModule } from '../utils/myModule.js';

describe('MyModule', () => {
    test('should do something', () => {
        const result = MyModule.doSomething();
        expect(result).toBe('expected');
    });
});
```
