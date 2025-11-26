import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { mergeAndConcat } from 'merge-anything';
import { isPlainObject, cloneDeep } from 'es-toolkit';

/**
 * 配置来源信息
 */
export interface ConfigSource {
    /** 配置文件路径 */
    filePath: string;
    /** 配置数据 */
    data: Record<string, any>;
}

/**
 * 合并配置选项
 */
export interface MergeConfigOptions {
    /** 合并策略：deep 深度合并（默认），shallow 浅合并，override 覆盖 */
    strategy?: 'deep' | 'shallow' | 'override';
    /** 是否克隆数据（避免引用污染），默认 true */
    clone?: boolean;
}

/**
 * 加载配置选项
 */
export interface LoadConfigOptions {
    /** 目录数组：要搜索的目录路径 */
    dirs: string[];
    /** 文件数组：要匹配的文件名 */
    files: string[];
    /** 合并选项 */
    merge?: MergeConfigOptions;
    /** 是否必须找到至少一个配置文件，默认 false */
    required?: boolean;
    /** 文件扩展名，默认 ['.js', '.ts', '.json'] */
    extensions?: string[];
}

/**
 * 合并多个配置对象
 * @param configs - 配置对象数组
 * @param options - 合并选项
 * @returns 合并后的配置对象
 */
export function mergeConfig(configs: Record<string, any>[], options: MergeConfigOptions = {}): Record<string, any> {
    const { strategy = 'deep', clone = true } = options;

    if (configs.length === 0) {
        return {};
    }

    // 只有一个配置时直接返回（可选克隆）
    if (configs.length === 1) {
        return clone ? cloneDeep(configs[0]) : configs[0];
    }

    // 根据策略合并
    let result: Record<string, any> = {};

    switch (strategy) {
        case 'shallow':
            // 浅合并：Object.assign
            result = Object.assign({}, ...configs);
            break;

        case 'override':
            // 覆盖：后面的完全覆盖前面的
            result = configs[configs.length - 1];
            if (clone) {
                result = cloneDeep(result);
            }
            break;

        case 'deep':
        default:
            // 深度合并：使用 merge-anything
            result = mergeAndConcat({}, ...configs);
            break;
    }

    return clone ? cloneDeep(result) : result;
}

/**
 * 加载并合并配置文件（矩阵搜索：dirs × files）
 * @param options - 加载选项
 * @returns 合并后的配置对象和来源信息
 */
export async function loadAndMergeConfig(options: LoadConfigOptions): Promise<{
    config: Record<string, any>;
    sources: ConfigSource[];
}> {
    const { dirs, files, merge = {}, required = false, extensions = ['.js', '.ts', '.json'] } = options;

    // 参数验证
    if (!Array.isArray(dirs) || dirs.length === 0) {
        throw new Error('dirs 必须是非空数组');
    }
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('files 必须是非空数组');
    }

    const sources: ConfigSource[] = [];
    const configs: Record<string, any>[] = [];

    // 矩阵搜索：dirs × files × extensions
    for (const dir of dirs) {
        if (!isAbsolute(dir)) {
            throw new Error(`目录必须是绝对路径: ${dir}`);
        }

        for (const file of files) {
            for (const ext of extensions) {
                const fileName = file.endsWith(ext) ? file : file + ext;
                const filePath = join(dir, fileName);

                if (existsSync(filePath)) {
                    try {
                        // 动态导入配置文件（使用 import 断言处理 JSON）
                        let data: any;

                        if (ext === '.json') {
                            // JSON 文件使用 import 断言
                            const module = await import(filePath, { with: { type: 'json' } });
                            data = module.default;
                        } else {
                            // JS/TS 文件使用动态导入
                            const module = await import(filePath);
                            data = module.default || module;
                        }

                        // 验证配置数据
                        if (!isPlainObject(data)) {
                            console.warn(`配置文件不是对象，已跳过: ${filePath}`);
                            continue;
                        }

                        sources.push({ filePath: filePath, data: data });
                        configs.push(data);

                        // 找到后跳过同名文件的其他扩展名
                        break;
                    } catch (error: any) {
                        console.error(`加载配置文件失败: ${filePath}`, error.message);
                    }
                }
            }
        }
    }

    // 检查必填要求
    if (required && sources.length === 0) {
        throw new Error(`未找到任何配置文件\ndirs: ${dirs.join(', ')}\nfiles: ${files.join(', ')}`);
    }

    // 合并配置
    const config = mergeConfig(configs, merge);

    return { config: config, sources: sources };
}
