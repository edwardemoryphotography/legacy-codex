import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.netlify/**',
      'out/**',
      'build/**',
      'foundry-console/**',
      'pocketforge/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default eslintConfig
