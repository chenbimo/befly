<template>
    <TDialog v-model:visible="$Data.visible" :header="$Prop.actionType === 'upd' ? '更新角色' : '添加角色'" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="10vh" @close="$Method.onClose">
        <div class="comp-role-edit">
            <TForm :model="$Data.formData" label-width="120px" label-position="left" :rules="$Data2.formRules" :ref="(el) => ($From.form = el)">
                <TFormItem label="角色名称" prop="name">
                    <TInput v-model="$Data.formData.name" placeholder="请输入角色名称" />
                </TFormItem>
                <TFormItem label="角色代码" prop="code">
                    <TInput v-model="$Data.formData.code" placeholder="请输入角色代码，如：admin" />
                </TFormItem>
                <TFormItem label="角色描述" prop="description">
                    <TInput v-model="$Data.formData.description" placeholder="请输入角色描述" />
                </TFormItem>
                <TFormItem label="排序" prop="sort">
                    <TInputNumber v-model="$Data.formData.sort" :min="0" :max="9999" />
                </TFormItem>
                <TFormItem label="状态" prop="state">
                    <TRadioGroup v-model="$Data.formData.state">
                        <TRadio :value="1">正常</TRadio>
                        <TRadio :value="2">禁用</TRadio>
                    </TRadioGroup>
                </TFormItem>
            </TForm>
        </div>
        <template #footer>
            <TButton @click="$Method.onClose">取消</TButton>
            <TButton theme="primary" :loading="$Data.submitting" @click="$Method.onSubmit">确定</TButton>
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
    InputNumber as TInputNumber,
    RadioGroup as TRadioGroup,
    Radio as TRadio,
    Button as TButton,
    MessagePlugin
} from "tdesign-vue-next";
import { fieldClear } from "befly-shared/utils/fieldClear";
import { $Http } from "@/plugins/http";

const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    actionType: {
        type: String,
        default: "add"
    },
    rowData: {
        type: Object,
        default: {}
    }
});

const $Emit = defineEmits(["update:modelValue", "success"]);

// 表单引用
const $From = $shallowRef({
    form: null
});

const $Computed = {};

const $Data = $ref({
    visible: false,
    submitting: false,
    formData: {
        id: 0,
        name: "",
        code: "",
        description: "",
        sort: 0,
        state: 1
    }
});

const $Data2 = $shallowRef({
    formRules: {
        name: [{ required: true, message: "请输入角色名称", trigger: "blur" }],
        code: [
            { required: true, message: "请输入角色代码", trigger: "blur" },
            { pattern: /^[a-zA-Z0-9_]+$/, message: "角色代码只能包含字母、数字和下划线", trigger: "blur" }
        ],
        sort: [{ type: "number", message: "排序必须是数字", trigger: "blur" }]
    }
});

// 方法集合
const $Method = {
    async initData() {
        if ($Prop.actionType === "upd" && $Prop.rowData.id) {
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
            $Emit("update:modelValue", false);
        }, 300);
    },
    async onSubmit() {
        try {
            const valid = await $From.form.validate();
            if (!valid) return;

            $Data.submitting = true;
            const formData = $Prop.actionType === "add" ? fieldClear($Data.formData, { omitKeys: ["id", "state"] }) : $Data.formData;
            const res = await $Http($Prop.actionType === "upd" ? "/addon/admin/role/upd" : "/addon/admin/role/ins", formData);

            MessagePlugin.success(res.msg);
            $Emit("success");
            $Method.onClose();
        } catch (error) {
            MessagePlugin.error(error.msg || "提交失败");
        } finally {
            $Data.submitting = false;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-edit {
}
</style>
