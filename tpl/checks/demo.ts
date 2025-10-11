/**
 * 示例项目检查
 * 这是一个演示如何编写项目级别检查的示例文件
 */

import { Logger } from 'befly';

/**
 * 检查示例
 * @returns 检查是否通过
 */
export default async function (): Promise<boolean> {
    try {
        Logger.info('执行项目示例检查...');

        // 这里可以添加项目特定的检查逻辑
        // 例如：检查必需的环境变量、检查文件是否存在等

        Logger.info('项目示例检查通过');
        return true;
    } catch (error: any) {
        Logger.error('项目示例检查失败', error);
        return false;
    }
}
