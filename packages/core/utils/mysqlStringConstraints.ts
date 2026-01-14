/**
 * MySQL（utf8mb4）字段约束
 *
 * 说明：
 * - VARCHAR(n) 的 n 是“字符数”，但受行大小与字符集字节数限制
 * - utf8mb4 最坏情况 4 bytes/char，因此 65535 bytes 上限可近似换算为 16383 chars
 * - InnoDB 单列索引 key length 上限默认 3072 bytes（MySQL 8），换算约 768 chars
 */
export const MYSQL_STRING_CONSTRAINTS = {
    MAX_VARCHAR_LENGTH: 16383,
    MAX_INDEXED_VARCHAR_LENGTH: 768
} as const;
