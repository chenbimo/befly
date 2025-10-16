/**
 * 数据库错误类
 * 提供统一的错误处理机制，包含错误码和上下文信息
 */
export class DatabaseError extends Error {
    code: string;
    context?: Record<string, any>;
    originalError?: Error;

    constructor(message: string, code: string, context?: Record<string, any>, originalError?: Error) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.context = context;
        this.originalError = originalError;

        // 保持正确的堆栈跟踪（仅在 V8 引擎中有效）
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DatabaseError);
        }
    }

    /**
     * 获取完整的错误信息（包含上下文）
     */
    getFullMessage(): string {
        let msg = `[${this.code}] ${this.message}`;

        if (this.context && Object.keys(this.context).length > 0) {
            msg += `\n上下文: ${JSON.stringify(this.context, null, 2)}`;
        }

        if (this.originalError) {
            msg += `\n原始错误: ${this.originalError.message}`;
        }

        return msg;
    }

    /**
     * 转换为 JSON 格式（便于日志记录和 API 返回）
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            context: this.context,
            originalError: this.originalError?.message,
            stack: this.stack
        };
    }
}

/**
 * 数据库错误码枚举
 */
export const DB_ERROR_CODES = {
    // 连接错误
    CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
    CONNECTION_TIMEOUT: 'DB_CONNECTION_TIMEOUT',

    // ID 生成错误
    ID_GENERATION_FAILED: 'DB_ID_GENERATION_FAILED',

    // 查询错误
    QUERY_FAILED: 'DB_QUERY_FAILED',
    QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',

    // 参数错误
    INVALID_PARAMS: 'DB_INVALID_PARAMS',
    INVALID_TABLE_NAME: 'DB_INVALID_TABLE_NAME',
    INVALID_FIELD_NAME: 'DB_INVALID_FIELD_NAME',
    INVALID_WHERE_CONDITION: 'DB_INVALID_WHERE_CONDITION',

    // 数据错误
    DATA_NOT_FOUND: 'DB_DATA_NOT_FOUND',
    DATA_ALREADY_EXISTS: 'DB_DATA_ALREADY_EXISTS',
    DATA_VALIDATION_FAILED: 'DB_DATA_VALIDATION_FAILED',

    // 事务错误
    TRANSACTION_FAILED: 'DB_TRANSACTION_FAILED',
    TRANSACTION_COMMIT_FAILED: 'DB_TRANSACTION_COMMIT_FAILED',
    TRANSACTION_ROLLBACK_FAILED: 'DB_TRANSACTION_ROLLBACK_FAILED',

    // 批量操作错误
    BATCH_SIZE_EXCEEDED: 'DB_BATCH_SIZE_EXCEEDED',
    BATCH_INSERT_FAILED: 'DB_BATCH_INSERT_FAILED',

    // 其他错误
    UNKNOWN_ERROR: 'DB_UNKNOWN_ERROR'
} as const;

/**
 * 快速创建数据库错误的工厂函数
 */
export class DBError {
    /**
     * 连接失败
     */
    static connectionFailed(message: string, context?: Record<string, any>, originalError?: Error): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.CONNECTION_FAILED, context, originalError);
    }

    /**
     * ID 生成失败
     */
    static idGenerationFailed(message: string, context?: Record<string, any>, originalError?: Error): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.ID_GENERATION_FAILED, context, originalError);
    }

    /**
     * 查询失败
     */
    static queryFailed(message: string, context?: Record<string, any>, originalError?: Error): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.QUERY_FAILED, context, originalError);
    }

    /**
     * 无效参数
     */
    static invalidParams(message: string, context?: Record<string, any>): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.INVALID_PARAMS, context);
    }

    /**
     * 无效表名
     */
    static invalidTableName(tableName: string): DatabaseError {
        return new DatabaseError(`无效的表名: ${tableName}`, DB_ERROR_CODES.INVALID_TABLE_NAME, { tableName });
    }

    /**
     * 无效字段名
     */
    static invalidFieldName(fieldName: string): DatabaseError {
        return new DatabaseError(`无效的字段名: ${fieldName}，只允许字母、数字和下划线。`, DB_ERROR_CODES.INVALID_FIELD_NAME, { fieldName });
    }

    /**
     * 数据未找到
     */
    static dataNotFound(message: string, context?: Record<string, any>): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.DATA_NOT_FOUND, context);
    }

    /**
     * 事务提交失败
     */
    static transactionCommitFailed(message: string, originalError?: Error): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.TRANSACTION_COMMIT_FAILED, undefined, originalError);
    }

    /**
     * 事务回滚失败
     */
    static transactionRollbackFailed(message: string, originalError?: Error): DatabaseError {
        return new DatabaseError(message, DB_ERROR_CODES.TRANSACTION_ROLLBACK_FAILED, undefined, originalError);
    }

    /**
     * 批量大小超限
     */
    static batchSizeExceeded(actual: number, max: number): DatabaseError {
        return new DatabaseError(`批量插入数量 ${actual} 超过最大限制 ${max}，请分批插入。`, DB_ERROR_CODES.BATCH_SIZE_EXCEEDED, { actual, max });
    }

    /**
     * 批量插入失败
     */
    static batchInsertFailed(table: string, originalError?: Error): DatabaseError {
        return new DatabaseError(`表 \`${table}\` 批量插入失败`, DB_ERROR_CODES.BATCH_INSERT_FAILED, { table }, originalError);
    }
}
