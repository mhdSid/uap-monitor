import js from '@eslint/js'
import tsEslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tsEslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.claude/**', '.github/**', '.yarn/**'] },
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      semi: ['error', 'never'],
      '@stylistic/comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'space-before-function-paren': ['error', 'always'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    }
  }
)
