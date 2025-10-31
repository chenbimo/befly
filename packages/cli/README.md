# Befly CLI

命令行工具，用于 Befly 框架的数据同步操作。

## 安装

```bash
npm install -g befly
# 或
bun add -g befly
```

## 使用

```bash
# 开发环境同步
cross-env NODE_ENV=development befly sync

# 生产环境同步
cross-env NODE_ENV=production befly sync
```

## 功能

- `befly sync` - 执行完整的同步流程
    - 同步数据库表结构
    - 同步 API 接口数据
    - 同步菜单配置
    - 同步开发管理员账号

## 环境变量

通过 `NODE_ENV` 环境变量切换环境：

- `development` - 开发环境（默认）
- `production` - 生产环境
- `test` - 测试环境

## License

MIT
