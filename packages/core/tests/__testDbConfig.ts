import type { BeflyOptions } from "../types/befly.ts";

import { loadBeflyConfig } from "../befly.config.ts";

export async function getDefaultDbConfig(): Promise<NonNullable<BeflyOptions["db"]>> {
    const config = await loadBeflyConfig("development");

    if (!config.db) {
        throw new Error("tests/__testDbConfig: config.db 未初始化");
    }

    return {
        idMode: config.db.idMode,
        host: config.db.host,
        port: config.db.port,
        username: config.db.username,
        password: config.db.password,
        database: "befly_test",
        poolMax: config.db.poolMax
    };
}
