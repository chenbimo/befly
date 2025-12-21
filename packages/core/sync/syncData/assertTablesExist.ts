import type { DbHelper } from "../../lib/dbHelper.js";

import { Logger } from "../../lib/logger.js";

export async function assertTablesExist(dbHelper: DbHelper, tables: string[]): Promise<boolean> {
    for (const table of tables) {
        const exists = await dbHelper.tableExists(table);
        if (!exists) {
            Logger.debug(`${table} 表不存在`);
            return false;
        }
    }

    return true;
}
