<template>
  <div :data-theme="theme" class="min-h-screen bg-base-100 text-base-content">
    <!-- Navbar -->
    <div class="navbar bg-base-200 border-b border-base-300 sticky top-0 z-40 min-h-14 px-3">
      <div class="navbar-start gap-1">
        <!-- Mobile hamburger -->
        <label for="lists-drawer" class="btn btn-ghost btn-sm btn-square lg:hidden">
          <span class="i-mdi-menu text-xl"></span>
        </label>
        <span class="flex items-center gap-2 font-bold text-base">
          <span class="i-mdi-star text-yellow-400 text-lg"></span>
          {{ t('nav.title') }}
        </span>
      </div>
      <div class="navbar-center hidden lg:flex">
        <span v-if="user" class="text-xl text-base-content/50 flex items-center gap-2">
          <div class="avatar">
            <div class="w-5 rounded-full ring-secondary ring-offset-base-100 ring-2 ring-offset-2">
              <img :src="user.avatar_url" alt="User Avatar" />
            </div>  
          </div>
          <a :href="user.html_url" target="_blank" class="font-medium link link-hover text-base-content/70">{{ user.login }}</a>
        </span>
      </div>
      <div class="navbar-end gap-1">
        <label class="swap swap-rotate btn btn-ghost btn-sm btn-square">
          <input type="checkbox" :checked="theme === 'dark'" @change="toggleTheme" />
          <span class="swap-on i-mdi-weather-night text-lg"></span>
          <span class="swap-off i-mdi-weather-sunny text-lg"></span>
        </label>
        <button class="btn btn-ghost btn-sm font-semibold" @click="toggleLocale">
          {{ t('nav.switchLang') }}
        </button>
        <button class="btn btn-ghost btn-sm gap-1" @click="showTokenInput = true">
          <span class="i-mdi-key-variant text-base"></span>
          <span class="hidden sm:inline text-sm">{{ t('nav.token') }}</span>
        </button>
      </div>
    </div>

    <!-- Body: drawer (mobile overlay) + flex layout (desktop) -->
    <div class="drawer">
      <input id="lists-drawer" type="checkbox" class="drawer-toggle" />

      <div class="drawer-content">
        <!-- No-token landing -->
        <div v-if="!token" class="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-5 p-8">
          <span class="i-mdi-star text-yellow-400 text-7xl"></span>
          <h1 class="text-3xl font-bold">{{ t('landing.title') }}</h1>
          <p class="text-base-content/60 text-center max-w-sm">
            {{ t('landing.subtitle') }}
          </p>
          <button class="btn btn-primary gap-2" @click="showTokenInput = true">
            <span class="i-mdi-key-variant"></span>
            {{ t('landing.setupToken') }}
          </button>
        </div>

        <!-- Main app layout -->
        <div v-else class="flex min-h-[calc(100vh-3.5rem)]">
          <!-- Left sidebar (desktop only) -->
          <aside class="hidden lg:flex flex-col w-56 xl:w-60 shrink-0 border-r border-base-300">
            <div class="sticky top-14 overflow-y-auto max-h-[calc(100vh-3.5rem)] p-3">
              <ListManager
                :token="token"
                :lists="githubLists"
                :loading="listsLoading"
                :selected-list-id="selectedListId"
                @select-list="selectedListId = $event"
                @updated="refreshLists"
              />
            </div>
          </aside>

          <!-- Main content -->
          <main class="flex-1 min-w-0 p-4 lg:p-5">
            <StarList
              :token="token"
              :lists="githubLists"
              :selected-list-id="selectedListId"
              @lists-updated="refreshLists"
            />
          </main>
        </div>
      </div>

      <!-- Mobile drawer -->
      <div class="drawer-side z-50">
        <label for="lists-drawer" aria-label="Close navigation menu" class="drawer-overlay"></label>
        <div class="bg-base-100 w-56 min-h-full p-3 border-r border-base-300">
          <ListManager
            :token="token"
            :lists="githubLists"
            :loading="listsLoading"
            :selected-list-id="selectedListId"
            @select-list="selectedListId = $event"
            @updated="refreshLists"
          />
        </div>
      </div>
    </div>

    <!-- Token Modal -->
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
import { useI18n } from 'vue-i18n'
import TokenInput from './src/components/TokenInput.vue'
import StarList from './src/components/StarList.vue'
import ListManager from './src/components/ListManager.vue'
import { getUserLists } from './src/services/github.js'

const { t, locale } = useI18n()

const token = ref('')
const user = ref(null)
const showTokenInput = ref(false)
const theme = ref('light')
const githubLists = ref([])
const listsLoading = ref(false)
const selectedListId = ref(null) // null = all, '__no_list__' = no list, or a list GraphQL ID

onMounted(() => {
  const savedToken = localStorage.getItem('github_token')
  const savedUser = localStorage.getItem('github_user')
  const savedTheme = localStorage.getItem('star_theme') || 'winter'
  const savedLang = localStorage.getItem('star_lang')

  if (savedLang) {
    locale.value = savedLang
  }

  theme.value = savedTheme
  document.documentElement.setAttribute('data-theme', savedTheme)

  if (savedToken) {
    token.value = savedToken
    if (savedUser) {
      try { user.value = JSON.parse(savedUser) } catch (e) {
        console.warn('Failed to parse saved user, clearing:', e)
        localStorage.removeItem('github_user')
      }
    }
    loadLists()
  } else {
    showTokenInput.value = true
  }
})

function toggleTheme() {
  theme.value = theme.value === 'winter' ? 'forest' : 'winter'
  localStorage.setItem('star_theme', theme.value)
  document.documentElement.setAttribute('data-theme', theme.value)
}

function toggleLocale() {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
  localStorage.setItem('star_lang', locale.value)
}

function handleTokenSaved({ token: t, user: u }) {
  token.value = t
  user.value = u
  localStorage.setItem('github_user', JSON.stringify(u))
  showTokenInput.value = false
  loadLists()
}

async function loadLists() {
  if (!token.value) return
  listsLoading.value = true
  try {
    githubLists.value = await getUserLists(token.value)
  } catch (e) {
    console.error('Failed to load lists:', e)
  } finally {
    listsLoading.value = false
  }
}

function refreshLists() {
  loadLists()
}
</script>

