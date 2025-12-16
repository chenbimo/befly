<template>
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-left">
                <h1 class="title">欢迎回来，管理员</h1>
                <p class="subtitle">这里是您的后台管理中心</p>
            </div>
            <div class="header-right">
                <div class="date-info">
                    <span class="date">{{ currentDate }}</span>
                    <span class="time">{{ currentTime }}</span>
                </div>
                <div class="user-info">
                    <t-avatar :size="40" src="https://picsum.photos/id/1005/100/100"></t-avatar>
                    <span class="username">管理员</span>
                </div>
            </div>
        </div>

        <!-- 统计卡片 -->
        <div class="stats-grid">
            <t-card class="stat-card">
                <div class="stat-content">
                    <div class="stat-left">
                        <div class="stat-value">12,345</div>
                        <div class="stat-label">总用户数</div>
                    </div>
                    <div class="stat-right">
                        <ILucideUser class="stat-icon" size="24" />
                    </div>
                </div>
                <div class="stat-footer">
                    <span class="growth positive">+5.2% <ILucideChevronUp /></span>
                    <span class="period">较上月</span>
                </div>
            </t-card>

            <t-card class="stat-card">
                <div class="stat-content">
                    <div class="stat-left">
                        <div class="stat-value">¥98,765</div>
                        <div class="stat-label">总销售额</div>
                    </div>
                    <div class="stat-right">
                        <ILucideDollarSign class="stat-icon" size="24" />
                    </div>
                </div>
                <div class="stat-footer">
                    <span class="growth positive">+12.8% <ILucideChevronUp /></span>
                    <span class="period">较上月</span>
                </div>
            </t-card>

            <t-card class="stat-card">
                <div class="stat-content">
                    <div class="stat-left">
                        <div class="stat-value">456</div>
                        <div class="stat-label">今日订单</div>
                    </div>
                    <div class="stat-right">
                        <ILucideShoppingCart class="stat-icon" size="24" />
                    </div>
                </div>
                <div class="stat-footer">
                    <span class="growth negative">-2.1% <ILucideChevronDown /></span>
                    <span class="period">较昨日</span>
                </div>
            </t-card>

            <t-card class="stat-card">
                <div class="stat-content">
                    <div class="stat-left">
                        <div class="stat-value">789</div>
                        <div class="stat-label">活跃用户</div>
                    </div>
                    <div class="stat-right">
                        <ILucideBell class="stat-icon" size="24" />
                    </div>
                </div>
                <div class="stat-footer">
                    <span class="growth positive">+8.5% <ILucideChevronUp /></span>
                    <span class="period">较昨日</span>
                </div>
            </t-card>
        </div>

        <!-- 图表区域 -->
        <div class="charts-grid">
            <t-card class="chart-card">
                <template #header>
                    <div class="card-header">
                        <span>月度销售趋势</span>
                        <t-select v-model="salesPeriod" :style="{ width: '120px' }" size="small">
                            <t-option label="本月" value="month" />
                            <t-option label="季度" value="quarter" />
                            <t-option label="年度" value="year" />
                        </t-select>
                    </div>
                </template>
                <div class="chart-container">
                    <div ref="salesChartRef" class="chart" style="height: 300px"></div>
                </div>
            </t-card>

            <t-card class="chart-card">
                <template #header>
                    <div class="card-header">
                        <span>产品销售分布</span>
                        <t-button theme="primary" size="small">查看详情</t-button>
                    </div>
                </template>
                <div class="chart-container">
                    <div ref="productChartRef" class="chart" style="height: 300px"></div>
                </div>
            </t-card>
        </div>

        <!-- 信息区域 -->
        <div class="info-grid">
            <t-card class="info-card">
                <template #header>
                    <div class="card-header">
                        <span>最近活动</span>
                        <t-link theme="primary" size="small">查看全部</t-link>
                    </div>
                </template>
                <div class="activity-list">
                    <div class="activity-item" v-for="item in activities" :key="item.id">
                        <t-avatar :size="40" :src="item.avatar" class="activity-avatar"></t-avatar>
                        <div class="activity-content">
                            <div class="activity-text">
                                <strong>{{ item.user }}</strong> {{ item.action }}
                                <span class="activity-time">{{ item.time }}</span>
                            </div>
                            <div class="activity-desc">{{ item.description }}</div>
                        </div>
                        <t-tag :theme="item.status" size="small">{{ item.status }}</t-tag>
                    </div>
                </div>
            </t-card>

            <t-card class="info-card">
                <template #header>
                    <div class="card-header">
                        <span>任务进度</span>
                        <t-button theme="success" size="small">添加任务</t-button>
                    </div>
                </template>
                <div class="task-list">
                    <div class="task-item" v-for="task in tasks" :key="task.id">
                        <div class="task-header">
                            <span class="task-title">{{ task.title }}</span>
                            <span class="task-deadline">{{ task.deadline }}</span>
                        </div>
                        <div class="task-progress">
                            <t-progress :percentage="task.progress" :color="task.color" :stroke="8" />
                        </div>
                        <div class="task-meta">
                            <t-tag size="small">{{ task.assignee }}</t-tag>
                            <t-tag :theme="task.priority" size="small">{{ task.priority }}</t-tag>
                        </div>
                    </div>
                </div>
            </t-card>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Card as TCard, Select as TSelect, Option as TOption, Button as TButton, Avatar as TAvatar, Tag as TTag, Progress as TProgress, Link as TLink } from "tdesign-vue-next";
