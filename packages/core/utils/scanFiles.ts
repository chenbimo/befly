import { existsSync } from "node:fs";

import { camelCase } from "es-toolkit/string";
import { relative, normalize, parse, join } from "pathe";

import { importDefault } from "./importDefault.js";

export type ScanFileSource = "app" | "addon" | "core";

export interface ScanFileResult {
    source: ScanFileSource; // 文件来源
    sourceName: string; // 来源名称（用于日志展示）
    filePath: string; // 绝对路径
    relativePath: string; // 相对路径（无扩展名）
    fileName: string; // 文件名（无扩展名）

    /** 模块名（用于 deps 依赖图 key 与运行时挂载 key） */
    moduleName: string;

    /** addon 名（仅 source='addon' 时存在，便于排查） */
    addonName?: string;

    fileBaseName: string;
    routePrefix: string;
    fileDir: string;
    content: any;
}

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
 * @param pattern Glob 模式
 */
export async function scanFiles(dir: string, source: ScanFileSource, pattern: string, defaultValue): Promise<ScanFileResult[]> {
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
            const content = await importDefault(normalizedFile, defaultValue);

            const baseName = camelCase(fileName);
            let addonName: string | undefined = undefined;
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

            results.push({
                source: source,
                sourceName: { core: "核心", addon: "组件", app: "项目" }[source],
                filePath: normalizedFile,
                relativePath: relativePath,
                fileName: fileName,
                moduleName: moduleName,
                addonName: addonName,
                fileBaseName: parse(normalizedFile).base,
                routePrefix: source === "app" ? "/app/" : "/addon/",
                fileDir: dir,
                content: content
            });
        }
    } catch (error: any) {
        const wrappedError = new Error(`scanFiles failed: source=${source} dir=${normalizedDir} pattern=${pattern}`);
        (wrappedError as any).cause = error;
        throw wrappedError;
    }
    return results;
}
