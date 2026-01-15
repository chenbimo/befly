import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { scanCoreBuiltinHooks, scanCoreBuiltinPlugins } from "../utils/scanCoreBuiltins";
import { scanFiles } from "../utils/scanFiles";
import { sortModules } from "../utils/sortModules";

function ensureEmptyDir(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
}

describe("utils - sortModules", () => {
    test("should topologically sort by deps", () => {
        type TestModule = { fileName: string; moduleName: string; deps: string[] };

        const items: TestModule[] = [
            { fileName: "b", moduleName: "b", deps: ["a"] },
            { fileName: "a", moduleName: "a", deps: [] },
            { fileName: "c", moduleName: "c", deps: ["b"] }
        ];

        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).not.toBe(false);
        if (sorted === false) {
            throw new Error("Expected sorted result");
        }
        expect(sorted.map((x) => x.moduleName)).toEqual(["a", "b", "c"]);
    });

    test("missing dependency should return false", () => {
        const items = [{ fileName: "a", moduleName: "a", deps: ["notFound"] }];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).toBe(false);
    });

    test("cycle dependency should return false", () => {
        const items = [
            { fileName: "a", moduleName: "a", deps: ["b"] },
            { fileName: "b", moduleName: "b", deps: ["a"] }
        ];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).toBe(false);
    });

    test("duplicate module name should return false", () => {
        const items = [
            { fileName: "a", moduleName: "same", deps: [] },
            { fileName: "b", moduleName: "same", deps: [] }
        ];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).toBe(false);
    });

    test("stress: long chain deps should sort correctly", () => {
        const len = 120;
        const items: Array<{ fileName: string; moduleName: string; deps: string[] }> = [];
        for (let i = 0; i < len; i++) {
            const name = `m${i}`;
            const dep = i === 0 ? [] : [`m${i - 1}`];
            items.push({ fileName: name, moduleName: name, deps: dep });
        }

        // 打乱输入顺序，确保排序不是“碰巧”通过。
        items.reverse();

        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).not.toBe(false);
        if (sorted === false) {
            throw new Error("Expected sorted result");
        }
        expect(sorted.map((x) => x.moduleName)).toEqual(Array.from({ length: len }, (_, i) => `m${i}`));
    });

    test("stress: multi-branch deps should keep partial order", () => {
        // 图：
        //   d
        //  / \
        // b   c
        //  \ /
        //   a
        const items: Array<{ fileName: string; moduleName: string; deps: string[] }> = [
            { fileName: "a", moduleName: "a", deps: ["b", "c"] },
            { fileName: "b", moduleName: "b", deps: ["d"] },
            { fileName: "c", moduleName: "c", deps: ["d"] },
            { fileName: "d", moduleName: "d", deps: [] }
        ];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).not.toBe(false);

        if (sorted === false) {
            throw new Error("Expected sorted result");
        }

        const order = sorted.map((x) => x.moduleName);
        const indexOf = (name: string) => order.indexOf(name);

        expect(indexOf("d")).toBeGreaterThanOrEqual(0);
        expect(indexOf("b")).toBeGreaterThanOrEqual(0);
        expect(indexOf("c")).toBeGreaterThanOrEqual(0);
        expect(indexOf("a")).toBeGreaterThanOrEqual(0);

        expect(indexOf("d")).toBeLessThan(indexOf("b"));
        expect(indexOf("d")).toBeLessThan(indexOf("c"));
        expect(indexOf("b")).toBeLessThan(indexOf("a"));
        expect(indexOf("c")).toBeLessThan(indexOf("a"));
    });
});

