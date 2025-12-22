/**
 * Befly 插件系统类型定义
 */

import type { BeflyContext } from "./befly.js";

/**
 * 插件配置类型
 */
export interface Plugin {
    /** 插件名称（运行时动态添加，由文件名生成） */
    name?: string;

    /** 依赖的插件列表（在这些插件之后执行） */
    deps: string[];

    /** 插件初始化函数 */
    handler: (context: BeflyContext) => any | Promise<any>;
}

/**
 * 插件导出格式
 */
export interface PluginExport {
    default: Plugin;
}

/**
 * 插件加载选项
 */
export interface PluginLoadOptions {
    /** 插件目录路径 */
    pluginDir: string;

    /** 是否跳过错误 */
    skipErrors?: boolean;

    /** 插件过滤函数 */
    filter?: (filename: string) => boolean;
}

/**
 * 插件执行上下文
 */
export interface PluginContext {
    /** 插件名称 */
    name: string;

    /** 执行开始时间 */
    startTime: number;

    /** 执行结束时间 */
    endTime?: number;

    /** 执行状态 */
    status: "pending" | "running" | "success" | "error";

    /** 错误信息 */
    error?: Error;
}

/**
 * 插件管理器接口
 */
export interface PluginManager {
    /** 已加载的插件列表 */
    plugins: Plugin[];

    /** 注册插件 */
    register(plugin: Plugin): void;

    /** 加载插件目录 */
    loadPlugins(options: PluginLoadOptions): Promise<void>;

    /** 执行所有插件 */
    executeAll(befly: BeflyContext): Promise<void>;

    /** 获取插件 */
    getPlugin(name: string): Plugin | undefined;

    /** 移除插件 */
    removePlugin(name: string): boolean;
}
