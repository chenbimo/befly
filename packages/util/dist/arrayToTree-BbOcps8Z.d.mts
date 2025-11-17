//#region types/arrayToTree.d.ts
interface ArrayToTreeOptions<T = any> {
  idField?: string;
  pidField?: string;
  childrenField?: string;
  rootPid?: any;
  mapFn?: (node: T) => T;
}
//#endregion
//#region src/arrayToTree.d.ts
declare function arrayToTree<T = any>(items: T[], options?: ArrayToTreeOptions<T>): T[];
//#endregion
export { arrayToTree as t };