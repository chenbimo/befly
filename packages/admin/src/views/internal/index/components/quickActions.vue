<template>
    <div class="section-block">
        <div class="section-content">
            <tiny-button type="primary" size="large" @click="handleClearCache">
                <template #prefix>
                    <i-lucide:rotate-cw style="width: 18px; height: 18px" />
                </template>
                刷新缓存
            </tiny-button>
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