import ILucideUser from "~icons/lucide/user";
import ILucideDollarSign from "~icons/lucide/dollar-sign";
import ILucideShoppingCart from "~icons/lucide/shopping-cart";
import ILucideBell from "~icons/lucide/bell";
import ILucideChevronUp from "~icons/lucide/chevron-up";
import ILucideChevronDown from "~icons/lucide/chevron-down";
import * as echarts from "echarts";

const currentDate = ref(new Date().toLocaleDateString("zh-CN"));
const currentTime = ref(new Date().toLocaleTimeString("zh-CN"));

// 时间更新
let timeInterval: number | null = null;

onMounted(() => {
    timeInterval = window.setInterval(() => {
        currentDate.value = new Date().toLocaleDateString("zh-CN");
        currentTime.value = new Date().toLocaleTimeString("zh-CN");
    }, 1000);

    initSalesChart();
    initProductChart();
});

onUnmounted(() => {
    if (timeInterval) {
        clearInterval(timeInterval);
    }
});

// 销售图表
const salesChartRef = ref<HTMLElement | null>(null);
const salesPeriod = ref("month");

const initSalesChart = () => {
    if (!salesChartRef.value) return;

    const chart = echarts.init(salesChartRef.value);

    const option = {
        tooltip: {
            trigger: "axis",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderColor: "#e0e0e0",
            borderWidth: 1,
            textStyle: { color: "#333" }
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: ["1日", "2日", "3日", "4日", "5日", "6日", "7日", "8日", "9日", "10日", "11日", "12日", "13日", "14日", "15日"],
            axisLine: { lineStyle: { color: "#f0f0f0" } },
            axisTick: { show: false }
        },
        yAxis: {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: "#f0f0f0" } }
        },
        series: [
            {
                name: "销售额",
                type: "line",
                smooth: true,
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: "rgba(64, 158, 255, 0.5)" },
                        { offset: 1, color: "rgba(64, 158, 255, 0.05)" }
                    ])
                },
                lineStyle: { color: "#409EFF", width: 3 },
                itemStyle: { color: "#409EFF" },
                data: [12000, 21348, 18900, 23400, 29000, 33000, 27800, 25600, 34900, 31000, 38000, 36400, 40000, 38700, 42300]
            }
        ]
    };

    chart.setOption(option);

    // 响应式
    window.addEventListener("resize", () => {
        chart.resize();
    });
};

// 产品图表
const productChartRef = ref<HTMLElement | null>(null);

const initProductChart = () => {
    if (!productChartRef.value) return;

    const chart = echarts.init(productChartRef.value);

    const option = {
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderColor: "#e0e0e0",
            borderWidth: 1,
            textStyle: { color: "#333" }
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true
        },
        xAxis: {
            type: "category",
            data: ["产品A", "产品B", "产品C", "产品D", "产品E", "产品F"],
            axisLine: { lineStyle: { color: "#f0f0f0" } },
            axisTick: { show: false }
        },
        yAxis: {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: "#f0f0f0" } }
        },
        series: [
            {
                name: "销售量",
                type: "bar",
                barWidth: "60%",
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: "#67C23A" },
                        { offset: 1, color: "#E6F7FF" }
                    ]),
                    borderRadius: [4, 4, 0, 0]
                },
                data: [120, 200, 150, 80, 70, 110]
            }
        ]
    };

    chart.setOption(option);

    // 响应式
    window.addEventListener("resize", () => {
        chart.resize();
    });
};

