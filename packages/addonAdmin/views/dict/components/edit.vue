<template>
    <tiny-dialog-box v-model:visible="$Data.visible" :title="$Prop.actionType === 'upd' ? '编辑字典' : '添加字典'" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="10vh" @close="$Method.onClose">
        <tiny-form :model="$Data.formData" label-width="120px" label-position="left" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)">
            <tiny-form-item label="字典名称" prop="name">
                <tiny-input v-model="$Data.formData.name" placeholder="请输入字典名称" />
            </tiny-form-item>
            <tiny-form-item label="字典代码" prop="code">
                <tiny-input v-model="$Data.formData.code" placeholder="请输入字典代码，如：gender" />
            </tiny-form-item>
            <tiny-form-item label="字典值" prop="value">
                <tiny-input v-model="$Data.formData.value" placeholder="请输入字典值" />
            </tiny-form-item>
            <tiny-form-item label="父级ID" prop="pid">
                <tiny-numeric v-model="$Data.formData.pid" :min="0" :max="999999999999999" />
            </tiny-form-item>
            <tiny-form-item label="排序" prop="sort">
                <tiny-numeric v-model="$Data.formData.sort" :min="0" :max="9999" />
            </tiny-form-item>
            <tiny-form-item label="描述" prop="description">
                <tiny-input v-model="$Data.formData.description" type="textarea" placeholder="请输入描述" :rows="3" />
            </tiny-form-item>
            <tiny-form-item label="状态" prop="state">
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
import { ref, watch, shallowRef } from 'vue';
import { Modal } from '@opentiny/vue';

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
    formData: {
        id: 0,
        name: '',
        code: '',
        value: '',
        pid: 0,
        sort: 0,
        description: '',
        state: 1
    }
});

const $Data2 = $shallowRef({
    formRules: {
        name: [{ required: true, message: '请输入字典名称', trigger: 'blur' }],
        code: [
            { required: true, message: '请输入字典代码', trigger: 'blur' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '字典代码只能包含字母、数字和下划线', trigger: 'blur' }
        ],
        value: [{ required: true, message: '请输入字典值', trigger: 'blur' }]
    }
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
    },

    onShow() {
        $Data.visible = true;
        if ($Prop.actionType === 'upd' && $Prop.rowData) {
            $Data.formData.id = $Prop.rowData.id || 0;
            $Data.formData.name = $Prop.rowData.name || '';
            $Data.formData.code = $Prop.rowData.code || '';
            $Data.formData.value = $Prop.rowData.value || '';
            $Data.formData.pid = $Prop.rowData.pid || 0;
            $Data.formData.sort = $Prop.rowData.sort || 0;
            $Data.formData.description = $Prop.rowData.description || '';
            $Data.formData.state = $Prop.rowData.state ?? 1;
        } else {
            // 重置表单
            $Data.formData.id = 0;
            $Data.formData.name = '';
            $Data.formData.code = '';
            $Data.formData.value = '';
            $Data.formData.pid = 0;
            $Data.formData.sort = 0;
            $Data.formData.description = '';
            $Data.formData.state = 1;
        }
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit('update:modelValue', false);
        }, 300);
    },

    async onSubmit() {
        try {
            const valid = await $From.form.validate();
            if (!valid) return;

            const res = await $Http($Prop.actionType === 'add' ? '/addon/admin/dictIns' : '/addon/admin/dictUpd', $Data.formData);

            Modal.message({
                message: $Prop.actionType === 'add' ? '添加成功' : '编辑成功',
                status: 'success'
            });
            $Method.onClose();
            $Emit('success');
        } catch (error) {
            console.error('提交失败:', error);
        }
    }
};

// 监听 modelValue 变化
watch(
    () => $Prop.modelValue,
    (val) => {
        if (val && !$Data.visible) {
            $Method.initData();
        } else if (!val && $Data.visible) {
            $Data.visible = false;
        }
    },
    { immediate: true }
);
</script>

<style scoped lang="scss">
// 可根据需要添加样式
</style>
