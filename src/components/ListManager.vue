<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 mb-4">
      <h3 class="font-bold text-lg flex-1">My Lists</h3>
      <button class="btn btn-sm btn-ghost gap-1" @click="showCreate = !showCreate">
        <span class="i-mdi-plus text-base"></span>
        New List
      </button>
    </div>

    <div v-if="showCreate" class="join w-full mb-2">
      <input
        v-model="newName"
        class="input input-bordered input-sm join-item flex-1"
        placeholder="List name..."
        @keyup.enter="handleCreate"
      />
      <button class="btn btn-sm btn-primary join-item" :disabled="!newName" @click="handleCreate">
        Create
      </button>
    </div>

    <div v-if="lists.length === 0" class="text-center py-6 text-base-content/40">
      <span class="i-mdi-format-list-bulleted text-3xl block mb-2"></span>
      <p class="text-sm">No lists yet. Create one to organize your stars.</p>
    </div>

    <div v-for="list in lists" :key="list.name" class="collapse collapse-arrow bg-base-200 rounded-lg">
      <input type="checkbox" />
      <div class="collapse-title flex items-center gap-2 py-3 min-h-0">
        <span class="i-mdi-format-list-bulleted-square text-primary"></span>
        <span class="font-medium flex-1">{{ list.name }}</span>
        <span class="badge badge-ghost badge-sm">{{ list.repos.length }}</span>
        <button
          class="btn btn-ghost btn-xs text-error"
          @click.stop="handleDeleteList(list.name)"
        >
          <span class="i-mdi-delete text-sm"></span>
        </button>
      </div>
      <div class="collapse-content">
        <div v-if="list.repos.length === 0" class="text-sm text-base-content/40 py-2">
          No repos in this list
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="repo in list.repos"
            :key="repo.id"
            class="flex items-center gap-2 py-1"
          >
            <span class="i-mdi-github text-sm"></span>
            <a
              :href="`https://github.com/${repo.full_name}`"
              target="_blank"
              class="link link-hover text-sm flex-1 truncate"
            >{{ repo.full_name }}</a>
            <button
              class="btn btn-ghost btn-xs"
              @click="handleRemove(list.name, repo.id)"
            >
              <span class="i-mdi-close text-sm"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getLists, createList, deleteList, removeRepoFromList } from '../services/github.js'

const emit = defineEmits(['updated'])

const lists = ref(getLists())
const showCreate = ref(false)
const newName = ref('')

function refresh() {
  lists.value = getLists()
}

function handleCreate() {
  if (!newName.value.trim()) return
  createList(newName.value.trim())
  newName.value = ''
  showCreate.value = false
  refresh()
  emit('updated')
}

function handleDeleteList(name) {
  if (!confirm(`Delete list "${name}"?`)) return
  deleteList(name)
  refresh()
  emit('updated')
}

function handleRemove(listName, repoId) {
  removeRepoFromList(listName, repoId)
  refresh()
  emit('updated')
}

defineExpose({ refresh })
</script>
