# Befly Framework - AI Coding Agent Instructions

> 注意，任何时候不能改动本文件，只能人为手动改动

## 必须遵守的指令

-   必要时，使用 context7 查询最新文档，最新的语法来进行代码实现
-   不要立即修改代码，要先进行详细分析，提供可行的方案
-   每个方案或建议，用数字序号表示，确认序号再进行对应的修改
-   运行命令如果 10 秒没有返回，要中断终端，不要一直等待
-   运行项目只能从 tpl 目录下执行`bun run dev`，不能在 core 目录下运行
-   解决问题的时候，不要立即修改，仔细分析，提供详细方案由我选择
-   不要生成变更文档，升级文档
-   不要执行 package.json 中的脚本命令，直接在终端运行命令
-   所有临时的测试脚本、文件等，都放到根目录下的 `temp` 目录下
-   所有说明文档、记录文档、总结文档等，都放到根目录下的 `notes` 目录下

## 项目概述

Befly 是专为 Bun 运行时设计的 API 框架，采用插件化架构，提供数据库操作、身份验证、日志记录等核心功能。

## 项目结构

-   `/core` 为 API 框架核心源码目录，含插件系统、工具函数、CLI 等
    -   作为 npm 包发布，供其他项目（如 `tpl/`）作为依赖使用
    -   `/core/apis`，内置接口目录，提供了令牌检测、健康检测等接口
        -   `/core/apis/health`，健康检查接口，包含 info.ts 等
        -   `/core/apis/tool`，工具接口，提供各种辅助功能
    -   `/core/bin`，二进制目录，提供了 befly 命令，用于执行同步数据库脚本等
        -   `/core/bin/befly.ts`，CLI 入口文件，处理命令行参数和脚本执行
    -   `/core/checks`，核心检测目录，在框架运行之前检测数据库表定义等，文件必须使用 `export default` 导出函数，函数返回值必须为 `true` 或 `false`
        -   `/core/checks/table.ts`，表定义检查，验证表字段规则的正确性
        -   检查器会按顺序执行：先执行 `core/checks` 的核心检查，再执行项目 `checks` 目录的项目检查
    -   `/core/config`，配置目录，比如`env.ts`，是对环境变量的映射
    -   `/core/docs`，说明目录，对增删改查逻辑、对同步数据库表、对表定义方式的说明文件
    -   `/core/lifecycle`，生命周期目录，包含框架启动的检查、加载、引导等流程
        -   `/core/lifecycle/checker.ts`，系统检查器，启动前验证配置和表定义
        -   `/core/lifecycle/loader.ts`，资源加载器，加载插件和 API
        -   `/core/lifecycle/bootstrap.ts`，启动引导器，初始化框架服务
    -   `/core/middleware`，中间件目录，包含认证、解析、验证、权限、日志等中间件
        -   `/core/middleware/auth.ts`，认证中间件，处理 JWT 令牌验证
        -   `/core/middleware/cors.ts`，跨域中间件，处理 CORS 请求
        -   `/core/middleware/parser.ts`，参数解析中间件，解析请求体
        -   `/core/middleware/validator.ts`，参数验证中间件，验证请求参数
        -   `/core/middleware/permission.ts`，权限中间件，检查用户权限
        -   `/core/middleware/plugin-hooks.ts`，插件钩子中间件，执行插件的钩子函数
        -   `/core/middleware/request-logger.ts`，请求日志中间件，记录请求信息
    -   `/core/plugins`，内置插件目录，给`befly`核心框架提供数据库操作、日志操作、redis 操作、常用工具函数等
        -   `/core/plugins/db.ts`，数据库插件，提供 SQL 操作能力
        -   `/core/plugins/logger.ts`，日志插件，提供日志记录能力
        -   `/core/plugins/redis.ts`，Redis 插件，提供缓存和分布式能力
        -   `/core/plugins/tool.ts`，工具插件，提供常用工具函数
    -   `/core/router`，路由目录，处理 API 路由、静态文件、错误处理等
        -   `/core/router/api.ts`，API 路由处理器，核心请求处理逻辑
        -   `/core/router/static.ts`，静态文件路由处理器
        -   `/core/router/root.ts`，根路由处理器
        -   `/core/router/error.ts`，错误路由处理器
    -   `/core/scripts`，脚本目录，同步数据库表、同步开发者用户等
        -   `/core/scripts/syncDb.ts`，数据库同步脚本，同步表结构到数据库
        -   `/core/scripts/syncDev.ts`，开发者同步脚本，初始化开发者账号
    -   `/core/tables`，内置表定义目录，定义了一些自带的表结构，用于同步到数据库结构
        -   表定义文件为 JSON 格式，如`common.json`、`tool.json`
    -   `/core/tests`，内置测试目录，用于测试集成，所有核心框架级别的测试文件放到这里
        -   测试文件命名格式为`*.test.ts`，使用 Bun 测试框架
    -   `/core/types`，类型定义目录，包含所有 TypeScript 类型定义文件
        -   `/core/types/index.ts`，类型导出入口，统一导出所有类型
        -   各个功能模块的类型定义文件，如`api.d.ts`、`befly.d.ts`、`database.d.ts`等
    -   `/core/utils`，工具目录，比如日志方法、加密方法、颜色方法、sql 构造器、参数验证等工具
        -   `/core/utils/logger.ts`，日志工具，处理日志记录和文件管理
        -   `/core/utils/crypto.ts`，加密工具，提供哈希、加密、签名等功能
        -   `/core/utils/jwt.ts`，JWT 工具，处理令牌签发和验证
        -   `/core/utils/validate.ts`，验证工具，处理参数验证
        -   `/core/utils/sqlBuilder.ts`，SQL 构造器，构建 SQL 查询语句
        -   `/core/utils/sqlHelper.ts`，SQL 助手，提供数据库操作方法
        -   `/core/utils/errorHandler.ts`，错误处理器，统一处理错误信息
        -   `/core/utils/index.ts`，工具函数导出入口
    -   `/core/main.ts`，框架的入口文件，对外导出给形如`/tpl`这样的项目模板使用
    -   `/core/system.ts`，系统文件，提供项目路径、根路径等
    -   `/core/package.json`，npm 包配置文件，定义依赖和发布信息
    -   `/core/tsconfig.json`，TypeScript 配置文件，定义编译选项
    -   `/core/bunfig.toml`，Bun 配置文件，定义 Bun 运行时选项
