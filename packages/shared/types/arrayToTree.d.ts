export interface ArrayToTreeOptions<T = any> {
    idField?: string;
    pidField?: string;
    childrenField?: string;
    rootPid?: any;
    mapFn?: (node: T) => T;
}
export declare function arrayToTree<T = any>(items: T[], options?: ArrayToTreeOptions<T>): T[];
