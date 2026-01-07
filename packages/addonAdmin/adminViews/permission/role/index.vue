<template>
    <div class="page-role page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <ILucidePlus />
                    </template>
                </TButton>
            </div>
            <div class="right">
                <TButton shape="circle" @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>
        <div class="main-content">
            <div class="main-table">
                <TTable
                    :data="$Data.tableData"
                    :columns="$Data.columns"
                    :loading="$Data.loading"
                    :active-row-keys="$Data.activeRowKeys"
                    row-key="id"
                    height="calc(100vh - var(--search-height) - var(--pagination-height) - var(--layout-gap) * 4)"
                    active-row-type="single"
                    @active-change="$Method.onActiveChange"
                >
                    <template #state="{ row }">
                        <TTag v-if="row.state === 1" shape="round" theme="success" variant="light-outline">正常</TTag>
                        <TTag v-else-if="row.state === 2" shape="round" theme="warning" variant="light-outline">禁用</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">已删除</TTag>
                    </template>
                    <template #menuCount="{ row }">
                        {{ $Method.getPathCount(row.menus) }}
                    </template>
                    <template #apiCount="{ row }">
                        {{ $Method.getPathCount(row.apis) }}
                    </template>
                    <template #operation="{ row }">
                        <TDropdown trigger="click" placement="bottom-right" @click="(data) => $Method.onAction(data.value, row)">
                            <TButton theme="primary" size="small">
                                操作
                                <template #suffix> <ILucideChevronDown /></template>
                            </TButton>
                            <TDropdownMenu slot="dropdown">
                                <TDropdownItem value="upd">
                                    <ILucidePencil />
                                    编辑
                                </TDropdownItem>
                                <TDropdownItem value="menu">
                                    <ILucideSettings />
                                    菜单权限
                                </TDropdownItem>
                                <TDropdownItem value="api">
                                    <ILucideCode />
                                    接口权限
                                </TDropdownItem>
                                <TDropdownItem value="del" :divider="true">
                                    <ILucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                    删除
                                </TDropdownItem>
                            </TDropdownMenu>
                        </TDropdown>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.columns" />
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiRoleList" />

        <!-- 菜单权限对话框组件 -->
        <MenuDialog v-if="$Data.menuVisible" v-model="$Data.menuVisible" :row-data="$Data.rowData" @success="$Method.apiRoleList" />

        <!-- 接口权限对话框组件 -->
        <ApiDialog v-if="$Data.apiVisible" v-model="$Data.apiVisible" :row-data="$Data.rowData" @success="$Method.apiRoleList" />
    </div>
</template>

<script setup lang="ts">
import { Button as TButton, Table as TTable, Tag as TTag, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin, DialogPlugin } from "tdesign-vue-next";
import ILucidePlus from "~icons/lucide/plus";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import ILucidePencil from "~icons/lucide/pencil";
import ILucideSettings from "~icons/lucide/settings";
import ILucideCode from "~icons/lucide/code";
import ILucideTrash2 from "~icons/lucide/trash-2";
import ILucideChevronDown from "~icons/lucide/chevron-down";
import EditDialog from "./components/edit.vue";
import MenuDialog from "./components/menu.vue";
import ApiDialog from "./components/api.vue";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { withDefaultColumns } from "../../../utils/withDefaultColumns";

definePage({
    meta: {
        title: "角色管理",
        order: 1
    }
});

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    activeRowKeys: [],
    currentRow: null,
    columns: withDefaultColumns([
        { colKey: "name", title: "角色名称" },
        { colKey: "code", title: "角色代码", width: 150 },
        { colKey: "menuCount", title: "菜单数量", align: "center", width: 100 },
        { colKey: "apiCount", title: "接口数量", align: "center", width: 100 },
        { colKey: "sort", title: "排序" },
        { colKey: "state", title: "状态" },
        { colKey: "description", title: "描述" },
        { colKey: "operation", title: "操作" }
    ]),
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0,
        align: "right",
        layout: "total, prev, pager, next, jumper"
    },
    editVisible: false,
    menuVisible: false,
    apiVisible: false,
    actionType: "add",
    rowData: {}
});

// 方法
const $Method = {
    getPathCount(value) {
        if (!Array.isArray(value)) return 0;
        return value.filter((p) => typeof p === "string" && p.trim().length > 0).length;
    },
    async initData() {
        await $Method.apiRoleList();
    },
    // 加载角色列表
    async apiRoleList() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/role/list", {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;

            // 自动选中并高亮第一行
            if ($Data.tableData.length > 0) {
                $Data.currentRow = $Data.tableData[0];
                $Data.activeRowKeys = [$Data.tableData[0].id];
            } else {
                $Data.currentRow = null;
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            MessagePlugin.error("加载数据失败");
        } finally {
            $Data.loading = false;
        }
    },

    // 删除角色
    async apiRoleDel(row) {
        let dialog = null;
        let destroyed = false;

        const destroy = () => {
            if (destroyed) return;
            destroyed = true;
            if (dialog && typeof dialog.destroy === "function") {
                dialog.destroy();
            }
        };

        dialog = DialogPlugin.confirm({
            header: "确认删除",
            body: `确认删除角色“${row.name}”吗？`,
            status: "warning",
            confirmBtn: "删除",
            cancelBtn: "取消",
            onConfirm: async () => {
                if (dialog && typeof dialog.setConfirmLoading === "function") {
                    dialog.setConfirmLoading(true);
                }

                try {
                    await $Http("/addon/admin/role/del", { id: row.id });
                    MessagePlugin.success("删除成功");
                    destroy();
                    await $Method.apiRoleList();
                } catch (error) {
                    MessagePlugin.error("删除失败");
                } finally {
                    if (dialog && typeof dialog.setConfirmLoading === "function") {
                        dialog.setConfirmLoading(false);
                    }
                }
            },
            onClose: () => {
                destroy();
            }
        });
    },

    // 刷新
    handleRefresh() {
        $Method.apiRoleList();
    },

    // 分页改变
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiRoleList();
    },

    // 每页条数改变
    handleSizeChange({ pageSize }) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiRoleList();
    },

    // 高亮行变化
    onActiveChange(value, context) {
        // 禁止取消高亮：如果新值为空，保持当前选中
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        // 更新当前高亮的行数据
        if (context.activeRowList && context.activeRowList.length > 0) {
            $Data.currentRow = context.activeRowList[0].row;
        }
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === "add" || command === "upd") {
            $Data.editVisible = true;
        } else if (command === "menu") {
            $Data.menuVisible = true;
        } else if (command === "api") {
            $Data.apiVisible = true;
        } else if (command === "del") {
            $Method.apiRoleDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
/* page styles */
</style>
