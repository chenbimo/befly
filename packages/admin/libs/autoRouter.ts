import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 自动路由生成插件
 * 逻辑放在外部模板文件 `auto-routes-template.js` 中，通过占位符替换实现：
 */
// 固定：视图目录 src/views；布局目录 src/layouts；排除目录 ['components']；不区分公开路由；模板已为最终可执行代码，不再做占位符替换。
export default function autoRouter(): Plugin {
    const virtualModuleId = 'virtual:auto-routes';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;
    // 目录固定，无需配置

    return {
        name: 'auto-router',
        enforce: 'pre',
        resolveId(id) {
            if (id === virtualModuleId) return resolvedVirtualModuleId;
        },
        load(id) {
            if (id !== resolvedVirtualModuleId) return;
            const templatePath = resolve(process.cwd(), 'packages', 'admin', 'libs', 'auto-routes-template.js');
            try {
                this.addWatchFile(templatePath);
            } catch {}
            let raw = '';
            try {
                raw = readFileSync(templatePath, 'utf-8');
            } catch (e) {
                return `console.error('[auto-routes] 模板读取失败: ${templatePath}');export default [];`;
            }
            return raw; // 直接返回模板内容
        }
    };
}
