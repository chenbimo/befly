<template>
    <TDialog v-model:visible="visible" :header="actionType === 'add' ? '添加字典类型' : '编辑字典类型'" width="600px" @confirm="$Method.handleSubmit" @close="$Method.handleClose">
        <TForm ref="formRef" :data="$Data.formData" :rules="$Data.rules" label-width="100px">
            <TFormItem label="类型代码" name="code">
                <TInput v-model="$Data.formData.code" placeholder="请输入类型代码（英文/数字/下划线）" :disabled="actionType === 'upd'" />
            </TFormItem>
            <TFormItem label="类型名称" name="name">
                <TInput v-model="$Data.formData.name" placeholder="请输入类型名称" />
            </TFormItem>
            <TFormItem label="描述" name="description">
                <TTextarea v-model="$Data.formData.description" placeholder="请输入描述信息" :autosize="{ minRows: 3, maxRows: 6 }" />
            </TFormItem>
            <TFormItem label="排序" name="sort">
                <TInputNumber v-model="$Data.formData.sort" :min="0" placeholder="请输入排序值" />
            </TFormItem>
        </TForm>
    </TDialog>
</template>

<script setup>
import { Dialog as TDialog, Form as TForm, FormItem as TFormItem, Input as TInput, Textarea as TTextarea, InputNumber as TInputNumber, MessagePlugin } from 'tdesign-vue-next';
import { $Http } from '@/plugins/http';

const props = defineProps({
    modelValue: Boolean,
    actionType: String,
    rowData: Object
});

const emit = defineEmits(['update:modelValue', 'success']);

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

const formRef = $ref(null);

const $Data = $ref({
    formData: {
        code: '',
        name: '',
        description: '',
        sort: 0
    },
    rules: {
        code: [{ required: true, message: '请输入类型代码' }],
        name: [{ required: true, message: '请输入类型名称' }]
    }
});

const $Method = {
    async handleSubmit() {
        const valid = await formRef.validate();
        if (!valid) return;

        try {
            const apiUrl = props.actionType === 'add' ? '/addon/admin/dictType/ins' : '/addon/admin/dictType/upd';
            const params = {
                code: $Data.formData.code,
                name: $Data.formData.name,
                description: $Data.formData.description,
                sort: $Data.formData.sort
            };
            if (props.actionType === 'upd') {
                params.id = props.rowData.id;
            }

            const res = await $Http(apiUrl, params);
            if (res.code === 0) {
                MessagePlugin.success(props.actionType === 'add' ? '添加成功' : '更新成功');
                visible.value = false;
                emit('success');
            } else {
                MessagePlugin.error(res.msg || '操作失败');
            }
        } catch (error) {
            console.error('提交失败:', error);
            MessagePlugin.error('操作失败');
        }
    },
    handleClose() {
        visible.value = false;
    }
};

watch(
    () => props.modelValue,
    (val) => {
        if (val) {
            if (props.actionType === 'upd' && props.rowData) {
                $Data.formData.code = props.rowData.code || '';
                $Data.formData.name = props.rowData.name || '';
                $Data.formData.description = props.rowData.description || '';
                $Data.formData.sort = props.rowData.sort || 0;
            } else {
                $Data.formData.code = '';
                $Data.formData.name = '';
                $Data.formData.description = '';
                $Data.formData.sort = 0;
            }
        }
    },
    { immediate: true }
);
</script>
