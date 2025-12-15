/**
 * 核心工具函数
 */

// 内部依赖
import { existsSync } from 'node:fs';

/**
 * 进程角色信息
 */
export interface ProcessRole {
    /** 进程角色：primary（主进程）或 worker（工作进程） */
    role: 'primary' | 'worker';
    /** 实例 ID（PM2 或 Bun Worker） */
    instanceId: string | null;
    /** 运行环境：bun-cluster、pm2-cluster 或 standalone */
    env: 'bun-cluster' | 'pm2-cluster' | 'standalone';
}

/**
 * 获取当前进程角色信息
 * @returns 进程角色、实例 ID 和运行环境
 */
export function getProcessRole(): ProcessRole {
    const bunWorkerId = process.env.BUN_WORKER_ID;
    const pm2InstanceId = process.env.PM2_INSTANCE_ID;

    // Bun 集群模式
    if (bunWorkerId !== undefined) {
        return {
            role: bunWorkerId === '' ? 'primary' : 'worker',
            instanceId: bunWorkerId || '0',
            env: 'bun-cluster'
        };
    }

    // PM2 集群模式
    if (pm2InstanceId !== undefined) {
        return {
            role: pm2InstanceId === '0' ? 'primary' : 'worker',
            instanceId: pm2InstanceId,
            env: 'pm2-cluster'
        };
    }

    // 单进程模式
    return {
        role: 'primary',
        instanceId: null,
        env: 'standalone'
    };
}

/**
 * 检测当前进程是否为主进程
 * 用于集群模式下避免重复执行同步任务
 * - Bun 集群：BUN_WORKER_ID 为空时是主进程
 * - PM2 集群：PM2_INSTANCE_ID 为 '0' 或不存在时是主进程
 * @returns 是否为主进程
 */
export function isPrimaryProcess(): boolean {
    return getProcessRole().role === 'primary';
}

// 外部依赖
import { camelCase } from 'es-toolkit/string';
import { scanFiles } from 'befly-shared/scanFiles';

// 相对导入
import { Logger } from './lib/logger.js';

// 类型导入
import type { Plugin } from './types/plugin.js';
import type { Hook } from './types/hook.js';
import type { CorsConfig, BeflyContext } from './types/befly.js';
import type { RequestContext } from './types/context.js';
import type { PluginRequestHook, Next } from './types/plugin.js';

/**
 * 创建错误响应（专用于 Hook 中间件）
 * 在钩子中提前拦截请求时使用
 * @param ctx - 请求上下文
 * @param msg - 错误消息
 * @param code - 错误码，默认 1
 * @param data - 附加数据，默认 null
 * @param detail - 详细信息，用于标记具体提示位置，默认 null
 * @returns Response 对象
 */
export function ErrorResponse(ctx: RequestContext, msg: string, code: number = 1, data: any = null, detail: any = null): Response {
    // 记录拦截日志
    if (ctx.requestId) {
        const duration = Date.now() - ctx.now;
        const user = ctx.user?.id ? `[User:${ctx.user.id} ${ctx.user.nickname}]` : '[Guest]';
        Logger.info(`[${ctx.requestId}] ${ctx.route} ${user} ${duration}ms [${msg}]`);
    }

    return Response.json(
        {
            code: code,
            msg: msg,
            data: data,
            detail: detail
        },
        {
            headers: ctx.corsHeaders
        }
    );
}

/**
 * 创建最终响应（专用于 API 路由结尾）
 * 自动处理 ctx.response/ctx.result，并记录请求日志
 * @param ctx - 请求上下文
 * @returns Response 对象
 */
export function FinalResponse(ctx: RequestContext): Response {
    // 记录请求日志
    if (ctx.api && ctx.requestId) {
        const duration = Date.now() - ctx.now;
        const user = ctx.user?.id ? `[User:${ctx.user.id}  ${ctx.user.nickname}]` : '[Guest]';
        Logger.info(`[${ctx.requestId}] ${ctx.route} ${user} ${duration}ms`);
    }

    // 1. 如果已经有 response，直接返回
    if (ctx.response) {
        return ctx.response;
    }

    // 2. 如果有 result，格式化为响应
    if (ctx.result !== undefined) {
        let result = ctx.result;

        // 如果是字符串，自动包裹为成功响应
        if (typeof result === 'string') {
            result = {
                code: 0,
                msg: result
            };
        }
        // 如果是对象，自动补充 code: 0
        else if (result && typeof result === 'object') {
            if (!('code' in result)) {
                result = {
                    code: 0,
                    ...result
                };
            }
        }

        // 处理 BigInt 序列化问题
        if (result && typeof result === 'object') {
            const jsonString = JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? value.toString() : value));
            return new Response(jsonString, {
                headers: {
                    ...ctx.corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            return Response.json(result, {
                headers: ctx.corsHeaders
            });
        }
    }

    // 3. 默认响应：没有生成响应
    return Response.json(
        {
            code: 1,
            msg: '未生成响应'
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
 * 标准化接口权限路径（用于写入/读取权限缓存时保持一致）
 * 规则（简化版）：method 大写；path 为空则为 '/'；确保以 '/' 开头
 * 说明：当前框架内 api.path 来源于目录结构生成、请求侧使用 URL.pathname，默认不包含 query/hash，且不期望出现尾部斜杠等异常输入。
 */
export function normalizeApiPath(method: string, path: string): string {
    const normalizedMethod = (method || '').toUpperCase();
    let normalizedPath = path || '/';

    if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
    }

    return `${normalizedMethod}${normalizedPath}`;
}

/**
 * 生成路由 Key（用于路由匹配 / 权限缓存 / 日志等场景统一使用）
 * 格式：METHOD/path
 */
export function makeRouteKey(method: string, pathname: string): string {
    return normalizeApiPath(method, pathname);
}

/**
 * 扫描模块（插件或钩子）
 * @param dir - 目录路径
 * @param type - 模块类型（core/addon/app）
 * @param moduleLabel - 模块标签（如"插件"、"钩子"）
 * @param addonName - 组件名称（仅 type='addon' 时需要）
 * @returns 模块列表
 */
export async function scanModules<T extends Plugin | Hook>(dir: string, type: 'core' | 'addon' | 'app', moduleLabel: string, addonName?: string): Promise<T[]> {
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
            // 为 addon 模块记录 addon 名称
            if (type === 'addon' && addonName) {
                item.addonName = addonName;
            }
            items.push(item);
        } catch (err: any) {
            const typeLabel = type === 'core' ? '核心' : type === 'addon' ? `组件${addonName}` : '项目';
            Logger.error({ err: err, module: fileName }, `${typeLabel}${moduleLabel} 导入失败`);
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
                    Logger.error({ module: module.name, dependency: dep }, '依赖的模块未找到');
                    isPass = false;
                }
            }
        }
    }

    if (!isPass) return false;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            Logger.error({ module: name }, '模块循环依赖');
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
