/**
 * 生成短 ID
 * 由时间戳（base36）+ 随机字符组成，约 13 位
 * - 前 8 位：时间戳（可排序）
 * - 后 5 位：随机字符（防冲突）
 * @returns 短 ID 字符串
 * @example
 * genShortId() // "lxyz1a2b3c4"
 */
export declare function genShortId(): string;
