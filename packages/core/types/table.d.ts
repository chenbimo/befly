/**
 * 表类型定义 - 用于增强 DbHelper 泛型推断
 */

// ============================================
// 基础表类型
// ============================================

/**
 * 系统字段（所有表都有的字段）
 */
export interface SystemFields {
    /** 主键 ID（雪花 ID） */
    id: number;
    /** 状态：0=已删除, 1=正常, 2=禁用 */
    state: number;
    /** 创建时间（毫秒时间戳） */
    createdAt: number;
    /** 更新时间（毫秒时间戳） */
    updatedAt: number;
    /** 删除时间（毫秒时间戳，软删除时设置） */
    deletedAt: number | null;
}

/**
 * 基础表类型（包含系统字段）
 */
export type BaseTable<T extends Record<string, any>> = T & SystemFields;

// ============================================
// 表操作类型工具
// ============================================

/**
 * 插入类型：排除系统自动生成的字段
 */
export type InsertType<T> = Omit<T, keyof SystemFields>;

/**
 * 更新类型：所有字段可选，排除不可修改的系统字段
 */
export type UpdateType<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

/**
 * 查询结果类型：完整的表记录
 */
export type SelectType<T> = T;

// ============================================
// 数据库表映射接口
// ============================================

/**
 * 数据库表映射
 * 用户可以在项目中扩展此接口来添加表类型
 *
 * @example
 * ```typescript
 * // 在项目的 types/index.d.ts 中扩展
 * declare module 'befly/types/table' {
 *   interface DatabaseTables {
 *     user: BaseTable<{
 *       email: string;
 *       username: string;
 *       password: string;
 *       nickname: string | null;
 *     }>;
 *     article: BaseTable<{
 *       title: string;
 *       content: string;
 *       authorId: number;
 *     }>;
 *   }
 * }
 * ```
 */
export interface DatabaseTables {
    // 用户通过模块扩展添加表类型
    [tableName: string]: BaseTable<Record<string, any>>;
}

/**
 * 表名类型（从 DatabaseTables 提取所有键）
 */
export type TableName = keyof DatabaseTables;

/**
 * 根据表名获取表类型
 */
export type TableType<K extends TableName> = DatabaseTables[K];

/**
 * 根据表名获取插入类型
 */
export type TableInsertType<K extends TableName> = InsertType<DatabaseTables[K]>;

/**
 * 根据表名获取更新类型
 */
export type TableUpdateType<K extends TableName> = UpdateType<DatabaseTables[K]>;

// ============================================
// WHERE 条件类型增强
// ============================================

/**
 * 比较操作符（值类型与字段类型相同）
 */
type CompareOperators = 'gt' | 'gte' | 'lt' | 'lte' | 'ne' | 'not';

/**
 * 数组操作符（值类型为字段类型的数组）
 */
type ArrayOperators = 'in' | 'nin' | 'notIn';

/**
 * 字符串操作符（值类型为字符串）
 */
type StringOperators = 'like' | 'notLike';

/**
 * 范围操作符（值类型为 [min, max] 元组）
 */
type RangeOperators = 'between' | 'notBetween';

/**
 * 空值操作符（值类型为 boolean）
 */
type NullOperators = 'null' | 'notNull';

/**
 * 所有操作符联合类型
 */
export type FieldOperator = `$${CompareOperators}` | `$${ArrayOperators}` | `$${StringOperators}` | `$${RangeOperators}` | `$${NullOperators}`;

/**
 * 比较操作符条件（值类型与字段类型相同）
 * @example { userId$gt: 10, age$lte: 65 }
 */
type CompareConditions<T> = {
    [K in keyof T as `${K & string}$${CompareOperators}`]?: T[K];
};

/**
 * 数组操作符条件（值类型为字段类型的数组）
 * @example { status$in: [1, 2, 3], roleId$nin: [100, 200] }
 */
type ArrayConditions<T> = {
    [K in keyof T as `${K & string}$${ArrayOperators}`]?: T[K][];
};

/**
 * 字符串操作符条件（值类型为字符串）
 * @example { name$like: '%test%', email$notLike: '%spam%' }
 */
type StringConditions<T> = {
    [K in keyof T as `${K & string}$${StringOperators}`]?: string;
};

/**
 * 范围操作符条件（值类型为 [min, max] 元组）
 * @example { age$between: [18, 65], createdAt$notBetween: [start, end] }
 */
type RangeConditions<T> = {
    [K in keyof T as `${K & string}$${RangeOperators}`]?: [T[K], T[K]];
};

/**
 * 空值操作符条件（值类型为 true）
 * @example { deletedAt$null: true, avatar$notNull: true }
 */
type NullConditions<T> = {
    [K in keyof T as `${K & string}$${NullOperators}`]?: true;
};

/**
 * 类型安全的 WHERE 条件
 *
 * 支持的操作符：
 * - 比较：$gt, $gte, $lt, $lte, $ne, $not（值类型与字段相同）
 * - 数组：$in, $nin, $notIn（值类型为数组）
 * - 字符串：$like, $notLike（值类型为字符串）
 * - 范围：$between, $notBetween（值类型为 [min, max] 元组）
 * - 空值：$null, $notNull（值类型为 true）
 * - 逻辑：$or, $and（递归条件数组）
 *
 * @example
 * ```typescript
 * const where: TypedWhereConditions<UserTable> = {
 *   state: 1,                        // 精确匹配
 *   age$gte: 18,                     // 大于等于
 *   roleId$in: [1, 2, 3],            // IN 数组
 *   name$like: '%test%',             // LIKE 匹配
 *   createdAt$between: [start, end], // BETWEEN 范围
 *   deletedAt$null: true,            // IS NULL
 *   $or: [                           // OR 条件
 *     { email$like: '%@gmail.com' },
 *     { email$like: '%@qq.com' }
 *   ]
 * };
 * ```
 */
export type TypedWhereConditions<T> = Partial<T> & // 精确匹配
    CompareConditions<T> & // 比较操作符
    ArrayConditions<T> & // 数组操作符
    StringConditions<T> & // 字符串操作符
    RangeConditions<T> & // 范围操作符
    NullConditions<T> & { // 空值操作符
        /** OR 条件组 */
        $or?: TypedWhereConditions<T>[];
        /** AND 条件组 */
        $and?: TypedWhereConditions<T>[];
    };
