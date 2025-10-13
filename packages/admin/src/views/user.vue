<template>
  <div class="user-page">
    <h1>用户管理页面</h1>
    <p>这个页面使用默认布局 0.vue</p>
    <div class="user-content">
      <p>这里是用户管理内容...</p>
      <button @click="goToNews">去新闻页面</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goToNews = () => {
  router.push('/news');
};
</script>

<style scoped>
.user-page {
  padding: 20px;
}

.user-content {
  margin-top: 20px;
  padding: 20px;
  background: #f0f8ff;
  border-radius: 8px;
}

button {
  padding: 10px 20px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #40a9ff;
}
</style>