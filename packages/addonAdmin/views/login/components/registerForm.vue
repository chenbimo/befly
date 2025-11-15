<template>
    <t-form :model="$Data.formData" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)" class="login-form" label-width="70px" label-position="left">
        <t-form-item prop="username" label="用户名">
            <t-input v-model="$Data.formData.username" placeholder="请输入用户名" size="large" clearable>
                <template #prefix-icon>
                    <i-lucide:user />
                </template>
            </t-input>
        </t-form-item>

        <t-form-item prop="email" label="邮箱">
            <t-input v-model="$Data.formData.email" placeholder="请输入邮箱" size="large" clearable>
                <template #prefix-icon>
                    <i-lucide:mail />
                </template>
            </t-input>
        </t-form-item>

        <t-form-item prop="password" label="密码">
            <t-input v-model="$Data.formData.password" type="password" placeholder="请输入密码" size="large" clearable>
                <template #prefix-icon>
                    <i-lucide:lock />
                </template>
            </t-input>
        </t-form-item>

        <t-form-item prop="nickname" label="昵称">
            <t-input v-model="$Data.formData.nickname" placeholder="请输入昵称（选填）" size="large" clearable>
                <template #prefix-icon>
                    <i-lucide:smile />
                </template>
            </t-input>
        </t-form-item>

        <t-button theme="primary" class="auth-btn" size="large" :loading="$Data.loading" @click="$Method.handleSubmit"> 注册 </t-button>
    </t-form>
</template>

<script setup>
import { $Http } from '@/plugins/http';

const emit = defineEmits(['success']);

// 表单引用
const $From = $shallowRef({
    form: null
});

// 数据定义
const $Data = $ref({
    loading: false,
    formData: {
        username: '',
        email: '',
        password: '',
        nickname: ''
    }
});

const $Data2 = $shallowRef({
    formRules: {
        username: [
            { required: true, message: '请输入用户名', trigger: 'blur' },
            { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' }
        ],
        email: [
            { required: true, message: '请输入邮箱', trigger: 'blur' },
            { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
        ],
        password: [
            { required: true, message: '请输入密码', trigger: 'blur' },
            { min: 6, message: '密码长度至少 6 个字符', trigger: 'blur' }
        ]
        // nickname 是选填项，不需要验证规则
    }
});

// 方法定义
const $Method = {
    async handleSubmit() {
        const valid = await $From.form.validate();
        if (!valid) return;

        $Data.loading = true;

        try {
            await $Http('/addon/admin/register', $Data.formData);
            MessagePlugin.success('注册成功，请登录');

            // 清空表单
            $Method.resetForm();

            // 通知父组件注册成功，切换到登录模式
            emit('success');
        } catch (error) {
            // 错误已经在 request 拦截器中处理
        } finally {
            $Data.loading = false;
        }
    },

    // 清空表单
    resetForm() {
        $Data.formData.username = '';
        $Data.formData.email = '';
        $Data.formData.password = '';
        $Data.formData.nickname = '';
    }
};
</script>

<style scoped lang="scss">
.login-form {
    width: 100%;
    max-width: 450px;
}

.tiny-form-item {
    width: 100%;
    margin-bottom: 1.2rem;

    :deep(.tiny-form__controls) {
        width: 100%;
    }

    :deep(.tiny-input) {
        width: 100%;
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        transition: all 0.3s;

        &:hover {
            border-color: #48b19f;
        }

        &:focus-within {
            border-color: #48b19f;
            background: #fff;
        }

        input {
            padding: 0.75rem 1rem;
        }
    }
}

.auth-btn {
    width: 100% !important;
    max-width: 100%;
    height: 44px;
    border-radius: 6px;
    background: #48b19f;
    border: none;
    font-size: 0.95rem;
    font-weight: 600;
    margin-top: 0.5rem;
    transition: all 0.3s;

    &:hover {
        background: #3a9d8f;
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(72, 177, 159, 0.3);
    }

    :deep(.tiny-button__text) {
        color: #fff;
    }
}
</style>
