/**
 * DbHelper 泛型类型使用示例
 *
 * 注意：本文件仅用于模板演示与本地测试，主要用于展示类型写法。
 * 不建议在生产环境直接照搬（请按项目实际字段/权限/校验需求调整）。
 *
 * 本文件演示如何使用类型安全的数据库操作
 * 通过扩展 DatabaseTables 接口，可以获得完整的类型推断和智能提示
 */

import type { BeflyContext } from "befly/types/befly";
import type { RequestContext } from "befly/types/context";
import type { BaseTable, TypedWhereConditions } from "befly/types/table";

// ============================================
// 步骤 1: 定义表类型
// ============================================

/**
 * 用户表类型定义
 * 只需定义业务字段，系统字段（id, state, createdAt 等）由 BaseTable 自动添加
 */
interface UserFields {
    email: string;
    username: string;
    password: string;
    nickname: string | null;
    avatar: string | null;
    roleId: number;
    lastLoginAt: number | null;
}

/**
 * 完整的用户表类型（包含系统字段）
 */
type UserTable = BaseTable<UserFields>;

// ============================================
// 步骤 2: 扩展 DatabaseTables（可选，推荐）
// ============================================

/**
 * 在项目的 types/index.d.ts 中添加以下声明：
 *
 * declare module 'befly/types/table' {
 *   interface DatabaseTables {
 *     user: BaseTable<{
 *       email: string;
 *       username: string;
 *       password: string;
 *       nickname: string | null;
 *       avatar: string | null;
 *       roleId: number;
 *       lastLoginAt: number | null;
 *     }>;
 *   }
 * }
 *
 * 扩展后，db.getOne({ table: 'user' }) 的返回类型会自动推断
 */

// ============================================
// 步骤 3: 在 API 中使用类型安全的数据库操作
// ============================================

export default {
    name: "类型安全示例",
    auth: false,
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // ----------------------------------------
        // 示例 1: 类型安全的 WHERE 条件
        // ----------------------------------------

        // 定义类型安全的查询条件
        const where: TypedWhereConditions<UserTable> = {
            state: 1, // 精确匹配
            roleId$in: [1, 2, 3], // IN 数组（必须是 number[]）
            email$like: "%@gmail.com", // LIKE 匹配（必须是 string）
            lastLoginAt$gte: Date.now() - 86400000 // 大于等于（必须是 number）
            // roleId$in: 'invalid',               // ❌ 类型错误：应为 number[]
            // email$like: 123,                    // ❌ 类型错误：应为 string
        };

        // ----------------------------------------
        // 示例 2: 使用泛型指定返回类型
        // ----------------------------------------

        // 方式 A: 手动指定泛型
        const user = await befly.db.getOne<UserTable>({
            table: "user",
            where: { id: ctx.body.id }
        });

        if (user) {
            // 有完整的类型提示（这里使用 void 避免示例代码产生未使用变量告警）
            void user.email; // string
            void user.createdAt; // number（系统字段）
            void user.nickname; // string | null
        }

        // ----------------------------------------
        // 示例 3: 类型安全的列表查询
        // ----------------------------------------

        const result = await befly.db.getList<UserTable>({
            table: "user",
            where: where,
            orderBy: ["createdAt#DESC"],
            page: 1,
            limit: 10
        });

        // result.lists 类型为 UserTable[]
        // 示例代码中不输出日志，避免 lint 的 no-console 报错

        // ----------------------------------------
        // 示例 4: 复杂 WHERE 条件（$or, $and）
        // ----------------------------------------

        const complexWhere: TypedWhereConditions<UserTable> = {
            state: 1,
            $or: [{ email$like: "%@gmail.com" }, { email$like: "%@qq.com" }],
            $and: [{ roleId$in: [1, 2] }, { lastLoginAt$notNull: true }]
        };

        const activeUsers = await befly.db.getAll<UserTable>({
            table: "user",
            where: complexWhere,
            orderBy: ["lastLoginAt#DESC"]
        });

        // ----------------------------------------
        // 示例 5: BETWEEN 范围查询
        // ----------------------------------------

        const rangeWhere: TypedWhereConditions<UserTable> = {
            state: 1,
            createdAt$between: [
                Date.now() - 7 * 86400000, // 7天前
                Date.now() // 现在
            ],
            roleId$between: [1, 10] // 角色 ID 1-10
        };

        // 示例中仅演示类型写法，避免产生未使用变量告警
        void rangeWhere;

        return befly.tool.Yes("类型安全示例", {
            user: user,
            total: result.total,
            activeCount: activeUsers.lists.length
        });
    }
};
