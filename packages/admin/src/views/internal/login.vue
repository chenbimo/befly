<template>
    <div class="page-login">
        <div class="login-box">
            <h1>登录</h1>
            <tiny-form ref="formRef" :model="$Data.form" label-position="top">
                <tiny-form-item label="用户名" prop="username">
                    <tiny-input v-model="$Data.form.username" placeholder="请输入用户名" />
                </tiny-form-item>
                <tiny-form-item label="密码" prop="password">
                    <tiny-input v-model="$Data.form.password" type="password" placeholder="请输入密码" />
                </tiny-form-item>
                <tiny-form-item>
                    <tiny-button type="primary" @click="$Method.handleLogin">登录</tiny-button>
                </tiny-form-item>
            </tiny-form>
        </div>
    </div>
</template>

<script setup>
const router = useRouter();

const $Data = $ref({
    form: {
        username: '',
        password: ''
    }
});

const $Method = {
    async handleLogin() {
        // 模拟登录
        $Storage.local.set('token', 'mock-token-123');
        MessagePlugin.success('登录成功');
        router.push('/');
    }
};
</script>

<route lang="yaml">
meta:
    layout: blank
    public: true
    title: 登录
</route>

<style lang="scss" scoped>
.page-login {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .login-box {
        width: 400px;
        padding: 40px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

        h1 {
            text-align: center;
            margin-bottom: 30px;
            color: $primary-color;
        }

        .tiny-button {
            width: 100%;
        }
    }
}
</style>
