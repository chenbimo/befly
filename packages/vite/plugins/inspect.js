import Inspect from 'vite-plugin-inspect';

/**
 * 创建 Vite 插件转换分析工具
 */
export function createInspectPlugin() {
    return Inspect({
        build: true,
        outputDir: '.vite-inspect'
    });
}
