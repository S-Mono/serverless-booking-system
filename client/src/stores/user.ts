import { ref } from 'vue'
import { defineStore } from 'pinia'
// 👇 ここを変更 (Supabase -> Firebase)
import type { User } from 'firebase/auth'

export const useUserStore = defineStore('user', () =>
{
  const user = ref<User | null>(null)

  const setUser = (newUser: User | null) =>
  {
    user.value = newUser
  }

  return { user, setUser }
})