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
import { Button as TButton } from 'tdesign-vue-next';

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
