import { defineStore } from 'pinia';
import { internalConfig } from '@/config/internal';

/**
 * 全局状态管理
 * 集中管理所有全局数据，避免分散到多个 store 文件
 */
export const useGlobal = defineStore('global', () => {
    // ==================== 全局数据 ====================
    const data = $ref({});

    // ==================== 全局计算属性 ====================
    const computed = {
        /** 上传地址 */
        uploadUrl: $computed(() => `${internalConfig.apiBaseUrl}/upload/local`),

        /** 上传请求头（动态获取 token） */
        uploadHeaders: $computed(() => {
            const token = $Storage.local.get('token');
            return {
                authorization: token ? `Bearer ${token}` : ''
            };
        })
    };

    // ==================== 全局方法 ====================
    const method = {
        /**
         * 设置页面标题
         * @param title 标题文本
         */
        setPageTitle: (title?: string) => {
            document.title = title ? `${title} - ${internalConfig.appTitle}` : internalConfig.appTitle;
        }
    };

    // ==================== 返回 ====================
    return {
        data,
        computed,
        method
    };
});
