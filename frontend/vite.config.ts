import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function getNodeModuleChunk(id: string) {
  const normalizedId = id.split('\\').join('/')

  if (!normalizedId.includes('node_modules/')) {
    return undefined
  }

  if (
    normalizedId.includes('node_modules/react/') ||
    normalizedId.includes('node_modules/react-dom/') ||
    normalizedId.includes('node_modules/react-router/') ||
    normalizedId.includes('node_modules/react-router-dom/') ||
    normalizedId.includes('node_modules/scheduler/')
  ) {
    return 'vendor-react'
  }

  if (normalizedId.includes('node_modules/echarts-for-react/')) {
    return 'vendor-echarts-react'
  }
  if (normalizedId.includes('node_modules/zrender/')) {
    return 'vendor-zrender'
  }
  if (normalizedId.includes('node_modules/echarts/lib/')) {
    if (normalizedId.includes('/chart/')) return 'vendor-echarts-lib-chart'
    if (normalizedId.includes('/component/')) return 'vendor-echarts-lib-component'
    if (normalizedId.includes('/renderer/')) return 'vendor-echarts-lib-renderer'
    if (normalizedId.includes('/coord/')) return 'vendor-echarts-lib-coord'
    if (normalizedId.includes('/core/')) return 'vendor-echarts-lib-core'
    if (normalizedId.includes('/util/')) return 'vendor-echarts-lib-util'
    if (normalizedId.includes('/data/')) return 'vendor-echarts-lib-data'
    if (normalizedId.includes('/layout/')) return 'vendor-echarts-lib-layout'
    if (normalizedId.includes('/animation/')) return 'vendor-echarts-lib-animation'
    return 'vendor-echarts-lib-misc'
  }
  if (normalizedId.includes('node_modules/echarts/')) {
    if (normalizedId.includes('/charts/')) return 'vendor-echarts-charts'
    if (normalizedId.includes('/components/')) return 'vendor-echarts-components'
    if (normalizedId.includes('/renderers/')) return 'vendor-echarts-renderers'
    if (normalizedId.includes('/core/')) return 'vendor-echarts-core'
    return 'vendor-echarts-misc'
  }

  if (normalizedId.includes('node_modules/@ant-design/icons/')) {
    return 'vendor-ant-icons'
  }
  if (normalizedId.includes('node_modules/rc-table/')) {
    return 'vendor-rc-table'
  }
  if (normalizedId.includes('node_modules/rc-select/')) {
    return 'vendor-rc-select'
  }
  if (normalizedId.includes('node_modules/rc-field-form/')) {
    return 'vendor-rc-form'
  }
  if (normalizedId.includes('node_modules/rc-tabs/')) {
    return 'vendor-rc-tabs'
  }
  if (normalizedId.includes('node_modules/rc-tree/')) {
    return 'vendor-rc-tree'
  }
  if (normalizedId.includes('node_modules/antd/es/')) {
    const section = normalizedId.split('node_modules/antd/es/')[1]?.split('/')[0]
    if (section) return `vendor-ant-${section}`
  }
  if (normalizedId.includes('node_modules/antd/lib/')) {
    const section = normalizedId.split('node_modules/antd/lib/')[1]?.split('/')[0]
    if (section) return `vendor-ant-${section}`
  }
  if (normalizedId.includes('node_modules/antd/')) {
    return 'vendor-ant-core'
  }

  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3270,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getNodeModuleChunk(id)
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
