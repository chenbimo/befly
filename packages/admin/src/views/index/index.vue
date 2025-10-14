<template>
    <div class="dashboard-container">
        <!-- 统计卡片区域 -->
        <t-row :gutter="16" class="stats-row">
            <t-col :xs="12" :sm="6" :md="6" :lg="6">
                <t-card hover-shadow class="stat-card stat-card-primary">
                    <div class="stat-card-content">
                        <div class="stat-icon">
                            <user-icon size="32px" />
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">总用户数</div>
                            <div class="stat-value">{{ $Data.stats.totalUsers }}</div>
                            <div class="stat-trend trend-up">
                                <chart-line-icon size="14px" />
                                较昨日 +{{ $Data.stats.userGrowth }}%
                            </div>
                        </div>
                    </div>
                </t-card>
            </t-col>

            <t-col :xs="12" :sm="6" :md="6" :lg="6">
                <t-card hover-shadow class="stat-card stat-card-success">
                    <div class="stat-card-content">
                        <div class="stat-icon">
                            <chart-line-icon size="32px" />
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">今日访问</div>
                            <div class="stat-value">{{ $Data.stats.todayVisits }}</div>
                            <div class="stat-trend trend-up">
                                <chart-line-icon size="14px" />
                                较昨日 +{{ $Data.stats.visitGrowth }}%
                            </div>
                        </div>
                    </div>
                </t-card>
            </t-col>

            <t-col :xs="12" :sm="6" :md="6" :lg="6">
                <t-card hover-shadow class="stat-card stat-card-warning">
                    <div class="stat-card-content">
                        <div class="stat-icon">
                            <shop-icon size="32px" />
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">订单数量</div>
                            <div class="stat-value">{{ $Data.stats.totalOrders }}</div>
                            <div class="stat-trend trend-down">
                                <chart-line-icon size="14px" />
                                较昨日 {{ $Data.stats.orderGrowth }}%
                            </div>
                        </div>
                    </div>
                </t-card>
            </t-col>

            <t-col :xs="12" :sm="6" :md="6" :lg="6">
                <t-card hover-shadow class="stat-card stat-card-danger">
                    <div class="stat-card-content">
                        <div class="stat-icon">
                            <money-icon size="32px" />
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">收入金额</div>
                            <div class="stat-value">¥{{ $Data.stats.totalRevenue }}</div>
                            <div class="stat-trend trend-up">
                                <chart-line-icon size="14px" />
                                较昨日 +{{ $Data.stats.revenueGrowth }}%
                            </div>
                        </div>
                    </div>
                </t-card>
            </t-col>
        </t-row>

        <!-- 图表和数据展示区域 -->
        <t-row :gutter="16" class="chart-row">
            <t-col :xs="24" :sm="24" :md="16" :lg="16">
                <t-card title="访问趋势" hover-shadow class="chart-card">
                    <template #actions>
                        <t-radio-group v-model="$Data.chartPeriod" variant="default-filled" size="small">
                            <t-radio-button value="week">近一周</t-radio-button>
                            <t-radio-button value="month">近一月</t-radio-button>
                            <t-radio-button value="year">近一年</t-radio-button>
                        </t-radio-group>
                    </template>
                    <div class="chart-placeholder">
                        <chart-line-icon size="64px" />
                        <p>访问趋势图表（可接入 ECharts 或其他图表库）</p>
                    </div>
                </t-card>
            </t-col>

            <t-col :xs="24" :sm="24" :md="8" :lg="8">
                <t-card title="快捷操作" hover-shadow class="quick-actions-card">
                    <t-space direction="vertical" style="width: 100%">
                        <t-button block theme="primary" @click="$Method.handleQuickAction('addUser')">
                            <template #icon>
                                <user-add-icon />
                            </template>
                            添加用户
                        </t-button>
                        <t-button block theme="success" @click="$Method.handleQuickAction('addContent')">
                            <template #icon>
                                <edit-icon />
                            </template>
                            发布内容
                        </t-button>
                        <t-button block theme="warning" @click="$Method.handleQuickAction('viewReports')">
                            <template #icon>
                                <chart-bar-icon />
                            </template>
                            查看报表
                        </t-button>
                        <t-button block theme="default" @click="$Method.handleQuickAction('settings')">
                            <template #icon>
                                <setting-icon />
                            </template>
                            系统设置
                        </t-button>
                    </t-space>
                </t-card>
            </t-col>
        </t-row>

        <!-- 最新动态和系统信息 -->
        <t-row :gutter="16" class="info-row">
            <t-col :xs="24" :sm="24" :md="12" :lg="12">
                <t-card title="最新动态" hover-shadow class="activity-card">
                    <t-list :split="true">
                        <t-list-item v-for="(item, index) in $Data.activities" :key="index">
                            <t-list-item-meta :image="item.avatar">
                                <template #title>{{ item.title }}</template>
                                <template #description>{{ item.time }}</template>
                            </t-list-item-meta>
                        </t-list-item>
                    </t-list>
                </t-card>
            </t-col>

            <t-col :xs="24" :sm="24" :md="12" :lg="12">
                <t-card title="系统信息" hover-shadow class="system-info-card">
                    <t-descriptions bordered>
                        <t-descriptions-item label="系统名称">Befly Admin</t-descriptions-item>
                        <t-descriptions-item label="版本号">v1.0.0</t-descriptions-item>
                        <t-descriptions-item label="框架">Vue 3 + TypeScript</t-descriptions-item>
                        <t-descriptions-item label="UI 组件">TDesign Vue Next</t-descriptions-item>
                        <t-descriptions-item label="构建工具">Vite 5</t-descriptions-item>
                        <t-descriptions-item label="后端框架">Befly API</t-descriptions-item>
                        <t-descriptions-item label="运行时">Bun</t-descriptions-item>
                        <t-descriptions-item label="数据库">MySQL 8</t-descriptions-item>
                    </t-descriptions>

                    <div class="tech-stack">
                        <t-space>
                            <t-tag theme="primary" variant="outline">Vue 3</t-tag>
                            <t-tag theme="success" variant="outline">TypeScript</t-tag>
                            <t-tag theme="warning" variant="outline">TDesign</t-tag>
                            <t-tag theme="danger" variant="outline">Vite</t-tag>
                            <t-tag theme="primary" variant="outline">Befly</t-tag>
                            <t-tag theme="success" variant="outline">Bun</t-tag>
                        </t-space>
                    </div>
                </t-card>
            </t-col>
        </t-row>
    </div>
