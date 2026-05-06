<template>
  <div>
    <!-- Controls bar -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <!-- Sort -->
      <div class="join">
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          class="btn btn-xs join-item"
          :class="sortField === opt.value ? 'btn-primary' : 'btn-ghost'"
          @click="setSortField(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <button class="btn btn-xs btn-ghost gap-1" @click="toggleDirection">
        <span :class="sortDirection === 'desc' ? 'i-mdi-arrow-down' : 'i-mdi-arrow-up'" class="text-sm"></span>
        {{ sortDirection === 'desc' ? t('starList.sort.newest') : t('starList.sort.oldest') }}
      </button>

      <div class="flex-1"></div>

      <!-- Search -->
      <div class="relative">
        <span class="i-mdi-magnify absolute left-2 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none"></span>
        <input
          v-model="searchQuery"
          class="input input-bordered input-xs pl-7 w-44"
          :placeholder="t('starList.searchPlaceholder')"
        />
        <button v-if="searchQuery" class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-square" @click="searchQuery = ''">
          <span class="i-mdi-close text-xs"></span>
        </button>
      </div>

      <!-- Per page -->
      <select v-model="perPage" class="select select-bordered select-xs w-24" @change="onPerPageChange">
        <option v-for="n in [10, 20, 30, 50]" :key="n" :value="n">{{ n }}{{ t('starList.perPage') }}</option>
      </select>
    </div>

    <!-- Active filter chip -->
    <div v-if="activeFilterLabel || isSearchActive" class="flex items-center gap-2 mb-3">
      <span v-if="activeFilterLabel" class="badge badge-primary gap-1 text-xs py-3 pr-1">
        <span class="i-mdi-filter text-xs"></span>
        {{ activeFilterLabel }}
        <button class="btn btn-ghost btn-xs btn-square h-4 w-4 min-h-0" aria-label="Clear filter" @click="$emit('update:selectedListId', null)">
          <span class="i-mdi-close text-xs"></span>
        </button>
      </span>
      <span v-if="isSearchActive" class="text-xs text-base-content/40">{{ displayRepos.length }} {{ t('starList.filter.searchResults') }}</span>
      <span v-else-if="isListMode" class="text-xs text-base-content/40">{{ totalCount }} {{ t('starList.filter.reposSortApplies') }}</span>
      <span v-else-if="activeFilterLabel" class="text-xs text-base-content/40">{{ displayRepos.length }} {{ t('starList.filter.shownOnPage') }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-24">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error text-sm">
      <span class="i-mdi-alert-circle"></span>
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="isListMode ? loadListItems(currentPage) : loadRepos()">{{ t('starList.retry') }}</button>
    </div>

    <!-- Empty -->
    <div v-else-if="displayRepos.length === 0" class="text-center py-24 text-base-content/40">
      <span class="i-mdi-star-off text-5xl block mb-3"></span>
      <p class="font-medium">{{ t('starList.empty.noRepos') }}</p>
      <p v-if="selectedListId === '__no_list__'" class="text-sm mt-1">{{ t('starList.empty.allInList') }}</p>
      <p v-else-if="isListMode" class="text-sm mt-1">{{ t('starList.empty.listEmpty') }}</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <RepoCard
        v-for="item in displayRepos"
        :key="item.repo.id"
        :repo="item.repo"
        :starred-at="item.starred_at"
        :token="token"
        :lists="lists"
        @unstarred="handleUnstarred"
        @lists-updated="handleListsUpdated"
      />
    </div>

    <!-- Pagination: cursor-based (list mode) -->
    <div v-if="!loading && !isSearchActive && isListMode && (totalPages > 1 || currentPage > 1)" class="flex justify-center items-center gap-1 mt-6">
      <button class="btn btn-sm btn-ghost btn-square" :disabled="currentPage === 1" @click="goToPage(1)">
        <span class="i-mdi-chevron-double-left"></span>
      </button>
      <button class="btn btn-sm btn-ghost btn-square" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
        <span class="i-mdi-chevron-left"></span>
      </button>
      <span class="text-sm px-3 tabular-nums">{{ currentPage }} / {{ totalPages }}</span>
      <button class="btn btn-sm btn-ghost btn-square" :disabled="!listHasNextPage" @click="goToPage(currentPage + 1)">
        <span class="i-mdi-chevron-right"></span>
      </button>
      <span class="text-xs text-base-content/50 ml-2" v-if="totalCount">· {{ totalCount }} {{ t('starList.pagination.repos') }}</span>
    </div>

    <!-- Pagination: page numbers (REST mode) -->
    <div v-if="!loading && !isSearchActive && !isListMode && totalPages > 1" class="flex justify-center items-center gap-1 mt-6 flex-wrap">
      <button class="btn btn-sm btn-ghost btn-square" :disabled="currentPage === 1" @click="goToPage(1)">
        <span class="i-mdi-chevron-double-left"></span>
      </button>
      <button class="btn btn-sm btn-ghost btn-square" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
        <span class="i-mdi-chevron-left"></span>
      </button>
      <div class="join">
        <button
          v-for="page in visiblePages"
          :key="page"
          class="btn btn-sm join-item"
          :class="{ 'btn-primary': page === currentPage, 'btn-ghost': page !== currentPage }"
          :disabled="typeof page !== 'number'"
          @click="typeof page === 'number' && goToPage(page)"
        >{{ page }}</button>
      </div>
      <button class="btn btn-sm btn-ghost btn-square" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
        <span class="i-mdi-chevron-right"></span>
      </button>
      <button class="btn btn-sm btn-ghost btn-square" :disabled="currentPage === totalPages" @click="goToPage(totalPages)">
        <span class="i-mdi-chevron-double-right"></span>
      </button>
      <span class="text-xs text-base-content/50 ml-2">
        {{ currentPage }} / {{ totalPages }}
        <span v-if="totalCount"> · {{ totalCount }} {{ t('starList.pagination.stars') }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import RepoCard from './RepoCard.vue'
import { getStarredRepos, getListItems, getAllStarredRepos, getAllListItems } from '../services/github.js'

const { t } = useI18n()

const props = defineProps({
  token: { type: String, required: true },
  lists: { type: Array, default: () => [] },
  selectedListId: { type: String, default: null },
})

const emit = defineEmits(['listsUpdated', 'update:selectedListId'])

const sortOptions = computed(() => [
  { label: t('starList.sort.starred'), value: 'created' },
  { label: t('starList.sort.updated'), value: 'updated' },
  { label: t('starList.sort.stars'), value: 'stars' },
])

const loading = ref(false)
const error = ref('')
const allRepos = ref([])
const totalCount = ref(0)
const currentPage = ref(1)
const perPage = ref(30)
const sortField = ref('created')
const sortDirection = ref('desc')
const searchQuery = ref('')
const totalPages = ref(1)

// All repos fetched for full-dataset search (populated when searchQuery becomes non-empty)
const searchAllRepos = ref([])
const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

// Cursor-based pagination state for list mode.
// listCursorMap[page] = the `after` cursor to use when fetching that page.
// Page 1 always uses null (no cursor), so it is pre-populated.
const listCursorMap = ref({ 1: null })
const listHasNextPage = ref(false)

const isListMode = computed(() => !!props.selectedListId && props.selectedListId !== '__no_list__')

const activeFilterLabel = computed(() => {
  if (props.selectedListId === '__no_list__') return 'No List'
  if (props.selectedListId) {
    const list = props.lists.find(l => l.id === props.selectedListId)
    return list ? list.name : null
  }
  return null
})

const displayRepos = computed(() => {
  let items = isSearchActive.value ? searchAllRepos.value : allRepos.value

  // In non-list mode, apply client-side list filter for 'no list' view
  if (!isListMode.value && props.selectedListId === '__no_list__' && props.lists.length > 0) {
    items = items.filter(item =>
      !props.lists.some(list => list.repoNodeIds.has(item.repo.node_id)),
    )
  }

  // Search filter
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(
      item =>
        item.repo.full_name.toLowerCase().includes(q) ||
        (item.repo.description || '').toLowerCase().includes(q),
    )
  }

  // Client-side sort
  if (sortField.value === 'stars') {
    items = [...items].sort((a, b) => {
      const diff = a.repo.stargazers_count - b.repo.stargazers_count
      return sortDirection.value === 'desc' ? -diff : diff
    })
  } else if (isListMode.value && sortField.value === 'updated') {
    // In list mode 'updated' is client-side (no server-side sort on list items)
    items = [...items].sort((a, b) => {
      const diff = new Date(a.repo.updated_at) - new Date(b.repo.updated_at)
      return sortDirection.value === 'desc' ? -diff : diff
    })
  }
  // In list mode + 'created': no starred_at available; keep API default order

  return items
})

const visiblePages = computed(() => {
  const total = totalPages.value
  const cur = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 3) pages.push('…')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('…')
  pages.push(total)
  return pages
})