// 模拟数据
const activities = [
    {
        id: 1,
        user: "张三",
        action: "完成了订单",
        time: "10分钟前",
        description: "订单号：#20230415001，金额¥1299.00",
        status: "success",
        avatar: "https://picsum.photos/id/1005/100/100"
    },
    {
        id: 2,
        user: "李四",
        action: "添加了新用户",
        time: "30分钟前",
        description: "用户邮箱：user@example.com，角色：管理员",
        status: "info",
        avatar: "https://picsum.photos/id/1006/100/100"
    },
    {
        id: 3,
        user: "王五",
        action: "修改了产品",
        time: "1小时前",
        description: "产品名称：智能手表，价格调整为¥1599.00",
        status: "warning",
        avatar: "https://picsum.photos/id/1007/100/100"
    },
    {
        id: 4,
        user: "赵六",
        action: "删除了日志",
        time: "2小时前",
        description: "删除了2023-04-14的系统日志",
        status: "danger",
        avatar: "https://picsum.photos/id/1008/100/100"
    },
    {
        id: 5,
        user: "孙七",
        action: "发布了公告",
        time: "3小时前",
        description: "新功能上线通知：新增数据分析模块",
        status: "success",
        avatar: "https://picsum.photos/id/1009/100/100"
    }
];

const tasks = [
    {
        id: 1,
        title: "完成系统架构设计",
        deadline: "2023-04-20",
        progress: 85,
        color: "#409EFF",
        assignee: "张三",
        priority: "danger"
    },
    {
        id: 2,
        title: "开发用户管理模块",
        deadline: "2023-04-25",
        progress: 55,
        color: "#67C23A",
        assignee: "李四",
        priority: "warning"
    },
    {
        id: 3,
        title: "测试支付系统",
        deadline: "2023-04-30",
        progress: 30,
        color: "#E6A23C",
        assignee: "王五",
        priority: "success"
    }
];
</script>

<style scoped>
.dashboard-container {
    padding: 20px;
    background-color: #f5f7fa;
    min-height: 100vh;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.title {
    font-size: 28px;
    font-weight: 600;
    margin: 0;
    color: #303133;
}

.subtitle {
    font-size: 14px;
    color: #909399;
    margin: 4px 0 0;
}

.date-info {
    text-align: right;
}

.date {
    display: block;
    font-size: 18px;
    font-weight: 500;
    color: #303133;
}

.time {
    display: block;
    font-size: 14px;
    color: #909399;
    margin-top: 4px;
}

.user-info {
    display: flex;
    align-items: center;
    margin-left: 32px;
}

.username {
    margin-left: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #303133;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
}

.stat-card {
    border-radius: 12px;
    border: none;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
}

.stat-card:hover {
    box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.stat-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
}

.stat-left {
    flex: 1;
}

.stat-value {
    font-size: 40px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
}

.stat-label {
    font-size: 14px;
    color: #909399;
}

.stat-right {
    padding-left: 20px;
}

.stat-icon {
    color: #409eff;
}

.stat-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-top: 1px solid #f0f0f0;
}

.growth {
    font-size: 14px;
    font-weight: 500;
}

.growth.positive {
    color: #67c23a;
}

.growth.negative {
    color: #f56c6c;
}

.period {
    font-size: 12px;
    color: #909399;
}

.charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
}

.chart-card,
.info-card {
    border-radius: 12px;
    border: none;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
}

.chart-container {
    padding: 10px 0;
}

.activity-list {
    max-height: 350px;
    overflow-y: auto;
}

.activity-item {
    display: flex;
    align-items: flex-start;
    padding: 16px 0;
    border-bottom: 1px solid #f0f0f0;
}

.activity-item:last-child {
    border-bottom: none;
}

.activity-avatar {
    margin-right: 12px;
    flex-shrink: 0;
}

.activity-content {
    flex: 1;
    min-width: 0;
}

.activity-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.activity-time {
    font-size: 12px;
    color: #909399;
}

.activity-desc {
    font-size: 13px;
    color: #606266;
    line-height: 1.4;
}

.task-list {
    padding: 10px 0;
}

.task-item {
    margin-bottom: 24px;
}

.task-item:last-child {
    margin-bottom: 0;
}

.task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.task-title {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
}

.task-deadline {
    font-size: 12px;
    color: #909399;
}

.task-progress {
    margin-bottom: 12px;
}

.task-meta {
    display: flex;
    gap: 8px;
}

/* 响应式设计 */
@media (max-width: 960px) {
    .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .header-right {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 16px;
    }

    .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }

    .charts-grid {
        grid-template-columns: 1fr;
    }

    .info-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 576px) {
    .dashboard-container {
        padding: 10px;
    }

    .title {
        font-size: 22px;
    }

    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .stat-value {
        font-size: 24px;
    }

    .activity-item {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
