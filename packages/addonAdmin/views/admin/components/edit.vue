<template>
    <TDialog v-model:visible="$Data.visible" :header="$Prop.actionType === 'upd' ? '编辑管理员' : '添加管理员'" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="10vh" @close="$Method.onClose">
        <div class="dialog-wrapper">
            <TForm :model="$Data.formData" label-width="80px" label-position="left" label-align="left" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)">
                <TFormItem label="角色" prop="roleId">
                    <TSelect v-model="$Data.formData.roleId" :options="$Data.roleOptions" placeholder="请选择角色" />
                </TFormItem>
                <TFormItem label="用户名" prop="username">
                    <TInput v-model="$Data.formData.username" placeholder="请输入用户名" :disabled="$Prop.actionType === 'upd'" />
                </TFormItem>
                <TFormItem label="邮箱" prop="email">
                    <TInput v-model="$Data.formData.email" placeholder="请输入邮箱" />
                </TFormItem>
                <TFormItem v-if="$Prop.actionType === 'add'" label="密码" prop="password">
                    <TInput v-model="$Data.formData.password" type="password" placeholder="请输入密码，至少6位" />
                </TFormItem>
                <TFormItem label="昵称" prop="nickname">
                    <TInput v-model="$Data.formData.nickname" placeholder="请输入昵称" />
                </TFormItem>
                <TFormItem label="手机号" prop="phone">
                    <TInput v-model="$Data.formData.phone" placeholder="请输入手机号" />
                </TFormItem>
                <TFormItem v-if="$Prop.actionType === 'upd'" label="状态" prop="state">
                    <TRadioGroup v-model="$Data.formData.state">
                        <TRadio :label="1">正常</TRadio>
                        <TRadio :label="2">禁用</TRadio>
                    </TRadioGroup>
                </TFormItem>
            </TForm>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <t-space>
                    <TButton theme="default" @click="$Method.onClose">取消</TButton>
                    <TButton theme="primary" @click="$Method.onSubmit">确定</TButton>
                </t-space>
            </div>
        </template>
    </TDialog>
</template>

<script setup>
import {
    //
    Dialog as TDialog,
    Form as TForm,
    FormItem as TFormItem,
    Input as TInput,
    Select as TSelect,
    RadioGroup as TRadioGroup,
    Radio as TRadio,
    Button as TButton,
    MessagePlugin
} from 'tdesign-vue-next';
import { $Http } from '@/plugins/http';
import { fieldClear } from 'befly-util/fieldClear';

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
const $From = $shallowRef({
    form: null
});

const $Data = $ref({
    visible: false,
    roleOptions: [],
    formData: {
        id: 0,
        username: '',
        email: '',
        password: '',
        name: '',
        nickname: '',
        phone: '',
        roleId: 0,
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
        roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
        name: [{ min: 2, max: 50, message: '姓名长度在 2 到 50 个字符', trigger: 'blur' }],
        nickname: [{ min: 2, max: 50, message: '昵称长度在 2 到 50 个字符', trigger: 'blur' }],
        phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }]
    }
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        await $Method.loadRoles();
        if ($Prop.actionType === 'upd' && $Prop.rowData.id) {
            // 编辑模式：直接赋值
            $Data.formData = { ...$Prop.rowData };
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

    async loadRoles() {
        try {
            const result = await $Http('/addon/admin/role/all');
            $Data.roleOptions = result
                .filter((role) => role.state === 1)
                .map((role) => ({
                    label: role.name,
                    value: role.id
                }));
        } catch (error) {
            MessagePlugin.error(error.msg || '加载角色列表失败');
        }
    },

    async onSubmit() {
        try {
            const valid = await $From.form.validate();
            if (!valid) return;

            const submitData = $Prop.actionType === 'add' ? fieldClear($Data.formData, { omitKeys: ['id', 'state'] }) : fieldClear($Data.formData, { omitKeys: ['password'] });

            await $Http($Prop.actionType === 'upd' ? '/addon/admin/admin/upd' : '/addon/admin/admin/ins', submitData);

            MessagePlugin.success($Prop.actionType === 'upd' ? '编辑成功' : '添加成功');
            $Emit('success');
            $Method.onClose();
        } catch (error) {
            MessagePlugin.error(error.msg || '提交失败');
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
