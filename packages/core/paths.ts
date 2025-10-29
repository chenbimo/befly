/**
 * Befly 框架路径配置
 * 提供统一的路径变量，供整个框架使用
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 项目根目录（befly 框架的使用方项目）
const projectRoot = process.cwd();

/**
 * 系统路径配置对象
 */
export const paths = {
    rootDir: __dirname,
    rootScriptDir: join(__dirname, 'scripts'),
    rootConfigDir: join(__dirname, 'config'),
    rootCheckDir: join(__dirname, 'checks'),
    rootPluginDir: join(__dirname, 'plugins'),
    rootApiDir: join(__dirname, 'apis'),
    coreTableDir: join(__dirname, 'tables'),
    projectDir: projectRoot,
    projectScriptDir: join(projectRoot, 'scripts'),
    projectConfigDir: join(projectRoot, 'config'),
    projectCheckDir: join(projectRoot, 'checks'),
    projectPluginDir: join(projectRoot, 'plugins'),
    projectApiDir: join(projectRoot, 'apis'),
    projectTableDir: join(projectRoot, 'tables')
} as const;
