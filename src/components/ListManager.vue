<template>
  <div class="flex flex-col gap-1 select-none">
    <!-- Section: All Stars / No List -->
    <div class="mb-1">
      <button
        class="nav-item"
        :class="selectedListId === null ? 'nav-item-active' : ''"
        @click="emit('select-list', null)"
      >
        <span class="i-mdi-star text-yellow-400 text-base shrink-0"></span>
        <span class="flex-1 truncate">All Stars</span>
      </button>
      <button
        class="nav-item"
        :class="selectedListId === '__no_list__' ? 'nav-item-active' : ''"
        @click="emit('select-list', selectedListId === '__no_list__' ? null : '__no_list__')"
      >
        <span class="i-mdi-filter-off-outline text-base-content/40 text-base shrink-0"></span>
        <span class="flex-1 truncate text-base-content/70">No List</span>
      </button>
    </div>

    <!-- Section header: Lists -->
    <div class="flex items-center justify-between px-2 mb-1">
      <span class="text-xs font-semibold uppercase tracking-wide text-base-content/40">Lists</span>
      <button
        v-if="token"
        class="btn btn-ghost btn-xs btn-square"
        title="New list"
        @click="showCreate = !showCreate"
      >
        <span class="i-mdi-plus text-base"></span>
      </button>
    </div>

    <!-- Create form -->
    <div v-if="showCreate" class="flex gap-1 mb-1 px-1">
      <input
        v-model="newName"
        class="input input-xs flex-1 input-bordered"
        placeholder="List name..."
        :disabled="creating"
        autofocus
        @keyup.enter="handleCreate"
        @keyup.escape="showCreate = false"
      />
      <button class="btn btn-xs btn-primary" :disabled="!newName.trim() || creating" @click="handleCreate">
        <span v-if="creating" class="loading loading-spinner loading-xs"></span>
        <span v-else class="i-mdi-check text-sm"></span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-4">
      <span class="loading loading-spinner loading-sm text-base-content/40"></span>
    </div>

    <!-- No lists -->
    <div v-else-if="!loading && lists.length === 0 && token" class="text-xs text-base-content/40 px-3 py-2">
      No lists yet
    </div>

    <!-- List items -->
    <div
      v-for="list in lists"
      :key="list.id"
      class="relative group"
    >
      <button
        class="nav-item pr-8"
        :class="selectedListId === list.id ? 'nav-item-active' : ''"
        @click="emit('select-list', selectedListId === list.id ? null : list.id)"
      >
        <span class="i-mdi-format-list-bulleted-square text-primary/70 text-base shrink-0"></span>
        <span class="flex-1 truncate">{{ list.name }}</span>
        <span class="text-xs text-base-content/40 shrink-0">{{ list.repoNodeIds.size }}</span>
      </button>
      <!-- Delete button, appears on hover -->
      <button
        class="btn btn-ghost btn-xs btn-square absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        :disabled="deleting === list.id"
        @click.stop="handleDeleteList(list)"
      >
        <span v-if="deleting === list.id" class="loading loading-spinner loading-xs"></span>
        <span v-else class="i-mdi-close text-xs text-error/70"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.nav-item {
  @apply flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm font-medium text-left transition-colors hover:bg-base-200 cursor-pointer;
}
.nav-item-active {
  @apply bg-primary/10 text-primary;
}
</style>

<script setup>
import { ref } from 'vue'
import { createUserList, deleteUserList } from '../services/github.js'

const props = defineProps({
  token: { type: String, default: '' },
  lists: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  selectedListId: { type: String, default: null },
})

const emit = defineEmits(['updated', 'select-list'])

const showCreate = ref(false)
const newName = ref('')
const creating = ref(false)
const deleting = ref(null)

async function handleCreate() {
  if (!newName.value.trim() || !props.token) return
  creating.value = true
  try {
    await createUserList(props.token, newName.value.trim())
    newName.value = ''
    showCreate.value = false
    emit('updated')
  } catch (e) {
    alert('Failed to create list: ' + e.message)
  } finally {
    creating.value = false
  }
}

async function handleDeleteList(list) {
  if (!confirm(`Delete list "${list.name}"? This cannot be undone.`)) return
  deleting.value = list.id
  try {
    await deleteUserList(props.token, list.id)
    emit('updated')
  } catch (e) {
    alert('Failed to delete list: ' + e.message)
  } finally {
    deleting.value = null
  }
}
</script>
