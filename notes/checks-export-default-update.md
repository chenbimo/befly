# Checks 目录导出方式更新

## 更新时间

2025-10-11

## 更新内容

### 1. 修改 `checks/table.ts`

-   **修改前**: 使用具名导出 `export const checkTable = async (): Promise<boolean> => { ... }`
-   **修改后**: 使用默认导出 `export default async function (): Promise<boolean> { ... }`

### 2. 修改 `lifecycle/checker.ts`

-   **修改前**: 通过遍历导出对象查找以 `check` 开头的具名导出函数
-   **修改后**: 直接获取 `default` 导出的函数

具体变更：

```typescript
// 修改前
let checkFn = null;
for (const [exportName, exportValue] of Object.entries(checkModule)) {
    if (typeof exportValue === 'function' && /^check/i.test(exportName)) {
        checkFn = exportValue;
        break;
    }
}

// 修改后
const checkFn = checkModule.default;
```

-   **新增验证**: 检查返回值是否为 `boolean` 类型

```typescript
if (typeof checkResult !== 'boolean') {
    Logger.error(`检查 ${fileName} 返回值必须为 true 或 false，当前为 ${typeof checkResult}，耗时: ${singleCheckTime}`);
    failedChecks++;
}
```

## 规范说明

### checks 目录下的文件规范

1. **导出方式**: 必须使用 `export default` 导出函数
2. **返回值类型**: 函数返回值必须为 `boolean` 类型
    - `true`: 检查通过
    - `false`: 检查失败
3. **函数签名**: `async function(): Promise<boolean>` 或 `function(): boolean`

### 示例

```typescript
/**
 * 检查示例
 */
export default async function (): Promise<boolean> {
    try {
        // 执行检查逻辑
        const result = await someCheck();

        if (result) {
            Logger.info('检查通过');
            return true;
        } else {
            Logger.error('检查失败');
            return false;
        }
    } catch (error: any) {
        Logger.error('检查过程出错', error);
        return false;
    }
}
```

## 测试结果

-   ✅ 所有现有测试通过（81/81）
-   ✅ Checker 正确识别 `export default` 导出
-   ✅ 返回值类型验证工作正常
-   ✅ 错误提示更加明确

## 影响范围

-   `core/checks/table.ts` - 已更新
-   `core/lifecycle/checker.ts` - 已更新
-   `core/tests/checker.test.ts` - 新增测试

## 后续工作

如果需要添加新的检查文件，按照以下步骤：

1. 在 `core/checks/` 目录下创建 `.ts` 文件
2. 使用 `export default` 导出一个异步或同步函数
3. 函数必须返回 `boolean` 类型（`true` 表示通过，`false` 表示失败）
4. 使用 `Logger` 记录检查过程和结果
5. 文件名不要以下划线 `_` 开头（会被跳过）

## 优势

1. **更简洁**: 一个文件一个检查函数，职责清晰
2. **强类型**: TypeScript 强制要求返回 `boolean` 类型
3. **易维护**: 不需要记忆特定的命名规则（如 `check` 前缀）
4. **易扩展**: 添加新检查只需创建新文件并默认导出函数
