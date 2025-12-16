/**
 * syncDb 常量定义模块
 *
 * 包含：
 * - 数据库类型判断
 * - 版本要求
 * - 数据类型映射
 * - 系统字段定义
 */

/**
 * 数据库版本要求
 */
export const DB_VERSION_REQUIREMENTS = {
  MYSQL_MIN_MAJOR: 8,
  POSTGRES_MIN_MAJOR: 17,
  SQLITE_MIN_VERSION: "3.50.0",
  SQLITE_MIN_VERSION_NUM: 35000, // 3 * 10000 + 50 * 100
} as const;

/**
 * 需要创建索引的系统字段
 */
export const SYSTEM_INDEX_FIELDS = ["created_at", "updated_at", "state"] as const;

/**
 * 字段变更类型的中文标签映射
 */
export const CHANGE_TYPE_LABELS = {
  length: "长度",
  datatype: "类型",
  comment: "注释",
  default: "默认值",
  nullable: "可空约束",
  unique: "唯一约束",
} as const;

/**
 * MySQL 表配置
 *
 * 固定配置说明：
 * - ENGINE: InnoDB（支持事务、外键）
 * - CHARSET: utf8mb4（完整 Unicode 支持，包括 Emoji）
 * - COLLATE: utf8mb4_0900_ai_ci（MySQL 8.0 推荐，不区分重音和大小写）
 */
export const MYSQL_TABLE_CONFIG = {
  ENGINE: "InnoDB",
  CHARSET: "utf8mb4",
  COLLATE: "utf8mb4_0900_ai_ci",
} as const;

// 是否为计划模式（仅输出 SQL 不执行）
export const IS_PLAN = process.argv.includes("--plan");

// 数据库类型（运行时设置，默认 mysql）
let _dbType: string = "mysql";

/**
 * 设置数据库类型（由 syncDbCommand 调用）
 * @param dbType - 数据库类型（mysql/postgresql/postgres/sqlite）
 */
export function setDbType(dbType: string): void {
  _dbType = (dbType || "mysql").toLowerCase();
}

/**
 * 获取当前数据库类型
 */
export function getDbType(): string {
  return _dbType;
}

// 数据库类型判断（getter 函数，运行时动态计算）
export function isMySQL(): boolean {
  return _dbType === "mysql";
}

export function isPG(): boolean {
  return _dbType === "postgresql" || _dbType === "postgres";
}

export function isSQLite(): boolean {
  return _dbType === "sqlite";
}

// 兼容旧代码的静态别名（通过 getter 实现动态获取）
export const DB_TYPE = {
  get current(): string {
    return _dbType;
  },
  get IS_MYSQL(): boolean {
    return isMySQL();
  },
  get IS_PG(): boolean {
    return isPG();
  },
  get IS_SQLITE(): boolean {
    return isSQLite();
  },
};

/**
 * 获取字段类型映射（根据当前数据库类型）
 */
export function getTypeMapping(): Record<string, string> {
  const isSqlite = isSQLite();
  const isPg = isPG();
  const isMysql = isMySQL();

  return {
    number: isSqlite ? "INTEGER" : isPg ? "BIGINT" : "BIGINT",
    string: isSqlite ? "TEXT" : isPg ? "character varying" : "VARCHAR",
    text: isMysql ? "MEDIUMTEXT" : "TEXT",
    array_string: isSqlite ? "TEXT" : isPg ? "character varying" : "VARCHAR",
    array_text: isMysql ? "MEDIUMTEXT" : "TEXT",
    array_number_string: isSqlite ? "TEXT" : isPg ? "character varying" : "VARCHAR",
    array_number_text: isMysql ? "MEDIUMTEXT" : "TEXT",
  };
}
