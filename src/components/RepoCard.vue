<template>
  <div class="card bg-base-100 border border-base-200 hover:border-base-300 hover:shadow-sm transition-all">
    <div class="card-body p-4 gap-2">
      <!-- Header -->
      <div class="flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <a
            :href="repo.html_url"
            target="_blank"
            class="font-semibold text-sm link link-hover text-primary block truncate"
          >{{ repo.full_name }}</a>
          <p v-if="repo.description" class="text-xs text-base-content/60 mt-0.5 line-clamp-2 leading-relaxed">
            {{ repo.description }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span v-if="repo.language" class="badge badge-ghost badge-xs text-xs">{{ repo.language }}</span>
          <span v-if="repo.private" class="badge badge-warning badge-xs">Private</span>
        </div>
      </div>

      <!-- Topics -->
      <div v-if="repo.topics?.length" class="flex flex-wrap gap-1">
        <span
          v-for="topic in repo.topics.slice(0, 4)"
          :key="topic"
          class="badge badge-outline badge-xs text-xs text-base-content/50"
        >{{ topic }}</span>
        <span v-if="repo.topics.length > 4" class="badge badge-ghost badge-xs text-xs">+{{ repo.topics.length - 4 }}</span>
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-3 text-xs text-base-content/50">
        <span class="flex items-center gap-0.5">
          <span class="i-mdi-star text-yellow-400 text-xs"></span>
          {{ formatCount(repo.stargazers_count) }}
        </span>
        <span class="flex items-center gap-0.5">
          <span class="i-mdi-source-fork text-xs"></span>
          {{ formatCount(repo.forks_count) }}
        </span>
        <span class="ml-auto flex items-center gap-0.5">
          <span class="i-mdi-clock-outline text-xs"></span>
          {{ formatDate(repo.updated_at) }}
        </span>
      </div>

      <!-- List membership tags -->
      <div v-if="repoListIds.size > 0" class="flex flex-wrap gap-1">
        <span
          v-for="listId in repoListIds"
          :key="listId"
          class="badge badge-primary badge-outline badge-xs gap-1 cursor-pointer"
          @click="toggleListById(listId)"
        >
          <span class="i-mdi-format-list-bulleted-square text-xs"></span>
          {{ getListName(listId) }}
        </span>
      </div>

      <!-- Footer actions -->
      <div class="flex items-center gap-1 pt-1 border-t border-base-200 mt-0.5">
        <!-- List dropdown -->
        <div class="dropdown dropdown-top">
          <button
            tabindex="0"
            class="btn btn-ghost btn-xs gap-1 text-base-content/60"
            :disabled="togglingList"
          >
            <span v-if="togglingList" class="loading loading-spinner loading-xs"></span>
            <span v-else class="i-mdi-tag-plus-outline text-sm"></span>
            <span class="text-xs">Lists</span>
          </button>
          <div tabindex="0" class="dropdown-content z-[1] shadow-lg bg-base-100 rounded-lg border border-base-200 w-52 p-1">
            <p class="text-xs text-base-content/40 px-2 py-1 font-medium uppercase tracking-wide">Add to list</p>
            <div v-if="lists.length === 0" class="px-2 py-2 text-xs text-base-content/40">
              No lists — create one in the sidebar
            </div>
            <button
              v-for="list in lists"
              :key="list.id"
              class="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-left hover:bg-base-200 transition-colors"
              :class="repoListIds.has(list.id) ? 'text-primary' : 'text-base-content'"
              :disabled="togglingList"
              @click="toggleList(list)"
            >
              <span
                :class="repoListIds.has(list.id) ? 'i-mdi-check-circle text-primary' : 'i-mdi-circle-outline text-base-content/30'"
                class="text-base shrink-0"
              ></span>
              <span class="flex-1 truncate">{{ list.name }}</span>
              <span class="text-xs text-base-content/30">{{ list.repoNodeIds.size }}</span>
            </button>
          </div>
        </div>

        <div class="flex-1"></div>

        <!-- Starred date -->
        <span v-if="starredAt" class="text-xs text-base-content/35 hidden sm:flex items-center gap-0.5">
          <span class="i-mdi-clock-check-outline text-xs"></span>
          {{ formatDate(starredAt) }}
        </span>

        <!-- Unstar -->
        <button
          class="btn btn-ghost btn-xs text-error/60 hover:text-error gap-1"
          :aria-label="'Unstar ' + repo.full_name"
          :disabled="unstarring"
          @click="handleUnstar"
        >
          <span v-if="unstarring" class="loading loading-spinner loading-xs"></span>
          <span v-else class="i-mdi-star-minus-outline text-sm"></span>
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

// Set of list IDs this repo currently belongs to
const repoListIds = computed(() => {
  const nodeId = props.repo.node_id
  const ids = new Set()
  for (const list of props.lists) {
    if (list.repoNodeIds.has(nodeId)) ids.add(list.id)
  }
  return ids
})

function getListName(listId) {
  return props.lists.find(l => l.id === listId)?.name ?? '…'
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
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
  const isIn = repoListIds.value.has(list.id)
  const newIds = [...repoListIds.value]
  if (isIn) newIds.splice(newIds.indexOf(list.id), 1)
  else newIds.push(list.id)
  togglingList.value = true
  try {
    await updateUserListsForItem(props.token, props.repo.node_id, newIds)
    emit('listsUpdated')
  } catch (e) {
    alert('Failed to update list: ' + e.message)
  } finally {
    togglingList.value = false
  }
}

async function toggleListById(listId) {
  const list = props.lists.find(l => l.id === listId)
  if (list) await toggleList(list)
}
</script>
