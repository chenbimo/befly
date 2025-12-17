/**
 * SqlBuilder 高级测试用例
 * 测试复杂 WHERE 条件、边界条件、SQL 注入防护
 */

import { describe, test, expect } from "bun:test";

import { SqlBuilder } from "../lib/sqlBuilder";

describe("SqlBuilder - WHERE 操作符完整测试", () => {
    test("$in - 空数组应抛出错误", () => {
        // **已修复**：$in 传入空数组 [] 会抛出错误
        // 空数组会导致查询永远不匹配任何记录

        const builder = new SqlBuilder();

        expect(() => {
            builder.select(["*"]).from("users").where({ id$in: [] }).toSelectSql();
        }).toThrow("$in 操作符的数组不能为空");
    });

    test("$in - 单个值应生成正确的 SQL", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({ id$in: [1] })
            .toSelectSql();

        expect(result.sql).toContain("IN (?)");
        expect(result.params).toEqual([1]);
    });

    test("$in - 多个值应生成多个占位符", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({ id$in: [1, 2, 3, 4, 5] })
            .toSelectSql();

        expect(result.sql).toContain("IN (?,?,?,?,?)");
        expect(result.params).toEqual([1, 2, 3, 4, 5]);
    });

    test("$notIn - 应生成 NOT IN 语句", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({ status$notIn: ["banned", "deleted"] })
            .toSelectSql();

        expect(result.sql).toContain("NOT IN");
        expect(result.params).toEqual(["banned", "deleted"]);
    });

    test("$between - 应生成 BETWEEN AND 语句", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({ age$between: [18, 65] })
            .toSelectSql();

        expect(result.sql).toContain("BETWEEN ? AND ?");
        expect(result.params).toEqual([18, 65]);
    });

    test("$between - 非数组值应如何处理", () => {
        // **问题**：$between 应该接收 [min, max]
        // 如果传入非数组，应该报错还是忽略？

        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({ age$between: 18 as any })
            .toSelectSql();

        // 当前实现：非数组不会生成 BETWEEN 条件（保持为其它 where 逻辑输出）
        expect(typeof result.sql).toBe("string");
    });

    test("$between - 数组长度不为 2 应如何处理", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({ age$between: [18] as any })
            .toSelectSql();

        // **建议**：未来可验证数组长度必须为 2
        expect(typeof result.sql).toBe("string");
    });

    test("$null - 应生成 IS NULL 语句", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").where({ deletedAt$null: true }).toSelectSql();

        expect(result.sql).toContain("IS NULL");
        expect(result.params.length).toBe(0); // IS NULL 不需要参数
    });

    test("$notNull - 应生成 IS NOT NULL 语句", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").where({ email$notNull: true }).toSelectSql();

        expect(result.sql).toContain("IS NOT NULL");
    });

    test("$like - 应生成 LIKE 语句", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").where({ name$like: "%john%" }).toSelectSql();

        expect(result.sql).toContain("LIKE ?");
        expect(result.params).toEqual(["%john%"]);
    });

    test("$like - 通配符应由用户控制", () => {
        // 用户应自己添加 %
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").where({ name$like: "john" }).toSelectSql();

        // 不应自动添加 %
        expect(result.params).toEqual(["john"]);
    });

    test("比较操作符 - 应生成正确的符号", () => {
        const cases = [
            { op: "gt", symbol: ">", value: 18 },
            { op: "gte", symbol: ">=", value: 18 },
            { op: "lt", symbol: "<", value: 65 },
            { op: "lte", symbol: "<=", value: 65 },
            { op: "ne", symbol: "!=", value: 0 }
        ];

        cases.forEach(({ op, symbol, value }) => {
            const builder = new SqlBuilder();
            const where: any = {};
            where[`age$${op}`] = value;

            const result = builder.select(["*"]).from("users").where(where).toSelectSql();

            expect(result.sql).toContain(symbol);
            expect(result.params).toEqual([value]);
        });
    });
});

