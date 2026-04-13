module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  ignorePatterns: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', '**/*.js.map', '**/src/generated/**'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'error',
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
};
