/**
 * Init 命令 - 初始化项目
 */

import { Logger, downloadPackage, copyDirRecursive, isDirectoryEmpty } from '../util.js';

/**
 * Init 命令主函数
 */
export async function initCommand(type: 'admin' | 'api') {
    const targetDir = process.cwd();

    // 配置映射
    const config = {
        admin: {
            packageName: 'befly-admin',
            registry: 'https://registry.npmmirror.com/befly-admin/latest',
            description: '前端 Admin 项目'
        },
        api: {
            packageName: 'befly-tpl',
            registry: 'https://registry.npmmirror.com/befly-tpl/latest',
            description: '后端 API 项目'
        }
    };

    const currentConfig = config[type];

    try {
        // 1. 检查目录是否为空
        Logger.info('检查当前目录...');
        const isEmpty = await isDirectoryEmpty(targetDir);

        if (!isEmpty) {
            throw new Error('当前目录不为空！初始化只能在空目录或仅包含隐藏文件的目录中执行');
        }

        // 2. 下载包
        const { version, packageDir, cleanup } = await downloadPackage(currentConfig.packageName, currentConfig.registry);

        // 3. 复制文件到当前目录
        Logger.info('正在初始化项目...');
        const result = await copyDirRecursive(packageDir, targetDir);

        // 4. 清理临时目录
        await cleanup();

        Logger.info(`✅ ${currentConfig.description}初始化成功`);
        Logger.info(`📦 版本: ${version}`);
        Logger.info(`📁 复制了 ${result.copied} 个文件`);
        Logger.info('');
        Logger.info('📝 下一步:');

        if (type === 'admin') {
            Logger.info('  1. bun install           # 安装依赖');
            Logger.info('  2. bun run dev           # 启动开发服务器');
        } else {
            Logger.info('  1. bun install           # 安装依赖');
            Logger.info('  2. 配置 .env.development # 配置数据库等环境变量');
            Logger.info('  3. bun run dev           # 启动开发服务器');
        }
    } catch (error: any) {
        Logger.error(`❌ 初始化失败: ${error.message}`);
        throw error;
    }
}
