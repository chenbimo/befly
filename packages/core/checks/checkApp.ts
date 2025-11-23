import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { projectApiDir, projectDir } from '../paths.js';

/**
 * 检查项目结构
 */
export default async function (): Promise<boolean> {
    try {
        // 检查项目 apis 目录下是否存在名为 addon 的目录
        if (existsSync(projectApiDir)) {
            const addonDir = join(projectApiDir, 'addon');
            if (existsSync(addonDir)) {
                Logger.error('项目 apis 目录下不能存在名为 addon 的目录，addon 是保留名称，用于组件接口路由');
                return false;
            }
        }

        // 检查并创建 logs 目录
        const logsDir = join(projectDir, 'logs');
        if (!existsSync(logsDir)) {
            mkdirSync(logsDir, { recursive: true });
        }

        return true;
    } catch (error: any) {
        Logger.error('项目结构检查过程中出错', error);
        return false;
    }
}
