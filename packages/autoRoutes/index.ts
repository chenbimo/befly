import type { Plugin, HmrContext } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'path';

/**
 * 自动路由生成插件
 * 逻辑放在外部模板文件 `template.js` 中，通过占位符替换实现：
 */
// 固定：视图目录 src/views；布局目录 src/layouts；排除目录 ['components']；不区分公开路由；模板已为最终可执行代码，不再做占位符替换。
export default function autoRouter(): Plugin {
    const virtualModuleId = 'virtual:befly-auto-routes';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;
    // 目录固定，无需配置

    // 模板路径：基于当前文件所在目录，避免 process.cwd() 导致嵌套 workspace 时的重复路径问题
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const templatePath = resolve(thisDir, 'template.js');

    // 缓存与状态
    let cached = '';
    let loadError = false;

    function readTemplate() {
        try {
            const content = readFileSync(templatePath, 'utf-8');
            cached = content;
            loadError = false;
        } catch (e) {
            loadError = true;
            cached = `console.error('[auto-routes] 模板读取失败: ${templatePath}');export default [];`;
        }
    }

    // 初次读取
    readTemplate();

    return {
        name: 'befly-auto-routes',
        enforce: 'pre',
        resolveId(id) {
            if (id === virtualModuleId) return resolvedVirtualModuleId;
        },
        buildStart() {
            // 监听模板文件
            try {
                this.addWatchFile(templatePath);
            } catch {}
        },
        handleHotUpdate(ctx: HmrContext) {
            if (ctx.file === templatePath) {
                const before = cached;
                readTemplate();
                if (cached !== before) {
                    this.invalidate(resolvedVirtualModuleId);
                }
            }
        },
        load(id) {
            if (id !== resolvedVirtualModuleId) return;
            if (loadError || !cached) {
                readTemplate();
            }
            return cached;
        }
    };
}
