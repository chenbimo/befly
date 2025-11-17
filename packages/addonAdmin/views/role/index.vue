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
                <TButton @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>
        <div class="main-table">
            <TTable :data="$Data.tableData" :columns="$Data.columns" header-cell-class-name="custom-table-cell-class" size="small" height="100%" row-key="id" bordered>
                <template #state="{ row }">
                    <TTag v-if="row.state === 1" theme="success">正常</TTag>
                    <TTag v-else-if="row.state === 2" theme="warning">禁用</TTag>
                    <TTag v-else theme="danger">已删除</TTag>
                </template>
                <template #operation="{ row }">
                    <TDropdown trigger="click" min-column-width="120" @click="(data) => $Method.onAction(data.value, row)">
                        <TButton variant="text" size="small">操作</TButton>
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

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiRoleList" />

        <!-- 菜单权限对话框组件 -->
        <MenuDialog v-if="$Data.menuVisible" v-model="$Data.menuVisible" :row-data="$Data.rowData" @success="$Method.apiRoleList" />

        <!-- 接口权限对话框组件 -->
        <ApiDialog v-if="$Data.apiVisible" v-model="$Data.apiVisible" :row-data="$Data.rowData" @success="$Method.apiRoleList" />
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import ILucidePlus from '~icons/lucide/plus';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import ILucidePencil from '~icons/lucide/pencil';
import ILucideSettings from '~icons/lucide/settings';
import ILucideCode from '~icons/lucide/code';
import ILucideTrash2 from '~icons/lucide/trash-2';
import EditDialog from './components/edit.vue';
import MenuDialog from './components/menu.vue';
import ApiDialog from './components/api.vue';
import { $Http } from '@/plugins/http';

// 响应式数据
const $Data = $ref({
    tableData: [],
    columns: [
        { colKey: 'index', title: '序号', width: 100, align: 'center' },
        { colKey: 'name', title: '角色名称', width: 150 },
        { colKey: 'code', title: '角色代码', width: 150 },
        { colKey: 'description', title: '描述', minWidth: 150, ellipsis: true },
        { colKey: 'sort', title: '排序', width: 80, align: 'center' },
        { colKey: 'state', title: '状态', width: 100, align: 'center' },
        { colKey: 'operation', title: '操作', width: 120, align: 'center', fixed: 'right' }
    ],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    menuVisible: false,
    apiVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiRoleList();
    },
    // 加载角色列表
    async apiRoleList() {
        try {
            const res = await $Http('/addon/admin/role/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;
        } catch (error) {
            console.error('加载角色列表失败:', error);
            MessagePlugin.info({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除角色
    async apiRoleDel(row) {
        DialogPlugin.confirm({
            header: '确认删除',
            body: `确定要删除角色"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/role/del', { id: row.id });
                if (res.code === 0) {
                    MessagePlugin.info({ message: '删除成功', status: 'success' });
                    $Method.apiRoleList();
                } else {
                    MessagePlugin.info({ message: res.msg || '删除失败', status: 'error' });
                }
            } catch (error) {
                console.error('删除失败:', error);
                MessagePlugin.info({ message: '删除失败', status: 'error' });
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

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'upd') {
            $Data.editVisible = true;
        } else if (command === 'menu') {
            $Data.menuVisible = true;
        } else if (command === 'api') {
            $Data.apiVisible = true;
        } else if (command === 'del') {
            $Method.apiRoleDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.page-role {
}
</style>
