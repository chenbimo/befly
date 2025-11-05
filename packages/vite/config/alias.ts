/**
 * Vite 路径别名和全局定义配置
 */
import { resolve } from 'path';

// 获取项目根目录（当前工作目录）
const projectRoot = process.cwd();

export const viteResolve = {
    alias: {
        '@': resolve(projectRoot, 'src')
    }
};

export const define = {
    'process.env': { TINY_MODE: 'pc' }
};
