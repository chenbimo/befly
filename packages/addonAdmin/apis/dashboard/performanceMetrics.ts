import { Yes } from 'befly';

export default {
    name: '获取性能指标',
    handler: async (befly, ctx) => {
        // 实际项目中，这些数据应该从监控系统或日志中获取
        // 这里提供示例数据结构
        return befly.tool.Yes('获取成功', {
            avgResponseTime: 125,
            qps: 856,
            errorRate: 0.8,
            activeConnections: 45,
            slowestApi: {
                path: '/addon/admin/menuList',
                time: 450
            }
        });
    }
};
