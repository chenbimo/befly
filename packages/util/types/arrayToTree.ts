// arrayToTree 类型定义

export interface ArrayToTreeOptions<T = any> {
    idField?: string; // 节点 id 字段名，默认 'id'
    pidField?: string; // 父节点 id 字段名，默认 'pid'
    childrenField?: string; // 子节点字段名，默认 'children'
    rootPid?: any; // 根节点 pid，默认 0
    mapFn?: (node: T) => T; // 节点转换函数
}
