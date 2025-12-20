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
            sort: meta.order || 1
        };

        const children = await scanViewsDir(dirPath, prefix, menuPath);
        if (children.length > 0) {
            menu.children = children;
        }

        menus.push(menu);
    }

    menus.sort((a, b) => (a.sort || 1) - (b.sort || 1));
    return menus;
}

function parseArgs(argv: string[]): { dir: string; prefix: string; out: string | null; pretty: number } {
    let dir = "";
    let prefix = "";
    let out: string | null = null;
    let pretty = 4;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === "--dir" || arg === "-d") {
            dir = argv[i + 1] || "";
            i += 1;
            continue;
        }

        if (arg === "--prefix" || arg === "-p") {
            prefix = argv[i + 1] || "";
            i += 1;
            continue;
        }

        if (arg === "--out" || arg === "-o") {
            out = argv[i + 1] || "";
            i += 1;
            continue;
        }

        if (arg === "--pretty") {
            const next = argv[i + 1] || "";
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 0) {
                pretty = parsed;
            }
            i += 1;
            continue;
        }
    }

    return {
        dir: dir,
        prefix: prefix,
        out: out,
        pretty: pretty
    };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (!args.dir) {
        process.stderr.write("Missing required --dir\n");
        process.stderr.write("Usage: bun ./bin/scanViewsDir.ts --dir <viewsAdminDir> [--prefix <pathPrefix>] [--out <menu.json>]\n");
        process.exitCode = 1;
        return;
    }

    const absDir = resolve(process.cwd(), args.dir);
    const outPath = args.out ? resolve(process.cwd(), args.out) : join(absDir, "menu.json");

    const menus = await scanViewsDir(absDir, args.prefix);
    const normalized = normalizeMenuTree(menus);

    const content = `${JSON.stringify(normalized, null, args.pretty)}\n`;
    await writeFile(outPath, content, { encoding: "utf-8" });

    process.stdout.write(`Wrote ${normalized.length} root menus to ${outPath}\n`);
}

await main();
