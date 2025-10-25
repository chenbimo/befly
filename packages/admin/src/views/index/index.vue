<template>
    <div class="dashboard-container">
        <div class="dashboard-left">
            <SystemOverview />
            <ServiceStatus />
            <SystemResources />
            <PerformanceMetrics />
            <EnvironmentInfo />
        </div>
        <div class="dashboard-right">
            <AddonList />
        </div>
    </div>
</template>

<script setup>
import SystemOverview from './components/SystemOverview.vue';
import ServiceStatus from './components/ServiceStatus.vue';
import AddonList from './components/AddonList.vue';
import SystemResources from './components/SystemResources.vue';
import PerformanceMetrics from './components/PerformanceMetrics.vue';
import EnvironmentInfo from './components/EnvironmentInfo.vue';
</script>

<style scoped lang="scss">
.dashboard-container {
    display: flex;
    gap: 12px;
    overflow: hidden;
    height: 100%;

    .dashboard-left {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        min-width: 0;
    }

    .dashboard-right {
        width: 400px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        flex-shrink: 0;
    }

    @media (max-width: 768px) {
        flex-direction: column;
        padding: 10px;
        gap: 10px;

        .dashboard-right {
            width: 100%;
        }
    }
}
</style>
