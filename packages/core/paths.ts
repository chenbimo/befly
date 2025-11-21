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
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== Core 框架路径 ====================

/**
 * Core 框架根目录
 * @description packages/core/
 */
export const coreDir = __dirname;

/**
 * Core 框架检查目录
 * @description packages/core/checks/
 * @usage 存放启动检查模块（返回 boolean 的 default 函数）
 */
export const coreCheckDir = join(__dirname, 'checks');

/**
 * Core 框架插件目录
 * @description packages/core/plugins/
 * @usage 存放内置插件（db, logger, redis, tool 等）
 */
export const corePluginDir = join(__dirname, 'plugins');

/**
 * Core 框架钩子目录
 * @description packages/core/hooks/
 * @usage 存放内置钩子（auth, cors, parser 等）
 */
export const coreHookDir = join(__dirname, 'hooks');

/**
 * Core 框架 API 目录

/**
 * Core 框架 API 目录
 * @description packages/core/apis/
 * @usage 存放框架级别的 API 接口
 */
export const coreApiDir = join(__dirname, 'apis');

/**
 * Core 框架表定义目录
 * @description packages/core/tables/
 * @usage 存放框架核心表定义（JSON 格式）
 */
export const coreTableDir = join(__dirname, 'tables');

// ==================== 用户项目路径 ====================

/**
 * 项目根目录
 * @description process.cwd()
 * @usage 用户项目的根目录
 */
export const projectDir = process.cwd();

/**
 * 项目检查目录
 * @description {projectDir}/checks/
 * @usage 存放用户自定义启动检查模块
 */
export const projectCheckDir = join(projectDir, 'checks');

/**
 * 项目插件目录
 * @description {projectDir}/plugins/
 * @usage 存放用户自定义插件
 */
export const projectPluginDir = join(projectDir, 'plugins');

/**
 * 项目钩子目录
 * @description {projectDir}/hooks/
 * @usage 存放用户自定义钩子
 */
export const projectHookDir = join(projectDir, 'hooks');

/**
 * 项目 API 目录

/**
 * 项目 API 目录
 * @description {projectDir}/apis/
 * @usage 存放用户业务 API 接口
 */
export const projectApiDir = join(projectDir, 'apis');

/**
 * 项目表定义目录
 * @description {projectDir}/tables/
 * @usage 存放用户业务表定义（JSON 格式）
 */
export const projectTableDir = join(projectDir, 'tables');

/**
 * 项目组件目录
 * @description {projectDir}/addons/
 * @usage 存放本地组件（优先级高于 node_modules 中的组件）
 */
export const projectAddonsDir = join(projectDir, 'addons');
