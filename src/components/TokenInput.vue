<template>
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div class="card w-full max-w-md bg-base-100 shadow-2xl">
      <div class="card-body gap-4">
        <h2 class="card-title text-2xl">
          <span class="i-mdi-github text-3xl"></span>
          Star Manage
        </h2>
        <p class="text-base-content/70 text-sm">
          Enter your GitHub Personal Access Token to manage your starred repositories.
          The token is stored only in your browser's localStorage.
        </p>
        <div class="form-control gap-2">
          <label class="label">
            <span class="label-text font-semibold">GitHub Token</span>
            <a
              href="https://github.com/settings/tokens/new?scopes=public_repo,user&description=star_manage"
              target="_blank"
              class="label-text-alt link link-primary"
            >Generate token ↗</a>
          </label>
          <div class="join w-full">
            <input
              v-model="tokenInput"
              :type="showToken ? 'text' : 'password'"
              class="input input-bordered join-item flex-1"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              @keyup.enter="handleSave"
            />
            <button class="btn btn-ghost join-item" @click="showToken = !showToken">
              <span :class="showToken ? 'i-mdi-eye-off' : 'i-mdi-eye'" class="text-lg"></span>
            </button>
          </div>
        </div>
        <div v-if="error" class="alert alert-error">
          <span class="i-mdi-alert-circle text-lg"></span>
          <span>{{ error }}</span>
        </div>
        <div class="card-actions justify-end mt-2">
          <button v-if="hasExistingToken" class="btn btn-ghost" @click="$emit('cancel')">
            Cancel
          </button>
          <button class="btn btn-primary" :disabled="loading || !tokenInput" @click="handleSave">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            <span v-else class="i-mdi-check text-lg"></span>
            {{ loading ? 'Validating...' : 'Save & Connect' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { validateToken } from '../services/github.js'

const props = defineProps({
  hasExistingToken: Boolean,
})

const emit = defineEmits(['saved', 'cancel'])

const tokenInput = ref('')
const showToken = ref(false)
const loading = ref(false)
const error = ref('')

async function handleSave() {
  if (!tokenInput.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    const user = await validateToken(tokenInput.value.trim())
    localStorage.setItem('github_token', tokenInput.value.trim())
    emit('saved', { token: tokenInput.value.trim(), user })
  } catch (e) {
    if (e.response?.status === 401) {
      error.value = 'Invalid token. Please check and try again.'
    } else {
      error.value = e.message || 'Failed to validate token.'
    }
  } finally {
    loading.value = false
  }
}
</script>
