# Admin 项目使用 pnpm 管理依赖

## 配置说明

admin 项目独立使用 pnpm 作为包管理器，与项目根目录的 Bun 分开管理。

### 为什么使用 pnpm？

1. **完美解决 OpenTiny 依赖提升问题**
    - pnpm 的 `public-hoist-pattern` 可以自动提升 `@opentiny/*` 所有子包
    - 无需手动在 package.json 中声明每个组件包

2. **更快的安装速度**
    - pnpm 使用硬链接和符号链接
    - 共享的依赖存储

3. **节省磁盘空间**
    - 相同版本的包只存储一次
    - 通过链接方式复用

## 配置文件

### .npmrc

```
# 提升 @opentiny 包到根 node_modules
public-hoist-pattern[]=@opentiny/*
```

### package.json

```json
{
    "packageManager": "pnpm@9.0.0",
    "engines": {
        "node": ">=22.0.0",
        "pnpm": ">=9.0.0"
    }
}
```

## 使用方法

### 安装依赖

```bash
# 进入 admin 目录
cd packages/admin

# 使用 pnpm 安装
pnpm install
```

### 添加依赖

```bash
# 添加生产依赖
pnpm add package-name

# 添加开发依赖
pnpm add -D package-name
```

### 更新依赖

```bash
# 更新所有依赖
pnpm update

# 更新指定依赖
pnpm update package-name
```

### 删除依赖

```bash
pnpm remove package-name
```

### 运行脚本

```bash
# 开发模式
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm type-check
```

## OpenTiny 组件自动导入验证

安装完成后，可以验证 OpenTiny 子包是否正确提升：

```bash
# Windows PowerShell
dir node_modules\@opentiny

# macOS/Linux
ls node_modules/@opentiny
```

应该能看到 200+ 个 OpenTiny 组件包，包括：

- `vue-tree-menu`
- `vue-button`
- `vue-dropdown`
- `vue-form`
- 等等...

## 注意事项

1. **只在 admin 目录使用 pnpm**
    - admin 目录有独立的 `pnpm-lock.yaml`
    - 不影响根目录和其他包的 Bun 使用

2. **package.json 无需手动声明 OpenTiny 子包**
    - `.npmrc` 的 `public-hoist-pattern` 会自动处理
    - 只需声明 `@opentiny/vue` 主包即可

3. **与 Bun 共存**
    - admin 使用 pnpm
    - core、tpl、docs 继续使用 Bun
    - 互不影响

## 文件结构

```
packages/admin/
├── .npmrc              # pnpm 配置（提升 @opentiny/*）
├── package.json        # 包管理器指定为 pnpm
├── pnpm-lock.yaml      # pnpm 锁文件
├── node_modules/       # pnpm 管理的依赖
│   ├── .pnpm/         # pnpm 存储目录
│   └── @opentiny/     # 提升的 OpenTiny 包（200+）
├── src/
├── vite.config.ts
└── ...
```

## 优势对比

### 使用 pnpm（当前方案）✅

**优点**：

- ✅ 自动提升所有 `@opentiny/*` 子包
- ✅ package.json 简洁，只需声明主包
- ✅ 完全符合 OpenTiny 官方推荐
- ✅ 安装速度快，磁盘占用小
- ✅ 锁文件更准确

**缺点**：

- ⚠️ admin 与其他包使用不同的包管理器

### 使用 Bun（之前的方案）

**优点**：

- ✅ 与项目其他部分统一

**缺点**：

- ❌ 需要手动声明所有使用的 OpenTiny 子包
- ❌ package.json 冗长
- ❌ hoisted 模式不会自动提升传递依赖
- ❌ 维护成本高（每次用新组件都要添加依赖）

## 结论

对于 admin 这样的前端项目，使用 pnpm 配合 `.npmrc` 的 `public-hoist-pattern` 是处理 OpenTiny Vue 依赖的最佳实践。
