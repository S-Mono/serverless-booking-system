import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'

export const useUserStore = defineStore('user', () => {
  // ユーザー情報を入れる変数（最初は空っぽ）
  const user = ref<User | null>(null)

  // ユーザー情報をセットする関数
  const setUser = (newUser: User | null) => {
    user.value = newUser
  }

  return { user, setUser }
})