-   `/tpl` 为示例模板目录，会以依赖方式引用 `/core/` 框架
    -   展示如何使用 Befly 框架构建真实项目
    -   `/tpl/apis`，项目接口目录，由用户自主实现的接口
        -   接口文件按模块组织，如`/tpl/apis/app/user/login.ts`
    -   `/tpl/checks`，项目检测目录，项目自定义检查文件，文件必须使用 `export default` 导出函数，函数返回值必须为 `true` 或 `false`
        -   `/tpl/checks/demo.ts`，示例检查文件
    -   `/tpl/data`，项目数据目录，存放项目相关的数据文件
    -   `/tpl/logs`，项目日志目录，日志自动写入，不要对此目录有任何操作
        -   日志文件按日期和类型自动分割，如`error-2025-10-11-001.log`
    -   `/tpl/plugins`，项目插件目录，会由`befly`自动加载并执行
        -   插件文件命名格式为`*.ts`，导出符合插件接口的对象
    -   `/tpl/tables`，项目表定义目录，用户自定义表结构
        -   表定义文件为 JSON 格式，会被自动加载并同步到数据库
    -   `/tpl/tests`，项目测试目录，自动生成，所有跟项目级别的测试文件放到这里
    -   `/tpl/types`，项目类型定义目录，存放项目的 TypeScript 类型定义
    -   `/tpl/.env.development`，开发环境变量文件，所有开发模式的环境变量都在这个文件中
    -   `/tpl/main.ts`，项目入口文件，会从`befly`中导入服务函数并启动
    -   `/tpl/pm2.config.cjs`，正式发布配置文件，所有正式环境变量在这个文件中
    -   `/tpl/package.json`，项目包配置文件，定义项目依赖（包括 befly）
    -   `/tpl/tsconfig.json`，TypeScript 配置文件，继承自 core 的配置
    -   `/tpl/bunfig.toml`，Bun 配置文件，定义项目的运行时选项
-   `/docs/` 为文档目录，格式为 markdown，包含 befly 的使用教程
    -   文档以 2 级目录组织，目录格式为`数字-目录名`，文件格式为`数字-文件名.md`
    -   文档要尽量通俗易懂，要层层递进，要详细清楚地表达框架的各个方面的概念和用法
    -   没有我的明确指令，不要读取和改动`/docs`目录下的文件,只针对`core`和`tpl`进行修改
-   `/notes/` 为升级记录、更新记录等文档目录，所有开发过程中的记录文档都放到这里
    -   包括但不限于：重构总结、问题排查、功能规划等 markdown 文档
-   `/r.js` 为发布脚本，用于版本管理和 npm 发布
    -   使用方式：`bun r.js -x`（主版本）、`-y`（次版本）、`-z`（补丁版本）
-   根目录的配置文件说明：
    -   `/bunfig.toml`，Bun 全局配置文件
    -   `/.prettierrc`，代码格式化配置文件
    -   `/.prettierignore`，格式化忽略文件配置
    -   `/.gitignore`，Git 忽略文件配置
    -   `/LICENSE`，开源许可证文件
    -   `/README.md`，项目说明文档

## 编码规范

-   只能使用 `bun` 进行安装、测试等操作，避免使用 `node`/`npm`/`npx`/`yarn`等
-   尽可能复用现有代码，保持逻辑高效且简洁，完全使用 TypeScript 来实现，不要使用 JavaScript
-   使用 powershell 脚本语法来执行终端命令，不要使用 cmd 语法
-   文件和变量命名使用小驼峰（camelCase）
-   导入语句必须遵循顺序：普通导入在前，类型导入（`import type`）在后
-   `/core/checks` 目录下的检查文件必须使用 `export default` 导出函数，函数返回值必须为 `true`（通过）或 `false`（失败）

## 数据库表定义

-   必须使用下划线格式
