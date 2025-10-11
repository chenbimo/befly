/**
 * Demo Addon 工具插件
 * 提供待办事项相关的工具函数
 */

import type { BeflyPlugin, BeflyContext } from 'befly/types';
import { Logger } from 'befly/utils/logger';

export default {
    name: 'tool',
    version: '1.0.0',
    priority: 100,

    async onLoad(befly: BeflyContext) {
        Logger.info('[Demo] 工具插件加载中...');
    },

    async onInit(befly: BeflyContext) {
        Logger.info('[Demo] 工具插件初始化中...');

        return {
            /**
             * 验证优先级
             */
            validatePriority(priority: string): boolean {
                return ['low', 'medium', 'high'].includes(priority);
            },

            /**
             * 格式化待办数据
             */
            formatTodo(todo: any) {
                return {
                    id: todo.id,
                    title: todo.title,
                    content: todo.content,
                    priority: todo.priority,
                    completed: Boolean(todo.completed),
                    priorityLabel:
                        {
                            low: '低',
                            medium: '中',
                            high: '高'
                        }[todo.priority] || '未知',
                    statusLabel: todo.completed ? '已完成' : '未完成',
                    createdAt: todo.createdAt,
                    createdAtFormatted: new Date(Number(todo.createdAt)).toLocaleString('zh-CN')
                };
            },

            /**
             * 获取配置
             */
            getConfig() {
                return {
                    enabled: process.env.DEMO_ENABLE !== 'false',
                    defaultPriority: process.env.DEMO_DEFAULT_PRIORITY || 'medium'
                };
            }
        };
    }
} as BeflyPlugin;
