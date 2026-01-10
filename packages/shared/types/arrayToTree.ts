export type ArrayToTreeResult<T extends Record<string, unknown>> = {
    flat: Array<T>;
    tree: Array<T>;
    map: Map<string, T>;
};

export type ArrayToTree = <T extends Record<string, unknown>>(items: Array<T>, id?: string, pid?: string, children?: string, sort?: string) => ArrayToTreeResult<T>;
