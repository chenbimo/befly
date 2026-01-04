import { describe, test, expect } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadBeflyConfig } from "../befly.config.js";

describe("Config - NODE_ENV 选择 development/production", () => {
    test("production -> befly.production.json；其他 -> befly.development.json（common 总是生效）", async () => {
        const tempRoot = join(process.cwd(), "temp", `befly-config-env-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const tempConfigsDir = join(tempRoot, "configs");

        mkdirSync(tempConfigsDir, { recursive: true });

        writeFileSync(
            join(tempConfigsDir, "befly.common.json"),
            JSON.stringify(
                {
                    appPort: 31111,
                    logger: {
                        debug: 2
                    }
                },
                null,
                4
            ),
            { encoding: "utf8" }
        );

        writeFileSync(
            join(tempConfigsDir, "befly.development.json"),
            JSON.stringify(
                {
                    appName: "development",
                    logger: {
                        debug: 3
                    }
                },
                null,
                4
            ),
            { encoding: "utf8" }
        );

        writeFileSync(
            join(tempConfigsDir, "befly.production.json"),
            JSON.stringify(
                {
                    appName: "production",
                    logger: {
                        debug: 9
                    }
                },
                null,
                4
            ),
            { encoding: "utf8" }
        );

        const originalCwd = process.cwd();
        const originalNodeEnv = process.env.NODE_ENV;

        try {
            process.chdir(tempRoot);

            process.env.NODE_ENV = "production";
            const productionConfig = await loadBeflyConfig();
            expect(productionConfig.appName).toBe("production");
            expect(productionConfig.logger.debug).toBe(9);
            expect(productionConfig.appPort).toBe(31111);

            // 除 production 外的其他 NODE_ENV，都应选择 befly.development.json
            process.env.NODE_ENV = "test";
            const fallbackConfig = await loadBeflyConfig();
            expect(fallbackConfig.appName).toBe("development");
            expect(fallbackConfig.logger.debug).toBe(3);
            expect(fallbackConfig.appPort).toBe(31111);
        } finally {
            if (typeof originalNodeEnv === "string") {
                process.env.NODE_ENV = originalNodeEnv;
            } else {
                delete process.env.NODE_ENV;
            }
            process.chdir(originalCwd);
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });
});
