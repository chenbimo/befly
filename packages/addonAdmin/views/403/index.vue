<template>
    <div class="error-page">
        <div class="error-content">
            <div class="error-code">403</div>
            <h1 class="error-title">无权限访问</h1>
            <p class="error-description">抱歉，您没有访问该页面的权限</p>
            <div class="error-actions">
                <TinyButton type="primary" @click="$Method.goHome">返回首页</TinyButton>
                <TinyButton @click="$Method.goBack">返回上一页</TinyButton>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router';
import { Button as TinyButton } from '@opentiny/vue';
import { useRouter } from 'vue-router';

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
    background: $bg-color-page;

    .error-content {
        text-align: center;

        .error-code {
            font-size: 120px;
            font-weight: bold;
            color: #ff6b6b;
            margin-bottom: 20px;
        }

        .error-title {
            font-size: 24px;
            font-weight: 600;
            color: $text-primary;
            margin-bottom: 12px;
        }

        .error-description {
            font-size: 14px;
            color: $text-secondary;
            margin-bottom: 30px;
        }

        .error-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
        }
    }
}
</style>
