import type { BeflyOptions, DatabaseConfig, RedisConfig } from "../types/befly";

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isValidPort(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 65535;
}

function isValidNonNegativeInt(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && Math.floor(value) === value;
}

function isValidPositiveInt(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 1 && Math.floor(value) === value;
}

function isValidTimeZone(value: unknown): value is string {
    if (!isNonEmptyString(value)) return false;

    try {
        // RangeError: Invalid time zone specified
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
        return true;
    } catch {
        return false;
    }
}

function validateDbConfig(db: DatabaseConfig | undefined): void {
    if (!db) {
        throw new Error("配置错误：缺少 db 配置（config.db）");
    }

    // MySQL：必须提供 host/port/username/password/database
    if (!isNonEmptyString(db.host)) {
        throw new Error(`配置错误：db.host 必须为非空字符串，当前值=${String(db.host)}`);
    }
    if (!isValidPort(db.port)) {
        throw new Error(`配置错误：db.port 必须为 1..65535 的数字，当前值=${String(db.port)}`);
    }
    if (!isNonEmptyString(db.username)) {
        throw new Error(`配置错误：db.username 必须为非空字符串，当前值=${String(db.username)}`);
    }
    // password 允许空字符串，但必须为 string（避免误传 number/object）
    if (db.password !== undefined && typeof db.password !== "string") {
        throw new Error(`配置错误：db.password 必须为字符串（允许为空字符串），当前值=${String(db.password)}`);
    }
    if (!isNonEmptyString(db.database)) {
        throw new Error(`配置错误：db.database 必须为非空字符串，当前值=${String(db.database)}`);
    }

    if (db.poolMax !== undefined) {
        if (typeof db.poolMax !== "number" || !Number.isFinite(db.poolMax) || db.poolMax <= 0) {
            throw new Error(`配置错误：db.poolMax 必须为正数，当前值=${String(db.poolMax)}`);
        }
    }
}

function validateRedisConfig(redis: RedisConfig | undefined): void {
    if (!redis) {
        throw new Error("配置错误：缺少 redis 配置（config.redis）");
    }

    if (redis.host !== undefined && typeof redis.host !== "string") {
        throw new Error(`配置错误：redis.host 必须为字符串，当前值=${String(redis.host)}`);
    }
    if (redis.port !== undefined && !isValidPort(redis.port)) {
        throw new Error(`配置错误：redis.port 必须为 1..65535 的数字，当前值=${String(redis.port)}`);
    }
    if (redis.db !== undefined && !isValidNonNegativeInt(redis.db)) {
        throw new Error(`配置错误：redis.db 必须为非负整数，当前值=${String(redis.db)}`);
    }

    const prefix = redis.prefix;
    if (prefix !== undefined) {
        if (typeof prefix !== "string") {
            throw new Error(`配置错误：redis.prefix 必须为字符串，当前值=${String(prefix)}`);
        }
        if (prefix.includes(":")) {
            throw new Error(`配置错误：redis.prefix 不允许包含 ':'（RedisHelper 会自动拼接分隔符 ':'），当前值=${String(prefix)}`);
        }
    }
}

/**
 * 配置检查（启动期强校验）
 *
 * 说明：
 * - checkTable/checkApi 等校验的是“扫描到的源码/表定义”。
 * - checkConfig 校验的是“最终合并后的运行时配置对象”，用于阻断错误配置带病启动。
 */
export async function checkConfig(config: BeflyOptions): Promise<void> {
    if (!config || typeof config !== "object") {
        throw new Error("配置错误：config 必须为对象");
    }

    // nodeEnv 已由 loadBeflyConfig 校验，这里只做兜底。
    if (config.nodeEnv !== "development" && config.nodeEnv !== "production") {
        throw new Error(`配置错误：nodeEnv 只能是 development/production，当前值=${String(config.nodeEnv)}`);
    }

    if (config.appName !== undefined) {
        if (!isNonEmptyString(config.appName)) {
            throw new Error(`配置错误：appName 必须为非空字符串，当前值=${String(config.appName)}`);
        }
    }

    if (config.appPort !== undefined) {
        if (!isValidPort(config.appPort)) {
            throw new Error(`配置错误：appPort 必须为 1..65535 的数字，当前值=${String(config.appPort)}`);
        }
    }

    if (config.appHost !== undefined) {
        if (!isNonEmptyString(config.appHost)) {
            throw new Error(`配置错误：appHost 必须为非空字符串，当前值=${String(config.appHost)}`);
        }
    }

    if (config.devEmail !== undefined) {
        if (typeof config.devEmail !== "string") {
            throw new Error(`配置错误：devEmail 必须为字符串（允许为空字符串），当前值=${String(config.devEmail)}`);
        }
        const trimmedDevEmail = config.devEmail.trim();
        if (trimmedDevEmail.length > 0 && !trimmedDevEmail.includes("@")) {
            throw new Error(`配置错误：devEmail 格式错误（必须包含 '@'，或置为空字符串以禁用 syncDev），当前值=${String(config.devEmail)}`);
        }
    }

    if (config.devPassword !== undefined) {
        if (typeof config.devPassword !== "string") {
            throw new Error(`配置错误：devPassword 必须为字符串（允许为空字符串），当前值=${String(config.devPassword)}`);
        }
    }

    if (config.bodyLimit !== undefined) {
        if (!isValidPositiveInt(config.bodyLimit)) {
            throw new Error(`配置错误：bodyLimit 必须为正整数（字节），当前值=${String(config.bodyLimit)}`);
        }
    }

    if (config.tz !== undefined) {
        if (!isValidTimeZone(config.tz)) {
            throw new Error(`配置错误：tz 必须为有效的 IANA 时区字符串（例如 'Asia/Shanghai'），当前值=${String(config.tz)}`);
        }
    }

    if (config.strict !== undefined) {
        if (typeof config.strict !== "boolean") {
            throw new Error(`配置错误：strict 必须为 boolean，当前值=${String(config.strict)}`);
        }
    }

    validateDbConfig(config.db);
    validateRedisConfig(config.redis);
}
