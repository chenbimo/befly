import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

describe("bundle - core should be bundleable into single JS", () => {
    test("Bun.build should produce a single file that can run scanSources with builtins", async () => {
        const repoRoot = resolve(import.meta.dir, "..", "..", "..");
        const outDir = resolve(repoRoot, "temp", "bundle-smoke");

        if (!existsSync(outDir)) {
            mkdirSync(outDir, { recursive: true });
        }

        const entryPath = resolve(import.meta.dir, "fixtures", "bundleEntry.ts");

        const buildResult = await Bun.build({
            entrypoints: [entryPath],
            outdir: outDir,
            target: "bun",
            format: "esm",
            splitting: false,
            sourcemap: "none",
            minify: false
        });

        try {
            expect(buildResult.success).toBe(true);
            expect(buildResult.outputs.length).toBe(1);

            const outPath = buildResult.outputs[0] ? buildResult.outputs[0].path : "";
            expect(typeof outPath).toBe("string");
            expect(outPath.length > 0).toBe(true);

            const modUrl = `${pathToFileURL(outPath).href}?t=${Date.now()}`;
            const mod = await import(modUrl);

            expect(typeof mod.run).toBe("function");
            const result = await mod.run();

            expect(typeof result).toBe("object");
            expect(result.hooksCount).toBeGreaterThan(0);
            expect(result.pluginsCount).toBeGreaterThan(0);
            expect(result.hasCoreAuthHook).toBe(true);
            expect(result.hasCoreDbPlugin).toBe(true);
            expect(result.hasCoreApi).toBe(false);
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });
});
