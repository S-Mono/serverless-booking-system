<script setup lang="ts">
import { useRouter } from 'vue-router'
import { seedDatabase } from '../lib/seed' // シード機能をインポート

const router = useRouter()

const handleSeed = async () => {
  if (confirm('現在のデータが上書きされる可能性があります。実行しますか？')) {
    await seedDatabase()
  }
}

const goBack = () => {
  router.push('/admin')
}
</script>

<template>
  <div class="settings-container">
    <header class="settings-header">
      <button @click="goBack" class="back-btn">◀ ダッシュボードに戻る</button>
      <h2>システム管理設定</h2>
    </header>

    <main class="settings-body">
      <div class="setting-card danger-zone">
        <h3>⚡ 開発者用ツール</h3>
        <p>データベースの初期化やテストデータの投入を行います。</p>
        <div class="actions">
          <button @click="handleSeed" class="seed-btn">初期データを投入 (Seed)</button>
        </div>
      </div>

      <div class="setting-card">
        <h3>店舗設定 (Coming Soon)</h3>
        <p>営業時間や定休日の設定機能は開発中です。</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-container {
  min-height: 100vh;
  background-color: #f4f5f7;
  display: flex;
  flex-direction: column;
}

.settings-header {
  background: #2c3e50;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.settings-header h2 { margin: 0; font-size: 1.2rem; }

.back-btn {
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}
.back-btn:hover { background: rgba(255,255,255,0.2); }

.settings-body {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.setting-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

.setting-card h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }

.danger-zone { border-left: 5px solid #e74c3c; }

.actions { margin-top: 1rem; }

.seed-btn {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
.seed-btn:hover { background-color: #c0392b; }
</style>