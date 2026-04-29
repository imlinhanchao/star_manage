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
        {{ sortDirection === 'desc' ? 'Newest' : 'Oldest' }}
      </button>

      <div class="flex-1"></div>

      <!-- Search -->
      <div class="relative">
        <span class="i-mdi-magnify absolute left-2 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none"></span>
        <input
          v-model="searchQuery"
          class="input input-bordered input-xs pl-7 w-44"
          placeholder="Search repos..."
        />
        <button v-if="searchQuery" class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-square" @click="searchQuery = ''">
          <span class="i-mdi-close text-xs"></span>
        </button>
      </div>

      <!-- Per page -->
      <select v-model="perPage" class="select select-bordered select-xs w-24" @change="onPerPageChange">
        <option v-for="n in [10, 20, 30, 50]" :key="n" :value="n">{{ n }} / page</option>
      </select>
    </div>

    <!-- Active filter chip -->
    <div v-if="activeFilterLabel" class="flex items-center gap-2 mb-3">
      <span class="badge badge-primary gap-1 text-xs py-3 pr-1">
        <span class="i-mdi-filter text-xs"></span>
        {{ activeFilterLabel }}
        <button class="btn btn-ghost btn-xs btn-square h-4 w-4 min-h-0" aria-label="Clear filter" @click="$emit('update:selectedListId', null)">
          <span class="i-mdi-close text-xs"></span>
        </button>
      </span>
      <span class="text-xs text-base-content/40">{{ displayRepos.length }} shown on this page</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-24">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error text-sm">
      <span class="i-mdi-alert-circle"></span>
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="loadRepos">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="displayRepos.length === 0" class="text-center py-24 text-base-content/40">
      <span class="i-mdi-star-off text-5xl block mb-3"></span>
      <p class="font-medium">No repositories found</p>
      <p v-if="selectedListId === '__no_list__'" class="text-sm mt-1">All starred repos on this page are in a list.</p>
      <p v-else-if="selectedListId" class="text-sm mt-1">No repos from this list on the current page.</p>
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
        @lists-updated="$emit('listsUpdated')"
      />
    </div>

    <!-- Pagination -->
    <div v-if="!loading && totalPages > 1" class="flex justify-center items-center gap-1 mt-6 flex-wrap">
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
        <span v-if="totalCount"> · {{ totalCount }} stars</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import RepoCard from './RepoCard.vue'
import { getStarredRepos } from '../services/github.js'

const props = defineProps({
  token: { type: String, required: true },
  lists: { type: Array, default: () => [] },
  selectedListId: { type: String, default: null },
})

const emit = defineEmits(['listsUpdated', 'update:selectedListId'])

const sortOptions = [
  { label: 'Starred', value: 'created' },
  { label: 'Updated', value: 'updated' },
  { label: 'Stars', value: 'stars' },
]

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

const activeFilterLabel = computed(() => {
  if (props.selectedListId === '__no_list__') return 'No List'
  if (props.selectedListId) {
    const list = props.lists.find(l => l.id === props.selectedListId)
    return list ? list.name : null
  }
  return null
})

const displayRepos = computed(() => {
  let items = allRepos.value

  // Filter by selected list
  if (props.selectedListId === '__no_list__' && props.lists.length > 0) {
    items = items.filter(item =>
      !props.lists.some(list => list.repoNodeIds.has(item.repo.node_id)),
    )
  } else if (props.selectedListId && props.selectedListId !== '__no_list__' && props.lists.length > 0) {
    const selectedList = props.lists.find(l => l.id === props.selectedListId)
    if (selectedList) {
      items = items.filter(item => selectedList.repoNodeIds.has(item.repo.node_id))
    }
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

  // Client-side star sort
  if (sortField.value === 'stars') {
    items = [...items].sort((a, b) => {
      const diff = a.repo.stargazers_count - b.repo.stargazers_count
      return sortDirection.value === 'desc' ? -diff : diff
    })
  }

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

function setSortField(field) {
  if (sortField.value === field) return
  sortField.value = field
  currentPage.value = 1
  loadRepos()
}

function toggleDirection() {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  currentPage.value = 1
  loadRepos()
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadRepos()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onPerPageChange() {
  currentPage.value = 1
  loadRepos()
}

function handleUnstarred(repoId) {
  allRepos.value = allRepos.value.filter(item => item.repo.id !== repoId)
  if (totalCount.value > 0) totalCount.value--
}

onMounted(loadRepos)
</script>
