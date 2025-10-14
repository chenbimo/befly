import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 自动路由生成插件
 * 逻辑放在外部模板文件 `auto-routes-template.js` 中，通过占位符替换实现：
 *  __VIEWS_GLOB__     -> 视图文件 glob
 *  __LAYOUTS_GLOB__   -> 布局文件 glob
 *  __EXCLUDE_DIRS__   -> 需要排除的目录数组 JSON
 *  __LAYOUTS_DIR__    -> 布局目录字符串
 */
// 固定：视图目录 src/views；布局目录 src/layouts；排除目录 ['components']；不区分公开路由。
export default function autoRouter(): Plugin {
    const virtualModuleId = 'virtual:auto-routes';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;
    const viewsDir = 'src/views';
    const layoutsDir = 'src/layouts';
    const exclude = ['components'];

    return {
        name: 'auto-router',
        enforce: 'pre',
        resolveId(id) {
            if (id === virtualModuleId) return resolvedVirtualModuleId;
        },
        load(id) {
            if (id !== resolvedVirtualModuleId) return;
            const excludeLiteral = JSON.stringify(exclude);
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
            return raw
                .replace(/__VIEWS_GLOB__/g, `${viewsDir}/**/*.vue`)
                .replace(/__LAYOUTS_GLOB__/g, `${layoutsDir}/*.vue`)
                .replace(/__EXCLUDE_DIRS__/g, excludeLiteral)
                .replace(/__LAYOUTS_DIR__/g, layoutsDir.replace(/'/g, ''));
        }
    };
}
