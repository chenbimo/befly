<template>
    <tiny-dialog-box v-model:visible="dialogVisible" :title="isEdit ? '编辑角色' : '添加角色'" width="600px" :append-to-body="true" :show-footer="true" top="10vh" @close="$Method.handleClose">
        <tiny-form :model="formData" label-width="120px" label-position="left" :rules="formRules" :ref="(el) => ($From = el)">
            <tiny-form-item label="角色名称" prop="name">
                <tiny-input v-model="formData.name" placeholder="请输入角色名称" />
            </tiny-form-item>
            <tiny-form-item label="角色代码" prop="code">
                <tiny-input v-model="formData.code" placeholder="请输入角色代码，如：admin" :disabled="isEdit" />
            </tiny-form-item>
            <tiny-form-item label="角色描述" prop="description">
                <tiny-input v-model="formData.description" type="textarea" placeholder="请输入角色描述" :rows="3" />
            </tiny-form-item>
            <tiny-form-item label="排序" prop="sort">
                <tiny-numeric v-model="formData.sort" :min="0" :max="9999" />
            </tiny-form-item>
            <tiny-form-item label="状态" prop="state" v-if="isEdit">
                <tiny-radio-group v-model="formData.state">
                    <tiny-radio :label="1">正常</tiny-radio>
                    <tiny-radio :label="2">禁用</tiny-radio>
                </tiny-radio-group>
            </tiny-form-item>
        </tiny-form>
        <template #footer>
            <tiny-button @click="$Method.handleCancel">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.handleSubmit">确定</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
const $Prop = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    isEdit: {
        type: Boolean,
        default: false
    },
    roleData: {
        type: Object,
        default: null
    }
});

const $Emit = defineEmits(['update:visible', 'success']);

// 表单引用
const $From = $ref(null);

// 对话框显示状态
const dialogVisible = $computed({
    get: () => $Prop.visible,
    set: (val) => $Emit('update:visible', val)
});

const $Data = $ref({});

const $Object = markRaw({
    formRules: {
        name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
        code: [
            { required: true, message: '请输入角色代码', trigger: 'blur' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '角色代码只能包含字母、数字和下划线', trigger: 'blur' }
        ],
        sort: [{ type: 'number', message: '排序必须是数字', trigger: 'blur' }]
    }
});

// 方法集合
const $Method = {
    // 关闭对话框
    handleClose() {
        $Emit('update:visible', false);
    },

    // 取消
    handleCancel() {
        $Method.handleClose();
    },

    // 提交表单
    async handleSubmit() {
        try {
            const valid = await $From.validate();
            if (!valid) return;

            const apiUrl = $Prop.isEdit ? '/addon/admin/roleUpdate' : '/addon/admin/roleCreate';
            const res = await $Http(apiUrl, formData);

            if (res.code === 0) {
                Modal.message({ message: $Prop.isEdit ? '编辑成功' : '添加成功', status: 'success' });
                $Method.handleClose();
                $Emit('success');
            } else {
                Modal.message({ message: res.msg || '操作失败', status: 'error' });
            }
        } catch (error) {
            console.error('提交失败:', error);
            Modal.message({ message: '提交失败', status: 'error' });
        }
    }
};
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
