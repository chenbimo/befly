<template>
    <div class="layout-admin">
        <aside class="layout-sidebar">
            <div class="sidebar-header">
                <h2>管理后台</h2>
            </div>
            <nav class="sidebar-nav">
                <router-link to="/">首页</router-link>
                <router-link to="/addon/admin/menu">菜单管理</router-link>
                <router-link to="/addon/admin/role">角色管理</router-link>
                <router-link to="/addon/admin/admin">管理员</router-link>
            </nav>
        </aside>
        <div class="layout-main">
            <header class="layout-header">
                <div class="header-left">
                    <h1>Befly Admin</h1>
                </div>
                <div class="header-right">
                    <span>管理员</span>
                </div>
            </header>
            <main class="layout-content">
                <router-view />
            </main>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.layout-admin {
    display: flex;
    min-height: 100vh;

    .layout-sidebar {
        width: 220px;
        background: $menu-bg-color;
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;

        .sidebar-header {
            height: 60px;
            display: flex;
            align-items: center;
            padding: 0 20px;
            border-bottom: 1px solid $border-color;

            h2 {
                margin: 0;
                font-size: 18px;
                color: $text-color;
            }
        }

        .sidebar-nav {
            flex: 1;
            padding: 20px 0;

            a {
                display: block;
                padding: 12px 20px;
                color: $text-color-secondary;
                text-decoration: none;
                transition: all 0.3s;

                &:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: $primary-color;
                }

                &.router-link-active {
                    background: $primary-color-light;
                    color: $primary-color;
                    border-right: 3px solid $primary-color;
                }
            }
        }
    }

    .layout-main {
        flex: 1;
        display: flex;
        flex-direction: column;

        .layout-header {
            height: 60px;
            background: #fff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;

            .header-left {
                h1 {
                    margin: 0;
                    font-size: 20px;
                    color: $text-color;
                }
            }

            .header-right {
                span {
                    color: $text-color-secondary;
                }
            }
        }

        .layout-content {
            flex: 1;
            padding: 20px;
            background: $bg-color;
            overflow-y: auto;
        }
    }
}
</style>
