<template>
    <tiny-dialog-box v-model:visible="$Data.visible" :title="$Prop.actionType === 'upd' ? '编辑管理员' : '添加管理员'" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="10vh" @close="$Method.onClose">
        <tiny-form :model="$Data.formData" label-width="120px" label-position="left" :rules="$Data2.formRules" :ref="(el) => ($Form.form = el)">
            <tiny-form-item label="用户名" prop="username">
                <tiny-input v-model="$Data.formData.username" placeholder="请输入用户名" :disabled="$Prop.actionType === 'upd'" />
            </tiny-form-item>
            <tiny-form-item label="邮箱" prop="email">
                <tiny-input v-model="$Data.formData.email" placeholder="请输入邮箱" />
            </tiny-form-item>
            <tiny-form-item v-if="$Prop.actionType === 'add'" label="密码" prop="password">
                <tiny-input v-model="$Data.formData.password" type="password" placeholder="请输入密码，至少6位" />
            </tiny-form-item>
            <tiny-form-item label="姓名" prop="name">
                <tiny-input v-model="$Data.formData.name" placeholder="请输入姓名" />
            </tiny-form-item>
            <tiny-form-item label="昵称" prop="nickname">
                <tiny-input v-model="$Data.formData.nickname" placeholder="请输入昵称" />
            </tiny-form-item>
            <tiny-form-item label="手机号" prop="phone">
                <tiny-input v-model="$Data.formData.phone" placeholder="请输入手机号" />
            </tiny-form-item>
            <tiny-form-item v-if="$Prop.actionType === 'upd'" label="状态" prop="state">
                <tiny-radio-group v-model="$Data.formData.state">
                    <tiny-radio :label="1">正常</tiny-radio>
                    <tiny-radio :label="2">禁用</tiny-radio>
                </tiny-radio-group>
            </tiny-form-item>
        </tiny-form>
        <template #footer>
            <tiny-button @click="$Method.onClose">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.onSubmit">确定</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    actionType: {
        type: String,
        default: 'add'
    },
    rowData: {
        type: Object,
        default: {}
    }
});

const $Emit = defineEmits(['update:modelValue', 'success']);

// 表单引用
const $Form = $shallowRef({
    form: null
});

const $Data = $ref({
    visible: false,
    formData: {
        id: 0,
        username: '',
        email: '',
        password: '',
        name: '',
        nickname: '',
        phone: '',
        state: 1
    }
});

const $Data2 = $shallowRef({
    formRules: {
        username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
        email: [
            { required: true, message: '请输入邮箱', trigger: 'blur' },
            { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
        ],
        password: [
            { required: true, message: '请输入密码', trigger: 'blur' },
            { min: 6, message: '密码至少6位', trigger: 'blur' }
        ],
        name: [{ min: 2, max: 50, message: '姓名长度在 2 到 50 个字符', trigger: 'blur' }],
        nickname: [{ min: 2, max: 50, message: '昵称长度在 2 到 50 个字符', trigger: 'blur' }],
        phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }]
    }
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        if ($Prop.actionType === 'upd' && $Prop.rowData.id) {
            // 编辑模式：复制数据
            $Data.formData.id = $Prop.rowData.id || 0;
            $Data.formData.username = $Prop.rowData.username || '';
            $Data.formData.email = $Prop.rowData.email || '';
            $Data.formData.name = $Prop.rowData.name || '';
            $Data.formData.nickname = $Prop.rowData.nickname || '';
            $Data.formData.phone = $Prop.rowData.phone || '';
            $Data.formData.state = $Prop.rowData.state ?? 1;
        }
    },

    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit('update:modelValue', false);
        }, 300);
    },

    async onSubmit() {
        try {
            const valid = await $Form.form.validate();
            if (!valid) return;

            const res = await $Http($Prop.actionType === 'upd' ? '/addon/admin/adminUpd' : '/addon/admin/adminIns', $Data.formData);

            Modal.message({
                message: $Prop.actionType === 'upd' ? '编辑成功' : '添加成功',
                status: 'success'
            });
            $Emit('success');
            $Method.onClose();
        } catch (error) {
            console.error('提交失败:', error);
            Modal.message({
                message: '提交失败',
                status: 'error'
            });
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
