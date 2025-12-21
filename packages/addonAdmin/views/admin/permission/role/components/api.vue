<template>
    <TDialog v-model:visible="$Data.visible" title="接口权限" width="900px" :append-to-body="true" :show-footer="true" top="5vh" @close="$Method.onClose">
        <div class="comp-role-api">
            <!-- 搜索框 -->
            <div class="search-box">
                <TInput v-model="$Data.searchText" placeholder="搜索接口名称或路径" clearable @change="$Method.onSearch">
                    <template #prefix-icon>
                        <ILucideSearch />
                    </template>
                </TInput>
            </div>

            <!-- 接口分组列表 -->
            <div class="api-container">
                <div class="api-group" v-for="group in $Data.filteredApiData" :key="group.name">
                    <div class="group-header">{{ group.title }}</div>
                    <div class="api-checkbox-list">
                        <TCheckboxGroup v-model="$Data.checkedApiIds">
                            <TCheckbox v-for="api in group.apis" :key="api.id" :value="api.id">
                                {{ api.label }}
                            </TCheckbox>
                        </TCheckboxGroup>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <t-space>
                    <TButton theme="default" @click="$Method.onClose">取消</TButton>
                    <TButton theme="primary" :loading="$Data.submitting" @click="$Method.onSubmit">保存</TButton>
                </t-space>
            </div>
        </template>
    </TDialog>
</template>

<script setup>
import { Dialog as TDialog, Input as TInput, CheckboxGroup as TCheckboxGroup, Checkbox as TCheckbox, Button as TButton, MessagePlugin } from "tdesign-vue-next";
import ILucideSearch from "~icons/lucide/search";
import { $Http } from "@/plugins/http";

const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    rowData: {
        type: Object,
        default: () => ({})
    }
});

const $Emit = defineEmits(["update:modelValue", "success"]);

const $Data = $ref({
    visible: false,
    submitting: false,
    apiData: [],
    filteredApiData: [],
    searchText: "",
    checkedApiIds: []
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        await Promise.all([$Method.apiApiAll(), $Method.apiRoleApiDetail()]);
        $Data.filteredApiData = $Data.apiData;
    },

    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit("update:modelValue", false);
        }, 300);
    },

    // 加载所有接口
    async apiApiAll() {
        try {
            const res = await $Http("/addon/admin/api/all");

            // 将接口列表按 addonTitle 分组
            const apiMap = new Map();

            res.data.lists.forEach((api) => {
                const addonTitle = api.addonTitle || api.addonName || "项目接口";
                const addonName = api.addonName || "app";

                if (!apiMap.has(addonName)) {
                    apiMap.set(addonName, {
                        name: addonName,
                        title: addonTitle,
                        apis: []
                    });
                }

                apiMap.get(addonName).apis.push({
                    id: api.id,
                    label: `${api.name}`,
                    description: api.description
                });
            });

            $Data.apiData = Array.from(apiMap.values());
        } catch (error) {
            MessagePlugin.error("加载接口失败");
        }
    },

    // 加载该角色已分配的接口
    async apiRoleApiDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http("/addon/admin/role/apis", {
                roleCode: $Prop.rowData.code
            });

            $Data.checkedApiIds = res.data.apiIds || [];
        } catch (error) {
            MessagePlugin.error("加载数据失败");
        }
    },

    // 搜索过滤
    onSearch() {
        if (!$Data.searchText) {
            $Data.filteredApiData = $Data.apiData;
            return;
        }

        const searchLower = $Data.searchText.toLowerCase();
        $Data.filteredApiData = $Data.apiData
            .map((group) => ({
                ...group,
                apis: group.apis.filter((api) => api.label.toLowerCase().includes(searchLower))
            }))
            .filter((group) => group.apis.length > 0);
    },

    // 提交表单
    async onSubmit() {
        try {
            $Data.submitting = true;

            const res = await $Http("/addon/admin/role/apiSave", {
                roleCode: $Prop.rowData.code,
                apiIds: $Data.checkedApiIds
            });

            if (res.code === 0) {
                MessagePlugin.success("保存成功");
                $Data.visible = false;
                $Emit("success");
            } else {
                MessagePlugin.error(res.msg || "保存失败");
            }
        } catch (error) {
            MessagePlugin.error("保存失败");
        } finally {
            $Data.submitting = false;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-api {
    height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .search-box {
    }

    .api-container {
        flex: 1;
        overflow-y: auto;

        .api-group {
            margin-bottom: 16px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-small);
            overflow: hidden;

            .api-checkbox-list {
                padding: 10px;
            }

            &:last-child {
                margin-bottom: 0;
            }

            .group-header {
                padding: 12px 16px;
                background-color: var(--bg-color-hover);
                font-weight: 500;
                font-size: var(--font-size-sm);
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 8px;

                &::before {
                    content: "";
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--primary-color);
                    opacity: 0.3;
                    flex-shrink: 0;
                }
            }

            .api-item {
                padding: 8px 16px;
                cursor: pointer;
                transition: background-color 0.2s;
                background-color: var(--bg-color-container);

                :deep(.t-checkbox-group) {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    width: 100%;
                }

                :deep(.t-checkbox) {
                    flex: 0 0 calc(33.333% - 8px);
                    margin: 0;

                    .t-checkbox__label {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }
            }
        }
    }
}

.dialog-footer {
    width: 100%;
    display: flex;
    justify-content: center;
}
</style>
