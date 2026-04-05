module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier' // Tích hợp Prettier (LUÔN PHẢI NẰM Ở CUỐI CÙNG)
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vite.config.ts'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'off', // Tạm tắt cảnh báo any để dễ code
    // Ép buộc sử dụng Barrel Pattern (index.ts) để mã nguồn gọn gàng
    'no-restricted-imports': ['error', {
      'patterns': [
        {
          'group': ['**/components/*', '!**/components/index.ts', '**/hooks/*', '!**/hooks/index.ts', '**/utils/*', '!**/utils/index.ts'],
          'message': '❌ CHÚ Ý: Vui lòng import qua thư mục gốc (Ví dụ: from "../components") thay vì import trực tiếp từ file con để code đồng nhất.'
        }
      ]
    }]
  },
}