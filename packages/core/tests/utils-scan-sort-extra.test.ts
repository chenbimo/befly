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
        const items: any[] = [
            { fileName: "b", moduleName: "b", deps: ["a"] },
            { fileName: "a", moduleName: "a", deps: [] },
            { fileName: "c", moduleName: "c", deps: ["b"] }
        ];

        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).not.toBe(false);
        expect((sorted as any[]).map((x) => x.moduleName)).toEqual(["a", "b", "c"]);
    });

    test("missing dependency should return false", () => {
        const items: any[] = [{ fileName: "a", moduleName: "a", deps: ["notFound"] }];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).toBe(false);
    });

    test("cycle dependency should return false", () => {
        const items: any[] = [
            { fileName: "a", moduleName: "a", deps: ["b"] },
            { fileName: "b", moduleName: "b", deps: ["a"] }
        ];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).toBe(false);
    });

    test("duplicate module name should return false", () => {
        const items: any[] = [
            { fileName: "a", moduleName: "same", deps: [] },
            { fileName: "b", moduleName: "same", deps: [] }
        ];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).toBe(false);
    });

    test("stress: long chain deps should sort correctly", () => {
        const len = 120;
        const items: any[] = [];
        for (let i = 0; i < len; i++) {
            const name = `m${i}`;
            const dep = i === 0 ? [] : [`m${i - 1}`];
            items.push({ fileName: name, moduleName: name, deps: dep });
        }

        // 打乱输入顺序，确保排序不是“碰巧”通过。
        items.reverse();

        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).not.toBe(false);
        expect((sorted as any[]).map((x) => x.moduleName)).toEqual(Array.from({ length: len }, (_, i) => `m${i}`));
    });

    test("stress: multi-branch deps should keep partial order", () => {
        // 图：
        //   d
        //  / \
        // b   c
        //  \ /
        //   a
        const items: any[] = [
            { fileName: "a", moduleName: "a", deps: ["b", "c"] },
            { fileName: "b", moduleName: "b", deps: ["d"] },
            { fileName: "c", moduleName: "c", deps: ["d"] },
            { fileName: "d", moduleName: "d", deps: [] }
        ];
        const sorted = sortModules(items, { moduleLabel: "测试模块" });
        expect(sorted).not.toBe(false);

        const order = (sorted as any[]).map((x) => x.moduleName);
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
    test("should parse addonName/moduleName for node_modules and local addons on Windows", async () => {
        const root = join(import.meta.dir, "..", "temp", "fixtures", "scanFilesWindows");
        ensureEmptyDir(root);

        // node_modules addon: @befly-addon/demo
        const nmPluginDir = join(root, "node_modules", "@befly-addon", "demo", "plugins");
        mkdirSync(nmPluginDir, { recursive: true });
        writeFileSync(join(nmPluginDir, "demoPlugin.ts"), 'export default { name: "demoPlugin", deps: [], handler: null }\n', { encoding: "utf8" });

        // local addon: addons/demo
        const localPluginDir = join(root, "addons", "demo", "plugins");
        mkdirSync(localPluginDir, { recursive: true });
        writeFileSync(join(localPluginDir, "localPlugin.ts"), 'export default { name: "localPlugin", deps: [], handler: null }\n', { encoding: "utf8" });

        try {
            const nmResults = await scanFiles(nmPluginDir, "addon", "plugin", "**/*.ts");
            expect(nmResults.length).toBe(1);
            expect(nmResults[0]?.addonName).toBe("demo");
            expect(nmResults[0]?.moduleName).toBe("addon_demo_demoPlugin");
            // 盘符/绝对路径：Windows 上通常是 D:\ 或 D:/，scanFiles 内部 normalize 后应稳定
            expect(String(nmResults[0]?.filePath)).toMatch(/^[A-Za-z]:[\\/]/);

            const localResults = await scanFiles(localPluginDir, "addon", "plugin", "**/*.ts");
            expect(localResults.length).toBe(1);
            expect(localResults[0]?.addonName).toBe("demo");
            expect(localResults[0]?.moduleName).toBe("addon_demo_localPlugin");
            expect(String(localResults[0]?.filePath)).toMatch(/^[A-Za-z]:[\\/]/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe("utils - scanCoreBuiltins", () => {
    test("scanCoreBuiltinPlugins should include core plugins with stable shape", () => {
        const plugins = scanCoreBuiltinPlugins();
        expect(plugins.length).toBeGreaterThan(0);

        const logger = plugins.find((p: any) => p.name === "logger");
        expect(logger).toBeTruthy();
        expect((logger as any).source).toBe("core");
        expect((logger as any).type).toBe("plugin");
        expect((logger as any).moduleName).toBe("logger");
        expect((logger as any).addonName).toBe("");
        expect((logger as any).filePath).toBe("core:plugin:logger");
    });

    test("scanCoreBuiltinHooks should include core hooks with stable shape", () => {
        const hooks = scanCoreBuiltinHooks();
        expect(hooks.length).toBeGreaterThan(0);

        const auth = hooks.find((p: any) => p.name === "auth");
        expect(auth).toBeTruthy();
        expect((auth as any).source).toBe("core");
        expect((auth as any).type).toBe("hook");
        expect((auth as any).moduleName).toBe("auth");
        expect((auth as any).addonName).toBe("");
        expect((auth as any).filePath).toBe("core:hook:auth");
    });
});

describe("utils - scanSources (fixture)", () => {
    test("should scan app + node_modules addon + local addons", async () => {
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

        // local addon: addons/demo (should override node_modules metadata)
        const localAddonRoot = join(root, "addons", "demo");
        mkdirSync(join(localAddonRoot, "plugins"), { recursive: true });
        mkdirSync(join(localAddonRoot, "tables"), { recursive: true });
        mkdirSync(join(localAddonRoot, "apis"), { recursive: true });
        writeFileSync(join(localAddonRoot, "tables", "local.json"), JSON.stringify({ name: "local" }), { encoding: "utf8" });
        writeFileSync(join(localAddonRoot, "plugins", "localPlugin.ts"), 'export default { name: "localPlugin", deps: [], handler: null };\n', { encoding: "utf8" });

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
  apis: result.apis.map((a) => ({ source: a.source, fileName: a.fileName, routePath: a.routePath, addonName: a.addonName, moduleName: a.moduleName }))
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
            const parsed = JSON.parse(text);

            // addons: local should override node_modules
            const demoAddon = parsed.addons.find((a: any) => a.name === "demo");
            expect(demoAddon).toBeTruthy();
            expect((demoAddon as any).sourceName).toBe("项目");
            expect(String((demoAddon as any).rootDir).replace(/\\/g, "/")).toContain("/addons/demo");

            // app table
            const appUserTable = parsed.tables.find((t: any) => t.source === "app" && t.fileName === "user");
            expect(appUserTable).toBeTruthy();
            expect((appUserTable as any).content.name).toBe("user");
            expect(Array.isArray((appUserTable as any).customKeys)).toBe(true);

            // app plugin (and _skip filtered)
            expect(parsed.plugins.some((p: any) => p.source === "app" && p.fileName === "hello")).toBe(true);
            expect(parsed.plugins.some((p: any) => p.fileName === "_skip")).toBe(false);

            // api routePath formatting
            const loginApi = parsed.apis.find((a: any) => a.source === "app" && a.fileName === "login");
            expect(loginApi).toBeTruthy();
            expect((loginApi as any).routePath).toBe("/api/app/user/login");

            // local addon scanning should work (tables/plugins/apis under addons/demo)
            const localAddonTable = parsed.tables.find((t: any) => t.source === "addon" && t.fileName === "local");
            expect(localAddonTable).toBeTruthy();
            expect(Array.isArray((localAddonTable as any).customKeys)).toBe(true);

            const localAddonPlugin = parsed.plugins.find((p: any) => p.source === "addon" && p.fileName === "localPlugin");
            expect(localAddonPlugin).toBeTruthy();
            expect((localAddonPlugin as any).addonName).toBe("demo");
            expect((localAddonPlugin as any).moduleName).toBe("addon_demo_localPlugin");

            // 同名 demo：本地 addons/demo 覆盖 node_modules/@befly-addon/demo，因此 node_modules 的 demoPlugin/post/ping 不应出现
            expect(parsed.plugins.some((p: any) => p.source === "addon" && p.fileName === "demoPlugin")).toBe(false);
            expect(parsed.tables.some((t: any) => t.source === "addon" && t.fileName === "post")).toBe(false);
            expect(parsed.apis.some((a: any) => a.source === "addon" && a.fileName === "ping")).toBe(false);

            // node_modules-only addon (remote) 应被扫描
            expect(parsed.plugins.some((p: any) => p.source === "addon" && p.fileName === "remotePlugin")).toBe(true);
            expect(parsed.tables.some((t: any) => t.source === "addon" && t.fileName === "remote")).toBe(true);
            expect(parsed.apis.some((a: any) => a.source === "addon" && a.fileName === "pong")).toBe(true);

            // core builtins should always exist
            expect(parsed.plugins.some((p: any) => p.source === "core")).toBe(true);
            expect(parsed.hooks.some((h: any) => h.source === "core")).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
