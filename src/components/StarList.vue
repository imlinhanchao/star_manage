<template>
  <div>
    <!-- Sort + Controls Bar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <!-- Sort field -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-base-content/70">Sort by:</span>
        <div class="join">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            class="btn btn-xs join-item"
            :class="{ 'btn-primary': sortField === opt.value, 'btn-ghost': sortField !== opt.value }"
            @click="setSortField(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Sort direction -->
      <button class="btn btn-xs btn-ghost gap-1" @click="toggleDirection">
        <span :class="sortDirection === 'desc' ? 'i-mdi-sort-descending' : 'i-mdi-sort-ascending'" class="text-base"></span>
        {{ sortDirection === 'desc' ? 'Newest first' : 'Oldest first' }}
      </button>

      <div class="flex-1"></div>

      <!-- Search -->
      <div class="join">
        <input
          v-model="searchQuery"
          class="input input-bordered input-xs join-item w-48"
          placeholder="Filter repos..."
          @input="onSearch"
        />
        <button v-if="searchQuery" class="btn btn-xs btn-ghost join-item" @click="clearSearch">
          <span class="i-mdi-close text-sm"></span>
        </button>
      </div>

      <!-- Per page -->
      <select v-model="perPage" class="select select-bordered select-xs" @change="onPerPageChange">
        <option v-for="n in [10, 20, 30, 50]" :key="n" :value="n">{{ n }} / page</option>
      </select>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center py-20">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="alert alert-error">
      <span class="i-mdi-alert-circle text-lg"></span>
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="loadRepos">Retry</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="displayRepos.length === 0" class="text-center py-20 text-base-content/50">
      <span class="i-mdi-star-off text-5xl block mb-3"></span>
      <p class="text-lg">No starred repositories found</p>
    </div>

    <!-- Repo grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <RepoCard
        v-for="item in displayRepos"
        :key="item.repo.id"
        :repo="item.repo"
        :starred-at="item.starred_at"
        :token="token"
        @unstarred="handleUnstarred"
        @lists-updated="$emit('listsUpdated')"
      />
    </div>

    <!-- Pagination -->
    <div v-if="!loading && totalPages > 1" class="flex justify-center items-center gap-2 mt-6">
      <button class="btn btn-sm btn-ghost" :disabled="currentPage === 1" @click="goToPage(1)">
        <span class="i-mdi-chevron-double-left"></span>
      </button>
      <button class="btn btn-sm btn-ghost" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
        <span class="i-mdi-chevron-left"></span>
      </button>

      <div class="join">
        <button
          v-for="page in visiblePages"
          :key="page"
          class="btn btn-sm join-item"
          :class="{ 'btn-primary': page === currentPage, 'btn-ghost': page !== currentPage }"
          @click="typeof page === 'number' && goToPage(page)"
        >
          {{ page }}
        </button>
      </div>

      <button class="btn btn-sm btn-ghost" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
        <span class="i-mdi-chevron-right"></span>
      </button>
      <button class="btn btn-sm btn-ghost" :disabled="currentPage === totalPages" @click="goToPage(totalPages)">
        <span class="i-mdi-chevron-double-right"></span>
      </button>

      <span class="text-sm text-base-content/60 ml-2">
        Page {{ currentPage }} / {{ totalPages }}
        <span v-if="totalCount"> · {{ totalCount }} repos</span>
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
})

const emit = defineEmits(['listsUpdated'])

const sortOptions = [
  { label: 'Star Time', value: 'created' },
  { label: 'Updated', value: 'updated' },
  { label: 'Stars', value: 'stars' },
]

const loading = ref(false)
const error = ref('')
const allRepos = ref([]) // raw items with {repo, starred_at}
const totalCount = ref(0)
const currentPage = ref(1)
const perPage = ref(30)
const sortField = ref('created')
const sortDirection = ref('desc')
const searchQuery = ref('')

// For client-side star-count sorting, we accumulate fetched pages
const cachedRepos = ref([]) // all pages fetched so far for star sort
const totalPages = ref(1)

const displayRepos = computed(() => {
  let items = allRepos.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(
      item =>
        item.repo.full_name.toLowerCase().includes(q) ||
        (item.repo.description || '').toLowerCase().includes(q),
    )
  }
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
  const pages = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }
  pages.push(1)
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
    pages.push(i)
  }
  if (cur < total - 2) pages.push('...')
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

    // With Accept: application/vnd.github.star+json, repos have starred_at field merged in
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

let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    // search is client-side on current page
  }, 300)
}

function clearSearch() {
  searchQuery.value = ''
}

function handleUnstarred(repoId) {
  allRepos.value = allRepos.value.filter(item => item.repo.id !== repoId)
  if (totalCount.value > 0) totalCount.value--
}

onMounted(() => {
  loadRepos()
})
</script>
