import type { DbHelper } from "../../lib/dbHelper.js";

import { Logger } from "../../lib/logger.js";

export type TableExistSpec = {
    table: string;
    skipMessage: string;
};

export async function assertTablesExist(options: { dbHelper: DbHelper; tables: TableExistSpec[] }): Promise<boolean> {
    for (const spec of options.tables) {
        const exists = await options.dbHelper.tableExists(spec.table);
        if (!exists) {
            Logger.debug(spec.skipMessage);
            return false;
        }
    }

    return true;
}
