import { test, expect } from "bun:test";

import { loadHooks } from "../loader/loadHooks";
import { loadPlugins } from "../loader/loadPlugins";

test("loadHooks should skip enable=false", async () => {
    const hooks: any[] = [
        {
            source: "core",
            type: "hook",
            sourceName: "核心",
            filePath: "core:hook:ok",
            relativePath: "ok",
            fileName: "ok",
            moduleName: "ok",
            addonName: "",
            fileBaseName: "ok",
            fileDir: "(builtin)",
            deps: [],
            handler: () => {}
        },
        {
            source: "core",
            type: "hook",
            sourceName: "核心",
            filePath: "core:hook:disabledFalse",
            relativePath: "disabledFalse",
            fileName: "disabledFalse",
            moduleName: "disabledFalse",
            addonName: "",
            fileBaseName: "disabledFalse",
            fileDir: "(builtin)",
            enable: false,
            deps: [],
            handler: () => {}
        }
    ];

    const loaded = await loadHooks(hooks as any);
    const names = loaded.map((item: any) => item && item.name).filter(Boolean);

    expect(names.includes("ok")).toBe(true);
    expect(names.includes("disabledFalse")).toBe(false);
});

test("loadPlugins should skip enable=false and not mount them", async () => {
    const context: any = {};

    const plugins: any[] = [
        {
            source: "core",
            type: "plugin",
            sourceName: "核心",
            filePath: "core:plugin:ok",
            relativePath: "ok",
            fileName: "ok",
            moduleName: "ok",
            addonName: "",
            fileBaseName: "ok",
            fileDir: "(builtin)",
            deps: [],
            handler: () => ({ v: 1 })
        },
        {
            source: "core",
            type: "plugin",
            sourceName: "核心",
            filePath: "core:plugin:disabledFalse",
            relativePath: "disabledFalse",
            fileName: "disabledFalse",
            moduleName: "disabledFalse",
            addonName: "",
            fileBaseName: "disabledFalse",
            fileDir: "(builtin)",
            enable: false,
            deps: [],
            handler: () => ({ v: 2 })
        }
    ];

    const loaded = await loadPlugins(plugins as any, context as any);
    const names = loaded.map((item: any) => item && item.name).filter(Boolean);

    expect(names.includes("ok")).toBe(true);
    expect(names.includes("disabledFalse")).toBe(false);

    expect(context.ok).toEqual({ v: 1 });
    expect("disabledFalse" in context).toBe(false);
});
