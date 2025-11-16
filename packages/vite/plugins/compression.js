import { compression } from 'vite-plugin-compression2';

/**
 * 创建文件压缩插件配置
 */
export function createCompressionPlugin(options = {}) {
    const { threshold = 10240, algorithms = ['gzip', 'brotliCompress'] } = options;

    return compression({
        include: /\.(html|xml|css|json|js|mjs|svg)$/i,
        threshold: threshold,
        algorithms: algorithms,
        deleteOriginalAssets: false
    });
}
