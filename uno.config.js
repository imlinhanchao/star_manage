import { defineConfig, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
})
