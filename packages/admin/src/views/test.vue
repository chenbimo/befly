<template>
    <div class="test-page">
        <h1>TinyVue 自动导入测试</h1>

        <div class="button-group">
            <tiny-button type="primary" @click="testModal">测试 Modal</tiny-button>
            <tiny-button type="success" @click="testMessage">测试 Message</tiny-button>
            <tiny-button type="warning" @click="testNotify">测试 Notify</tiny-button>
            <tiny-button type="info" @click="testMessageBox">测试 MessageBox</tiny-button>
        </div>
    </div>
</template>

<script setup>
// 无需导入，已自动导入：MessagePlugin, DialogPlugin, NotificationPlugin, LoadingPlugin

const testModal = () => {
    MessagePlugin.success('这是一个成功提示');
};

const testMessage = () => {
    Message.success('成功消息');
};

const testNotify = () => {
    Notify.success({
        title: '成功通知',
        message: '这是一个成功通知的内容'
    });
};

const testMessageBox = () => {
    MessageBox.alert('这是一个提示框', '提示');
};
</script>

<route lang="yaml">
meta:
    layout: default
    title: 自动导入测试
</route>

<style lang="scss" scoped>
.test-page {
    padding: 20px;

    h1 {
        color: $primary-color;
        margin-bottom: 24px;
    }

    .button-group {
        display: flex;
        gap: 12px;
    }
}
</style>
