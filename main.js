import { createApp } from 'vue'
import App from './App.vue'
import i18n from './src/i18n'
import './src/style.css'
import 'virtual:uno.css'

const app = createApp(App)
app.use(i18n)
app.mount('#app')
