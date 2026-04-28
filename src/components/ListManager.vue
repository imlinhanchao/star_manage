<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 mb-4">
      <h3 class="font-bold text-lg flex-1">GitHub Lists</h3>
      <button class="btn btn-sm btn-ghost gap-1" :disabled="!token" @click="showCreate = !showCreate">
        <span class="i-mdi-plus text-base"></span>
        New
      </button>
    </div>

    <div v-if="showCreate" class="join w-full mb-2">
      <input
        v-model="newName"
        class="input input-bordered input-sm join-item flex-1"
        placeholder="List name..."
        :disabled="creating"
        @keyup.enter="handleCreate"
      />
      <button class="btn btn-sm btn-primary join-item" :disabled="!newName || creating" @click="handleCreate">
        <span v-if="creating" class="loading loading-spinner loading-xs"></span>
        <span v-else>Create</span>
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-6">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <div v-else-if="!token" class="text-center py-6 text-base-content/40">
      <p class="text-sm">Set a token to manage lists.</p>
    </div>

    <div v-else-if="lists.length === 0" class="text-center py-6 text-base-content/40">
      <span class="i-mdi-format-list-bulleted text-3xl block mb-2"></span>
      <p class="text-sm">No GitHub Lists yet. Create one to organize your stars.</p>
    </div>

    <div v-for="list in lists" :key="list.id" class="collapse collapse-arrow bg-base-200 rounded-lg">
      <input type="checkbox" />
      <div class="collapse-title flex items-center gap-2 py-3 min-h-0">
        <span class="i-mdi-format-list-bulleted-square text-primary"></span>
        <span class="font-medium flex-1 truncate">{{ list.name }}</span>
        <span v-if="list.isPrivate" class="badge badge-ghost badge-xs">private</span>
        <span class="badge badge-ghost badge-sm">{{ list.repoNodeIds.size }}</span>
        <button
          class="btn btn-ghost btn-xs text-error"
          :disabled="deleting === list.id"
          @click.stop="handleDeleteList(list)"
        >
          <span v-if="deleting === list.id" class="loading loading-spinner loading-xs"></span>
          <span v-else class="i-mdi-delete text-sm"></span>
        </button>
      </div>
      <div class="collapse-content">
        <div v-if="list.repoNodeIds.size === 0" class="text-sm text-base-content/40 py-2">
          No repos in this list
        </div>
        <p v-else class="text-sm text-base-content/60 py-2">
          {{ list.repoNodeIds.size }} repo{{ list.repoNodeIds.size === 1 ? '' : 's' }} · manage from repo cards
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createUserList, deleteUserList } from '../services/github.js'

const props = defineProps({
  token: { type: String, default: '' },
  lists: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['updated'])

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
  if (!confirm(`Delete GitHub List "${list.name}"? This cannot be undone.`)) return
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
