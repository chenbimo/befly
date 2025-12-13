<template>
    <TDialog v-model:visible="visible" :header="actionType === 'add' ? '添加字典项' : '编辑字典项'" width="600px" @confirm="$Method.handleSubmit" @close="$Method.handleClose">
        <TForm ref="formRef" :data="$Data.formData" :rules="$Data.rules" label-width="100px">
            <TFormItem label="字典类型" name="typeCode">
                <TSelect v-model="$Data.formData.typeCode" placeholder="请选择字典类型" filterable>
                    <TOption v-for="item in typeList" :key="item.code" :value="item.code" :label="item.name" />
                </TSelect>
            </TFormItem>
            <TFormItem label="键" name="key">
                <TInput v-model="$Data.formData.key" placeholder="请输入键名（英文/数字/下划线）" />
            </TFormItem>
            <TFormItem label="标签" name="label">
                <TInput v-model="$Data.formData.label" placeholder="请输入标签（显示名称）" />
            </TFormItem>
            <TFormItem label="排序" name="sort">
                <TInputNumber v-model="$Data.formData.sort" :min="0" placeholder="请输入排序值" />
            </TFormItem>
            <TFormItem label="备注" name="remark">
                <TTextarea v-model="$Data.formData.remark" placeholder="请输入备注信息" :autosize="{ minRows: 3, maxRows: 6 }" />
            </TFormItem>
        </TForm>
    </TDialog>
</template>

<script setup>
import { Dialog as TDialog, Form as TForm, FormItem as TFormItem, Input as TInput, Select as TSelect, Option as TOption, Textarea as TTextarea, InputNumber as TInputNumber, MessagePlugin } from 'tdesign-vue-next';
import { $Http } from '@/plugins/http';

const props = defineProps({
    modelValue: Boolean,
    actionType: String,
    rowData: Object,
    typeList: Array
});

const emit = defineEmits(['update:modelValue', 'success']);

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

const formRef = $ref(null);

const $Data = $ref({
    formData: {
        typeCode: '',
        key: '',
        label: '',
        sort: 0,
        remark: ''
    },
    rules: {
        typeCode: [{ required: true, message: '请选择字典类型' }],
        key: [{ required: true, message: '请输入键名' }],
        label: [{ required: true, message: '请输入标签' }]
    }
});

const $Method = {
    async handleSubmit() {
        const valid = await formRef.validate();
        if (!valid) return;

        try {
            const apiUrl = props.actionType === 'add' ? '/addon/admin/dict/ins' : '/addon/admin/dict/upd';
            const params = {
                typeCode: $Data.formData.typeCode,
                key: $Data.formData.key,
                label: $Data.formData.label,
                sort: $Data.formData.sort,
                remark: $Data.formData.remark
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
                $Data.formData.typeCode = props.rowData.typeCode || '';
                $Data.formData.key = props.rowData.key || '';
                $Data.formData.label = props.rowData.label || '';
                $Data.formData.sort = props.rowData.sort || 0;
                $Data.formData.remark = props.rowData.remark || '';
            } else {
                $Data.formData.typeCode = '';
                $Data.formData.key = '';
                $Data.formData.label = '';
                $Data.formData.sort = 0;
                $Data.formData.remark = '';
            }
        }
    },
    { immediate: true }
);
</script>
