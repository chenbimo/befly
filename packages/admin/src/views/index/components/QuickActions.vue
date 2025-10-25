<template>
    <div class="section-block">
        <div class="section-content">
            <t-button theme="primary" size="large" @click="handleClearCache">
                <template #icon>
                    <Icon name="RotateCw" :size="18" />
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
    background: $bg-color-container;
    border-radius: $border-radius;
    padding: $spacing-md;

    .section-content {
        display: flex;
        justify-content: center;
    }
}
</style>
