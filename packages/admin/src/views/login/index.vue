<template>
    <div class="login-container">
        <t-card class="login-card">
            <template #header>
                <h2 class="login-title">Befly Admin</h2>
                <p class="login-subtitle">后台管理系统</p>
            </template>

            <t-form :data="formData" @submit="handleLogin" :rules="rules" ref="formRef">
                <t-form-item name="username">
                    <t-input v-model="formData.username" placeholder="请输入用户名" size="large" clearable>
                        <template #prefix-icon>
                            <user-icon />
                        </template>
                    </t-input>
                </t-form-item>

                <t-form-item name="password">
                    <t-input v-model="formData.password" type="password" placeholder="请输入密码" size="large" clearable>
                        <template #prefix-icon>
                            <lock-on-icon />
                        </template>
                    </t-input>
                </t-form-item>

                <t-form-item>
                    <t-button theme="primary" type="submit" block size="large" :loading="loading">登录</t-button>
                </t-form-item>
            </t-form>
        </t-card>
    </div>
</template>

<script setup lang="ts">
import { UserIcon, LockOnIcon } from 'tdesign-icons-vue-next';

const router = useRouter();
const formRef = ref();
const loading = ref(false);

const formData = reactive({
    username: '',
    password: ''
});

const rules = {
    username: [{ required: true, message: '请输入用户名', type: 'error' }],
    password: [{ required: true, message: '请输入密码', type: 'error' }]
};

const handleLogin = async () => {
    const valid = await formRef.value.validate();
    if (!valid) return;

    loading.value = true;

    try {
        // TODO: 调用登录接口
        // const res = await loginApi(formData);

        // 模拟登录
        setTimeout(() => {
            localStorage.setItem('token', 'mock-token');
            MessagePlugin.success('登录成功');
            router.push('/dashboard');
            loading.value = false;
        }, 1000);
    } catch (error) {
        MessagePlugin.error('登录失败');
        loading.value = false;
    }
};
</script>

<style scoped lang="scss">
.login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
    width: 400px;
}

.login-title {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 600;
    text-align: center;
}

.login-subtitle {
    margin: 0 0 24px 0;
    color: var(--td-text-color-secondary);
    text-align: center;
}
</style>