</template>

<script setup lang="ts">
import { UserIcon, ChartLineIcon, ShopIcon, MoneyIcon, UserAddIcon, EditIcon, ChartBarIcon, SettingIcon } from 'tdesign-icons-vue-next';

// 响应式数据
const $Data = $ref({
    // 统计数据
    stats: {
        totalUsers: 1234,
        userGrowth: 12.5,
        todayVisits: 567,
        visitGrowth: 8.3,
        totalOrders: 89,
        orderGrowth: -3.2,
        totalRevenue: '12,345',
        revenueGrowth: 15.8
    },
    // 图表周期
    chartPeriod: 'week',
    // 最新动态
    activities: [
        {
            avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
            title: '用户 张三 注册了账号',
            time: '5分钟前'
        },
        {
            avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
            title: '管理员 李四 发布了新内容',
            time: '1小时前'
        },
        {
            avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
            title: '系统完成了数据备份',
            time: '2小时前'
        },
        {
            avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
            title: '新订单 #12345 已创建',
            time: '3小时前'
        }
    ]
});

// 方法集合
const $Method = {
    // 处理快捷操作
    handleQuickAction(action: string) {
        MessagePlugin.info(`执行操作: ${action}`);
        // 这里可以根据不同的 action 跳转到不同的页面或执行不同的操作
    }
};
</script>

<style scoped lang="scss">
.dashboard-container {
    padding: 16px;
    background: var(--td-bg-color-container);
    min-height: 100%;
}

// 统计卡片行
.stats-row {
    margin-bottom: 16px;
}

// 统计卡片样式
.stat-card {
    border-radius: 8px;
    overflow: hidden;

    :deep(.t-card__body) {
        padding: 0;
    }

    .stat-card-content {
        display: flex;
        align-items: center;
        padding: 24px;
        gap: 16px;
    }

    .stat-icon {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .stat-info {
        flex: 1;
        min-width: 0;
    }

    .stat-title {
        font-size: 14px;
        color: var(--td-text-color-secondary);
        margin-bottom: 8px;
    }

    .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: var(--td-text-color-primary);
        margin-bottom: 6px;
        line-height: 1.2;
    }

    .stat-trend {
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;

        &.trend-up {
            color: var(--td-success-color);
        }

        &.trend-down {
            color: var(--td-error-color);
        }
    }

    // 不同主题的卡片
    &.stat-card-primary .stat-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }

    &.stat-card-success .stat-icon {
        background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
        color: white;
    }

    &.stat-card-warning .stat-icon {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
    }

    &.stat-card-danger .stat-icon {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        color: white;
    }
}

// 图表行
.chart-row {
    margin-bottom: 16px;
}

.chart-card {
    .chart-placeholder {
        height: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--td-text-color-placeholder);
        background: var(--td-bg-color-component);
        border-radius: 4px;

        p {
            margin-top: 16px;
            font-size: 14px;
        }
    }
}

.quick-actions-card {
    height: 100%;

    :deep(.t-card__body) {
        height: calc(100% - 56px);
        display: flex;
        align-items: center;
    }
}

// 信息行
.info-row {
    margin-bottom: 16px;
}

.activity-card {
    :deep(.t-list-item) {
        padding: 12px 0;
    }
}

.system-info-card {
    .tech-stack {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--td-component-border);
    }
}

// 响应式布局
@media (max-width: 768px) {
    .dashboard-container {
        padding: 12px;
    }

    .stat-card {
        .stat-card-content {
            padding: 16px;
        }

        .stat-icon {
            width: 48px;
            height: 48px;
        }

        .stat-value {
            font-size: 24px;
        }
    }

    .chart-card .chart-placeholder {
        height: 200px;
    }
}
</style>
