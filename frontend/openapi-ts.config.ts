import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'openapi.json',
  output: {
    path: 'src/api/generated',
  },
  plugins: ['@hey-api/typescript'],
  services: false,
  types: {
    enums: 'typescript',
  },
})
