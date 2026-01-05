import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

import { mergeAndConcat } from "./mergeAndConcat";
import { getByPath, isPlainObject, setByPath } from "./util";

/**
 * 加载配置选项
 * - 该类型为 scanConfig 专用：按“就近放置”原则直接与实现放在同文件，避免拆到单独的 *Types.ts 造成目录噪音。
 */
export interface LoadConfigOptions {
    /** 当前工作目录，默认 process.cwd() */
    cwd?: string;
    /** 目录数组：要搜索的目录路径（相对于 cwd） */
    dirs: string[];
    /** 文件数组：要匹配的文件名 */
    files: string[];
    /** 文件扩展名，默认 ['.js', '.ts', '.json'] */
    extensions?: string[];
    /** 加载模式：'first' = 返回第一个找到的配置（默认），'merge' = 合并所有配置 */
    mode?: "merge" | "first";
    /** 指定要提取的字段路径数组，如 ['menus', 'database.host']，为空则返回完整对象 */
    paths?: string[];
    /** 默认配置，会与找到的配置合并（优先级最低） */
    defaults?: Record<string, any>;
}

/**
 * 扫描并合并配置文件（矩阵搜索：dirs × files）
 * @param options - 加载选项
 * @returns 合并后的配置对象（或第一个找到的配置）
 */
export async function scanConfig(options: LoadConfigOptions): Promise<Record<string, any>> {
    const {
        //
        cwd = process.cwd(),
        dirs,
        files,
        extensions = [".ts", ".js", ".json"],
        mode = "first",
        paths,
        defaults = {}
    } = options;

    // 参数验证
    if (!Array.isArray(dirs) || dirs.length === 0) {
        throw new Error("dirs 必须是非空数组");
    }
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error("files 必须是非空数组");
    }

    const configs: Record<string, any>[] = [];

    // 矩阵搜索：dirs × files × extensions
    for (const dir of dirs) {
        // 如果是绝对路径则直接使用，否则拼接 cwd
        const fullDir = isAbsolute(dir) ? dir : join(cwd, dir);

        for (const file of files) {
            for (const ext of extensions) {
                const fileName = file.endsWith(ext) ? file : file + ext;
                const filePath = join(fullDir, fileName);

                if (existsSync(filePath)) {
                    try {
                        const importUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;

                        // 动态导入配置文件（使用 import 断言处理 JSON）
                        let data: any;

                        if (ext === ".json") {
                            // JSON 文件使用 import 断言
                            const module = await import(importUrl, { with: { type: "json" } });
                            data = module.default;
                        } else {
                            // JS/TS 文件使用动态导入
                            const module = await import(importUrl);
                            data = module.default || module;

                            // 处理 async 函数导出（如 defineAddonConfig）
                            if (data instanceof Promise) {
                                data = await data;
                            }
                        }

                        // 验证配置数据
                        if (!isPlainObject(data)) {
                            continue;
                        }

                        configs.push(data);

                        // 如果模式为 'first'，找到第一个配置后立即返回
                        if (mode === "first") {
                            const firstConfig = mergeAndConcat(defaults, data);

                            // 如果指定了 paths，则只返回指定路径的字段
                            if (paths && paths.length > 0) {
                                const result: Record<string, any> = {};
                                for (const path of paths) {
                                    const value = getByPath(firstConfig, path);
                                    if (value !== undefined) {
                                        setByPath(result, path, value);
                                    }
                                }
                                return result;
                            }

                            return firstConfig;
                        }

                        // 找到后跳过同名文件的其他扩展名
                        break;
                    } catch {
                        // 保持静默：继续尝试下一个候选配置文件
                    }
                }
            }
        }
    }

    // 合并配置（使用 mergeAndConcat 深度合并）
    // 合并顺序：defaults ← configs[0] ← configs[1] ← ...
    const finalConfig = mergeAndConcat(defaults, ...configs);

    // 如果指定了 paths，则只返回指定路径的字段
    if (paths && paths.length > 0) {
        const result: Record<string, any> = {};
        for (const path of paths) {
            const value = getByPath(finalConfig, path);
            if (value !== undefined) {
                setByPath(result, path, value);
            }
        }
        return result;
    }

    return finalConfig;
}
