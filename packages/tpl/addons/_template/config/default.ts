/**
 * Addon 默认配置
 * 建议从环境变量读取配置
 */

export default {
    // 示例配置
    apiKey: process.env.ADDON_API_KEY || '',
    apiSecret: process.env.ADDON_API_SECRET || '',
    timeout: Number(process.env.ADDON_TIMEOUT) || 30000,
    enabled: process.env.ADDON_ENABLED === 'true'
};
