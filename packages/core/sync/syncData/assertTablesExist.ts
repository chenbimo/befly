import { Logger } from "../../lib/logger.js";

export type TableExistSpec = {
    table: string;
    skipMessage: string;
};

export async function assertTablesExist(options: { helper: any; tables: TableExistSpec[] }): Promise<boolean> {
    for (const spec of options.tables) {
        const exists = await options.helper.tableExists(spec.table);
        if (!exists) {
            Logger.debug(spec.skipMessage);
            return false;
        }
    }

    return true;
}
