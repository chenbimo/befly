/**
 * 预定义的默认字段（API fields 的 @ 引用）
 */
export const presetFields: Record<string, any> = {
    "@id": { name: "ID", type: "number", min: 1, max: null },
    "@page": { name: "页码", type: "number", min: 1, max: 9999, default: 1 },
    "@limit": { name: "每页数量", type: "number", min: 1, max: 100, default: 30 },
    "@keyword": { name: "关键词", type: "string", min: 0, max: 50 },
    "@state": { name: "状态", type: "number", regex: "^[0-2]$" }
};
