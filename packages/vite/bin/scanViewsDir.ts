import type { ViewDirMeta } from "befly-shared/utils/scanViewsDir";

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock, normalizeMenuTree } from "befly-shared/utils/scanViewsDir";

type MenuConfig = {
    name: string;
    path: string;
    icon?: string;
    sort?: number;
    children?: MenuConfig[];
};

/**
 * 扫描 views 目录，构建菜单树（与 core/sync/syncMenu.ts 中的 scanViewsDir 逻辑一致）
 */
export async function scanViewsDir(viewsDir: string, prefix: string, parentPath: string = ""): Promise<MenuConfig[]> {
    if (!existsSync(viewsDir)) {
        return [];
    }

    const menus: MenuConfig[] = [];
    const entries = await readdir(viewsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "components") {
            continue;
        }

        const dirPath = join(viewsDir, entry.name);
        const indexVuePath = join(dirPath, "index.vue");

        if (!existsSync(indexVuePath)) {
            continue;
        }

        let meta: ViewDirMeta | null = null;
        try {
            const content = await readFile(indexVuePath, "utf-8");

            const scriptSetup = extractScriptSetupBlock(content);
            if (!scriptSetup) {
                continue;
            }

            meta = extractDefinePageMetaFromScriptSetup(scriptSetup);
            if (!meta?.title) {
                continue;
            }
        } catch {
            continue;
        }

        if (!meta?.title) {
            continue;
        }

        const cleanName = cleanDirName(entry.name);
        let menuPath: string;
        if (cleanName === "index") {
            menuPath = parentPath;
        } else {
            menuPath = parentPath ? `${parentPath}/${cleanName}` : `/${cleanName}`;
        }

        const fullPath = prefix ? (menuPath ? `${prefix}${menuPath}` : prefix) : menuPath || "/";

        const menu: MenuConfig = {
            name: meta.title,
            path: fullPath,
            sort: meta.order ?? 999999
        };

        const children = await scanViewsDir(dirPath, prefix, menuPath);
        if (children.length > 0) {
            menu.children = children;
        }

        menus.push(menu);
    }

    menus.sort((a, b) => (a.sort ?? 999999) - (b.sort ?? 999999));
    return menus;
}

async function main(): Promise<void> {
    const dir = process.env.SCAN_VIEWS_DIR || "";
    const prefix = process.env.SCAN_PREFIX || "";

    const outRaw = process.env.SCAN_OUT || "";
    const out = outRaw ? outRaw : null;

    const prettyRaw = process.env.SCAN_PRETTY || "";
    const parsedPretty = Number(prettyRaw);
    const pretty = Number.isFinite(parsedPretty) && parsedPretty >= 0 ? parsedPretty : 4;

    if (!dir) {
        process.stderr.write("Missing required env SCAN_VIEWS_DIR\n");
        process.stderr.write("Usage: SCAN_VIEWS_DIR=<viewsDir> [SCAN_PREFIX=<pathPrefix>] [SCAN_OUT=<menu.json>] [SCAN_PRETTY=4] bun ./bin/scanViewsDir.ts\n");
        process.exitCode = 1;
        return;
    }

    const absDir = resolve(process.cwd(), dir);
    const outPath = out ? resolve(process.cwd(), out) : join(absDir, "menu.json");

    const menus = await scanViewsDir(absDir, prefix);
    const normalized = normalizeMenuTree(menus);

    const content = `${JSON.stringify(normalized, null, pretty)}\n`;
    await writeFile(outPath, content, { encoding: "utf-8" });

    process.stdout.write(`Wrote ${normalized.length} root menus to ${outPath}\n`);
}

await main();
