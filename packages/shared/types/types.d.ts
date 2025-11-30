/**
 * Befly 共享类型定义 - 统一导出入口
 * 这些类型可以在 core、tpl、admin 等多个包中复用
 */

// 常量（从 constants 导出）
export { ApiCode, ErrorMessages } from './constants';
export type { ApiCodeType, ErrorMessageType } from './constants';

// 验证相关
export type { FieldType, FieldDefinition, TableDefinition, ValidateResult, SingleResult } from './validate';

// API 相关
export type { HttpMethod, ResponseResult, PaginatedResult, BaseApiRoute } from './api';

// 数据库相关
export type { SqlValue, SqlParams, OrderDirection, DatabaseType, DatabaseConfig, RedisConfig } from './database';

// 上下文相关
export type { UserInfo, BaseRequestContext } from './context';

// 菜单权限相关
export type { MenuItem, PermissionItem, RoleInfo } from './menu';

// 通用类型
export type { KeyValue } from './common';

// Addon 相关
export type { AddonAuthor, AddonConfig } from './addon';

// 日志相关
export type { LogLevel, LoggerConfig } from './logger';

// 加密相关
export type { EncodingType, HashAlgorithm, PasswordHashOptions } from './crypto';

// JWT 相关
export type { JwtAlgorithm, JwtHeader, JwtDecoded, JwtPayload, JwtSignOptions, JwtVerifyOptions } from './jwt';

// 工具相关
export type { DateFormat, ColorCode, PaginationParams, PaginationResult, FileType, MimeType, FileUploadOptions } from './tool';

// 表结构相关
export type { ReservedFields, SystemFields, BaseTable, InsertType, UpdateType, SelectType, ExcludeReserved } from './table';
