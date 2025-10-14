<template>
    <div class="layout-1">
        <header class="layout-header">
            <h1>布局 1 - 侧边栏布局</h1>
            <nav class="nav-menu">
                <router-link to="/">首页</router-link>
                <router-link to="/news">新闻</router-link>
            </nav>
        </header>

        <div class="layout-content">
            <aside class="sidebar">
                <h3>侧边栏</h3>
                <ul>
                    <li><router-link to="/">首页</router-link></li>
                    <li><router-link to="/news">新闻</router-link></li>
                </ul>
            </aside>

            <main class="main-content">
                <router-view />
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
// 布局 1 - 侧边栏布局
</script>

<style scoped>
.layout-1 {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.layout-header {
    background: #001529;
    color: white;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 64px;
}

.nav-menu a {
    color: white;
    margin-left: 20px;
    text-decoration: none;
}

.nav-menu a.router-link-active {
    color: #1890ff;
}

.layout-content {
    display: flex;
    flex: 1;
}

.sidebar {
    width: 200px;
    background: #f0f2f5;
    padding: 20px;
    border-right: 1px solid #d9d9d9;
}

.sidebar h3 {
    margin-top: 0;
}

.sidebar ul {
    list-style: none;
    padding: 0;
}

.sidebar li {
    margin: 10px 0;
}

.sidebar a {
    color: #1890ff;
    text-decoration: none;
}

.main-content {
    flex: 1;
    padding: 20px;
    background: white;
}
</style>