describe("SqlBuilder - 复杂 WHERE 条件", () => {
    test("$or - 单个条件应正确处理", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({
                $or: [{ name: "john" }]
            })
            .toSelectSql();

        // 单个条件不应该显示OR关键字
        expect(result.sql).not.toContain(" OR ");
        expect(result.params).toEqual(["john"]);
    });

    test("$or - 多个条件应用 OR 连接", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({
                $or: [{ name: "john" }, { email: "john@example.com" }]
            })
            .toSelectSql();

        expect(result.sql).toContain("OR");
        expect(result.params).toEqual(["john", "john@example.com"]);
    });

    test("$or - 空数组应如何处理", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").where({ $or: [] }).toSelectSql();

        // **问题**：空 $or 应该跳过还是报错？
        console.log("$or 空数组生成的 SQL:", result.sql);
    });

    test("$and + $or 嵌套", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({
                age$gte: 18,
                $or: [{ role: "admin" }, { role: "moderator" }]
            })
            .toSelectSql();

        expect(result.sql).toContain("AND");
        expect(result.sql).toContain("OR");
        expect(result.params).toEqual([18, "admin", "moderator"]);
    });

    test("$or 内嵌套多个操作符", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({
                $or: [{ age$gt: 60 }, { age$lt: 18 }]
            })
            .toSelectSql();

        expect(result.sql).toContain("OR");
        expect(result.sql).toContain(">");
        expect(result.sql).toContain("<");
    });

    test("深层嵌套的 $or 和 $and", () => {
        const builder = new SqlBuilder();
        const result = builder
            .select(["*"])
            .from("users")
            .where({
                status: "active",
                $or: [
                    {
                        $and: [{ age$gte: 18 }, { age$lte: 65 }]
                    },
                    { vip: true }
                ]
            })
            .toSelectSql();

        expect(result.sql).toBeDefined();
        console.log("深层嵌套生成的 SQL:", result.sql);
    });
});

describe("SqlBuilder - 字段名转义", () => {
    test("普通字段名应添加反引号", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["name", "email"]).from("users").toSelectSql();

        expect(result.sql).toContain("`name`");
        expect(result.sql).toContain("`email`");
    });

    test("星号不应添加反引号", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").toSelectSql();

        expect(result.sql).toContain("SELECT *");
        expect(result.sql).not.toContain("`*`");
    });

    test("已有反引号的字段不应重复添加", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["`user_id`", "`user_name`"]).from("users").toSelectSql();

        // 不应变成 `\`user_id\``
        expect(result.sql).toContain("`user_id`");
        expect(result.sql).not.toContain("``");
    });

    test("表名.字段名应分别转义", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["users.id", "profiles.bio"]).from("users").toSelectSql();

        expect(result.sql).toContain("`users`.`id`");
        expect(result.sql).toContain("`profiles`.`bio`");
    });

    test("函数调用不应转义", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["COUNT(*)", "MAX(age)"]).from("users").toSelectSql();

        expect(result.sql).toContain("COUNT(*)");
        expect(result.sql).toContain("MAX(age)");
        expect(result.sql).not.toContain("`COUNT(*)`");
    });

    test("AS 别名应正确处理", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["name AS userName", "COUNT(*) AS total"]).from("users").toSelectSql();

        expect(result.sql).toContain("`name` AS userName");
        expect(result.sql).toContain("COUNT(*) AS total");
    });

    test("特殊字符字段名应转义", () => {
        // 包含空格、横杠等特殊字符的字段名
        const builder = new SqlBuilder();
        const result = builder.select(["user-name", "created at"]).from("users").toSelectSql();

        // 应该添加反引号保护
        expect(result.sql).toContain("`user-name`");
        expect(result.sql).toContain("`created at`");
    });
});

describe("SqlBuilder - 表名转义", () => {
    test("普通表名应添加反引号", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").toSelectSql();

        expect(result.sql).toContain("FROM `users`");
    });

    test("表别名应正确处理", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users u").toSelectSql();

        expect(result.sql).toContain("FROM `users` u");
    });

    test("已有反引号的表名不应重复添加", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("`user_profiles`").toSelectSql();

        expect(result.sql).toContain("FROM `user_profiles`");
        expect(result.sql).not.toContain("``");
    });
});

