<template>
    <tiny-dialog-box v-model:visible="$Visible" :title="$Prop.actionType ? '编辑角色' : '添加角色'" width="600px" :append-to-body="true" :show-footer="true" top="10vh" @close="$Visible = false">
        <tiny-form :model="$Data.formData" label-width="120px" label-position="left" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)">
            <tiny-form-item label="角色名称" prop="name">
                <tiny-input v-model="$Data.formData.name" placeholder="请输入角色名称" />
            </tiny-form-item>
            <tiny-form-item label="角色代码" prop="code">
                <tiny-input v-model="$Data.formData.code" placeholder="请输入角色代码，如：admin" />
            </tiny-form-item>
            <tiny-form-item label="角色描述" prop="description">
                <tiny-input v-model="$Data.formData.description" type="textarea" placeholder="请输入角色描述" :rows="3" />
            </tiny-form-item>
            <tiny-form-item label="排序" prop="sort">
                <tiny-numeric v-model="$Data.formData.sort" :min="0" :max="9999" />
            </tiny-form-item>
            <tiny-form-item label="状态" prop="state">
                <tiny-radio-group v-model="$Data.formData.state">
                    <tiny-radio :label="1">正常</tiny-radio>
                    <tiny-radio :label="2">禁用</tiny-radio>
                </tiny-radio-group>
            </tiny-form-item>
        </tiny-form>
        <template #footer>
            <tiny-button @click="$Visible = false">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.handleSubmit">确定</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
const $Visible = defineModel({ default: false });

const $Prop = defineProps({
    actionType: {
        type: String,
        default: 'add'
    },
    rowData: {
        type: Object,
        default: {}
    }
});

const $Emit = defineEmits(['success']);

// 表单引用
const $From = $shallowRef({
    form: null
});

const $Computed = {};

const $Data = $ref({
    formData: {
        name: '',
        code: '',
        description: '',
        sort: 0,
        state: 1
    }
});

const $Data2 = $shallowRef({
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
    // 提交表单
    async handleSubmit() {
        try {
            const valid = await $From.validate();
            if (!valid) return;

            const apiUrl = $Prop.actionType ? '/addon/admin/roleUpdate' : '/addon/admin/roleCreate';
            const res = await $Http(apiUrl, formData);

            if (res.code === 0) {
                Modal.message({
                    message: $Prop.actionType ? '编辑成功' : '添加成功',
                    status: 'success'
                });
                $Method.handleClose();
                $Emit('success');
            } else {
                Modal.message({
                    message: res.msg || '操作失败',
                    status: 'error'
                });
            }
        } catch (error) {
            console.error('提交失败:', error);
            Modal.message({
                message: '提交失败',
                status: 'error'
            });
        }
    }
};

onMounted(() => {});
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
