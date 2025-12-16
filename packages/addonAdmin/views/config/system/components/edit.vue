<template>
    <TDialog v-model:visible="$Data.visible" :title="$Prop.actionType === 'upd' ? '编辑配置' : '添加配置'" width="600px" :append-to-body="true" :show-footer="true" :esc-closable="false" top="10vh" @close="$Method.onClose">
        <TForm :model="$Data.formData" label-width="120px" label-position="left" :rules="$Data2.formRules" :ref="(el) => ($Form.form = el)">
            <TFormItem label="配置名称" prop="name">
                <TInput v-model="$Data.formData.name" placeholder="请输入配置名称" :disabled="$Data.isSystem" />
            </TFormItem>
            <TFormItem label="配置代码" prop="code">
                <TInput v-model="$Data.formData.code" placeholder="请输入配置代码，如：site_name" :disabled="$Prop.actionType === 'upd'" />
            </TFormItem>
            <TFormItem label="配置值" prop="value">
                <TTextarea v-if="$Data.formData.valueType === 'json' || $Data.formData.valueType === 'text'" v-model="$Data.formData.value" placeholder="请输入配置值" :autosize="{ minRows: 3, maxRows: 8 }" />
                <TInput v-else v-model="$Data.formData.value" placeholder="请输入配置值" />
            </TFormItem>
            <TFormItem label="值类型" prop="valueType">
                <TSelect v-model="$Data.formData.valueType" :disabled="$Data.isSystem">
                    <TOption label="字符串" value="string" />
                    <TOption label="数字" value="number" />
                    <TOption label="布尔" value="boolean" />
                    <TOption label="JSON" value="json" />
                </TSelect>
            </TFormItem>
            <TFormItem label="配置分组" prop="group">
                <TSelect v-model="$Data.formData.group" placeholder="请选择分组" clearable :disabled="$Data.isSystem">
                    <TOption v-for="item in $Data2.groupOptions" :key="item" :label="item" :value="item" />
                </TSelect>
            </TFormItem>
            <TFormItem label="排序" prop="sort">
                <TInputNumber v-model="$Data.formData.sort" :min="0" :max="9999" :disabled="$Data.isSystem" />
            </TFormItem>
            <TFormItem label="描述说明" prop="description">
                <TTextarea v-model="$Data.formData.description" placeholder="请输入描述说明" :autosize="{ minRows: 2, maxRows: 4 }" :disabled="$Data.isSystem" />
            </TFormItem>
            <TFormItem v-if="$Prop.actionType === 'upd' && !$Data.isSystem" label="状态" prop="state">
                <TRadioGroup v-model="$Data.formData.state">
                    <TRadio :value="1">正常</TRadio>
                    <TRadio :value="2">禁用</TRadio>
                </TRadioGroup>
            </TFormItem>
        </TForm>
        <template #footer>
            <TButton @click="$Method.onClose">取消</TButton>
            <TButton theme="primary" :loading="$Data.submitting" @click="$Method.onSubmit">确定</TButton>
        </template>
    </TDialog>
</template>

<script setup>
import { watch } from "vue";
import { Dialog as TDialog, Form as TForm, FormItem as TFormItem, Input as TInput, Textarea as TTextarea, InputNumber as TInputNumber, Select as TSelect, Option as TOption, RadioGroup as TRadioGroup, Radio as TRadio, Button as TButton, MessagePlugin } from "tdesign-vue-next";
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
        default: () => ({})
    }
});

const $Emit = defineEmits(["update:modelValue", "success"]);

// 表单引用
const $Form = $shallowRef({
    form: null
});

const $Data = $ref({
    visible: false,
    submitting: false,
    isSystem: false,
    formData: {
        id: 0,
        name: "",
        code: "",
        value: "",
        valueType: "string",
        group: "",
        sort: 0,
        description: "",
        state: 1
    }
});

const $Data2 = $shallowRef({
    formRules: {
        name: [{ required: true, message: "请输入配置名称", trigger: "blur" }],
        code: [
            { required: true, message: "请输入配置代码", trigger: "blur" },
            { pattern: /^[a-zA-Z0-9_]+$/, message: "配置代码只能包含字母、数字和下划线", trigger: "blur" }
        ],
        value: [{ required: true, message: "请输入配置值", trigger: "blur" }],
        valueType: [{ required: true, message: "请选择值类型", trigger: "change" }]
    },
    groupOptions: ["基础配置", "邮件配置", "存储配置", "安全配置", "其他"]
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
    },

    onShow() {
        $Data.visible = true;
        if ($Prop.actionType === "upd" && $Prop.rowData) {
            $Data.formData.id = $Prop.rowData.id || 0;
            $Data.formData.name = $Prop.rowData.name || "";
            $Data.formData.code = $Prop.rowData.code || "";
            $Data.formData.value = $Prop.rowData.value || "";
            $Data.formData.valueType = $Prop.rowData.valueType || "string";
            $Data.formData.group = $Prop.rowData.group || "";
            $Data.formData.sort = $Prop.rowData.sort || 0;
            $Data.formData.description = $Prop.rowData.description || "";
            $Data.formData.state = $Prop.rowData.state || 1;
            $Data.isSystem = $Prop.rowData.isSystem === 1;
        } else {
            $Data.formData = {
                id: 0,
                name: "",
                code: "",
                value: "",
                valueType: "string",
                group: "",
                sort: 0,
                description: "",
                state: 1
            };
            $Data.isSystem = false;
        }
    },

    onClose() {
        $Data.visible = false;
        $Emit("update:modelValue", false);
    },

    async onSubmit() {
        const valid = await $Form.form?.validate();
        if (valid !== true) return;

        $Data.submitting = true;
        try {
            const api = $Prop.actionType === "upd" ? "/addon/admin/sysConfig/upd" : "/addon/admin/sysConfig/ins";
            const res = await $Http(api, $Data.formData);

            if (res.code === 0) {
                MessagePlugin.success($Prop.actionType === "upd" ? "编辑成功" : "添加成功");
                $Emit("success");
                $Method.onClose();
            } else {
                MessagePlugin.error(res.msg || "操作失败");
            }
        } catch (error) {
            MessagePlugin.error("操作失败");
        } finally {
            $Data.submitting = false;
        }
    }
};

watch(
    () => $Prop.modelValue,
    (val) => {
        if (val) {
            $Method.initData();
        }
    },
    { immediate: true }
);
</script>

<style scoped lang="scss"></style>