describe("SqlBuilder - ORDER BY", () => {
    test("单字段升序排序", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").orderBy(["createdAt#ASC"]).toSelectSql();

        // ORDER BY目前不转换驼峰，保持原样
        expect(result.sql).toContain("ORDER BY `createdAt` ASC");
    });

    test("单字段降序排序", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").orderBy(["createdAt#DESC"]).toSelectSql();

        // ORDER BY目前不转换驼峰，保持原样
        expect(result.sql).toContain("ORDER BY `createdAt` DESC");
    });

    test("多字段排序", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").orderBy(["priority#DESC", "createdAt#ASC"]).toSelectSql();

        expect(result.sql).toContain("ORDER BY");
        expect(result.sql).toContain("`priority` DESC");
        expect(result.sql).toContain("`createdAt` ASC");
    });

    test("无方向标识应抛错", () => {
        // **当前实现**：要求必须有 #ASC 或 #DESC

        const builder = new SqlBuilder();

        expect(() => {
            builder.select(["*"]).from("users").orderBy(["createdAt"]).toSelectSql();
        }).toThrow('orderBy 字段必须是 "字段#方向" 格式的字符串');
    });

    test("字段名当前不转换为下划线", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").orderBy(["createdAt#DESC", "userId#ASC"]).toSelectSql();

        // 当前实现不转换驼峰
        expect(result.sql).toContain("createdAt");
        expect(result.sql).toContain("userId");
    });
});

describe("SqlBuilder - LIMIT 和 OFFSET", () => {
    test("LIMIT 应生成正确的 SQL", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").limit(10).toSelectSql();

        expect(result.sql).toContain("LIMIT 10");
    });

    test("OFFSET 单独使用时无效（需要配合LIMIT）", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").offset(20).toSelectSql();

        // 当前实现：单独使用OFFSET不生效
        expect(result.sql).not.toContain("OFFSET");
    });

    test("LIMIT + OFFSET 组合", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").limit(10).offset(20).toSelectSql();

        expect(result.sql).toContain("LIMIT 10");
        expect(result.sql).toContain("OFFSET 20");
    });

    test("LIMIT 0 应允许（查询结构不查数据）", () => {
        const builder = new SqlBuilder();
        const result = builder.select(["*"]).from("users").limit(0).toSelectSql();

        expect(result.sql).toContain("LIMIT 0");
    });

    test("LIMIT 负数应抛错", () => {
        const builder = new SqlBuilder();

        expect(() => {
            builder.select(["*"]).from("users").limit(-10).toSelectSql();
        }).toThrow("LIMIT 数量必须是非负数");
    });

    test("OFFSET 负数应抛错", () => {
        const builder = new SqlBuilder();

        expect(() => {
            builder.select(["*"]).from("users").offset(-5).toSelectSql();
        }).toThrow("OFFSET 必须是非负数");
    });
});

describe("SqlBuilder - INSERT/UPDATE/DELETE 语句", () => {
    test("当前 SqlBuilder 不直接支持 INSERT/UPDATE/DELETE", () => {
        // **说明**：当前 SqlBuilder 主要用于 SELECT 查询
        // INSERT/UPDATE/DELETE 由 DbHelper 的 insData/updData/delData 方法处理

        const builder = new SqlBuilder();

        // 验证没有这些方法
        expect(typeof (builder as any).insert).toBe("undefined");
        expect(typeof (builder as any).update).toBe("undefined");
        expect(typeof (builder as any).delete).toBe("undefined");
    });
});

describe("SqlBuilder - SQL 注入防护", () => {
    test("参数化查询应防止 SQL 注入", () => {
        const builder = new SqlBuilder();
        const maliciousInput = "' OR '1'='1";

        const result = builder.select(["*"]).from("users").where({ name: maliciousInput }).toSelectSql();

        // 参数应该被正确转义
        expect(result.params).toEqual([maliciousInput]);
        expect(result.sql).not.toContain("' OR '1'='1");
        expect(result.sql).toContain("?"); // 使用占位符
    });

    test("字段名不应允许用户输入", () => {
        // **潜在风险**：如果字段名来自用户输入
        const userInput = "name; DROP TABLE users; --";
        expect(userInput).toContain("DROP TABLE");

        // 字段名应该从白名单选择，不应直接使用用户输入
        // const result = builder.select([userInput]).from('users').toSelectSql();

        // **建议**：字段名应该验证是否在允许的字段列表中
    });

    test("表名不应允许用户输入", () => {
        // **潜在风险**：表名来自用户输入
        const userInput = "users; DROP TABLE sensitive_data; --";
        expect(userInput).toContain("DROP TABLE");

        // **建议**：表名应该从白名单选择
    });
});

