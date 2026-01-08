import { existsSync } from "node:fs";

import { relative, normalize, parse, join } from "pathe";

import { importDefault } from "./importDefault";
import { camelCase, forOwn, isPlainObject } from "./util";

export type ScanFileSource = "app" | "addon" | "core";

export type ScanFileType = "api" | "table" | "plugin" | "hook";

export interface ScanFileResultBase {
    source: ScanFileSource; // 文件来源
    type: ScanFileType; // 文件类型（api/table/plugin/hook）
    sourceName: string; // 来源名称（用于日志展示）
    filePath: string; // 绝对路径
    relativePath: string; // 相对路径（无扩展名）
    fileName: string; // 文件名（无扩展名）

    /** 模块名（用于 deps 依赖图 key 与运行时挂载 key） */
    moduleName: string;

    /** addon 名：addon 来源为真实值；core/app 统一为空字符串（""） */
    addonName: string;

    fileBaseName: string;
    fileDir: string;

    /** default export 的自有 key 集合（用于记录模块自定义属性/结构校验） */
    customKeys?: string[];
}

export type ScanFileResult =
    | (ScanFileResultBase & {
          type: "table";
          content: any;
      })
    | (ScanFileResultBase & {
          type: Exclude<ScanFileType, "table">;
      } & Record<string, any>);

function parseAddonNameFromPath(normalizedPath: string): string | null {
    // 期望路径中包含：/node_modules/@befly-addon/<addonName>/...
    const parts = normalizedPath.split("/").filter(Boolean);
    const idx = parts.indexOf("@befly-addon");
    if (idx < 0) return null;
    const addonName = parts[idx + 1];
    if (typeof addonName !== "string" || addonName.trim() === "") return null;
    return addonName;
}

function parseLocalAddonNameFromPath(normalizedPath: string): string | null {
    // 兼容项目本地 addons：/addons/<addonName>/...
    // 注意：normalizedPath 已通过 pathe.normalize 统一为 /
    const parts = normalizedPath.split("/").filter(Boolean);
    const idx = parts.lastIndexOf("addons");
    if (idx < 0) return null;
    const addonName = parts[idx + 1];
    if (typeof addonName !== "string" || addonName.trim() === "") return null;
    return addonName;
}

/**
 * 扫描指定目录下的文件
 * @param dir 目录路径
 * @param source 文件来源（app/addon/core）
 * @param type 文件类型（api/table/plugin/hook）
 * @param pattern Glob模式
 */
export async function scanFiles(dir: string, source: ScanFileSource, type: ScanFileType, pattern: string): Promise<ScanFileResult[]> {
    if (!existsSync(dir)) return [];

    const normalizedDir = normalize(dir);
    const glob = new Bun.Glob(pattern);
    const results: ScanFileResult[] = [];

    try {
        const files = await glob.scan({
            cwd: dir,
            onlyFiles: true,
            absolute: true,
            followSymlinks: true
        });

        for await (const file of files) {
            if (file.endsWith(".d.ts")) continue;

            // 使用 pathe.normalize 统一路径分隔符为 /
            const normalizedFile = normalize(file);

            // 获取文件名（去除扩展名）
            const fileName = parse(normalizedFile).name;

            // 计算相对路径（去除扩展名）
            const relativePathWithExt = relative(normalizedDir, normalizedFile);
            const parsedRelativePath = parse(relativePathWithExt);
            const relativePath = parsedRelativePath.dir ? join(parsedRelativePath.dir, parsedRelativePath.name) : parsedRelativePath.name;

            // 固定默认过滤（不可关闭）：忽略下划线开头的文件/目录
            if (fileName.startsWith("_")) continue;
            if (relativePath.split("/").some((part) => part.startsWith("_"))) continue;
            const content = await importDefault(normalizedFile, {});

            // 记录 default export 的自有 key 集合（任何类型都记录，用于自定义属性审计/结构校验）。
            // 注意：在合并导出对象后还会写回一次 customKeys，避免用户导出同名字段覆盖该元信息。

            const baseName = camelCase(fileName);
            let addonName = "";
            let moduleName = "";

            if (source === "core") {
                // core：不做任何命名转换，直接使用文件名作为 moduleName（例如 auth / rate_limit）。
                addonName = "";
                moduleName = fileName;
            } else if (source === "app") {
                moduleName = `app_${baseName}`;
            } else {
                const parsedAddonName = parseAddonNameFromPath(normalizedFile) || parseLocalAddonNameFromPath(normalizedFile);
                if (!parsedAddonName) {
                    throw new Error(`scanFiles addon moduleName 解析失败：未找到 @befly-addon/<addon>/ 段落：${normalizedFile}`);
                }
                addonName = parsedAddonName;
                moduleName = `addon_${camelCase(addonName)}_${baseName}`;
            }

            const base: Record<string, any> = {
                source: source,
                type: type,
                sourceName: source === "core" ? "核心" : source === "addon" ? "组件" : "项目",
                filePath: normalizedFile,
                relativePath: relativePath,
                fileName: fileName,
                moduleName: moduleName,
                addonName: addonName,
                fileBaseName: parse(normalizedFile).base,
                fileDir: dir,

                customKeys: isPlainObject(content) ? Object.keys(content) : []
            };

            if (type === "table") {
                base["content"] = content;
                results.push(base as ScanFileResult);
                continue;
            }
            if (type === "api") {
                // 运行时 auth 必须是 boolean：
                // - checkApi 会校验 auth 类型
                // - permission hook 以 ctx.api.auth === false 判断公开接口
                // DB 存储的 0/1 由 syncApi 负责转换写入。
                base["auth"] = true;
                base["rawBody"] = false;
                base["method"] = "POST";
                base["fields"] = {};
                base["required"] = [];
            }
            if (type === "plugin" || type === "hook") {
                base["deps"] = [];
                base["name"] = "";
                base["handler"] = null;
            }

            forOwn(content, (value, key) => {
                base[key] = value;
            });

            if (type === "api") {
                base["routePrefix"] = source === "app" ? "/app" : `/addon/${addonName}`;
                base["path"] = `/api${base["routePrefix"]}/${relativePath}`;
            }

            results.push(base as ScanFileResult);
        }
    } catch (error: any) {
        const wrappedError = new Error(`scanFiles failed: source=${source} type=${type} dir=${normalizedDir} pattern=${pattern}`);
        (wrappedError as any).cause = error;
        throw wrappedError;
    }
    return results;
}
