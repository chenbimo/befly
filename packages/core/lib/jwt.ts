/**
 * JWT 工具类 - 基于 fast-jwt 实现
 */

import { createSigner, createVerifier, createDecoder } from 'fast-jwt';

import type { AuthConfig } from '../types/befly.js';
import type { JwtPayload, JwtSignOptions, JwtVerifyOptions, JwtDecoded, JwtHeader } from 'befly-shared/types';

interface FastJwtComplete {
    header: JwtHeader;
    payload: JwtPayload;
    signature: string;
    input: string;
}

export class Jwt {
    private config: AuthConfig;

    constructor(config: AuthConfig = {}) {
        this.config = {
            secret: config.secret || 'befly-secret',
            expiresIn: config.expiresIn || '7d',
            algorithm: config.algorithm || 'HS256'
        };
    }

    sign(payload: JwtPayload, options: JwtSignOptions = {}): string {
        const signer = createSigner({
            key: options.secret || this.config.secret,
            algorithm: options.algorithm || this.config.algorithm,
            expiresIn: options.expiresIn || this.config.expiresIn,
            iss: options.issuer,
            aud: options.audience,
            sub: options.subject,
            jti: options.jwtId,
            notBefore: options.notBefore
        });
        return signer(payload);
    }

    verify<T = JwtPayload>(token: string, options: JwtVerifyOptions = {}): T {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
        }
        const verifier = createVerifier({
            key: options.secret || this.config.secret,
            algorithms: options.algorithms || [this.config.algorithm || 'HS256'],
            allowedIss: options.issuer,
            allowedAud: options.audience,
            allowedSub: options.subject,
            ignoreExpiration: options.ignoreExpiration,
            ignoreNotBefore: options.ignoreNotBefore,
            cache: true,
            cacheTTL: 600000
        });
        return verifier(token) as T;
    }

    decode(token: string, complete?: false): JwtPayload;
    decode(token: string, complete: true): JwtDecoded;
    decode(token: string, complete: boolean = false): JwtPayload | JwtDecoded {
        if (!token || typeof token !== 'string') {
            throw new Error('Token必须是非空字符串');
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
