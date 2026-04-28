<template>
  <div :data-theme="theme" class="min-h-screen bg-base-100 text-base-content">
    <!-- Navbar -->
    <div class="navbar bg-base-200 shadow-md sticky top-0 z-40">
      <div class="navbar-start">
        <label for="lists-drawer" class="btn btn-ghost btn-sm lg:hidden">
          <span class="i-mdi-menu text-xl"></span>
        </label>
        <span class="flex items-center gap-2 pl-2 font-bold text-lg">
          <span class="i-mdi-star text-yellow-400 text-2xl"></span>
          Star Manage
        </span>
      </div>
      <div class="navbar-center hidden lg:flex">
        <span v-if="user" class="text-sm text-base-content/60">
          Managing stars for
          <a :href="user.html_url" target="_blank" class="font-semibold link link-hover">{{ user.login }}</a>
        </span>
      </div>
      <div class="navbar-end gap-2">
        <!-- Lists toggle (desktop) -->
        <button
          class="btn btn-ghost btn-sm gap-1 hidden lg:flex"
          :class="{ 'btn-active': showListsSidebar }"
          @click="showListsSidebar = !showListsSidebar"
        >
          <span class="i-mdi-format-list-bulleted text-base"></span>
          Lists
        </button>

        <!-- Theme toggle -->
        <label class="swap swap-rotate btn btn-ghost btn-sm btn-circle">
          <input type="checkbox" :checked="theme === 'dark'" @change="toggleTheme" />
          <span class="swap-on i-mdi-weather-night text-xl"></span>
          <span class="swap-off i-mdi-weather-sunny text-xl"></span>
        </label>

        <!-- Token button -->
        <button class="btn btn-ghost btn-sm gap-1" @click="showTokenInput = true">
          <span class="i-mdi-key-variant text-base"></span>
          <span class="hidden sm:inline">Token</span>
        </button>
      </div>
    </div>

    <!-- Main layout: drawer for mobile lists sidebar -->
    <div class="drawer lg:drawer-open" :class="{ 'drawer-end': false }">
      <input id="lists-drawer" type="checkbox" class="drawer-toggle" />

      <!-- Main content -->
      <div class="drawer-content flex flex-col">
        <main class="flex-1 p-4 max-w-screen-2xl mx-auto w-full">
          <!-- No token state -->
          <div v-if="!token" class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <span class="i-mdi-star text-yellow-400 text-7xl"></span>
            <h1 class="text-3xl font-bold">GitHub Star Manager</h1>
            <p class="text-base-content/60 text-center max-w-md">
              Manage your GitHub starred repositories. Set up your token to get started.
            </p>
            <button class="btn btn-primary btn-lg gap-2" @click="showTokenInput = true">
              <span class="i-mdi-key-variant text-xl"></span>
              Setup GitHub Token
            </button>
          </div>

          <!-- Main star list -->
          <div v-else class="flex gap-4">
            <div class="flex-1 min-w-0">
              <StarList :token="token" @lists-updated="refreshLists" />
            </div>
            <!-- Desktop lists sidebar inline -->
            <div v-if="showListsSidebar" class="hidden lg:block w-72 shrink-0">
              <div class="sticky top-20 bg-base-200 rounded-xl p-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <ListManager ref="listManagerRef" @updated="refreshLists" />
              </div>
            </div>
          </div>
        </main>
      </div>

      <!-- Mobile drawer sidebar -->
      <div class="drawer-side z-50">
        <label for="lists-drawer" class="drawer-overlay"></label>
        <div class="bg-base-100 w-72 min-h-full p-4">
          <ListManager ref="mobileListManagerRef" @updated="refreshLists" />
        </div>
      </div>
    </div>

    <!-- Token Input Modal -->
    <TokenInput
      v-if="showTokenInput"
      :has-existing-token="!!token"
      @saved="handleTokenSaved"
      @cancel="showTokenInput = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TokenInput from './src/components/TokenInput.vue'
import StarList from './src/components/StarList.vue'
import ListManager from './src/components/ListManager.vue'

const token = ref('')
const user = ref(null)
const showTokenInput = ref(false)
const showListsSidebar = ref(true)
const theme = ref('light')

const listManagerRef = ref(null)
const mobileListManagerRef = ref(null)

onMounted(() => {
  const savedToken = localStorage.getItem('github_token')
  const savedUser = localStorage.getItem('github_user')
  const savedTheme = localStorage.getItem('star_theme') || 'light'

  theme.value = savedTheme
  document.documentElement.setAttribute('data-theme', savedTheme)

  if (savedToken) {
    token.value = savedToken
    if (savedUser) {
      try { user.value = JSON.parse(savedUser) } catch {}
    }
  } else {
    showTokenInput.value = true
  }
})

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('star_theme', theme.value)
  document.documentElement.setAttribute('data-theme', theme.value)
}

function handleTokenSaved({ token: t, user: u }) {
  token.value = t
  user.value = u
  localStorage.setItem('github_user', JSON.stringify(u))
  showTokenInput.value = false
}

function refreshLists() {
  listManagerRef.value?.refresh()
  mobileListManagerRef.value?.refresh()
}
</script>

