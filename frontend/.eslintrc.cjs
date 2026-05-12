module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2021: true
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    '@typescript-eslint'
  ],
  settings: {
    vue: {
      version: '3.x'
    }
  },
  rules: {
    'vue/no-v-model-argument': 'error',
    'vue/multi-word-component-names': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'camelcase': ['error', {
      properties: 'always',
      ignoreDestructuring: true,
      ignoreImports: true,
      ignoreGlobals: true
    }],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[object.type="Identifier"][property.name=/_.+/]',
        message: '禁止使用下划线命名访问对象属性，请使用驼峰命名。例如：created_at → createdAt，local_path → localPath'
      }
    ]
  }
}
