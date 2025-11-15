<template>
    <div class="page-role page-table">
        <div class="main-tool">
            <div class="left">
                <t-button type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <IconLucidePlus />
                    </template>
                    添加角色
                </t-button>
            </div>
            <div class="right">
                <t-button @click="$Method.handleRefresh">
                    <template #icon>
                        <IconLucideRotateCw />
                    </template>
                    刷新
                </t-button>
            </div>
        </div>
        <div class="main-table">
            <t-table :data="$Data.tableData" header-cell-class-name="custom-table-cell-class" size="small" height="100%" show-overflow="tooltip" border seq-serial>
                <t-tableColumn type="index" title="序号" align="center" :width="100" />
                <t-tableColumn field="name" title="角色名称" :width="150" />
                <t-tableColumn field="code" title="角色代码" :width="150" />
                <t-tableColumn field="description" title="描述" :min-width="150" />
                <t-tableColumn field="sort" title="排序" align="center" :width="80" />
                <t-table-column field="state" title="状态" align="center" :width="100">
                    <template #default="{ row }">
                        <t-tag v-if="row.state === 1" type="success">正常</t-tag>
                        <t-tag v-else-if="row.state === 2" type="warning">禁用</t-tag>
                        <t-tag v-else type="danger">已删除</t-tag>
                    </template>
                </t-table-column>
                <t-table-column title="操作" :width="120" align="center" fixed="right">
                    <template #default="{ row }">
                        <t-dropdown title="操作" trigger="click" size="small" border visible-arrow @item-click="(data) => $Method.onAction(data.itemData.command, row)">
                            <template #dropdown>
                                <t-dropdown-menu>
                                    <t-dropdown-item :item-data="{ command: 'upd' }">
                                        <IconLucidePencil />
                                        编辑
                                    </t-dropdown-item>
                                    <t-dropdown-item :item-data="{ command: 'menu' }">
                                        <IconLucideSettings />
                                        菜单权限
                                    </t-dropdown-item>
                                    <t-dropdown-item :item-data="{ command: 'api' }">
                                        <IconLucideCode />
                                        接口权限
                                    </t-dropdown-item>
                                    <t-dropdown-item :item-data="{ command: 'del' }" divided>
                                        <IconLucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                        删除
                                    </t-dropdown-item>
                                </t-dropdown-menu>
                            </template>
                        </t-dropdown>
                    </template>
                </t-table-column>
            </t-table>
        </div>

        <div class="main-page">
            <t-pagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @size-change="$Method.handleSizeChange" />
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
import IconLucidePlus from '~icons/lucide/plus';
import IconLucideRotateCw from '~icons/lucide/rotate-cw';
import IconLucidePencil from '~icons/lucide/pencil';
import IconLucideSettings from '~icons/lucide/settings';
import IconLucideCode from '~icons/lucide/code';
import IconLucideTrash2 from '~icons/lucide/trash-2';
import EditDialog from './components/edit.vue';
import MenuDialog from './components/menu.vue';
import ApiDialog from './components/api.vue';
import { $Http } from '@/plugins/http';

// 响应式数据
const $Data = $ref({
    tableData: [],
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
