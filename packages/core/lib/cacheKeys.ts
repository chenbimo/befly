/**
 * Cache Key 统一管理
 * 所有缓存键在此统一定义，避免硬编码分散
 */

/**
 * Redis Key 生成函数集合
 */
export const RedisKeys = {
  /** 所有接口缓存 */
  apisAll: () => "befly:apis:all",

  /** 所有菜单缓存 */
  menusAll: () => "befly:menus:all",

  /** 角色信息缓存（完整角色对象） */
  roleInfo: (roleCode: string) => `befly:role:info:${roleCode}`,

  /**
   * 角色接口权限缓存（Set 集合）
   * - key: befly:role:apis:${roleCode}
   * - member: METHOD/path
   */
  roleApis: (roleCode: string) => `befly:role:apis:${roleCode}`,

  /** 表结构缓存 */
  tableColumns: (table: string) => `befly:table:columns:${table}`,
} as const;
