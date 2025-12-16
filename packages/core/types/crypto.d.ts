/**
 * 加密相关类型定义
 */

/**
 * 编码类型
 */
export type EncodingType = "hex" | "base64" | "base64url";

/**
 * 哈希算法类型
 */
export type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha512" | "sha384" | "sha224";

/**
 * 密码哈希选项
 */
export interface PasswordHashOptions {
    algorithm?: "argon2" | "bcrypt";
    memoryCost?: number;
    timeCost?: number;
    [key: string]: any;
}
