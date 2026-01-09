<template>
    <TDialog v-model:visible="$Data.visible" title="菜单权限" width="900px" :append-to-body="true" :show-footer="true" top="5vh" @close="$Method.onClose">
        <div class="comp-role-menu">
            <!-- 搜索框 -->
            <div class="search-box">
                <TInput v-model="$Data.searchText" placeholder="搜索菜单名称或路径" clearable @change="$Method.onSearch">
                    <template #prefix-icon>
                        <ILucideSearch />
                    </template>
                </TInput>
            </div>

            <div class="menu-container">
                <div class="menu-group" v-for="group in $Data.filteredMenuGroups" :key="group.name">
                    <div class="group-header">{{ group.title }}</div>
                    <div class="menu-checkbox-list">
                        <TCheckboxGroup v-model="$Data.checkedMenuPaths">
                            <TCheckbox v-for="menu in group.menus" :key="menu.value" :value="menu.value">
                                <div class="menu-checkbox-label">
                                    <div class="menu-label-main">
                                        <div class="menu-name" :title="menu.path ? `${menu.name}\n${menu.path}` : menu.name">
                                            {{ menu.name }}
                                        </div>
                                    </div>
                                </div>
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

<script setup lang="ts">
import { Dialog as TDialog, CheckboxGroup as TCheckboxGroup, Checkbox as TCheckbox, Button as TButton, Input as TInput, MessagePlugin } from "tdesign-vue-next";
import ILucideSearch from "~icons/lucide/search";
import { $Http } from "@/plugins/http";
import { arrayToTree } from "../../../../utils/arrayToTree";

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
    searchText: "",
    menuGroups: [],
    filteredMenuGroups: [],
    checkedMenuPaths: []
});

// 方法集合
const $Method = {
    async initData() {
        await Promise.all([$Method.apiMenuAll(), $Method.apiRoleMenuDetail()]);
        $Data.filteredMenuGroups = $Data.menuGroups;
        $Method.onShow();
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

    // 加载菜单树（用于配置权限）
    async apiMenuAll() {
        try {
            const res = await $Http.post(
                "/addon/admin/menu/all",
                {},
                {
                    dropValues: [""]
                }
            );
            const lists = Array.isArray(res?.data?.lists) ? res.data.lists : [];

            const treeResult = arrayToTree(lists, "path", "parentPath", "children", "sort");
            const roots = Array.isArray(treeResult?.tree) ? treeResult.tree : [];

            const groups = [];
            for (const root of roots) {
                const rootPath = typeof root?.path === "string" ? root.path : "";
                const rootName = typeof root?.name === "string" ? root.name : "";

                const menus = [];

                const walk = (node, depth) => {
                    const name = typeof node?.name === "string" ? node.name : "";
                    const path = typeof node?.path === "string" ? node.path : "";
                    if (path.length > 0) {
                        menus.push({
                            value: path,
                            name: name,
                            path: path,
                            depth: depth,
                            label: `${name} ${path}`.trim()
                        });
                    }

                    const children = Array.isArray(node?.children) ? node.children : [];
                    for (const child of children) {
                        walk(child, depth + 1);
                    }
                };

                walk(root, 0);

                const groupTitle = rootName.length > 0 ? rootName : rootPath;
                groups.push({
                    name: rootPath.length > 0 ? rootPath : groupTitle,
                    title: groupTitle.length > 0 ? groupTitle : "未命名菜单",
                    menus: menus
                });
            }

            $Data.menuGroups = groups;
        } catch (error) {
            MessagePlugin.error("加载菜单失败");
        }
    },

    // 加载该角色已分配的菜单
    async apiRoleMenuDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http.post(
                "/addon/admin/role/menus",
                {
                    roleCode: $Prop.rowData.code
                },
                {
                    dropValues: [""]
                }
            );

            // menus 返回的 data 直接就是菜单 path 数组
            $Data.checkedMenuPaths = Array.isArray(res.data) ? res.data : [];
        } catch (error) {
            MessagePlugin.error("加载数据失败");
        }
    },

    // 搜索过滤（按“名称 + 路径”匹配；展示结构与接口弹框一致）
    onSearch() {
        const kw = typeof $Data.searchText === "string" ? $Data.searchText.trim().toLowerCase() : "";
        if (kw.length === 0) {
            $Data.filteredMenuGroups = $Data.menuGroups;
            return;
        }

        $Data.filteredMenuGroups = $Data.menuGroups
            .map((group) => {
                const menus = Array.isArray(group?.menus)
                    ? group.menus.filter((menu) => {
                          const label = typeof menu?.label === "string" ? menu.label : "";
                          return label.toLowerCase().includes(kw);
                      })
                    : [];

                return {
                    name: group.name,
                    title: group.title,
                    menus: menus
                };
            })
            .filter((group) => Array.isArray(group.menus) && group.menus.length > 0);
    },

    // 提交表单
    async onSubmit() {
        try {
            $Data.submitting = true;

            const res = await $Http.post("/addon/admin/role/menuSave", {
                roleCode: $Prop.rowData.code,
                menuPaths: $Data.checkedMenuPaths
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
.comp-role-menu {
    height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .menu-container {
        flex: 1;
        overflow-y: auto;

        .menu-group {
            margin-bottom: 16px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-small);
            overflow: hidden;

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

            .menu-checkbox-list {
                padding: 10px;

                :deep(.t-checkbox-group) {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    width: 100%;
                }

                :deep(.t-checkbox) {
                    flex: 0 0 calc(33.333% - 8px);
                    margin: 0;
                    min-width: 0;
                }

                :deep(.t-checkbox__label) {
                    min-width: 0;
                }
            }
        }
    }
}

.menu-checkbox-label {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.menu-label-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.menu-name {
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
