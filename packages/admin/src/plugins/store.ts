import { defineStore } from 'pinia';

/**
 * 全局状态管理
 * 集中管理所有全局数据，避免分散到多个 store 文件
 */
export const useGlobal = defineStore('global', () => {
    // ==================== 全局状态 ====================

    // 可以在这里添加全局状态，例如：
    // - 用户信息
    // - 主题配置
    // - 应用设置
    // - 等等

    return {
        // 暂时没有状态和方法
    };
});
