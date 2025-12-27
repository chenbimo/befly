/**
 * 密码哈希工具
 * 使用 SHA-256 + 盐值对密码进行单向哈希
 */
/**
 * 使用 SHA-256 对密码进行哈希
 * @param password - 原始密码
 * @param salt - 盐值，默认为 befly
 * @returns 哈希后的密码（十六进制字符串）
 */
export declare function hashPassword(password: string, salt?: string): Promise<string>;
