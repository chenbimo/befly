/**
 * Befly 框架路径配置
 * 提供统一的路径变量，供整个框架使用
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 项目根目录（befly 框架的使用方项目）
const projectRoot = process.cwd();

/**
 * 系统路径配置对象
 */
export const paths = {
    /** Befly 框架根目录 */
    rootDir: __dirname,
    /** Befly 框架脚本目录 */
    rootScriptDir: join(__dirname, 'scripts'),
    /** Befly 框架检查目录 */
    rootCheckDir: join(__dirname, 'checks'),
    /** Befly 框架插件目录 */
    rootPluginDir: join(__dirname, 'plugins'),
    /** 项目根目录 */
    projectDir: projectRoot,
    /** 项目脚本目录 */
    projectScriptDir: join(projectRoot, 'scripts'),
    /** 项目检查目录 */
    projectCheckDir: join(projectRoot, 'checks'),
    /** 项目插件目录 */
    projectPluginDir: join(projectRoot, 'plugins'),
    /** 项目 API 目录 */
    projectApiDir: join(projectRoot, 'apis'),
    /** 项目表定义目录 */
    projectTableDir: join(projectRoot, 'tables')
} as const;
