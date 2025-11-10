import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'path';

/**
 * 扫描 addon 的 views 目录
 */
function scanAddonViews(projectRoot: string): Array<{ virtualPath: string; realPath: string }> {
    const addonViews: Array<{ virtualPath: string; realPath: string }> = [];
    const nodeModulesAddonDir = join(projectRoot, 'node_modules', '@befly-addon');

    if (!existsSync(nodeModulesAddonDir)) {
        return addonViews;
    }

    try {
        const addons = readdirSync(nodeModulesAddonDir);

        for (const addonName of addons) {
            const addonDir = join(nodeModulesAddonDir, addonName);
            const viewsDir = join(addonDir, 'views');

            if (existsSync(viewsDir) && statSync(viewsDir).isDirectory()) {
                scanViewsDir(viewsDir, addonName, addonViews);
            }
        }
    } catch (error) {
        console.warn('[auto-routes] 扫描 addon views 失败:', error);
    }

    return addonViews;
}

/**
 * 递归扫描 views 目录
 */
function scanViewsDir(dir: string, addonName: string, result: Array<{ virtualPath: string; realPath: string }>): void {
    const scanDir = (currentDir: string, prefix = ''): void => {
        const files = readdirSync(currentDir);

        for (const file of files) {
            const fullPath = join(currentDir, file);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                // 跳过 components 目录
                if (file !== 'components') {
                    scanDir(fullPath, prefix ? `${prefix}/${file}` : file);
                }
            } else if (file.endsWith('.vue')) {
                const relativePath = prefix ? `${prefix}/${file}` : file;
                const virtualPath = `/node_modules/@befly-addon/${addonName}/views/${relativePath}`;
                const realPath = fullPath.replace(/\\/g, '/');

                result.push({ virtualPath, realPath });
            }
        }
    };

    scanDir(dir);
}

/**
 * 自动路由生成插件
 * 逻辑放在外部模板文件 `template.js` 中，通过占位符替换实现：
 */
// 固定：视图目录 src/views；布局目录 src/layouts；排除目录 ['components']；不区分公开路由；模板已为最终可执行代码，不再做占位符替换。
export default function autoRouter() {
    const virtualModuleId = 'virtual:befly-auto-routes';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;

    // 模板路径：基于当前文件所在目录，避免 process.cwd() 导致嵌套 workspace 时的重复路径问题
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const templatePath = resolve(thisDir, 'template.js');

    // 缓存与状态
    let cached = '';
    let loadError = false;
    let addonViewsCache: Array<{ virtualPath: string; realPath: string }> = [];

    function readTemplate(projectRoot: string) {
        try {
            let content = readFileSync(templatePath, 'utf-8');

            // 扫描 addon views
            const addonViews = scanAddonViews(projectRoot);
            addonViewsCache = addonViews;

            // 开发模式下输出调试信息
            if (process.env.NODE_ENV === 'development') {
                console.log('[auto-routes] 扫描到的 addon 页面数量:', addonViews.length);
            }

            // 生成 addon views 的导入语句
            const addonImports = addonViews.map((view) => `  '${view.virtualPath}': () => import('${view.realPath}')`).join(',\n');

            // 替换模板中的 addonViewFiles
            content = content.replace("const addonViewFiles = import.meta.glob('/node_modules/@befly-addon/*/views/**/*.vue');", `const addonViewFiles = {\n${addonImports}\n};`);

            cached = content;
            loadError = false;
        } catch (e) {
            loadError = true;
            cached = `console.error('[auto-routes] 模板读取失败: ${templatePath}');export default [];`;
        }
    }

    return {
        name: 'befly-auto-routes',
        enforce: 'pre',
        resolveId(id) {
            if (id === virtualModuleId) return resolvedVirtualModuleId;
        },
        configResolved(config) {
            // 初次读取，获取项目根目录
            readTemplate(config.root);
        },
        buildStart() {
            // 监听模板文件
            try {
                this.addWatchFile(templatePath);
            } catch {}
        },
        handleHotUpdate(ctx) {
            const normalizedFile = ctx.file.replace(/\\/g, '/');
            const projectRoot = ctx.server.config.root;

            // 监听 template.js 变化
            if (ctx.file === templatePath) {
                const before = cached;
                readTemplate(projectRoot);
                if (cached !== before) {
                    const module = ctx.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
                    if (module) {
                        ctx.server.moduleGraph.invalidateModule(module);
                    }
                    return [];
                }
            }

            // 监听 views 和 layouts 目录文件变化（新建、删除、修改）
            if (normalizedFile.includes('/src/views/') || normalizedFile.includes('/src/layouts/')) {
                const module = ctx.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
                if (module) {
                    ctx.server.moduleGraph.invalidateModule(module);
                }
                return [];
            }

            // 监听 addon views 目录变化
            if (normalizedFile.includes('/node_modules/@befly-addon/') && normalizedFile.includes('/views/')) {
                const before = addonViewsCache;
                readTemplate(projectRoot);
                if (JSON.stringify(addonViewsCache) !== JSON.stringify(before)) {
                    const module = ctx.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
                    if (module) {
                        ctx.server.moduleGraph.invalidateModule(module);
                    }
                }
                return [];
            }
        },
        load(id) {
            if (id !== resolvedVirtualModuleId) return;
            if (loadError || !cached) {
                // 降级处理：使用 process.cwd()
                readTemplate(process.cwd());
            }
            return cached;
        }
    };
}
