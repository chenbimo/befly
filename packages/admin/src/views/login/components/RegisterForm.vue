<template>
    <tiny-form :data="$Data.formData" :rules="$Data.rules" :ref="(el) => ($Form.form = el)" class="login-form" :required-mark="false" show-error-message label-align="left" label-width="70px">
        <tiny-form-item name="name" label="姓名">
            <tiny-input v-model="$Data.formData.name" placeholder="请输入姓名" size="large" clearable>
                <template #prefix-icon>
                    <Icon name="User" :size="18" />
                </template>
            </tiny-input>
        </tiny-form-item>

        <tiny-form-item name="email" label="邮箱">
            <tiny-input v-model="$Data.formData.email" placeholder="请输入邮箱" size="large" clearable>
                <template #prefix-icon>
                    <Icon name="Mail" :size="18" />
                </template>
            </tiny-input>
        </tiny-form-item>

        <tiny-form-item name="password" label="密码">
            <tiny-input v-model="$Data.formData.password" type="password" placeholder="请输入密码" size="large" clearable>
                <template #prefix-icon>
                    <Icon name="Lock" :size="18" />
                </template>
            </tiny-input>
        </tiny-form-item>

        <tiny-button theme="primary" class="auth-btn" size="large" :loading="$Data.loading" @click="$Method.handleSubmit"> 注册 </tiny-button>
    </tiny-form>
</template>

<script setup>
const emit = defineEmits(['success']);

// 表单引用
const $Form = $ref({
    form: null
});

// 数据定义
const $Data = $ref({
    loading: false,
    formData: {
        name: '',
        email: '',
        password: ''
    },
    rules: {
        name: [{ required: true, message: '请输入姓名', type: 'error' }],
        email: [{ required: true, message: '请输入邮箱', type: 'error' }],
        password: [{ required: true, message: '请输入密码', type: 'error' }]
    }
});

// 方法定义
const $Method = {
    async handleSubmit() {
        const valid = await $Form.form.validate();
        if (!valid) return;

        $Data.loading = true;

        try {
            await $Http('/core/admin/register', $Data.formData);
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
        $Data.formData.name = '';
        $Data.formData.email = '';
        $Data.formData.password = '';
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
