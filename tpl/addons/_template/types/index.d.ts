/**
 * Addon 类型定义
 */

declare global {
    namespace Befly {
        interface Context {
            // 扩展 befly 对象的类型
            // 示例：如果插件名是 payment.alipay
            // 'payment.alipay'?: {
            //     createOrder: (params: any) => Promise<string>;
            //     config: {
            //         appId: string;
            //         timeout: number;
            //     };
            // };
        }
    }
}

export {};
