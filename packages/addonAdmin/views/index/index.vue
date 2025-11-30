<template>
    <div class="dashboard-container">
        <!-- 第一行：系统概览（全宽） -->
        <div class="dashboard-row full-width">
            <SystemOverview />
        </div>

        <!-- 第二行：服务状态 + 系统资源 -->
        <div class="dashboard-row two-columns">
            <ServiceStatus />
            <SystemResources />
        </div>

        <!-- 第三行：性能指标 + 环境信息 -->
        <div class="dashboard-row two-columns">
            <PerformanceMetrics />
            <EnvironmentInfo />
        </div>
    </div>
</template>

<script setup>
import SystemOverview from './components/systemOverview.vue';
import ServiceStatus from './components/serviceStatus.vue';
import SystemResources from './components/systemResources.vue';
import PerformanceMetrics from './components/performanceMetrics.vue';
import EnvironmentInfo from './components/environmentInfo.vue';
</script>

<style scoped lang="scss">
.dashboard-container {
    display: flex;
    flex-direction: column;
    gap: var(--layout-gap);
    overflow-y: auto;
    height: 100%;
    padding: 0;

    .dashboard-row {
        display: flex;
        gap: var(--layout-gap);

        &.full-width {
            > * {
                flex: 1;
            }
        }

        &.two-columns {
            > * {
                flex: 1;
                min-width: 0;
            }
        }
    }

    // 每个组件都是独立的卡片
    :deep(.section-block) {
        background: var(--bg-color-container);
        border-radius: var(--card-radius);
        box-shadow: var(--shadow-1);
        padding: var(--spacing-md);
        border: none;
        height: 100%;
    }
}
</style>
