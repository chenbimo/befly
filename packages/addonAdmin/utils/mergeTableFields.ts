import type { TableDefinition } from "befly/types/validate";

export function mergeTableFields(...tables: TableDefinition[]): TableDefinition {
    const merged: TableDefinition = {};

    for (const table of tables) {
        Object.assign(merged, table);
    }

    return merged;
}
