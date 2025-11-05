/**
 * Vite CSS 配置
 */
export const css = {
    preprocessorOptions: {
        scss: {
            api: 'modern-compiler',
            additionalData: `@use "@/styles/internal/variables.scss" as *;`
        }
    }
};
