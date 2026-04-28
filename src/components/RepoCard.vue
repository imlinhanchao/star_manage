<template>
  <div class="card bg-base-200 hover:bg-base-300 transition-colors shadow-sm border border-base-300">
    <div class="card-body p-4 gap-3">
      <!-- Header: Owner/Repo name + Language badge -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <a
            :href="repo.html_url"
            target="_blank"
            class="font-bold text-base link link-hover text-primary truncate block"
          >
            {{ repo.full_name }}
          </a>
          <p v-if="repo.description" class="text-sm text-base-content/70 mt-1 line-clamp-2">
            {{ repo.description }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span v-if="repo.language" class="badge badge-ghost badge-sm">
            {{ repo.language }}
          </span>
          <span v-if="repo.private" class="badge badge-warning badge-sm">Private</span>
        </div>
      </div>

      <!-- Stats row -->
      <div class="flex items-center gap-4 text-sm text-base-content/60">
        <span class="flex items-center gap-1">
          <span class="i-mdi-star text-yellow-400"></span>
          {{ formatCount(repo.stargazers_count) }}
        </span>
        <span class="flex items-center gap-1">
          <span class="i-mdi-source-fork"></span>
          {{ formatCount(repo.forks_count) }}
        </span>
        <span class="flex items-center gap-1 ml-auto">
          <span class="i-mdi-clock-outline"></span>
          {{ formatDate(repo.updated_at) }}
        </span>
      </div>

      <!-- Topics -->
      <div v-if="repo.topics?.length" class="flex flex-wrap gap-1">
        <span
          v-for="topic in repo.topics.slice(0, 5)"
          :key="topic"
          class="badge badge-outline badge-xs"
        >{{ topic }}</span>
        <span v-if="repo.topics.length > 5" class="badge badge-ghost badge-xs">
          +{{ repo.topics.length - 5 }}
        </span>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 pt-1 border-t border-base-300">
        <!-- List dropdown -->
        <div class="dropdown dropdown-top">
          <button tabindex="0" class="btn btn-xs btn-ghost gap-1" :disabled="togglingList">
            <span v-if="togglingList" class="loading loading-spinner loading-xs"></span>
            <span v-else class="i-mdi-playlist-plus text-base"></span>
            Lists
            <span v-if="repoListIds.size > 0" class="badge badge-primary badge-xs">{{ repoListIds.size }}</span>
          </button>
          <div tabindex="0" class="dropdown-content z-[1] card card-compact shadow bg-base-100 w-56 border border-base-300">
            <div class="card-body p-2 gap-1">
              <p class="font-semibold text-xs px-2 py-1 text-base-content/60">GITHUB LISTS</p>
              <div v-if="lists.length === 0" class="px-2 py-1 text-sm text-base-content/50">
                No lists yet — create one in the sidebar
              </div>
              <button
                v-for="list in lists"
                :key="list.id"
                class="btn btn-ghost btn-xs justify-start"
                :class="{ 'btn-active': repoListIds.has(list.id) }"
                :disabled="togglingList"
                @click="toggleList(list)"
              >
                <span :class="repoListIds.has(list.id) ? 'i-mdi-check-circle text-success' : 'i-mdi-circle-outline'" class="text-sm"></span>
                <span class="truncate">{{ list.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1"></div>

        <!-- Star time -->
        <span v-if="starredAt" class="text-xs text-base-content/40 flex items-center gap-1">
          <span class="i-mdi-star-outline text-xs"></span>
          Starred {{ formatDate(starredAt) }}
        </span>

        <!-- Unstar button -->
        <button
          class="btn btn-xs btn-error btn-outline gap-1"
          :disabled="unstarring"
          @click="handleUnstar"
        >
          <span v-if="unstarring" class="loading loading-spinner loading-xs"></span>
          <span v-else class="i-mdi-star-off text-sm"></span>
          Unstar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { updateUserListsForItem, unstarRepo } from '../services/github.js'

const props = defineProps({
  repo: { type: Object, required: true },
  starredAt: { type: String, default: null },
  token: { type: String, required: true },
  lists: { type: Array, default: () => [] },
})

const emit = defineEmits(['unstarred', 'listsUpdated'])

const unstarring = ref(false)
const togglingList = ref(false)

// Which list IDs currently contain this repo (by node_id)
const repoListIds = computed(() => {
  const nodeId = props.repo.node_id
  const ids = new Set()
  for (const list of props.lists) {
    if (list.repoNodeIds.has(nodeId)) ids.add(list.id)
  }
  return ids
})

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

async function handleUnstar() {
  if (!confirm(`Unstar ${props.repo.full_name}?`)) return
  unstarring.value = true
  try {
    await unstarRepo(props.token, props.repo.owner.login, props.repo.name)
    emit('unstarred', props.repo.id)
  } catch (e) {
    alert('Failed to unstar: ' + (e.response?.data?.message || e.message))
  } finally {
    unstarring.value = false
  }
}

async function toggleList(list) {
  const nodeId = props.repo.node_id
  const isIn = repoListIds.value.has(list.id)

  // Compute new desired set of list IDs
  const newIds = [...repoListIds.value]
  if (isIn) {
    const idx = newIds.indexOf(list.id)
    if (idx !== -1) newIds.splice(idx, 1)
  } else {
    newIds.push(list.id)
  }

  togglingList.value = true
  try {
    await updateUserListsForItem(props.token, nodeId, newIds)
    emit('listsUpdated')
  } catch (e) {
    alert('Failed to update list: ' + e.message)
  } finally {
    togglingList.value = false
  }
}
</script>
