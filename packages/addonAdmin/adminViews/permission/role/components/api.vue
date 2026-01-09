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
                <TCheckboxGroup v-model="$Data.checkedApiPaths">
                    <div class="api-group" v-for="group in $Data.filteredApiData" :key="group.name">
                        <div class="group-header">{{ group.title }}</div>
                        <div class="api-checkbox-list">
                            <TCheckbox v-for="api in group.apis" :key="api.value" :value="api.value">
                                <div class="api-checkbox-label">
                                    <div class="api-label-main">
                                        <div class="api-name" :title="api.path ? `${api.name}\n${api.path}` : api.name">{{ api.name }}</div>
                                    </div>
                                </div>
                            </TCheckbox>
                        </div>
                    </div>
                </TCheckboxGroup>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <TSpace>
                    <TButton theme="default" @click="$Method.onClose">取消</TButton>
                    <TButton theme="primary" :loading="$Data.submitting" @click="$Method.onSubmit">保存</TButton>
                </TSpace>
            </div>
        </template>
    </TDialog>
</template>

<script setup lang="ts">
import { Dialog as TDialog, Input as TInput, CheckboxGroup as TCheckboxGroup, Checkbox as TCheckbox, Button as TButton, Space as TSpace, MessagePlugin } from "tdesign-vue-next";
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
    checkedApiPaths: []
});

// 方法集合
const $Method = {
    async initData() {
        $Method.onShow();
        await Promise.all([$Method.apiApiAll(), $Method.apiRoleApiDetail()]);

        // auth=0（免登录）接口默认选中：与角色已有权限做并集，不覆盖。
        const merged = new Set();
        const current = Array.isArray($Data.checkedApiPaths) ? $Data.checkedApiPaths : [];
        for (const p of current) {
            merged.add(p);
        }

        const groups = Array.isArray($Data.apiData) ? $Data.apiData : [];
        for (const group of groups) {
            const apis = group && group.apis;
            const list = Array.isArray(apis) ? apis : [];
            for (const api of list) {
                const isPublic = api && (api.auth === 0 || api.auth === "0" || api.auth === false);
                if (isPublic && typeof api.value === "string" && api.value) {
                    merged.add(api.value);
                }
            }
        }

        $Data.checkedApiPaths = Array.from(merged);
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
            const res = await $Http.post("/addon/admin/api/all");

            // 将接口列表按 parentPath 分组展示（routePath 已迁移为 path）
            const apiMap = new Map();

            const lists = res && res.data && Array.isArray(res.data.lists) ? res.data.lists : [];
            for (const api of lists) {
                const apiPath = api && typeof api.path === "string" ? api.path : "";
                if (!apiPath) {
                    continue;
                }

                const parentPath = api && typeof api.parentPath === "string" ? api.parentPath : "";
                const groupKey = parentPath || "(未分组)";

                if (!apiMap.has(groupKey)) {
                    apiMap.set(groupKey, {
                        name: groupKey,
                        title: groupKey,
                        apis: []
                    });
                }

                apiMap.get(groupKey).apis.push({
                    value: apiPath,
                    name: (api && typeof api.name === "string" ? api.name : "") || apiPath,
                    path: apiPath,
                    label: `${(api && typeof api.name === "string" ? api.name : "") || ""} ${apiPath ? `(${apiPath})` : ""}`.trim(),
                    description: api ? api.description : undefined,
                    auth: api ? api.auth : undefined,
                    parentPath: parentPath
                });
            }

            const groups = Array.from(apiMap.values());
            for (const group of groups) {
                group.apis.sort((a, b) => {
                    const ap = typeof a.path === "string" ? a.path : "";
                    const bp = typeof b.path === "string" ? b.path : "";
                    return ap.localeCompare(bp);
                });
            }

            groups.sort((a, b) => {
                const at = typeof a.title === "string" ? a.title : "";
                const bt = typeof b.title === "string" ? b.title : "";
                return at.localeCompare(bt);
            });

            $Data.apiData = groups;
        } catch (error) {
            MessagePlugin.error("加载接口失败");
        }
    },

    // 加载该角色已分配的接口
    async apiRoleApiDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http.post("/addon/admin/role/apis", {
                roleCode: $Prop.rowData.code
            });

            $Data.checkedApiPaths = res.data.apiPaths || [];
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
            .map((group) => {
                const apis = group.apis.filter((api) => {
                    const label = api && typeof api.label === "string" ? api.label : "";
                    const name = api && typeof api.name === "string" ? api.name : "";
                    const path = api && typeof api.path === "string" ? api.path : "";
                    return label.toLowerCase().includes(searchLower) || name.toLowerCase().includes(searchLower) || path.toLowerCase().includes(searchLower);
                });
                return {
                    name: group.name,
                    title: group.title,
                    apis: apis
                };
            })
            .filter((group) => group.apis.length > 0);
    },

    // 提交表单
    async onSubmit() {
        try {
            $Data.submitting = true;

            const res = await $Http.post("/addon/admin/role/apiSave", {
                roleCode: $Prop.rowData.code,
                apiPaths: $Data.checkedApiPaths
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

    .api-container {
        flex: 1;
        overflow-y: auto;

        /* CheckboxGroup 默认可能是 inline 布局，容易被内容撑开；这里强制占满容器宽度 */
        :deep(.t-checkbox-group) {
            display: block;
            width: 100%;
        }

        .api-group {
            margin-bottom: 16px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-small);
            overflow: hidden;

            .api-checkbox-list {
                padding: 12px 16px;
                display: flex;
                flex-wrap: wrap;
                gap: 12px;

                :deep(.t-checkbox) {
                    margin: 0;
                    flex: 0 0 calc(33.333% - 8px);
                    min-width: 0;

                    .t-checkbox__label {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }
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

.api-checkbox-label {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.api-label-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.api-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dialog-footer {
    width: 100%;
    display: flex;
    justify-content: center;
}
</style>
