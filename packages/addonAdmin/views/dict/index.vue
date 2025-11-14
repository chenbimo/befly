<template>
    <div class="page-dict page-table">
        <div class="main-tool">
            <div class="left">
                <TinyButton type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <IconLucidePlus />
                    </template>
                    添加字典
                </TinyButton>
            </div>
            <div class="right">
                <TinyButton @click="$Method.handleRefresh">
                    <template #icon>
                        <IconLucideRotateCw />
                    </template>
                    刷新
                </TinyButton>
            </div>
        </div>
        <div class="main-table">
            <TinyGrid :data="$Data.dictList" header-cell-class-name="custom-table-cell-class" size="small" height="100%" seq-serial>
                <TinyGridColumn type="index" title="序号" :width="60" />
                <TinyGridColumn field="name" title="字典名称" />
                <TinyGridColumn field="code" title="字典代码" :width="150" />
                <TinyGridColumn field="value" title="字典值" :width="200" />
                <TinyGridColumn field="pid" title="父级ID" :width="100" />
                <TinyGridColumn field="sort" title="排序" :width="80" />
                <TinyGridColumn field="description" title="描述" />
                <TinyGridColumn field="state" title="状态" :width="100">
                    <template #default="{ row }">
                        <TinyTag v-if="row.state === 1" type="success">正常</TinyTag>
                        <TinyTag v-else-if="row.state === 2" type="warning">禁用</TinyTag>
                        <TinyTag v-else type="danger">已删除</TinyTag>
                    </template>
                </TinyGridColumn>
                <TinyGridColumn title="操作" :width="120" align="right">
                    <template #default="{ row }">
                        <TinyDropdown title="操作" trigger="click" size="small" border visible-arrow @item-click="(data) => $Method.onAction(data.itemData.command, row)">
                            <template #dropdown>
                                <TinyDropdownMenu>
                                    <TinyDropdownItem :item-data="{ command: 'upd' }">
                                        <IconLucidePencil />
                                        编辑
                                    </TinyDropdownItem>
                                    <TinyDropdownItem :item-data="{ command: 'del' }" divided>
                                        <IconLucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                        删除
                                    </TinyDropdownItem>
                                </TinyDropdownMenu>
                            </template>
                        </TinyDropdown>
                    </template>
                </TinyGridColumn>
            </TinyGrid>
        </div>

        <div class="main-page">
            <TinyPager :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiDictList" />
    </div>
</template>

<script setup>
import { Button as TinyButton, Grid as TinyGrid, GridColumn as TinyGridColumn, Tag as TinyTag, Dropdown as TinyDropdown, DropdownMenu as TinyDropdownMenu, DropdownItem as TinyDropdownItem, Pager as TinyPager, Modal } from '@opentiny/vue';
import IconLucidePlus from '~icons/lucide/plus';
import IconLucideRotateCw from '~icons/lucide/rotate-cw';
import IconLucidePencil from '~icons/lucide/pencil';
import IconLucideTrash2 from '~icons/lucide/trash-2';

import EditDialog from './components/edit.vue';

import EditDialog from './components/edit.vue';

// 响应式数据
const $Data = $ref({
    dictList: [],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiDictList();
    },

    // 加载字典列表
    async apiDictList() {
        try {
            const res = await $Http('/addon/admin/dict/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            $Data.dictList = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;
        } catch (error) {
            console.error('加载字典列表失败:', error);
            Modal.message({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除字典
    async apiDictDel(row) {
        Modal.confirm({
            header: '确认删除',
            body: `确定要删除字典"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/dict/del', { id: row.id });
                if (res.code === 0) {
                    Modal.message({ message: '删除成功', status: 'success' });
                    $Method.apiDictList();
                } else {
                    Modal.message({ message: res.msg || '删除失败', status: 'error' });
                }
            } catch (error) {
                console.error('删除失败:', error);
                Modal.message({ message: '删除失败', status: 'error' });
            }
        });
    },

    // 刷新
    handleRefresh() {
        $Method.apiDictList();
    },

    // 分页改变
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiDictList();
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'upd') {
            $Data.editVisible = true;
        } else if (command === 'del') {
            $Method.apiDictDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
