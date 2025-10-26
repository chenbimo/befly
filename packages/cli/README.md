# Befly CLI

为 Befly 框架提供命令行工具。

## 系统要求

- **Bun v1.3.0 或更高版本**

Befly CLI 专为 Bun 运行时设计，需要 Bun v1.3.0 或更高版本。

如果您的系统未安装 Bun 或版本过低，CLI 将自动提示您安装或升级。

### 安装 Bun

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

### 升级 Bun

```bash
bun upgrade
```

## 安装

```bash
# 全局安装
bun add -g befly-cli

# 或在项目中使用
bunx befly-cli
```

## 命令

### init - 初始化项目

```bash
# 交互式创建
befly init

# 指定项目名
befly init my-app

# 指定模板
befly init my-app --template api

# 跳过依赖安装
befly init my-app --skip-install

# 强制覆盖
befly init my-app --force
```

### script - 执行脚本

列出并执行 befly 核心、项目和插件中的脚本。

```bash
# 列出并选择脚本执行
befly script

# 预演模式（只显示不执行）
befly script --dry-run
```

### dev - 开发服务器

```bash
# 默认端口 3000
befly dev

# 指定端口和主机
befly dev -p 8080 -h 0.0.0.0

# 跳过表同步
befly dev --no-sync

# 详细日志
befly dev -v
```

### build - 构建项目

```bash
# 基本构建
befly build

# 指定输出目录
befly build -o dist

# 压缩代码
befly build --minify

# 生成 sourcemap
befly build --sourcemap
```

### start - 生产服务器

```bash
# 启动生产服务器
befly start

# 指定端口
befly start -p 8080
```

### sync - 同步数据库

```bash
# 同步所有表
befly sync

# 同步指定表
befly sync -t user

# 强制同步
befly sync -f

# 只显示 SQL 不执行
befly sync --dry-run

# 删除不存在的表
befly sync --drop
```

### addon - 插件管理

```bash
# 安装插件
befly addon install admin

# 从指定源安装
befly addon install admin -s https://github.com/xxx/admin

# 卸载插件
befly addon uninstall admin

# 卸载但保留数据
befly addon uninstall admin --keep-data

# 列出已安装插件
befly addon list
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/chenbimo/befly.git

# 进入 CLI 目录
cd packages/befly-cli

# 安装依赖
bun install

# 开发模式
bun run dev

# 构建
bun run build
```

## 许可证

Apache-2.0
