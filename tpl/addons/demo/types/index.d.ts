/**
 * Demo Addon 类型定义
 */

declare global {
    namespace Befly {
        interface Context {
            /**
             * Demo 工具插件
             */
            'demo.tool'?: {
                /**
                 * 验证优先级
                 */
                validatePriority(priority: string): boolean;

                /**
                 * 格式化待办数据
                 */
                formatTodo(todo: any): {
                    id: number;
                    title: string;
                    content: string;
                    priority: string;
                    completed: boolean;
                    priorityLabel: string;
                    statusLabel: string;
                    createdAt: number;
                    createdAtFormatted: string;
                };

                /**
                 * 获取配置
                 */
                getConfig(): {
                    enabled: boolean;
                    defaultPriority: string;
                };
            };
        }
    }
}

/**
 * 待办事项数据结构
 */
export interface Todo {
    id: number;
    title: string;
    content: string;
    completed: number;
    priority: 'low' | 'medium' | 'high';
    createdAt: number;
}

export {};
