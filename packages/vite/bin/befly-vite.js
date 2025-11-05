#!/usr/bin/env node
import { createServer, build, preview, mergeConfig, loadConfigFromFile } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = resolve(__dirname, '../vite.config.ts');

const command = process.argv[2];

/**
 * 加载并合并配置
 * 优先级：项目 vite.config.ts > befly-vite 默认配置
 */
async function loadMergedConfig(mode) {
    const projectConfigPath = resolve(process.cwd(), 'vite.config.ts');

    // 如果项目有自己的 vite.config.ts，直接使用它
    // （项目配置应该已经使用了 createBeflyConfig）
    if (existsSync(projectConfigPath)) {
        return projectConfigPath;
    }

    // 否则使用默认配置
    return defaultConfigPath;
}

async function main() {
    try {
        const mode = command === 'build' ? 'production' : 'development';
        const configFile = await loadMergedConfig(mode);

        switch (command) {
            case 'dev':
                console.log(' 启动开发服务器...\n');
                const server = await createServer({
                    configFile: configFile,
                    root: process.cwd()
                });
                await server.listen();
                server.printUrls();
                break;

            case 'build':
                console.log(' 开始构建...\n');
                await build({
                    configFile: configFile,
                    root: process.cwd()
                });
                console.log('\n 构建完成！');
                break;

            case 'preview':
                console.log(' 启动预览服务器...\n');
                const previewServer = await preview({
                    configFile: configFile,
                    root: process.cwd()
                });
                previewServer.printUrls();
                break;

            default:
                console.log(`
befly-vite - Befly Vite 开发工具

用法:
  befly-vite dev      启动开发服务器
  befly-vite build    构建生产版本
  befly-vite preview  预览构建结果
                `);
        }
    } catch (error) {
        console.error(' 执行失败:', error);
        process.exit(1);
    }
}

main();
