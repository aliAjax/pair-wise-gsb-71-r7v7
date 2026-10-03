// 打包并运行 TS 端到端测试（Node + localStorage/IndexedDB 垫片）
const path = require('path')
const esbuild = require('esbuild')

const entry = path.join(__dirname, 'e2e.ts')

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(__dirname, '.e2e.bundle.cjs'),
    alias: {
      '@': path.join(__dirname, '..', 'src'),
    },
    logLevel: 'silent',
  })
  .then(() => {
    require(path.join(__dirname, '.e2e.bundle.cjs'))
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
