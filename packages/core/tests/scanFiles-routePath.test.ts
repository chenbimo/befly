import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { scanFiles } from "../utils/scanFiles.ts";

describe("scanFiles - api routePath formatting", () => {
    test("routePrefix 应为 /core|/app|/addon 且 routePath 不应出现 /api//", async () => {
        const fixturesDir = fileURLToPath(new URL("./fixtures/scanFilesApis", import.meta.url));
        const addonApisDir = fileURLToPath(new URL("./fixtures/scanFilesAddon/node_modules/@befly-addon/demo/apis", import.meta.url));

        const coreApis = await scanFiles(fixturesDir, "core", "api", "**/*.{ts,js}");
        const appApis = await scanFiles(fixturesDir, "app", "api", "**/*.{ts,js}");
        const addonApis = await scanFiles(addonApisDir, "addon", "api", "**/*.{ts,js}");

        const all = ([] as any[]).concat(coreApis as any, appApis as any, addonApis as any);
        expect(all.length).toBeGreaterThan(0);

        for (const api of all) {
            expect(typeof api.routePrefix).toBe("string");
            expect(typeof api.routePath).toBe("string");

            if (api.source === "addon") {
                expect(api.routePrefix.startsWith("/addon/")).toBe(true);
                expect(typeof api.addonName).toBe("string");
                expect(api.addonName.length > 0).toBe(true);
                expect(api.routePrefix).toBe(`/addon/${api.addonName}`);
            } else {
                expect(["/core", "/app"].includes(api.routePrefix)).toBe(true);
            }
            expect(api.routePath.includes("/api//")).toBe(false);
        }

        const coreB = (coreApis as any[]).find((item) => item.relativePath === "sub/b");
        expect(coreB.routePrefix).toBe("/core");
        expect(coreB.routePath).toBe("/api/core/sub/b");

        const appB = (appApis as any[]).find((item) => item.relativePath === "sub/b");
        expect(appB.routePrefix).toBe("/app");
        expect(appB.routePath).toBe("/api/app/sub/b");

        const addonB = (addonApis as any[]).find((item) => item.relativePath === "sub/b");
        expect(addonB.addonName).toBe("demo");
        expect(addonB.routePrefix).toBe("/addon/demo");
        expect(addonB.routePath).toBe("/api/addon/demo/sub/b");
    });
});
