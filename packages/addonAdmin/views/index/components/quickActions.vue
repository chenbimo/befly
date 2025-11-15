<template>
    <div class="section-block">
        <div class="section-content">
            <t-button type="primary" size="large" @click="handleClearCache">
                <template #prefix>
                    <i-lucide:rotate-cw />
                </template>
                刷新缓存
            </t-button>
        </div>
    </div>
</template>

<script setup>
const handleClearCache = () => {
    console.log('刷新缓存');
};
</script>

<style scoped lang="scss">
.section-block {
    .section-content {
        display: flex;
        justify-content: center;
    }
}
</style>
