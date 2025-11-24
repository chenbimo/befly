/**
 * 核心工具函数
 */

// 内部依赖
import { existsSync } from 'node:fs';

// 外部依赖
import { camelCase } from 'es-toolkit/string';
import { scanFiles } from 'befly-util';

// 相对导入
import { Logger } from './lib/logger.js';

// 类型导入
import type { Plugin } from './types/plugin.js';
import type { Hook } from './types/hook.js';
import type { CorsConfig, BeflyContext } from './types/befly.js';
import type { RequestContext } from './types/context.js';
import type { PluginRequestHook, Next } from './types/plugin.js';

/**
 * 创建 JSON 响应（用于 Hook 中）
 * @param ctx - 请求上下文
 * @param msg - 消息
 * @param code - 状态码（默认 1）
 * @param data - 数据（可选）
 * @returns Response 对象
 */
export function JsonResponse(ctx: RequestContext, msg: string, code: number = 1, data?: any): Response {
    return Response.json(
        {
            code: code,
            msg: msg,
            data: data ?? null
        },
        {
            headers: ctx.corsHeaders
        }
    );
}

/**
 * 设置 CORS 响应头
 * @param req - 请求对象
 * @param config - CORS 配置（可选）
 * @returns CORS 响应头对象
 */
export function setCorsOptions(req: Request, config: CorsConfig = {}): Record<string, string> {
    const origin = config.origin || '*';
    return {
        'Access-Control-Allow-Origin': origin === '*' ? req.headers.get('origin') || '*' : origin,
        'Access-Control-Allow-Methods': config.methods || 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': config.allowedHeaders || 'Content-Type, Authorization, authorization, token',
        'Access-Control-Expose-Headers': config.exposedHeaders || 'Content-Range, X-Content-Range, Authorization, authorization, token',
        'Access-Control-Max-Age': String(config.maxAge || 86400),
        'Access-Control-Allow-Credentials': config.credentials || 'true'
    };
}

/**
 * 组合中间件函数
 * 基于 koa-compose 实现
 * @param middleware - 中间件函数数组
 * @returns 组合后的中间件函数
 */
export function compose(middleware: PluginRequestHook[]) {
    return function (befly: BeflyContext, ctx: RequestContext, next?: Next) {
        let index = -1;
        return dispatch(0);

        function dispatch(i: number): Promise<void> {
            if (i <= index) return Promise.reject(new Error('next() called multiple times'));
            index = i;
            let fn = middleware[i];
            if (i === middleware.length) fn = next as PluginRequestHook;
            if (!fn) return Promise.resolve();
            try {
                return Promise.resolve(fn(befly, ctx, dispatch.bind(null, i + 1)));
            } catch (err) {
                return Promise.reject(err);
            }
        }
    };
}

/**
 * 扫描并加载模块（插件或钩子）
 * @param dir - 目录路径
 * @param type - 模块类型
 * @param moduleLabel - 模块标签（如“插件”、“钩子”）
 * @param config - 配置对象
 * @param addonName - 组件名称（仅 type='addon' 时需要）
 * @returns 模块列表
 */
export async function scanModules<T extends Plugin | Hook>(dir: string, type: 'core' | 'addon' | 'app', moduleLabel: string, config?: Record<string, any>, addonName?: string): Promise<T[]> {
    if (!existsSync(dir)) return [];

    const items: T[] = [];
    const files = await scanFiles(dir, '*.{ts,js}');

    for (const { filePath, fileName } of files) {
        // 生成模块名称
        const name = camelCase(fileName);
        const moduleName = type === 'core' ? name : type === 'addon' ? `addon_${camelCase(addonName!)}_${name}` : `app_${name}`;

        try {
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            const moduleImport = await import(normalizedFilePath);
            const item = moduleImport.default;

            item.name = moduleName;
            // 注入配置
            if (config && config[moduleName]) {
                item.config = config[moduleName];
            }
            items.push(item);
        } catch (err: any) {
            const typeLabel = type === 'core' ? '核心' : type === 'addon' ? `组件${addonName}` : '项目';
            Logger.error(`${typeLabel}${moduleLabel} ${fileName} 导入失败`, err);
            process.exit(1);
        }
    }

    return items;
}

/**
 * 排序模块（根据依赖关系）
 * @param modules - 待排序的模块列表
 * @returns 排序后的模块列表，如果存在循环依赖或依赖不存在则返回 false
 */
export function sortModules<T extends { name?: string; after?: string[] }>(modules: T[]): T[] | false {
    const result: T[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const moduleMap: Record<string, T> = Object.fromEntries(modules.map((m) => [m.name!, m]));
    let isPass = true;

    // 检查依赖是否存在
    for (const module of modules) {
        if (module.after) {
            for (const dep of module.after) {
                if (!moduleMap[dep]) {
                    Logger.error(`模块 ${module.name} 依赖的模块 ${dep} 未找到`);
                    isPass = false;
                }
            }
        }
    }

    if (!isPass) return false;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            Logger.error(`模块循环依赖: ${name}`);
            isPass = false;
            return;
        }

        const module = moduleMap[name];
        if (!module) return;

        visiting.add(name);
        (module.after || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(module);
    };

    modules.forEach((m) => visit(m.name!));
    return isPass ? result : false;
}
