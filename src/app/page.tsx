import dynamic from 'next/dynamic'

const CodexApp = dynamic(() => import('@/components/CodexApp'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: 'var(--text-dim)',
      fontFamily: 'system-ui'
    }}>
      Loading Legacy Codex…
    </div>
  )
})

export default function Home() {
  return <CodexApp />
}
