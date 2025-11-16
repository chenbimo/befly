import { defineConfig, presetAttributify, presetUno } from 'unocss';

/**
 * 创建 UnoCSS 配置
 */
export function createUnoConfig(userConfig = {}) {
    const defaultConfig = {
        presets: [presetUno(), presetAttributify()],
        shortcuts: {
            'flex-center': 'flex items-center justify-center',
            'flex-between': 'flex items-center justify-between',
            'flex-col-center': 'flex flex-col items-center justify-center'
        },
        theme: {
            colors: {
                primary: '#1890ff',
                success: '#52c41a',
                warning: '#faad14',
                danger: '#ff4d4f',
                info: '#1890ff'
            }
        }
    };

    return defineConfig({
        ...defaultConfig,
        ...userConfig,
        theme: {
            ...defaultConfig.theme,
            ...(userConfig.theme || {})
        },
        shortcuts: {
            ...defaultConfig.shortcuts,
            ...(userConfig.shortcuts || {})
        }
    });
}
