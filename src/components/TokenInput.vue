<template>
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div class="card w-full max-w-md bg-base-100 shadow-2xl">
      <div class="card-body gap-4">
        <h2 class="card-title text-2xl">
          <span class="i-mdi-github text-3xl"></span>
          {{ t('token.title') }}
        </h2>
        <p class="text-base-content/70 text-sm">
          {{ t('token.desc') }}
        </p>
        <div class="form-control gap-2">
          <label class="label">
            <span class="label-text font-semibold">{{ t('token.label') }}</span>
            <a
              href="https://github.com/settings/tokens/new?scopes=public_repo,user&description=star_manage"
              target="_blank"
              class="label-text-alt link link-primary"
            >{{ t('token.generate') }}</a>
          </label>
          <div class="join w-full">
            <input
              v-model="tokenInput"
              :type="showToken ? 'text' : 'password'"
              class="input input-bordered join-item flex-1"
              :placeholder="t('token.placeholder')"
              @keyup.enter="handleSave"
            />
            <button class="btn btn-ghost join-item" @click="showToken = !showToken">
              <span :class="showToken ? 'i-mdi-eye-off' : 'i-mdi-eye'" class="text-lg"></span>
            </button>
          </div>
        </div>
        <!-- API Mirror URL -->
        <div class="form-control gap-2">
          <label class="label pb-0">
            <span class="label-text font-semibold">{{ t('token.mirror') }}</span>
          </label>
          <input
            v-model="mirrorInput"
            type="url"
            class="input input-bordered input-sm"
            :placeholder="t('token.mirrorPlaceholder')"
          />
          <p class="text-xs text-base-content/50">{{ t('token.mirrorDesc') }}</p>
        </div>
        <div v-if="error" class="alert alert-error">
          <span class="i-mdi-alert-circle text-lg"></span>
          <span>{{ error }}</span>
        </div>
        <div class="card-actions justify-end mt-2">
          <button v-if="hasExistingToken" class="btn btn-ghost" @click="$emit('cancel')">
            {{ t('token.cancel') }}
          </button>
          <button class="btn btn-primary" :disabled="loading || !tokenInput" @click="handleSave">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            <span v-else class="i-mdi-check text-lg"></span>
            {{ loading ? t('token.validating') : t('token.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { validateToken, setApiBaseUrl } from '../services/github.js'

const { t } = useI18n()

const props = defineProps({
  hasExistingToken: Boolean,
})

const emit = defineEmits(['saved', 'cancel'])

const tokenInput = ref('')
const showToken = ref(false)
const loading = ref(false)
const error = ref('')
const mirrorInput = ref(localStorage.getItem('github_api_mirror') || '')

async function handleSave() {
  if (!tokenInput.value.trim()) return
  loading.value = true
  error.value = ''
  // Apply mirror URL before validation so the request uses the configured endpoint
  const mirror = mirrorInput.value.trim()
  setApiBaseUrl(mirror)
  if (mirror) {
    localStorage.setItem('github_api_mirror', mirror)
  } else {
    localStorage.removeItem('github_api_mirror')
  }
  try {
    const user = await validateToken(tokenInput.value.trim())
    localStorage.setItem('github_token', tokenInput.value.trim())
    emit('saved', { token: tokenInput.value.trim(), user })
  } catch (e) {
    if (e.response?.status === 401) {
      error.value = t('token.invalid')
    } else {
      error.value = e.message || t('token.failed')
    }
  } finally {
    loading.value = false
  }
}
</script>
