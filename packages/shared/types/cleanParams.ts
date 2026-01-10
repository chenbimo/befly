export type CleanParams = <TData extends Record<string, unknown>>(data: TData, dropValues?: readonly unknown[], dropKeyValue?: Record<string, readonly unknown[]>) => Partial<TData>;