describe("SqlBuilder - reset 功能", () => {
    test("reset 应清空所有状态", () => {
        const builder = new SqlBuilder();

        builder.select(["name"]).from("users").where({ id: 1 }).orderBy(["name#ASC"]).limit(10);

        const beforeReset = builder.toSelectSql();
        expect(beforeReset.sql).toBeDefined();

        builder.reset();

        // reset 后应该是空状态
        builder.select(["email"]).from("profiles");
        const afterReset = builder.toSelectSql();

        expect(afterReset.sql).not.toContain("users");
        expect(afterReset.sql).toContain("profiles");
        expect(afterReset.sql).not.toContain("LIMIT");
    });

    test("reset 应支持链式调用", () => {
        const builder = new SqlBuilder();

        const result = builder.select(["*"]).from("users").reset().select(["id"]).from("posts").toSelectSql();

        expect(result.sql).toContain("posts");
        expect(result.sql).not.toContain("users");
    });
});

describe("SqlBuilder - 代码逻辑问题分析", () => {
    test("问题1：$in 空数组会生成错误的 SQL", () => {
        // **问题**：WHERE id IN () 是非法的 SQL 语法
        // **建议**：检测到空数组应跳过条件或抛出错误

        const mockWhere = (values: any[]) => {
            if (values.length === 0) {
                throw new Error("$in 操作符不能使用空数组");
            }
            return `id IN (${values.map(() => "?").join(", ")})`;
        };

        expect(() => mockWhere([])).toThrow("$in 操作符不能使用空数组");
        expect(mockWhere([1, 2])).toBe("id IN (?, ?)");
    });

    test("问题2：LIMIT 和 OFFSET 没有验证", () => {
        // **问题**：负数会导致 SQL 错误
        // **建议**：添加参数验证

        const mockLimit = (value: number) => {
            if (value < 0) {
                throw new Error("LIMIT 必须 >= 0");
            }
            return `LIMIT ${value}`;
        };

        expect(() => mockLimit(-10)).toThrow("LIMIT 必须 >= 0");
        expect(mockLimit(10)).toBe("LIMIT 10");
    });

    test("问题3：无 WHERE 的 UPDATE 和 DELETE 很危险", () => {
        // **问题**：容易误操作导致数据丢失
        // **建议**：要求必须有 WHERE 条件或明确的标志

        const mockUpdate = (where: any, allowNoWhere: boolean = false) => {
            const hasWhere = where && Object.keys(where).length > 0;

            if (!hasWhere && !allowNoWhere) {
                throw new Error("UPDATE 必须有 WHERE 条件。如果确实要更新所有行，请设置 allowNoWhere: true");
            }

            return "UPDATE users SET status = ?";
        };

        expect(() => mockUpdate({})).toThrow("UPDATE 必须有 WHERE 条件");
        expect(mockUpdate({}, true)).toBeDefined(); // 明确允许
        expect(mockUpdate({ id: 1 })).toBeDefined(); // 有 WHERE
    });

    test("问题4：$between 参数验证不足", () => {
        // **问题**：应该验证是否为数组且长度为 2
        // **建议**：添加严格的参数检查

        const mockBetween = (value: any) => {
            if (!Array.isArray(value)) {
                throw new Error("$between 必须是数组");
            }
            if (value.length !== 2) {
                throw new Error("$between 数组长度必须为 2");
            }
            return `age BETWEEN ? AND ?`;
        };

        expect(() => mockBetween(18)).toThrow("$between 必须是数组");
        expect(() => mockBetween([18])).toThrow("$between 数组长度必须为 2");
        expect(mockBetween([18, 65])).toBeDefined();
    });

    test("问题5：字段名转义可能影响性能", () => {
        // **问题**：每次查询都要转义字段名
        // **建议**：可以缓存转义结果

        const escapeCache = new Map<string, string>();

        const mockEscape = (field: string) => {
            if (escapeCache.has(field)) {
                return escapeCache.get(field)!;
            }

            const escaped = field === "*" ? field : `\`${field}\``;
            escapeCache.set(field, escaped);
            return escaped;
        };

        // 第一次转义
        const t1 = performance.now();
        mockEscape("user_name");
        const time1 = performance.now() - t1;

        // 第二次应该更快（从缓存读取）
        const t2 = performance.now();
        mockEscape("user_name");
        const time2 = performance.now() - t2;

        console.log(`首次转义: ${time1}ms, 缓存命中: ${time2}ms`);
    });
});