describe("utils - scanFiles (windows paths)", () => {
    test("should parse addonName/moduleName for node_modules addons on Windows", async () => {
        const root = join(import.meta.dir, "..", "temp", "fixtures", "scanFilesWindows");
        ensureEmptyDir(root);

        // node_modules addon: @befly-addon/demo
        const nmPluginDir = join(root, "node_modules", "@befly-addon", "demo", "plugins");
        mkdirSync(nmPluginDir, { recursive: true });
        writeFileSync(join(nmPluginDir, "demoPlugin.ts"), 'export default { name: "demoPlugin", deps: [], handler: null }\n', { encoding: "utf8" });

        try {
            const nmResults = await scanFiles(nmPluginDir, "addon", "plugin", "**/*.ts");
            expect(nmResults.length).toBe(1);
            expect(nmResults[0]?.addonName).toBe("demo");
            expect(nmResults[0]?.moduleName).toBe("addon_demo_demoPlugin");
            // 盘符/绝对路径：Windows 上通常是 D:\ 或 D:/，scanFiles 内部 normalize 后应稳定
            expect(String(nmResults[0]?.filePath)).toMatch(/^[A-Za-z]:[\\/]/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe("utils - scanCoreBuiltins", () => {
    test("scanCoreBuiltinPlugins should include core plugins with stable shape", () => {
        const plugins = scanCoreBuiltinPlugins();
        expect(plugins.length).toBeGreaterThan(0);

        const logger = plugins.find((p) => (p as Record<string, unknown>)["name"] === "logger");
        expect(logger).toBeTruthy();
        if (!logger) {
            throw new Error("Expected logger plugin");
        }
        expect(logger.source).toBe("core");
        expect(logger.type).toBe("plugin");
        expect(logger.moduleName).toBe("logger");
        expect(logger.addonName).toBe("");
        expect(logger.filePath).toBe("core:plugin:logger");
    });

    test("scanCoreBuiltinHooks should include core hooks with stable shape", () => {
        const hooks = scanCoreBuiltinHooks();
        expect(hooks.length).toBeGreaterThan(0);

        const auth = hooks.find((p) => (p as Record<string, unknown>)["name"] === "auth");
        expect(auth).toBeTruthy();
        if (!auth) {
            throw new Error("Expected auth hook");
        }
        expect(auth.source).toBe("core");
        expect(auth.type).toBe("hook");
        expect(auth.moduleName).toBe("auth");
        expect(auth.addonName).toBe("");
        expect(auth.filePath).toBe("core:hook:auth");
    });
});

describe("utils - scanSources (fixture)", () => {
    test("should scan app + node_modules addons", async () => {
        const root = join(import.meta.dir, "..", "temp", "fixtures", "scanSources");
        ensureEmptyDir(root);

        // app
        mkdirSync(join(root, "tables"), { recursive: true });
        mkdirSync(join(root, "plugins"), { recursive: true });
        mkdirSync(join(root, "hooks"), { recursive: true });
        mkdirSync(join(root, "apis", "user"), { recursive: true });

        writeFileSync(join(root, "tables", "user.json"), JSON.stringify({ name: "user" }), { encoding: "utf8" });
        writeFileSync(join(root, "plugins", "hello.ts"), 'export default { name: "hello", deps: [], handler: null };\n', { encoding: "utf8" });
        writeFileSync(join(root, "plugins", "_skip.ts"), 'export default { name: "skip" };\n', { encoding: "utf8" });
        writeFileSync(join(root, "hooks", "auth.ts"), 'export default { name: "auth", deps: [], handler: null };\n', { encoding: "utf8" });
        writeFileSync(join(root, "apis", "user", "login.ts"), 'export default { name: "login" };\n', { encoding: "utf8" });

        // node_modules addon: @befly-addon/demo
        const nmAddonRoot = join(root, "node_modules", "@befly-addon", "demo");
        mkdirSync(join(nmAddonRoot, "plugins"), { recursive: true });
        mkdirSync(join(nmAddonRoot, "tables"), { recursive: true });
        mkdirSync(join(nmAddonRoot, "apis"), { recursive: true });
        writeFileSync(join(nmAddonRoot, "tables", "post.json"), JSON.stringify({ name: "post" }), { encoding: "utf8" });
        writeFileSync(join(nmAddonRoot, "plugins", "demoPlugin.ts"), 'export default { name: "demoPlugin", deps: [], handler: null };\n', { encoding: "utf8" });
        writeFileSync(join(nmAddonRoot, "apis", "ping.ts"), 'export default { name: "ping" };\n', { encoding: "utf8" });

        // node_modules addon: @befly-addon/remote (no local override)
        const nmRemoteRoot = join(root, "node_modules", "@befly-addon", "remote");
        mkdirSync(join(nmRemoteRoot, "plugins"), { recursive: true });
        mkdirSync(join(nmRemoteRoot, "tables"), { recursive: true });
        mkdirSync(join(nmRemoteRoot, "apis"), { recursive: true });
        writeFileSync(join(nmRemoteRoot, "tables", "remote.json"), JSON.stringify({ name: "remote" }), { encoding: "utf8" });
        writeFileSync(join(nmRemoteRoot, "plugins", "remotePlugin.ts"), 'export default { name: "remotePlugin", deps: [], handler: null };\n', { encoding: "utf8" });
        writeFileSync(join(nmRemoteRoot, "apis", "pong.ts"), 'export default { name: "pong" };\n', { encoding: "utf8" });

        try {
            // 注意：paths.ts 的 appDir=process.cwd() 很容易在其他测试里提前被缓存。
            // 这里用子进程隔离模块缓存：先 chdir 到夹具 root，再 import scanSources。
            const scanSourcesUrl = new URL("../utils/scanSources.ts", import.meta.url).href;
            const code = `
process.chdir(${JSON.stringify(root)});
const mod = await import(${JSON.stringify(scanSourcesUrl)});
const result = await mod.scanSources();
process.stdout.write(JSON.stringify({
  addons: result.addons,
        tables: result.tables.map((t) => ({ source: t.source, type: t.type, fileName: t.fileName, content: t.type === 'table' ? t.content : undefined, customKeys: t.customKeys, addonName: t.addonName, moduleName: t.moduleName })),
  plugins: result.plugins.map((p) => ({ source: p.source, fileName: p.fileName, addonName: p.addonName, moduleName: p.moduleName })),
  hooks: result.hooks.map((h) => ({ source: h.source, fileName: h.fileName })),
    apis: result.apis.map((a) => ({ source: a.source, fileName: a.fileName, path: a.path, addonName: a.addonName, moduleName: a.moduleName }))
}));
`;

            const proc = Bun.spawnSync({
                cmd: ["bun", "-e", code],
                cwd: join(import.meta.dir, ".."),
                stdout: "pipe",
                stderr: "pipe"
            });

            expect(proc.exitCode).toBe(0);

            const text = proc.stdout.toString();
            type ParsedScanSources = {
                addons: Array<{ name: string; sourceName: string; rootDir: string }>;
                tables: Array<{
                    source: string;
                    type: string;
                    fileName: string;
                    content?: { name: string };
                    customKeys?: unknown;
                    addonName: string;
                    moduleName: string;
                }>;
                plugins: Array<{ source: string; fileName: string; addonName: string; moduleName: string }>;
                hooks: Array<{ source: string; fileName: string }>;
                apis: Array<{ source: string; fileName: string; path: string; addonName: string; moduleName: string }>;
            };

            const parsed = JSON.parse(text) as ParsedScanSources;

            const demoAddon = parsed.addons.find((a) => a.name === "demo");
            expect(demoAddon).toBeTruthy();
            if (!demoAddon) {
                throw new Error("Expected demo addon");
            }
            expect(demoAddon.sourceName).toBe("组件");
            expect(String(demoAddon.rootDir).replace(/\\/g, "/")).toContain("/node_modules/@befly-addon/demo");

            // app table
            const appUserTable = parsed.tables.find((t) => t.source === "app" && t.fileName === "user");
            expect(appUserTable).toBeTruthy();
            if (!appUserTable || !appUserTable.content) {
                throw new Error("Expected app user table content");
            }
            expect(appUserTable.content.name).toBe("user");
            expect(Array.isArray(appUserTable.customKeys)).toBe(true);

            // app plugin (and _skip filtered)
            expect(parsed.plugins.some((p) => p.source === "app" && p.fileName === "hello")).toBe(true);
            expect(parsed.plugins.some((p) => p.fileName === "_skip")).toBe(false);

            // api routePath formatting
            const loginApi = parsed.apis.find((a) => a.source === "app" && a.fileName === "login");
            expect(loginApi).toBeTruthy();
            if (!loginApi) {
                throw new Error("Expected login api");
            }
            expect(loginApi.path).toBe("/api/app/user/login");

            expect(parsed.plugins.some((p) => p.source === "addon" && p.fileName === "demoPlugin")).toBe(true);
            expect(parsed.tables.some((t) => t.source === "addon" && t.fileName === "post")).toBe(true);
            expect(parsed.apis.some((a) => a.source === "addon" && a.fileName === "ping")).toBe(true);

            // node_modules-only addon (remote) 应被扫描
            expect(parsed.plugins.some((p) => p.source === "addon" && p.fileName === "remotePlugin")).toBe(true);
            expect(parsed.tables.some((t) => t.source === "addon" && t.fileName === "remote")).toBe(true);
            expect(parsed.apis.some((a) => a.source === "addon" && a.fileName === "pong")).toBe(true);

            // core builtins should always exist
            expect(parsed.plugins.some((p) => p.source === "core")).toBe(true);
            expect(parsed.hooks.some((h) => h.source === "core")).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
