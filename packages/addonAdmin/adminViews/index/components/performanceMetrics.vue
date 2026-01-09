<template>
    <div class="section-block">
        <div class="section-header flex items-center gap-2">
            <ILucideActivity />
            <h2>性能指标</h2>
        </div>
        <div class="section-content">
            <div class="performance-grid">
                <div class="perf-metric">
                    <div class="perf-icon">
                        <ILucideClock />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">平均响应</div>
                        <div class="perf-value">{{ performanceMetrics.avgResponseTime }}ms</div>
                    </div>
                </div>
                <div class="perf-metric">
                    <div class="perf-icon">
                        <ILucideTrendingUp />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">QPS</div>
                        <div class="perf-value">{{ performanceMetrics.qps }}/s</div>
                    </div>
                </div>
                <div class="perf-metric">
                    <div class="perf-icon">
                        <ILucideAlertCircle />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">错误率</div>
                        <div class="perf-value">{{ performanceMetrics.errorRate }}%</div>
                    </div>
                </div>
                <div class="perf-metric">
                    <div class="perf-icon">
                        <ILucideActivity />
                    </div>
                    <div class="perf-info">
                        <div class="perf-label">活跃连接</div>
                        <div class="perf-value">{{ performanceMetrics.activeConnections }}</div>
                    </div>
                </div>
            </div>
            <!-- 最慢接口提示 -->
            <div v-if="performanceMetrics.slowestApi" class="perf-slowest">
                <ILucideAlertTriangle />
                <span>最慢接口: {{ performanceMetrics.slowestApi.path }} ({{ performanceMetrics.slowestApi.time }}ms)</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ILucideActivity from "~icons/lucide/activity";
import ILucideClock from "~icons/lucide/clock";
import ILucideTrendingUp from "~icons/lucide/trending-up";
import ILucideAlertCircle from "~icons/lucide/alert-circle";
import ILucideAlertTriangle from "~icons/lucide/alert-triangle";
import { $Http } from "@/plugins/http";

// 组件内部数据
const performanceMetrics = $ref({
    avgResponseTime: 0,
    qps: 0,
    errorRate: 0,
    activeConnections: 0,
    slowestApi: null
});

// 获取数据
const fetchData = async () => {
    try {
        const { data } = await $Http.post(
            "/addon/admin/dashboard/performanceMetrics",
            {},
            {
                dropValues: [""]
            }
        );
        Object.assign(performanceMetrics, data);
    } catch (error) {
        // 静默失败：不阻断页面展示
    }
};

fetchData();
</script>

<style scoped lang="scss">
.performance-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);

    .perf-metric {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        background: rgba(var(--primary-color-rgb), 0.02);
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        transition: all 0.2s;

        &:hover {
            background: rgba(var(--primary-color-rgb), 0.05);
            border-color: var(--primary-color);
        }

        .perf-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: var(--border-radius-small);
            background: linear-gradient(135deg, rgba(0, 168, 112, 0.1) 0%, rgba(0, 168, 112, 0.05) 100%);
            color: var(--success-color);
            flex-shrink: 0;
        }

        .perf-info {
            flex: 1;

            .perf-label {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 2px;
            }

            .perf-value {
                font-size: 16px;
                font-weight: 700;
                color: var(--primary-color);
            }
        }
    }
}

.warning-tip {
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(var(--warning-color-rgb), 0.05);
    border-radius: var(--border-radius-small);
    border: 1px solid rgba(var(--warning-color-rgb), 0.2);
    font-size: 13px;
    color: var(--warning-color);
}
</style>