async function loadRepos() {
  loading.value = true
  error.value = ''
  try {
    const apiSort = sortField.value === 'stars' ? 'created' : sortField.value
    const { repos, totalCount: tc } = await getStarredRepos(props.token, {
      page: currentPage.value,
      perPage: perPage.value,
      sort: apiSort,
      direction: sortDirection.value,
    })
    allRepos.value = repos.map(repo => ({ repo, starred_at: repo.starred_at || null }))
    if (tc !== null) {
      totalCount.value = tc
      totalPages.value = Math.max(1, Math.ceil(tc / perPage.value))
    }
  } catch (e) {
    error.value = e.response?.data?.message || e.message || 'Failed to load repositories'
  } finally {
    loading.value = false
  }
}

async function loadListItems(page = 1) {
  if (!props.selectedListId || props.selectedListId === '__no_list__') return
  loading.value = true
  error.value = ''
  try {
    const after = listCursorMap.value[page] ?? null
    const { repos, totalCount: tc, hasNextPage, endCursor } = await getListItems(
      props.token,
      props.selectedListId,
      { first: perPage.value, after },
    )
    allRepos.value = repos
    totalCount.value = tc
    totalPages.value = Math.max(1, Math.ceil(tc / perPage.value))
    listHasNextPage.value = hasNextPage
    if (hasNextPage && endCursor) {
      listCursorMap.value = { ...listCursorMap.value, [page + 1]: endCursor }
    }
  } catch (e) {
    error.value = e.message || 'Failed to load list items'
  } finally {
    loading.value = false
  }
}

