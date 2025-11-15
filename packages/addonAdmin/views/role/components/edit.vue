<template>
    <t-dialog v-model:visible="$Data.visible" :title="$Prop.actionType === 'upd' ? '更新角色' : '添加角色'" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="10vh" @close="$Method.onClose">
        <div class="comp-role-edit">
            <t-form :model="$Data.formData" label-width="120px" label-position="left" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)">
                <t-form-item label="角色名称" prop="name">
                    <t-input v-model="$Data.formData.name" placeholder="请输入角色名称" />
                </t-form-item>
                <t-form-item label="角色代码" prop="code">
                    <t-input v-model="$Data.formData.code" placeholder="请输入角色代码，如：admin" />
                </t-form-item>
                <t-form-item label="角色描述" prop="description">
                    <t-input v-model="$Data.formData.description" type="textarea" placeholder="请输入角色描述" :rows="3" />
                </t-form-item>
                <t-form-item label="排序" prop="sort">
                    <t-input-number v-model="$Data.formData.sort" :min="0" :max="9999" />
                </t-form-item>
                <t-form-item label="状态" prop="state">
                    <t-radio-group v-model="$Data.formData.state">
                        <t-radio :label="1">正常</t-radio>
                        <t-radio :label="2">禁用</t-radio>
                    </t-radio-group>
                </t-form-item>
            </t-form>
        </div>
        <template #footer>
            <t-button @click="$Method.onClose">取消</t-button>
            <t-button type="primary" @click="$Method.onSubmit">确定</t-button>
        </template>
    </t-dialog>
</template>

<script setup>
import { $Http } from '@/plugins/http';

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

const $Computed = {};

const $Data = $ref({
    visible: false,
    formData: {
        id: 0,
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
    async initData() {
        if ($Prop.actionType === 'upd' && $Prop.rowData.id) {
            $Data.formData = Object.assign({}, $Prop.rowData);
        }
        $Method.onShow();
    },
    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },
    // 关闭抽屉事件
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

            const res = await $Http($Prop.actionType === 'upd' ? '/addon/admin/roleUpd' : '/addon/admin/roleIns', $Data.formData);

            MessagePlugin.info({
                message: $Prop.actionType === 'upd' ? '更新成功' : '添加成功',
                status: 'success'
            });
            $Data.visible = false;
            $Emit('success');
        } catch (error) {
            console.error('提交失败:', error);
            MessagePlugin.info({
                message: '提交失败',
                status: 'error'
            });
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-edit {
}
</style>
