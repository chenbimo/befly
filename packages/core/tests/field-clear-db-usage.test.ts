import { describe, expect, test } from 'bun:test';

/**
 * fieldClear 在数据库场景中的使用测试
 */
import { fieldClear } from '../utils/util.js';

describe('fieldClear 在数据库操作中的应用', () => {
    // ========================================
    // insData 数据清理测试
    // ========================================

    test('insData：清理插入数据中的 null 和 undefined', () => {
        const data = {
            name: 'John',
            email: 'john@example.com',
            age: null,
            bio: undefined,
            avatar: ''
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            name: 'John',
            email: 'john@example.com',
            avatar: ''
        });
    });

    test('insData：保留空字符串和 0 值', () => {
        const data = {
            name: 'John',
            description: '',
            price: 0,
            stock: null
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            name: 'John',
            description: '',
            price: 0
        });
    });

    // ========================================
    // updData 数据清理测试
    // ========================================

    test('updData：清理更新数据中的 null 和 undefined', () => {
        const data = {
            name: 'John Updated',
            email: null,
            age: undefined,
            status: 1
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            name: 'John Updated',
            status: 1
        });
    });

    test('updData：允许更新为空字符串和 0', () => {
        const data = {
            description: '',
            price: 0,
            note: null
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            description: '',
            price: 0
        });
    });

    // ========================================
    // where 条件清理测试
    // ========================================

    test('where：清理查询条件中的 null 和 undefined', () => {
        const where = {
            userId: 123,
            categoryId: null,
            status: undefined,
            name: 'test'
        };

        const cleanWhere = fieldClear(where, [null, undefined], {});

        expect(cleanWhere).toEqual({
            userId: 123,
            name: 'test'
        });
    });

    test('where：保留 0、false、空字符串等有效查询值', () => {
        const where = {
            userId: 123,
            status: 0,
            enabled: false,
            keyword: '',
            categoryId: null
        };

        const cleanWhere = fieldClear(where, [null, undefined], {});

        expect(cleanWhere).toEqual({
            userId: 123,
            status: 0,
            enabled: false,
            keyword: ''
        });
    });

    test('where：保留操作符条件', () => {
        const where = {
            userId$gt: 100,
            status$in: [0, 1, 2],
            name$like: '%test%',
            age$gte: null,
            price$lte: undefined
        };

        const cleanWhere = fieldClear(where, [null, undefined], {});

        expect(cleanWhere).toEqual({
            userId$gt: 100,
            status$in: [0, 1, 2],
            name$like: '%test%'
        });
    });

    // ========================================
    // 实际场景测试
    // ========================================

    test('场景1：用户注册 - 清理可选字段', () => {
        const registerData = {
            username: 'john',
            email: 'john@example.com',
            password: 'hashed_password',
            avatar: null,
            bio: undefined,
            phone: ''
        };

        const cleanData = fieldClear(registerData, [null, undefined], {});

        expect(cleanData).toEqual({
            username: 'john',
            email: 'john@example.com',
            password: 'hashed_password',
            phone: ''
        });
    });

    test('场景2：用户更新 - 只更新提供的字段', () => {
        const updateData = {
            username: 'john_updated',
            email: null, // 不更新邮箱
            avatar: undefined, // 不更新头像
            bio: 'New bio'
        };

        const cleanData = fieldClear(updateData, [null, undefined], {});

        expect(cleanData).toEqual({
            username: 'john_updated',
            bio: 'New bio'
        });
    });

    test('场景3：商品搜索 - 清理空的搜索条件', () => {
        const searchWhere = {
            keyword: 'laptop',
            categoryId: null,
            minPrice: 0,
            maxPrice: null,
            inStock: true,
            brandId: undefined
        };

        const cleanWhere = fieldClear(searchWhere, [null, undefined], {});

        expect(cleanWhere).toEqual({
            keyword: 'laptop',
            minPrice: 0,
            inStock: true
        });
    });

    test('场景4：订单查询 - 保留状态 0（待支付）', () => {
        const orderWhere = {
            userId: 123,
            status: 0, // 0 表示待支付，是有效值
            paymentMethod: null,
            shippingAddress: undefined
        };

        const cleanWhere = fieldClear(orderWhere, [null, undefined], {});

        expect(cleanWhere).toEqual({
            userId: 123,
            status: 0
        });
    });

    test('场景5：商品更新 - 允许价格为 0（免费商品）', () => {
        const productData = {
            name: 'Free Sample',
            price: 0, // 免费商品
            stock: 100,
            description: null,
            images: undefined
        };

        const cleanData = fieldClear(productData, [null, undefined], {});

        expect(cleanData).toEqual({
            name: 'Free Sample',
            price: 0,
            stock: 100
        });
    });

    test('场景6：表单提交 - 区分未填写和清空', () => {
        const formData = {
            title: 'Article',
            content: 'Content here',
            summary: '', // 明确清空（保留）
            tags: null, // 未填写（排除）
            author: undefined // 未填写（排除）
        };

        const cleanData = fieldClear(formData, [null, undefined], {});

        expect(cleanData).toEqual({
            title: 'Article',
            content: 'Content here',
            summary: ''
        });
    });

    test('场景7：复杂查询条件 - 混合操作符和普通条件', () => {
        const complexWhere = {
            userId: 123,
            status$in: [1, 2, 3],
            createdAt$gte: 1697452800000,
            deletedAt: null, // 排除
            updatedBy: undefined, // 排除
            price$lte: 0, // 保留（查询价格小于等于 0 的商品）
            keyword$like: '' // 保留空字符串
        };

        const cleanWhere = fieldClear(complexWhere, [null, undefined], {});

        expect(cleanWhere).toEqual({
            userId: 123,
            status$in: [1, 2, 3],
            createdAt$gte: 1697452800000,
            price$lte: 0,
            keyword$like: ''
        });
    });

    test('场景8：批量更新 - 只更新非空字段', () => {
        const batchUpdateData = {
            status: 1,
            approvedBy: 123,
            approvedAt: Date.now(),
            rejectReason: null, // 不设置拒绝原因
            note: undefined // 不设置备注
        };

        const cleanData = fieldClear(batchUpdateData, [null, undefined], {});

        expect(cleanData).toEqual({
            status: 1,
            approvedBy: 123,
            approvedAt: batchUpdateData.approvedAt
        });
    });

    // ========================================
    // 边界情况测试
    // ========================================

    test('边界：空对象输入返回空对象', () => {
        const cleanData = fieldClear({}, [null, undefined], {});
        expect(cleanData).toEqual({});
    });

    test('边界：只有 null 和 undefined 的对象', () => {
        const data = {
            a: null,
            b: undefined,
            c: null
        };

        const cleanData = fieldClear(data, [null, undefined], {});
        expect(cleanData).toEqual({});
    });

    test('边界：保留 false 和 0', () => {
        const data = {
            enabled: false,
            count: 0,
            deleted: null
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            enabled: false,
            count: 0
        });
    });

    test('边界：数组字段保留', () => {
        const data = {
            tags: ['tag1', 'tag2'],
            categories: [],
            authors: null
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            tags: ['tag1', 'tag2'],
            categories: []
        });
    });

    test('边界：对象字段保留', () => {
        const data = {
            meta: { key: 'value' },
            config: {},
            settings: null
        };

        const cleanData = fieldClear(data, [null, undefined], {});

        expect(cleanData).toEqual({
            meta: { key: 'value' },
            config: {}
        });
    });
});
