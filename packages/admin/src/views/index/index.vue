<template>
    <div class="dashboard-container">
        <SystemOverview />
        <ServiceStatus />
        <AddonList />
        <SystemResources />
        <PerformanceMetrics />
        <EnvironmentInfo />
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
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    height: 100%;

    @media (max-width: 768px) {
        padding: 10px;
        gap: 10px;
    }
}
</style>