async function fetchAllForSearch() {
  loading.value = true
  error.value = ''
  try {
    if (isListMode.value) {
      searchAllRepos.value = await getAllListItems(props.token, props.selectedListId)
    } else {
      const apiSort = sortField.value === 'stars' ? 'created' : sortField.value
      const repos = await getAllStarredRepos(props.token, { sort: apiSort, direction: sortDirection.value })
      searchAllRepos.value = repos.map(repo => ({ repo, starred_at: repo.starred_at || null }))
    }
  } catch (e) {
    error.value = e.response?.data?.message || e.message || 'Failed to load repositories'
    searchAllRepos.value = []
  } finally {
    loading.value = false
  }
}

function setSortField(field) {
  if (sortField.value === field) return
  sortField.value = field
  if (!isListMode.value) {
    currentPage.value = 1
    loadRepos()
  }
  // In list mode, sort is client-side; displayRepos recomputes automatically
}

function toggleDirection() {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  if (!isListMode.value) {
    currentPage.value = 1
    loadRepos()
  }
  // In list mode, sort is client-side; displayRepos recomputes automatically
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  if (isListMode.value) {
    if (!(page in listCursorMap.value)) return
    currentPage.value = page
    loadListItems(page)
  } else {
    currentPage.value = page
    loadRepos()
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onPerPageChange() {
  currentPage.value = 1
  if (isListMode.value) {
    listCursorMap.value = { 1: null }
    listHasNextPage.value = false
    loadListItems(1)
  } else {
    loadRepos()
  }
}

function handleUnstarred(repoId) {
  allRepos.value = allRepos.value.filter(item => item.repo.id !== repoId)
  if (totalCount.value > 0) totalCount.value--
}

function handleListsUpdated() {
  emit('listsUpdated')
  // Reload current page so items removed from this list disappear immediately
  if (isListMode.value) {
    loadListItems(currentPage.value)
  }
}

// When search becomes active, fetch all repos for full-dataset filtering
watch(searchQuery, (newQuery, oldQuery) => {
  const wasEmpty = !oldQuery || oldQuery.trim().length === 0
  const isNowActive = newQuery && newQuery.trim().length > 0
  if (isNowActive && wasEmpty) {
    fetchAllForSearch()
  } else if (!isNowActive) {
    searchAllRepos.value = []
  }
})

// Switch data source when the selected list changes
watch(
  () => props.selectedListId,
  (newId) => {
    currentPage.value = 1
    listCursorMap.value = { 1: null }
    listHasNextPage.value = false
    allRepos.value = []
    searchAllRepos.value = []
    if (newId && newId !== '__no_list__') {
      if (isSearchActive.value) {
        fetchAllForSearch()
      } else {
        loadListItems(1)
      }
    } else {
      if (isSearchActive.value) {
        fetchAllForSearch()
      } else {
        loadRepos()
      }
    }
  },
)

onMounted(loadRepos)
</script>
