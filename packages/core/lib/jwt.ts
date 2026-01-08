/**
 * JWT 工具类 - 基于 fast-jwt 实现
 */

import type { AuthConfig } from "../types/befly";
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions, JwtDecoded, JwtHeader } from "../types/jwt";
import type { Algorithm as FastJwtAlgorithm, SignerOptions, VerifierOptions } from "fast-jwt";

import { createSigner, createVerifier, createDecoder } from "fast-jwt";

interface FastJwtComplete {
    header: JwtHeader;
    payload: JwtPayload;
    signature: string;
    input: string;
}

type JwtInternalConfig = {
    secret: string;
    expiresIn: string | number;
    algorithm: FastJwtAlgorithm;
};

export class Jwt {
    private config: JwtInternalConfig;

    constructor(config: AuthConfig = {}) {
        this.config = {
            secret: config.secret || "befly-secret",
            expiresIn: config.expiresIn || "7d",
            algorithm: (config.algorithm || "HS256") as FastJwtAlgorithm
        };
    }

    sign(payload: JwtPayload, options: JwtSignOptions = {}): string {
        const key = options.secret || this.config.secret;
        const algorithm = (options.algorithm || this.config.algorithm || "HS256") as FastJwtAlgorithm;

        const signerOptions: Partial<SignerOptions> & { key: string } = {
            key: key,
            algorithm: algorithm,
            expiresIn: options.expiresIn ?? this.config.expiresIn
        };

        if (options.issuer !== undefined) signerOptions.iss = options.issuer;
        if (options.audience !== undefined) signerOptions.aud = options.audience;
        if (options.subject !== undefined) signerOptions.sub = options.subject;
        if (options.jwtId !== undefined) signerOptions.jti = options.jwtId;
        if (typeof options.notBefore === "number") signerOptions.notBefore = options.notBefore;

        const signer = createSigner(signerOptions);
        return signer(payload);
    }

    verify<T = JwtPayload>(token: string, options: JwtVerifyOptions = {}): T {
        if (!token || typeof token !== "string") {
            throw new Error("Token必须是非空字符串");
        }
        const key = options.secret || this.config.secret;
        const algorithm = this.config.algorithm || "HS256";
        const algorithms: FastJwtAlgorithm[] = options.algorithms ? (options.algorithms as FastJwtAlgorithm[]) : [algorithm];

        const verifierOptions: Partial<VerifierOptions> & { key: string } = {
            key: key,
            algorithms: algorithms,
            cache: true,
            cacheTTL: 600000
        };

        if (options.issuer !== undefined) verifierOptions.allowedIss = options.issuer;
        if (options.audience !== undefined) verifierOptions.allowedAud = options.audience;
        if (options.subject !== undefined) verifierOptions.allowedSub = options.subject;
        if (typeof options.ignoreExpiration === "boolean") verifierOptions.ignoreExpiration = options.ignoreExpiration;
        if (typeof options.ignoreNotBefore === "boolean") verifierOptions.ignoreNotBefore = options.ignoreNotBefore;

        const verifier = createVerifier(verifierOptions);
        return verifier(token) as T;
    }

    decode(token: string, complete?: false): JwtPayload;
    decode(token: string, complete: true): JwtDecoded;
    decode(token: string, complete: boolean = false): JwtPayload | JwtDecoded {
        if (!token || typeof token !== "string") {
            throw new Error("Token必须是非空字符串");
        }
        if (complete) {
            const decoder = createDecoder({ complete: true });
            const result = decoder(token) as FastJwtComplete;
            return {
                header: result.header,
                payload: result.payload,
                signature: result.signature
            };
        }
        const decoder = createDecoder();
        return decoder(token) as JwtPayload;
    }
}
