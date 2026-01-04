/**
 * Cipher 类型定义（对外）。
 *
 * 说明：runtime 实现位于 core 内部（dist/lib），但对外类型应只从 `befly/types/*` 获取。
 * 此处仅描述 Befly 注入的 `befly.cipher`（静态方法集合）。
 */

import type { EncodingType, HashAlgorithm, PasswordHashOptions } from "./crypto.ts";

export interface CipherStatic {
    md5(data: string | Uint8Array, encoding?: EncodingType): string;
    hmacMd5(key: string | Uint8Array, data: string | Uint8Array, encoding?: EncodingType): string;

    sha1(data: string | Uint8Array, encoding?: EncodingType): string;
    hmacSha1(key: string | Uint8Array, data: string | Uint8Array, encoding?: EncodingType): string;

    sha256(data: string | Uint8Array, encoding?: EncodingType): string;
    hmacSha256(key: string | Uint8Array, data: string | Uint8Array, encoding?: EncodingType): string;

    sha512(data: string | Uint8Array, encoding?: EncodingType): string;
    hmacSha512(key: string | Uint8Array, data: string | Uint8Array, encoding?: EncodingType): string;

    rsaSha256(data: string, privateKey: string | Buffer, encoding?: "hex" | "base64" | "base64url"): string;

    hash(algorithm: HashAlgorithm, data: string | Uint8Array, encoding?: EncodingType): string;
    hmac(algorithm: HashAlgorithm, key: string | Uint8Array, data: string | Uint8Array, encoding?: EncodingType): string;

    hashFile(filePath: string, algorithm?: HashAlgorithm, encoding?: EncodingType): Promise<string>;

    hashPassword(password: string, options?: PasswordHashOptions): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;

    base64Encode(data: string): string;
    base64Decode(data: string): string;

    randomString(length: number): string;
    fastHash(data: string | Uint8Array, seed?: number): number;
}
