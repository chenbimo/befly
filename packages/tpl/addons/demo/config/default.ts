/**
 * Demo Addon 默认配置
 */

export default {
    // 是否启用组件
    enabled: process.env.DEMO_ENABLE !== 'false',

    // 默认优先级
    defaultPriority: process.env.DEMO_DEFAULT_PRIORITY || 'medium',

    // 每页默认数量
    defaultPageSize: Number(process.env.DEMO_PAGE_SIZE) || 10,

    // 最大每页数量
    maxPageSize: Number(process.env.DEMO_MAX_PAGE_SIZE) || 100
};
