//#region types/fieldClear.d.ts
interface FieldClearOptions {
  pickKeys?: string[];
  omitKeys?: string[];
  keepValues?: any[];
  excludeValues?: any[];
}
type FieldClearResult<T> = T extends Array<infer U> ? Array<FieldClearResult<U>> : T extends object ? { [K in keyof T]?: T[K] } : T;
//#endregion
//#region src/fieldClear.d.ts
declare function fieldClear<T = any>(data: T | T[], options?: FieldClearOptions): FieldClearResult<T>;
//#endregion
export { fieldClear as t };