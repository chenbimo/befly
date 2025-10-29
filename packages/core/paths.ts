/**
 * Befly 框架路径配置
 *
 * 提供统一的路径常量，供整个框架使用
 * 所有路径常量采用具名导出方式，避免通过对象访问
 *
 * 路径分类：
 * - root* 系列：Core 框架内部路径（packages/core/*）
 * - project* 系列：用户项目路径（process.cwd()/*）
 *
 * 目录结构：
 * ```
 * packages/core/           (rootDir)
 *   ├── scripts/           (rootScriptDir)
 *   ├── config/            (rootConfigDir)
 *   ├── checks/            (rootCheckDir)
 *   ├── plugins/           (rootPluginDir)
 *   ├── apis/              (rootApiDir)
 *   └── tables/            (rootTableDir)
 *
 * project/                 (projectDir)
 *   ├── scripts/           (projectScriptDir)
 *   ├── config/            (projectConfigDir)
 *   ├── checks/            (projectCheckDir)
 *   ├── plugins/           (projectPluginDir)
 *   ├── apis/              (projectApiDir)
 *   └── tables/            (projectTableDir)
 * ```
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 项目根目录（befly 框架的使用方项目）
const projectRoot = process.cwd();

// ==================== Core 框架路径 ====================

/**
 * Core 框架根目录
 * @description packages/core/
 */
export const rootDir = __dirname;

/**
 * Core 框架脚本目录
 * @description packages/core/scripts/
 * @usage 存放框架级别的脚本工具
 */
export const rootScriptDir = join(__dirname, 'scripts');

/**
 * Core 框架配置目录
 * @description packages/core/config/
 * @usage 存放框架默认配置（env.ts, fields.ts 等）
 */
export const rootConfigDir = join(__dirname, 'config');

/**
 * Core 框架检查目录
 * @description packages/core/checks/
 * @usage 存放启动检查模块（返回 boolean 的 default 函数）
 */
export const rootCheckDir = join(__dirname, 'checks');

/**
 * Core 框架插件目录
 * @description packages/core/plugins/
 * @usage 存放内置插件（db, logger, redis, tool 等）
 */
export const rootPluginDir = join(__dirname, 'plugins');

/**
 * Core 框架 API 目录
 * @description packages/core/apis/
 * @usage 存放框架级别的 API 接口
 */
export const rootApiDir = join(__dirname, 'apis');

/**
 * Core 框架表定义目录
 * @description packages/core/tables/
 * @usage 存放框架核心表定义（JSON 格式）
 */
export const rootTableDir = join(__dirname, 'tables');

// ==================== 用户项目路径 ====================

/**
 * 项目根目录
 * @description process.cwd()
 * @usage 用户项目的根目录
 */
export const projectDir = projectRoot;

/**
 * 项目脚本目录
 * @description {projectDir}/scripts/
 * @usage 存放用户自定义脚本工具
 */
export const projectScriptDir = join(projectRoot, 'scripts');

/**
 * 项目配置目录
 * @description {projectDir}/config/
 * @usage 存放用户项目配置（覆盖框架默认配置）
 */
export const projectConfigDir = join(projectRoot, 'config');

/**
 * 项目检查目录
 * @description {projectDir}/checks/
 * @usage 存放用户自定义启动检查模块
 */
export const projectCheckDir = join(projectRoot, 'checks');

/**
 * 项目插件目录
 * @description {projectDir}/plugins/
 * @usage 存放用户自定义插件
 */
export const projectPluginDir = join(projectRoot, 'plugins');

/**
 * 项目 API 目录
 * @description {projectDir}/apis/
 * @usage 存放用户业务 API 接口
 */
export const projectApiDir = join(projectRoot, 'apis');

/**
 * 项目表定义目录
 * @description {projectDir}/tables/
 * @usage 存放用户业务表定义（JSON 格式）
 */
export const projectTableDir = join(projectRoot, 'tables');
