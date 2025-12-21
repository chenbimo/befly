<template>
    <div class="error-page">
        <div class="error-content">
            <div class="error-code">403</div>
            <h1 class="error-title">无权限访问</h1>
            <p class="error-description">抱歉，您没有访问该页面的权限</p>
            <div class="error-actions">
                <TButton theme="primary" @click="$Method.goHome">返回首页</TButton>
                <TButton @click="$Method.goBack">返回上一页</TButton>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { Button as TButton } from "tdesign-vue-next";

definePage({
    meta: {
        title: "403",
        order: 101
    }
});

const router = useRouter();

const $Method = {
    goHome() {
        router.push("/");
    },
    goBack() {
        router.back();
    }
};
</script>

<style scoped lang="scss">
.error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg-color-page);

    .error-code {
        font-size: 120px;
        font-weight: 700;
        background: linear-gradient(135deg, var(--primary-color) 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0;
    }

    .error-message {
        font-size: 24px;
        color: var(--text-primary);
        margin: 20px 0;
    }

    .error-description {
        font-size: 16px;
        color: var(--text-secondary);
        margin: 8px 0 24px;
    }

    .error-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
    }
}
</style>
