<template>
    <div class="error-page">
        <t-result status="403" title="无权限访问" description="抱歉，您没有访问该页面的权限">
            <template #extra>
                <t-button theme="primary" @click="$Method.goHome">返回首页</t-button>
                <t-button theme="default" @click="$Method.goBack">返回上一页</t-button>
            </template>
        </t-result>
    </div>
</template>

<script setup>
const router = useRouter();

const $Method = {
    goHome() {
        router.push('/');
    },
    goBack() {
        router.back();
    }
};
</script>

<style scoped lang="scss">
.error-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--td-bg-color-page);
}
</style>
