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
export async function hashPassword(password: string, salt: string = "befly"): Promise<string> {
    const data = password + salt;

    // 将字符串转换为 Uint8Array
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // 使用 Web Crypto API 进行 SHA-256 哈希
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

    // 将 ArrayBuffer 转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return hashHex;
}
