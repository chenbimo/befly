import { analyzer } from 'vite-bundle-analyzer';

/**
 * 创建打包分析插件配置
 */
export function createAnalyzerPlugin(options = {}) {
    const { analyzerMode = 'static', fileName = 'bundle-report', reportTitle = '打包分析', openAnalyzer = false } = options;

    return analyzer({
        analyzerMode: analyzerMode,
        fileName: fileName,
        reportTitle: reportTitle,
        defaultSizes: 'gzip',
        gzipOptions: {},
        brotliOptions: {},
        openAnalyzer: openAnalyzer,
        summary: true
    });
}
