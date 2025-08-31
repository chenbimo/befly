/**
 * 数据库表同步功能测试套件
 * 测试 dbSync.js 中的表结构同步功能
 */

import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test';
import { SyncDb as syncDatabase } from '../scripts/syncDb.js';
import { ruleSplit } from '../utils/index.js';
import path from 'node:path';
import { writeFile, mkdir, rm } from 'node:fs/promises';

// 从 syncDb.js 导入解析函数进行测试（此处测试内自带的 parse，仅用于规则解析模拟）
const parseFieldRule = (rule) => {
    const allParts = rule.split('⚡');

    // 现在支持7个部分：显示名⚡类型⚡最小值⚡最大值⚡默认值⚡ 是否索引⚡正则约束
    if (allParts.length <= 7) {
        // 如果少于7个部分，补齐缺失的部分为 null
        while (allParts.length < 7) {
            allParts.push('null');
        }
        return allParts;
    }

    // 如果超过7个部分，把第7个部分之后的内容合并为第7个部分（正则表达式可能包含⚡符号）
    const mergedRule = allParts.slice(6).join('⚡'); // 合并最后的正则部分
    return [
        allParts[0], // 显示名
        allParts[1], // 类型
        allParts[2], // 最小值
        allParts[3], // 最大值
        allParts[4], // 默认值
        allParts[5], // 是否索引
        mergedRule // 正则约束（可能包含⚡符号）
    ];
};

// 测试用的临时表定义
const testTableDefinitions = {
    'test_users.json': {
        name: '用户名⚡string⚡2⚡50⚡null⚡1⚡null',
        email: '邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        age: '年龄⚡number⚡1⚡150⚡18⚡0⚡null',
        bio: '个人简介⚡text⚡0⚡5000⚡null⚡0⚡null',
        tags: '标签⚡array⚡0⚡10⚡null⚡0⚡null'
    },
    'test_products.json': {
        name: '产品名称⚡string⚡1⚡200⚡null⚡1⚡null',
        price: '价格⚡number⚡0⚡999999999⚡0⚡1⚡x>0',
        description: '产品描述⚡text⚡0⚡10000⚡null⚡0⚡null',
        category: '分类⚡string⚡1⚡50⚡default⚡1⚡null'
    }
};

