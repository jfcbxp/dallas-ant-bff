// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'import/prefer-default-export': 'off',
      'operator-linebreak': 'off',
      'no-console': 'warn',
      'import/extensions': 'off',
      'class-methods-use-this': 'off',
      'object-curly-newline': 'warn',
      'implicit-arrow-linebreak': 'off',
      'function-paren-newline': 'off',
      'no-restricted-syntax': 'off',
      'import/no-unresolved': 'off',
      'prefer-destructuring': ['error', { array: false, object: true }],
      'no-unused-vars': 'warn',
      'max-len': ['warn', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true }],
      'import/no-named-as-default-member': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-shadow': 'off',
      'prettier/prettier': [
        'error',
        {
          tabWidth: 2,
          semi: true,
          trailingComma: 'all',
          arrowParens: 'always',
          printWidth: 140,
          quoteProps: 'consistent',
          bracketSpacing: true,
          useTabs: true,
          jsxSingleQuote: true,
          singleQuote: true,
          endOfLine: 'auto',
        },
      ],
    },
  },
);
