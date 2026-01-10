/**
 * 使用 SHA-256 对密码进行哈希（前端实现：WebCrypto）。
 *
 * 注意：这是前端/管理后台用途的工具函数。
 * - 禁止在接口端/服务端使用该函数作为密码存储方案
 * - 服务端应使用 core 侧既定密码策略（例如 Cipher.hashPassword）
 */
export async function hashPassword(password: string, salt: string = "befly"): Promise<string> {
    const data = password + salt;

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return hashHex;
}
