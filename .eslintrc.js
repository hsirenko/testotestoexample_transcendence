module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier + displays Prettier errors as ESLint errors
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    rules: {
        // Optional: override/add ESLint rules
        indent: ['error', 4],
        'prettier/prettier': ['error', { tabWidth: 4, useTabs: false }],
    },
};
