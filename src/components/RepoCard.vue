<template>
  <div class="card bg-base-100 border border-base-200 hover:border-base-300 hover:shadow-md transition-all duration-300 flex flex-col h-full rounded-xl">
    <div class="card-body p-4 sm:p-5 gap-3 flex-1 flex flex-col">
      <!-- Header -->
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <a
            :href="repo.html_url"
            target="_blank"
            class="font-bold text-base hover:text-primary transition-colors block truncate w-full"
          >{{ repo.full_name }}</a>
          <p v-if="repo.description" class="text-sm text-base-content/70 mt-1.5 line-clamp-2 leading-relaxed">
            {{ repo.description }}
          </p>
        </div>
        <div v-if="repo.private" class="flex flex-col items-end gap-1 shrink-0 mt-1">
          <span class="badge badge-warning badge-sm font-medium">Private</span>
        </div>
      </div>

      <div class="flex-1"></div>

      <!-- Topics -->
      <div v-if="repo.topics?.length" class="flex flex-wrap gap-1.5 mt-1">
        <span
          v-for="topic in repo.topics.slice(0, 4)"
          :key="topic"
          class="badge badge-sm bg-base-200/60 text-base-content/70 border-none font-medium px-2.5 py-2.5 text-xs"
        >{{ topic }}</span>
        <span v-if="repo.topics.length > 4" class="badge badge-sm badge-ghost font-medium px-2.5 py-2.5 text-xs">+{{ repo.topics.length - 4 }}</span>
      </div>
      
      <!-- List membership tags -->
      <div v-if="repoListIds.size > 0" class="flex flex-wrap gap-1.5">
        <span
          v-for="listId in repoListIds"
          :key="listId"
          class="badge badge-primary badge-sm badge-outline gap-1 cursor-pointer font-medium px-2.5 py-2.5 text-xs hover:bg-primary hover:text-primary-content transition-colors"
          @click="toggleListById(listId)"
        >
          <span class="i-mdi-format-list-bulleted-square text-[10px]"></span>
          {{ getListName(listId) }}
        </span>
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-4 text-xs text-base-content/60 font-medium mt-1">
        <span class="flex items-center gap-1 hover:text-base-content transition-colors">
          <span class="i-mdi-star text-yellow-400 text-sm"></span>
          {{ formatCount(repo.stargazers_count) }}
        </span>
        <span v-if="repo.language" class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-primary/60"></span>
          {{ repo.language }}
        </span>
        <span class="flex items-center gap-1 hover:text-base-content transition-colors">
          <span class="i-mdi-source-fork text-sm"></span>
          {{ formatCount(repo.forks_count) }}
        </span>
      </div>

      <!-- Footer actions -->
      <div class="flex items-center gap-1 pt-3 border-t border-base-200/80 mt-1">
        <!-- List dropdown -->
        <div class="dropdown dropdown-top">
          <button
            tabindex="0"
            class="btn btn-ghost btn-xs gap-1.5 text-base-content/60 hover:text-base-content transition-colors px-2 py-1.5 h-auto min-h-0"
            :disabled="togglingList"
          >
            <span v-if="togglingList" class="loading loading-spinner loading-xs text-primary"></span>
            <span v-else class="i-mdi-tag-plus-outline text-[15px]"></span>
            <span class="text-xs font-medium">Lists</span>
          </button>
          <div tabindex="0" class="dropdown-content z-[1] shadow-xl bg-base-100 rounded-xl border border-base-200/80 w-56 p-1.5 mb-1">
            <p class="text-[10px] text-base-content/40 px-2.5 py-1.5 font-bold uppercase tracking-wider">Add to list</p>
            <div v-if="lists.length === 0" class="px-2.5 py-3 text-sm text-base-content/50 text-center">
              No lists — create one in the sidebar
            </div>
            <button
              v-for="list in lists"
              :key="list.id"
              class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-left hover:bg-base-200/60 transition-colors"
              :class="repoListIds.has(list.id) ? 'text-primary font-medium' : 'text-base-content/80 font-medium'"
              :disabled="togglingList"
              @click="toggleList(list)"
            >
              <span
                :class="repoListIds.has(list.id) ? 'i-mdi-check-circle text-[18px]' : 'i-mdi-checkbox-blank-circle-outline text-[18px] text-base-content/20 hover:text-base-content/40 transition-colors'"
                class="shrink-0"
              ></span>
              <span class="flex-1 truncate">{{ list.name }}</span>
              <span class="text-xs text-base-content/40 font-normal tabular-nums bg-base-200/50 px-1.5 py-0.5 rounded-md">{{ list.repoNodeIds.size }}</span>
            </button>
          </div>
        </div>

        <div class="flex-1"></div>

        <!-- Starred date -->
        <span v-if="starredAt" class="text-[11px] text-base-content/40 hidden sm:flex items-center gap-1 font-medium bg-base-200/30 px-2 py-1 rounded-md">
          <span class="i-mdi-clock-check-outline text-sm"></span>
          {{ formatDate(starredAt) }}
        </span>

        <!-- Unstar -->
        <button
          class="btn btn-ghost btn-xs text-base-content/40 hover:text-error hover:bg-error/10 transition-colors px-1.5 rounded-md"
          :aria-label="'Unstar ' + repo.full_name"
          :disabled="unstarring"
          @click="handleUnstar"
        >
          <span v-if="unstarring" class="loading loading-spinner loading-xs text-error"></span>
          <span v-else class="i-mdi-star-minus-outline text-[16px]"></span>
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
