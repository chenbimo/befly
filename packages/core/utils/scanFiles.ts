import { existsSync } from "node:fs";

import { forOwn } from "es-toolkit/compat";
import { camelCase } from "es-toolkit/string";
import { relative, normalize, parse, join } from "pathe";

import { importDefault } from "./importDefault.js";

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

            const baseName = camelCase(fileName);
            let addonName = "";
            let moduleName = "";

            if (source === "core") {
                moduleName = baseName;
            } else if (source === "app") {
                moduleName = `app_${baseName}`;
            } else {
                const parsedAddonName = parseAddonNameFromPath(normalizedFile);
                if (!parsedAddonName) {
                    throw new Error(`scanFiles addon moduleName 解析失败：未找到 @befly-addon/<addon>/ 段落：${normalizedFile}`);
                }
                addonName = parsedAddonName;
                moduleName = `addon_${camelCase(addonName)}_${baseName}`;
            }

            const base: Record<string, any> = {
                source: source,
                type: type,
                sourceName: { core: "核心", addon: "组件", app: "项目" }[source],
                filePath: normalizedFile,
                relativePath: relativePath,
                fileName: fileName,
                moduleName: moduleName,
                addonName: addonName,
                fileBaseName: parse(normalizedFile).base,
                fileDir: dir
            };

            if (type === "table") {
                base.content = content;
                results.push(base as ScanFileResult);
                continue;
            }
            if (type === "api") {
                base.auth = true;
                base.rawBody = false;
                base.method = "POST";
                base.fields = {};
                base.required = [];
            }
            if (type === "plugin" || type === "hook") {
                base.deps = [];
                base.name = "";
                base.handler = null;
            }

            forOwn(content, (value, key) => {
                base[key] = value;
            });

            if (type === "api") {
                base.routePrefix = source === "core" ? "/core/" : source === "app" ? "/app/" : "/addon/";
                base.routePath = `/api/${base.routePrefix}${relativePath}`;
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
