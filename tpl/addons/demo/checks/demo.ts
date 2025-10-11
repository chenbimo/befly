/**
 * Demo Addon 启动检查
 * 验证组件配置和依赖
 */

import { Logger } from 'befly/utils/logger';

export default async function (): Promise<boolean> {
    try {
        // 检查环境变量配置
        const demoEnable = process.env.DEMO_ENABLE;
        const defaultPriority = process.env.DEMO_DEFAULT_PRIORITY;

        if (demoEnable === 'false') {
            Logger.info('[Demo] 组件已禁用');
            return true;
        }

        // 验证默认优先级配置
        if (defaultPriority && !['low', 'medium', 'high'].includes(defaultPriority)) {
            Logger.warn(`[Demo] 无效的默认优先级配置: ${defaultPriority}，将使用 'medium'`);
        }

        Logger.info('[Demo] 组件检查通过');
        return true;
    } catch (error: any) {
        Logger.error('[Demo] 组件检查失败:', error);
        return false;
    }
}
