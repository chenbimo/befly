/**
 * hashPassword 类型定义（类型模块，仅供 type 引用）。
 */

export type HashPassword = (password: string, salt?: string) => Promise<string>;
