/**
 * Cipher 加密工具测试
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { Cipher } from "../lib/cipher";

describe("Cipher - 哈希功能", () => {
    const testData = "hello world";
    const testDataBytes = new TextEncoder().encode(testData);

    test("MD5 哈希 - 字符串输入", () => {
        const result = Cipher.md5(testData);
        expect(result).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
        expect(result.length).toBe(32);
    });

    test("MD5 哈希 - Uint8Array 输入", () => {
        const result = Cipher.md5(testDataBytes);
        expect(result).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
    });

    test("MD5 哈希 - base64 编码", () => {
        const result = Cipher.md5(testData, "base64");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });

    test("SHA1 哈希", () => {
        const result = Cipher.sha1(testData);
        expect(result).toBe("2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
        expect(result.length).toBe(40);
    });

    test("SHA256 哈希", () => {
        const result = Cipher.sha256(testData);
        expect(result).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
        expect(result.length).toBe(64);
    });

    test("SHA512 哈希", () => {
        const result = Cipher.sha512(testData);
        expect(result.length).toBe(128);
        expect(typeof result).toBe("string");
    });

    test("通用 hash 方法 - SHA256", () => {
        const result = Cipher.hash("sha256", testData);
        expect(result).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });

    test("通用 hash 方法 - MD5", () => {
        const result = Cipher.hash("md5", testData);
        expect(result).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
    });
});

describe("Cipher - HMAC 签名", () => {
    const key = "secret-key";
    const data = "test data";

    test("HMAC-MD5", () => {
        const result = Cipher.hmacMd5(key, data);
        expect(result.length).toBe(32);
        expect(typeof result).toBe("string");
    });

    test("HMAC-SHA1", () => {
        const result = Cipher.hmacSha1(key, data);
        expect(result.length).toBe(40);
        expect(typeof result).toBe("string");
    });

    test("HMAC-SHA256", () => {
        const result = Cipher.hmacSha256(key, data);
        expect(result.length).toBe(64);
        expect(typeof result).toBe("string");
    });

    test("HMAC-SHA512", () => {
        const result = Cipher.hmacSha512(key, data);
        expect(result.length).toBe(128);
        expect(typeof result).toBe("string");
    });

    test("通用 HMAC 方法", () => {
        const result1 = Cipher.hmac("sha256", key, data);
        const result2 = Cipher.hmacSha256(key, data);
        expect(result1).toBe(result2);
    });

    test("HMAC - Uint8Array 输入", () => {
        const keyBytes = new TextEncoder().encode(key);
        const dataBytes = new TextEncoder().encode(data);
        const result = Cipher.hmacSha256(keyBytes, dataBytes);
        expect(result.length).toBe(64);
    });
});

describe("Cipher - 密码加密", () => {
    const password = "MySecurePassword123!";

    test("密码哈希", async () => {
        const hash = await Cipher.hashPassword(password);
        expect(hash).toBeDefined();
        expect(hash.length).toBeGreaterThan(0);
        expect(hash).not.toBe(password);
    });

    test("密码验证 - 正确密码", async () => {
        const hash = await Cipher.hashPassword(password);
        const isValid = await Cipher.verifyPassword(password, hash);
        expect(isValid).toBe(true);
    });

    test("密码验证 - 错误密码", async () => {
        const hash = await Cipher.hashPassword(password);
        const isValid = await Cipher.verifyPassword("wrong-password", hash);
        expect(isValid).toBe(false);
    });

    test("相同密码生成不同哈希", async () => {
        const hash1 = await Cipher.hashPassword(password);
        const hash2 = await Cipher.hashPassword(password);
        expect(hash1).not.toBe(hash2);
    });
});

describe("Cipher - Base64 编码", () => {
    const original = "Hello, 世界!";

    test("Base64 编码", () => {
        const encoded = Cipher.base64Encode(original);
        expect(encoded).toBe("SGVsbG8sIOS4lueVjCE=");
    });

    test("Base64 解码", () => {
        const encoded = "SGVsbG8sIOS4lueVjCE=";
        const decoded = Cipher.base64Decode(encoded);
        expect(decoded).toBe(original);
    });

    test("Base64 编码解码循环", () => {
        const encoded = Cipher.base64Encode(original);
        const decoded = Cipher.base64Decode(encoded);
        expect(decoded).toBe(original);
    });

    test("Base64 编码空字符串", () => {
        const encoded = Cipher.base64Encode("");
        expect(encoded).toBe("");
    });
});

describe("Cipher - 随机字符串", () => {
    test("生成指定长度的随机字符串", () => {
        const result = Cipher.randomString(16);
        expect(result.length).toBe(16);
        expect(/^[0-9a-f]+$/.test(result)).toBe(true);
    });

    test("生成不同的随机字符串", () => {
        const result1 = Cipher.randomString(32);
        const result2 = Cipher.randomString(32);
        expect(result1).not.toBe(result2);
    });

    test("生成奇数长度的随机字符串", () => {
        const result = Cipher.randomString(15);
        expect(result.length).toBe(15);
    });

    test("生成 0 长度字符串", () => {
        const result = Cipher.randomString(0);
        expect(result).toBe("");
    });
});

describe("Cipher - 文件哈希", () => {
    const testFilePath = join(process.cwd(), "temp", "cipher-test-file.txt");
    const testContent = "Test file content for hashing";

    beforeAll(() => {
        const tempDir = join(process.cwd(), "temp");
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
        }
        writeFileSync(testFilePath, testContent, "utf8");
    });

    test("SHA256 文件哈希", async () => {
        const result = await Cipher.hashFile(testFilePath, "sha256");
        expect(result.length).toBe(64);
        expect(typeof result).toBe("string");
    });

    test("MD5 文件哈希", async () => {
        const result = await Cipher.hashFile(testFilePath, "md5");
        expect(result.length).toBe(32);
    });

    test("文件哈希与内容哈希一致", async () => {
        const fileHash = await Cipher.hashFile(testFilePath, "sha256");
        const contentHash = Cipher.sha256(testContent);
        expect(fileHash).toBe(contentHash);
    });

    test("文件哈希 - base64 编码", async () => {
        const result = await Cipher.hashFile(testFilePath, "sha256", "base64");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("Cipher - 快速哈希", () => {
    const testData = "quick hash test";

    test("快速哈希 - 字符串输入", () => {
        const result = Cipher.fastHash(testData);
        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThan(0);
    });

    test("快速哈希 - Uint8Array 输入", () => {
        const bytes = new TextEncoder().encode(testData);
        const result = Cipher.fastHash(bytes);
        expect(typeof result).toBe("number");
    });

    test("快速哈希 - 相同输入产生相同哈希", () => {
        const result1 = Cipher.fastHash(testData);
        const result2 = Cipher.fastHash(testData);
        expect(result1).toBe(result2);
    });

    test("快速哈希 - 不同 seed 产生不同结果", () => {
        const result1 = Cipher.fastHash(testData, 0);
        const result2 = Cipher.fastHash(testData, 1);
        expect(result1).not.toBe(result2);
    });

    test("快速哈希 - 空字符串", () => {
        const result = Cipher.fastHash("");
        expect(typeof result).toBe("number");
    });
});