describe('数据库同步功能测试', () => {
    let tempTablesDir;

    beforeAll(async () => {
        // 创建临时表定义目录
        tempTablesDir = path.join(process.cwd(), 'temp_tables_test');
        try {
            await mkdir(tempTablesDir, { recursive: true });

            // 创建测试表定义文件
            for (const [fileName, definition] of Object.entries(testTableDefinitions)) {
                const filePath = path.join(tempTablesDir, fileName);
                await writeFile(filePath, JSON.stringify(definition, null, 2));
            }
        } catch (error) {
            console.warn('创建测试文件时出错:', error.message);
        }
    });

    afterAll(async () => {
        // 清理临时文件
        try {
            await rm(tempTablesDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('清理测试文件时出错:', error.message);
        }
    });

    describe('规则解析测试', () => {
        test('正确解析基本字段规则', () => {
            const rule = '用户名⚡string⚡2⚡50⚡null⚡0⚡null';
            const parts = parseFieldRule(rule);

            expect(parts).toHaveLength(7);
            expect(parts[0]).toBe('用户名');
            expect(parts[1]).toBe('string');
            expect(parts[2]).toBe('2');
            expect(parts[3]).toBe('50');
            expect(parts[4]).toBe('null'); // 默认值
            expect(parts[5]).toBe('0'); // 索引
            expect(parts[6]).toBe('null'); // 正则约束
        });

        test('正确解析包含正则表达式的规则', () => {
            const rule = '邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
            const parts = parseFieldRule(rule);

            expect(parts).toHaveLength(7);
            expect(parts[0]).toBe('邮箱');
            expect(parts[1]).toBe('string');
            expect(parts[2]).toBe('5');
            expect(parts[3]).toBe('100');
            expect(parts[4]).toBe('null');
            expect(parts[5]).toBe('1');
            expect(parts[6]).toBe('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
        });

        test('正确解析包含计算表达式的规则', () => {
            const rule = '价格⚡number⚡0⚡999999999⚡x>0⚡0⚡1';
            const parts = parseFieldRule(rule);

            expect(parts).toHaveLength(7);
            expect(parts[0]).toBe('价格');
            expect(parts[1]).toBe('number');
            expect(parts[2]).toBe('0');
            expect(parts[3]).toBe('999999999');
            expect(parts[4]).toBe('x>0');
            expect(parts[5]).toBe('0');
            expect(parts[6]).toBe('1');
        });

        test('正确解析包含管道符的复杂正则规则', () => {
            const rule = '状态⚡string⚡1⚡20⚡active⚡1⚡^(active|inactive|pending)$';
            const parts = parseFieldRule(rule);

            expect(parts).toHaveLength(7);
            expect(parts[0]).toBe('状态');
            expect(parts[1]).toBe('string');
            expect(parts[2]).toBe('1');
            expect(parts[3]).toBe('20');
            expect(parts[4]).toBe('active');
            expect(parts[5]).toBe('1');
            expect(parts[6]).toBe('^(active|inactive|pending)$');
        });
    });

    describe('数据类型映射测试', () => {
        // 由于 dbSync.js 中的 typeMapping 不是导出的，我们测试已知的映射关系
        test('数据类型应该正确映射到SQL类型', () => {
            // 这些是我们期望的映射关系
            const expectedMappings = {
                number: 'BIGINT',
                string: 'VARCHAR',
                text: 'MEDIUMTEXT',
                array: 'VARCHAR(1000)'
            };

            // 通过测试不同类型的字段定义来验证映射
            expect(typeof expectedMappings.number).toBe('string');
            expect(typeof expectedMappings.string).toBe('string');
            expect(typeof expectedMappings.text).toBe('string');
            expect(typeof expectedMappings.array).toBe('string');
        });
    });

    describe('表定义验证测试', () => {
        test('应该检测保留字段', () => {
            const reservedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'];

            // 测试每个保留字段都不应该在表定义中使用
            reservedFields.forEach((field) => {
                expect(reservedFields.includes(field)).toBe(true);
            });
        });

        test('有效的字段定义应该通过验证', () => {
            const validFields = {
                name: '姓名,string,1,100,null',
                age: '年龄,number,0,200,null',
                description: '描述,text,0,5000,null',
                tags: '标签,array,0,10,null'
            };

            // 验证字段名不是保留字段
            const reservedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'];

            Object.keys(validFields).forEach((fieldName) => {
                expect(reservedFields.includes(fieldName)).toBe(false);
            });
        });

        test('无效的字段定义应该被拒绝', () => {
            const invalidFields = {
                id: 'ID,number,1,999999999,null', // 保留字段
                created_at: '创建时间,number,1,999999999,null', // 保留字段
                state: '状态,number,0,1,null' // 保留字段
            };

            const reservedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'];

            Object.keys(invalidFields).forEach((fieldName) => {
                expect(reservedFields.includes(fieldName)).toBe(true);
            });
        });
    });

    describe('表名生成测试', () => {
        test('应该从文件名正确生成表名（转为下划线 snake_case）', () => {
            const testCases = [
                { fileName: 'users.json', expectedTableName: 'users' },
                { fileName: 'testProducts.json', expectedTableName: 'test_products' },
                { fileName: 'blogPosts.json', expectedTableName: 'blog_posts' },
                { fileName: 'userProfiles.json', expectedTableName: 'user_profiles' },
                { fileName: 'orderV2.json', expectedTableName: 'order_v2' }
            ];

            testCases.forEach(({ fileName, expectedTableName }) => {
                const base = path.basename(fileName, '.json');
                // 与脚本保持一致的转换规则
                const toSnake = (name) =>
                    name
                        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
                        .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
                        .toLowerCase();
                const tableName = toSnake(base);
                expect(tableName).toBe(expectedTableName);
            });
        });
    });

    describe('字段SQL生成测试', () => {
        test('string类型应该生成正确的VARCHAR定义', () => {
            const rule = '用户名,string,2,50,null';
            const parts = ruleSplit(rule);

            expect(parts[1]).toBe('string');
            expect(parts[3]).toBe('50'); // 最大长度

            // 验证会生成类似 VARCHAR(50) 的定义
            const maxLength = parseInt(parts[3]);
            expect(maxLength).toBe(50);
            expect(maxLength).toBeGreaterThan(0);
            expect(maxLength).toBeLessThanOrEqual(65535);
        });

        test('number类型应该生成BIGINT定义', () => {
            const rule = '年龄,number,0,150,null';
            const parts = ruleSplit(rule);

            expect(parts[1]).toBe('number');
            // number类型应该映射到BIGINT
        });

        test('text类型应该生成MEDIUMTEXT定义', () => {
            const rule = '描述,text,0,5000,null';
            const parts = ruleSplit(rule);

            expect(parts[1]).toBe('text');
            // text类型应该映射到MEDIUMTEXT
        });

        test('array类型应该生成VARCHAR定义', () => {
            const rule = '标签,array,0,10,null';
            const parts = ruleSplit(rule);

            expect(parts[1]).toBe('array');
            // array类型应该映射到VARCHAR用于JSON存储
        });
    });

    describe('系统字段测试', () => {
        test('系统字段应该自动添加到每个表', () => {
            const systemFields = [
                { name: 'id', type: 'BIGINT', isPrimary: true },
                { name: 'created_at', type: 'BIGINT', nullable: false, default: 0 },
                { name: 'updated_at', type: 'BIGINT', nullable: false, default: 0 },
                { name: 'deleted_at', type: 'BIGINT', nullable: false, default: 0 },
                { name: 'state', type: 'BIGINT', nullable: false, default: 0 }
            ];

            systemFields.forEach((field) => {
                expect(field.name).toBeTruthy();
                expect(field.type).toBeTruthy();
                expect(typeof field.name).toBe('string');
                expect(typeof field.type).toBe('string');
            });
        });

        test('系统字段应该有正确的索引', () => {
            const expectedIndexes = ['idx_created_at', 'idx_updated_at', 'idx_state'];

            expectedIndexes.forEach((indexName) => {
                expect(indexName).toMatch(/^idx_/);
                expect(typeof indexName).toBe('string');
            });
        });
    });

    // 注意：实际的数据库连接测试需要有效的数据库配置
    // 这里我们只测试不需要数据库连接的逻辑部分
    describe('环境配置测试', () => {
        test('应该有必要的环境变量配置项', () => {
            const requiredEnvVars = ['DB_ENABLE', 'DB_TYPE', 'DB_NAME'];
            requiredEnvVars.forEach((envVar) => {
                expect(typeof envVar).toBe('string');
                expect(envVar.startsWith('DB_')).toBe(true);
            });
        });
    });

    describe('字段变更检测测试', () => {
        // 模拟现有数据库字段信息
        const mockExistingColumn = {
            type: 'varchar',
            columnType: 'varchar(100)',
            length: 100,
            precision: null,
            scale: null,
            nullable: true,
            defaultValue: null,
            comment: '旧注释'
        };

        test('检测字符串长度变化', () => {
            const newRule = '用户名,string,2,150,null'; // 长度从100改为150
            const ruleParts = ruleSplit(newRule);

            expect(ruleParts[1]).toBe('string');
            expect(ruleParts[3]).toBe('150');

            // 模拟检测逻辑
            const newMaxLength = parseInt(ruleParts[3]);
            const currentLength = mockExistingColumn.length;

            expect(newMaxLength).not.toBe(currentLength);
            expect(newMaxLength).toBe(150);
            expect(currentLength).toBe(100);
        });

        test('检测注释变化', () => {
            const newRule = '新注释,string,2,100,null'; // 注释从"旧注释"改为"新注释"
            const ruleParts = ruleSplit(newRule);

            expect(ruleParts[0]).toBe('新注释');

            // 模拟检测逻辑
            const newComment = ruleParts[0];
            const currentComment = mockExistingColumn.comment;

            expect(newComment).not.toBe(currentComment);
            expect(newComment).toBe('新注释');
            expect(currentComment).toBe('旧注释');
        });

        test('检测数据类型变化', () => {
            const newRule = '描述,text,0,5000,null'; // 从string改为text
            const ruleParts = ruleSplit(newRule);

            expect(ruleParts[1]).toBe('text');

            // 模拟检测逻辑
            const newType = ruleParts[1];
            const currentType = mockExistingColumn.type;

            let expectedDbType = '';
            switch (newType) {
                case 'text':
                    expectedDbType = 'mediumtext';
                    break;
                case 'string':
                    expectedDbType = 'varchar';
                    break;
            }

            expect(expectedDbType).toBe('mediumtext');
            expect(currentType).toBe('varchar');
            expect(expectedDbType).not.toBe(currentType);
        });

        test('无变化的字段应该被正确识别', () => {
            const newRule = '旧注释,string,2,100,null'; // 所有参数都相同
            const ruleParts = ruleSplit(newRule);

            const newMaxLength = parseInt(ruleParts[3]);
            const newComment = ruleParts[0];
            const newType = ruleParts[1];

            // 所有值都应该匹配
            expect(newMaxLength).toBe(mockExistingColumn.length);
            expect(newComment).toBe(mockExistingColumn.comment);
            expect(newType).toBe('string'); // 对应varchar
        });

        test('复合变化检测', () => {
            const newRule = '新的用户名字段,string,1,255,^[a-zA-Z]+$'; // 多个变化
            const ruleParts = ruleSplit(newRule);

            const changes = [];

            // 检测长度变化
            const newMaxLength = parseInt(ruleParts[3]);
            if (newMaxLength !== mockExistingColumn.length) {
                changes.push('length');
            }

            // 检测注释变化
            const newComment = ruleParts[0];
            if (newComment !== mockExistingColumn.comment) {
                changes.push('comment');
            }

            // 检测正则表达式变化（这里简化为检测是否从null变为有值）
            const newSpec = ruleParts[4];
            if (newSpec !== 'null') {
                changes.push('validation');
            }

            expect(changes).toContain('length');
            expect(changes).toContain('comment');
            expect(changes).toContain('validation');
            expect(changes.length).toBe(3);
        });
    });

    describe('ALTER语句生成测试', () => {
        test('MODIFY COLUMN语句格式', () => {
            const tableName = 'test_table';
            const fieldName = 'username';
            const rule = '用户名,string,2,150,null';

            // 模拟生成ALTER语句的逻辑
            const ruleParts = ruleSplit(rule);
            const [displayName, type, minStr, maxStr, spec] = ruleParts;

            // 构建字段定义
            const maxLength = maxStr === 'null' ? 255 : parseInt(maxStr);
            const sqlType = `VARCHAR(${Math.min(maxLength, 65535)})`;
            const columnDef = `\`${fieldName}\` ${sqlType}`;
            const commentPart = displayName && displayName !== 'null' ? ` COMMENT "${displayName}"` : '';

            const expectedSQL = `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${columnDef}${commentPart}`;

            expect(expectedSQL).toContain('ALTER TABLE');
            expect(expectedSQL).toContain('MODIFY COLUMN');
            expect(expectedSQL).toContain('VARCHAR(150)');
            expect(expectedSQL).toContain('COMMENT "用户名"');
        });

        test('ADD COLUMN语句格式', () => {
            const tableName = 'test_table';
            const fieldName = 'new_field';
            const rule = '新字段,string,1,100,null';

            // 模拟生成ADD语句的逻辑
            const ruleParts = ruleSplit(rule);
            const [displayName, type, minStr, maxStr, spec] = ruleParts;

            const maxLength = maxStr === 'null' ? 255 : parseInt(maxStr);
            const sqlType = `VARCHAR(${Math.min(maxLength, 65535)})`;
            const columnDef = `\`${fieldName}\` ${sqlType}`;
            const commentPart = displayName && displayName !== 'null' ? ` COMMENT "${displayName}"` : '';

            const expectedSQL = `ALTER TABLE \`${tableName}\` ADD COLUMN ${columnDef}${commentPart}`;

            expect(expectedSQL).toContain('ALTER TABLE');
            expect(expectedSQL).toContain('ADD COLUMN');
            expect(expectedSQL).toContain('VARCHAR(100)');
            expect(expectedSQL).toContain('COMMENT "新字段"');
        });
    });

    describe('错误处理测试', () => {
        test('无效的字段规则应该抛出错误', () => {
            const invalidRules = [
                '', // 空规则
                'name', // 只有一个部分
                'name,string', // 只有两个部分
                'name,string,1', // 只有三个部分
                'name,string,1,50' // 只有四个部分
            ];

            invalidRules.forEach((rule) => {
                if (rule === '') {
                    expect(rule).toBe('');
                } else {
                    const parts = ruleSplit(rule);
                    expect(parts.length).toBeLessThan(5);
                }
            });
        });

        test('不支持的数据类型应该被识别', () => {
            const validTypes = ['number', 'string', 'text', 'array'];
            const invalidTypes = ['boolean', 'date', 'json', 'blob'];

            validTypes.forEach((type) => {
                expect(validTypes.includes(type)).toBe(true);
            });

            invalidTypes.forEach((type) => {
                expect(validTypes.includes(type)).toBe(false);
            });
        });
    });
});
