/**
 * 密码哈希工具（浏览器侧）
 * 使用 SHA-256 + 盐值对密码进行单向哈希
 * @param {string} password
 * @param {string=} salt
 * @returns {Promise<string>} 十六进制哈希
 */
export async function hashPassword(password, salt = 'befly') {
    const data = String(password) + String(salt);

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}
