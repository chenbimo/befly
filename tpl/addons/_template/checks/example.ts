/**
 * Addon 检查示例
 * 在框架启动前执行，用于验证配置、依赖等
 */

import { Logger } from 'befly/utils/logger';

export default async function (): Promise<boolean> {
    try {
        // 检查环境变量配置
        // const config = process.env.ADDON_NAME_CONFIG;
        // if (!config) {
        //     Logger.error('未配置 ADDON_NAME_CONFIG 环境变量');
        //     return false;
        // }

        Logger.info('Addon 示例检查通过');
        return true;
    } catch (error: any) {
        Logger.error('Addon 示例检查失败:', error);
        return false;
    }
}
