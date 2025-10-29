/**
 * @befly/auto-routes - Vue Router 自动路由生成插件
 *
 * 功能：
 * - 基于文件结构自动生成 Vue Router 路由配置
 * - 支持多级目录嵌套
 * - 支持布局系统（通过文件名后缀 _n 指定布局）
 * - 自动排除 components 目录
 *
 * 路由规则：
 * 1. index.vue 代表目录的默认路由：/news/index.vue -> /news
 * 2. 非 index.vue 页面，路径 = 所有目录段 + 文件名：/news/detail/detail.vue -> /news/detail/detail
 * 3. 根目录 index.vue -> '/'
 * 4. 布局后缀规则：<name>_n.vue 指定布局编号（默认 0）
 * 5. components 子目录下文件自动忽略
 * 6. 路径自动转换为 kebab-case
 */

import type { Plugin, HmrContext } from 'vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'path';

/**
 * 插件配置选项
 */
export interface AutoRoutesOptions {
    /**
     * 是否在开发环境打印路由信息
     * @default true
     */
    debug?: boolean;
}

/**
 * 自动路由生成插件
 *
 * 固定配置：
 * - viewsDir: '/src/views'
 * - layoutsDir: '/src/layouts'
 * - excludeDirs: ['components']
 *
 * 可选配置：
 * - debug: 是否在开发环境打印路由信息（默认 true）
 */
export default function autoRoutes(options: AutoRoutesOptions = {}): Plugin {
    const resolvedOptions = {
        viewsDir: '/src/views',
        layoutsDir: '/src/layouts',
        excludeDirs: ['components'],
        debug: options.debug !== undefined ? options.debug : true
    };

    const virtualModuleId = 'virtual:auto-routes';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;

    // 模板路径：基于当前文件所在目录
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const templatePath = resolve(thisDir, 'template.js');

    // 缓存与状态
    let cached = '';
    let loadError = false;

    function readTemplate() {
        try {
            let content = readFileSync(templatePath, 'utf-8');

            // 替换模板中的占位符
            content = content
                .replace(/\{\{viewsDir\}\}/g, resolvedOptions.viewsDir)
                .replace(/\{\{layoutsDir\}\}/g, resolvedOptions.layoutsDir)
                .replace(/\{\{excludeDirs\}\}/g, JSON.stringify(resolvedOptions.excludeDirs))
                .replace(/\{\{debug\}\}/g, String(resolvedOptions.debug));

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

        resolveId(id: string) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
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
                    const module = ctx.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
                    if (module) {
                        ctx.server.moduleGraph.invalidateModule(module);
                    }
                }
            }
        },

        load(id: string) {
            if (id !== resolvedVirtualModuleId) return;
            if (loadError || !cached) {
                readTemplate();
            }
            return cached;
        }
    };
}
