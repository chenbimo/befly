/**
 * 正则表达式别名测试
 */
import { describe, expect, it } from 'bun:test';

import { getRegex, matchRegex, RegexAliases } from '../src/regex.js';

describe('RegexAliases - 正则别名常量', () => {
    describe('数字类型', () => {
        it('number - 正整数', () => {
            expect(new RegExp(RegexAliases.number).test('123')).toBe(true);
            expect(new RegExp(RegexAliases.number).test('0')).toBe(true);
            expect(new RegExp(RegexAliases.number).test('-123')).toBe(false);
            expect(new RegExp(RegexAliases.number).test('12.3')).toBe(false);
        });

        it('integer - 整数（含负数）', () => {
            expect(new RegExp(RegexAliases.integer).test('123')).toBe(true);
            expect(new RegExp(RegexAliases.integer).test('-123')).toBe(true);
            expect(new RegExp(RegexAliases.integer).test('0')).toBe(true);
        });

        it('float - 浮点数', () => {
            expect(new RegExp(RegexAliases.float).test('12.34')).toBe(true);
            expect(new RegExp(RegexAliases.float).test('-12.34')).toBe(true);
            expect(new RegExp(RegexAliases.float).test('123')).toBe(true);
        });

        it('positive - 正整数（不含0）', () => {
            expect(new RegExp(RegexAliases.positive).test('123')).toBe(true);
            expect(new RegExp(RegexAliases.positive).test('0')).toBe(false);
            expect(new RegExp(RegexAliases.positive).test('-1')).toBe(false);
        });
    });

    describe('字符串类型', () => {
        it('word - 纯字母', () => {
            expect(new RegExp(RegexAliases.word).test('Hello')).toBe(true);
            expect(new RegExp(RegexAliases.word).test('Hello123')).toBe(false);
        });

        it('alphanumeric - 字母和数字', () => {
            expect(new RegExp(RegexAliases.alphanumeric).test('Hello123')).toBe(true);
            expect(new RegExp(RegexAliases.alphanumeric).test('Hello_123')).toBe(false);
        });

        it('alphanumericUnderscore - 字母、数字和下划线', () => {
            expect(new RegExp(RegexAliases.alphanumericUnderscore).test('Hello_123')).toBe(true);
            expect(new RegExp(RegexAliases.alphanumericUnderscore).test('Hello-123')).toBe(false);
        });
    });

    describe('中文', () => {
        it('chinese - 纯中文', () => {
            expect(new RegExp(RegexAliases.chinese).test('你好')).toBe(true);
            expect(new RegExp(RegexAliases.chinese).test('你好World')).toBe(false);
        });

        it('chineseWord - 中文和字母', () => {
            expect(new RegExp(RegexAliases.chineseWord).test('你好World')).toBe(true);
            expect(new RegExp(RegexAliases.chineseWord).test('你好123')).toBe(false);
        });
    });

    describe('常用格式', () => {
        it('email - 邮箱地址', () => {
            expect(new RegExp(RegexAliases.email).test('test@example.com')).toBe(true);
            expect(new RegExp(RegexAliases.email).test('test.name@example.co.uk')).toBe(true);
            expect(new RegExp(RegexAliases.email).test('invalid-email')).toBe(false);
        });

        it('phone - 中国大陆手机号', () => {
            expect(new RegExp(RegexAliases.phone).test('13812345678')).toBe(true);
            expect(new RegExp(RegexAliases.phone).test('12345678901')).toBe(false);
            expect(new RegExp(RegexAliases.phone).test('1381234567')).toBe(false);
        });

        it('url - URL 地址', () => {
            expect(new RegExp(RegexAliases.url).test('https://example.com')).toBe(true);
            expect(new RegExp(RegexAliases.url).test('http://example.com')).toBe(true);
            expect(new RegExp(RegexAliases.url).test('ftp://example.com')).toBe(false);
        });

        it('ip - IPv4 地址', () => {
            expect(new RegExp(RegexAliases.ip).test('192.168.1.1')).toBe(true);
            expect(new RegExp(RegexAliases.ip).test('255.255.255.255')).toBe(true);
            expect(new RegExp(RegexAliases.ip).test('256.1.1.1')).toBe(false);
        });
    });

    describe('特殊格式', () => {
        it('uuid - UUID', () => {
            expect(new RegExp(RegexAliases.uuid).test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(new RegExp(RegexAliases.uuid).test('invalid-uuid')).toBe(false);
        });

        it('md5 - MD5 哈希', () => {
            expect(new RegExp(RegexAliases.md5).test('d41d8cd98f00b204e9800998ecf8427e')).toBe(true);
            expect(new RegExp(RegexAliases.md5).test('invalid')).toBe(false);
        });
    });

    describe('日期时间', () => {
        it('date - 日期 YYYY-MM-DD', () => {
            expect(new RegExp(RegexAliases.date).test('2024-01-15')).toBe(true);
            expect(new RegExp(RegexAliases.date).test('2024/01/15')).toBe(false);
        });

        it('time - 时间 HH:MM:SS', () => {
            expect(new RegExp(RegexAliases.time).test('12:30:45')).toBe(true);
            expect(new RegExp(RegexAliases.time).test('12:30')).toBe(false);
        });
    });

    describe('代码相关', () => {
        it('variable - 变量名', () => {
            expect(new RegExp(RegexAliases.variable).test('myVar')).toBe(true);
            expect(new RegExp(RegexAliases.variable).test('_private')).toBe(true);
            expect(new RegExp(RegexAliases.variable).test('123var')).toBe(false);
        });

        it('constant - 常量名', () => {
            expect(new RegExp(RegexAliases.constant).test('MY_CONST')).toBe(true);
            expect(new RegExp(RegexAliases.constant).test('myConst')).toBe(false);
        });
    });

    describe('证件相关', () => {
        it('idCard - 中国身份证号', () => {
            expect(new RegExp(RegexAliases.idCard).test('11010119900101001X')).toBe(true);
            expect(new RegExp(RegexAliases.idCard).test('110101199001010019')).toBe(true);
            expect(new RegExp(RegexAliases.idCard).test('1234567890')).toBe(false);
        });
    });
});

describe('getRegex - 获取正则表达式', () => {
    it('以 @ 开头返回别名对应的正则', () => {
        expect(getRegex('@email')).toBe(RegexAliases.email);
        expect(getRegex('@phone')).toBe(RegexAliases.phone);
    });

    it('未知别名返回原字符串', () => {
        expect(getRegex('@unknown')).toBe('@unknown');
    });

    it('不以 @ 开头返回原字符串', () => {
        expect(getRegex('^\\d+$')).toBe('^\\d+$');
    });
});

describe('matchRegex - 验证值是否匹配', () => {
    it('使用别名验证', () => {
        expect(matchRegex('test@example.com', '@email')).toBe(true);
        expect(matchRegex('invalid', '@email')).toBe(false);
    });

    it('使用自定义正则验证', () => {
        expect(matchRegex('123', '^\\d+$')).toBe(true);
        expect(matchRegex('abc', '^\\d+$')).toBe(false);
    });

    it('手机号验证', () => {
        expect(matchRegex('13812345678', '@phone')).toBe(true);
        expect(matchRegex('12345678901', '@phone')).toBe(false);
    });
});

describe('RegexAliases - 新增正则别名', () => {
    describe('账号相关', () => {
        it('bankCard - 银行卡号', () => {
            expect(new RegExp(RegexAliases.bankCard).test('6222020111122223333')).toBe(true);
            expect(new RegExp(RegexAliases.bankCard).test('622202011112222')).toBe(false); // 15位太短
            expect(new RegExp(RegexAliases.bankCard).test('62220201111222233334444')).toBe(false); // 20位太长
        });

        it('wechat - 微信号', () => {
            expect(new RegExp(RegexAliases.wechat).test('abc123')).toBe(true);
            expect(new RegExp(RegexAliases.wechat).test('test_user-1')).toBe(true);
            expect(new RegExp(RegexAliases.wechat).test('123abc')).toBe(false); // 数字开头
            expect(new RegExp(RegexAliases.wechat).test('ab')).toBe(false); // 太短
        });

        it('qq - QQ号', () => {
            expect(new RegExp(RegexAliases.qq).test('12345')).toBe(true);
            expect(new RegExp(RegexAliases.qq).test('123456789')).toBe(true);
            expect(new RegExp(RegexAliases.qq).test('01234')).toBe(false); // 0开头
            expect(new RegExp(RegexAliases.qq).test('1234')).toBe(false); // 太短
        });

        it('alipay - 支付宝账号', () => {
            expect(new RegExp(RegexAliases.alipay).test('13812345678')).toBe(true);
            expect(new RegExp(RegexAliases.alipay).test('test@example.com')).toBe(true);
        });
    });

    describe('密码强度', () => {
        it('passwordWeak - 弱密码', () => {
            expect(new RegExp(RegexAliases.passwordWeak).test('123456')).toBe(true);
            expect(new RegExp(RegexAliases.passwordWeak).test('12345')).toBe(false);
        });

        it('passwordMedium - 中等密码', () => {
            expect(new RegExp(RegexAliases.passwordMedium).test('abc12345')).toBe(true);
            expect(new RegExp(RegexAliases.passwordMedium).test('12345678')).toBe(false); // 无字母
        });

        it('passwordStrong - 强密码', () => {
            expect(new RegExp(RegexAliases.passwordStrong).test('Abc12345!')).toBe(true);
            expect(new RegExp(RegexAliases.passwordStrong).test('abc12345!')).toBe(false); // 无大写
        });
    });

    describe('其他常用', () => {
        it('postalCode - 邮政编码', () => {
            expect(new RegExp(RegexAliases.postalCode).test('518000')).toBe(true);
            expect(new RegExp(RegexAliases.postalCode).test('51800')).toBe(false);
        });

        it('semver - 语义化版本号', () => {
            expect(new RegExp(RegexAliases.semver).test('1.0.0')).toBe(true);
            expect(new RegExp(RegexAliases.semver).test('1.0.0-beta.1')).toBe(true);
            expect(new RegExp(RegexAliases.semver).test('1.0.0+build.123')).toBe(true);
            expect(new RegExp(RegexAliases.semver).test('v1.0.0')).toBe(false);
        });

        it('colorHex - 十六进制颜色', () => {
            expect(new RegExp(RegexAliases.colorHex).test('#fff')).toBe(true);
            expect(new RegExp(RegexAliases.colorHex).test('#ffffff')).toBe(true);
            expect(new RegExp(RegexAliases.colorHex).test('#FFFFFF')).toBe(true);
            expect(new RegExp(RegexAliases.colorHex).test('ffffff')).toBe(false);
        });

        it('ipv6 - IPv6 地址', () => {
            expect(new RegExp(RegexAliases.ipv6).test('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
            expect(new RegExp(RegexAliases.ipv6).test('192.168.1.1')).toBe(false);
        });

        it('username - 用户名', () => {
            expect(new RegExp(RegexAliases.username).test('admin123')).toBe(true);
            expect(new RegExp(RegexAliases.username).test('test_user')).toBe(true);
            expect(new RegExp(RegexAliases.username).test('123admin')).toBe(false); // 数字开头
            expect(new RegExp(RegexAliases.username).test('abc')).toBe(false); // 太短
        });

        it('nickname - 昵称', () => {
            expect(new RegExp(RegexAliases.nickname).test('用户昵称')).toBe(true);
            expect(new RegExp(RegexAliases.nickname).test('test123')).toBe(true);
            expect(new RegExp(RegexAliases.nickname).test('a')).toBe(false); // 太短
        });

        it('licensePlate - 车牌号', () => {
            expect(new RegExp(RegexAliases.licensePlate).test('京A12345')).toBe(true);
            expect(new RegExp(RegexAliases.licensePlate).test('粤B88888')).toBe(true);
        });
    });
});

describe('正则缓存功能', () => {
    // 导入缓存相关函数
    const { getCompiledRegex, clearRegexCache, getRegexCacheSize } = require('../src/regex.js');

    it('getCompiledRegex - 返回 RegExp 对象', () => {
        const regex = getCompiledRegex('@email');
        expect(regex).toBeInstanceOf(RegExp);
        expect(regex.test('test@example.com')).toBe(true);
    });

    it('getCompiledRegex - 缓存命中返回相同对象', () => {
        clearRegexCache();
        const regex1 = getCompiledRegex('@phone');
        const regex2 = getCompiledRegex('@phone');
        expect(regex1).toBe(regex2); // 同一个对象
    });

    it('getCompiledRegex - 支持 flags 参数', () => {
        const regexI = getCompiledRegex('^hello$', 'i');
        expect(regexI.test('HELLO')).toBe(true);

        const regexNoFlag = getCompiledRegex('^hello$');
        expect(regexNoFlag.test('HELLO')).toBe(false);
    });

    it('clearRegexCache - 清除缓存', () => {
        getCompiledRegex('@email');
        expect(getRegexCacheSize()).toBeGreaterThan(0);
        clearRegexCache();
        expect(getRegexCacheSize()).toBe(0);
    });

    it('缓存性能 - 避免重复编译', () => {
        clearRegexCache();
        const pattern = '@email';

        // 验证缓存命中时返回相同对象
        const regex1 = getCompiledRegex(pattern);
        const regex2 = getCompiledRegex(pattern);
        expect(regex1).toBe(regex2);

        // 验证缓存大小
        expect(getRegexCacheSize()).toBe(1);

        // 添加更多缓存
        getCompiledRegex('@phone');
        getCompiledRegex('@url');
        expect(getRegexCacheSize()).toBe(3);
    });
});
