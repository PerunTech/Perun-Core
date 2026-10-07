import globals from 'globals'
import js from '@eslint/js'
import babelParser from '@babel/eslint-parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
    {
        ignores: ['frontend/assets/themes/*.bundle.min.js'],
    },
    js.configs.recommended,
    {
        files: ['frontend/**/*.js'],
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                babelOptions: {
                    presets: ['@babel/preset-react'],
                },
                requireConfigFile: false,
            },
            globals: {
                ...globals.browser,
                ...globals.es2017,
                ...globals.node,
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
                // Filled in by vite.config.mjs's `define` at build time: each module loaded on
                // demand, with its version. frontend/functions/modules.js reads it.
                __PERUN_CORE_MODULES__: 'readonly',
            },
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            'react/prop-types': 0,
            'react-hooks/rules-of-hooks': 'warn',
            'react-hooks/exhaustive-deps': 'warn',
            'react/no-children-prop': 0,
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
        },
    },
]
