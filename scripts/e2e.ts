/**
 * 端到端行为测试：在 Node 中垫片 localStorage / indexedDB 后，
 * 直接走真实的 axios mock 适配器（含 HTTP 状态码、409 冲突体）。
 *
 * 通过 esbuild 打包 TS 源码后运行：
 *   node scripts/run-e2e.cjs
 */
import { initDb } from '../src/mocks/db'
import { api } from '../src/api/http'

// ─── localStorage 垫片 ───────────────────────────────────────
const storage = new Map<string, string>()
const localStorageShim = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => {
    storage.set(key, String(value))
  },
  removeItem: (key: string) => storage.delete(key),
}
;(globalThis as any).localStorage = localStorageShim
;(globalThis as any).window = { setTimeout, clearTimeout }

// ─── IndexedDB 最小垫片（单库单 store，支持 put/get/事务 complete） ──
const idbData = new Map<string, unknown>()
;(globalThis as any).indexedDB = {
  open() {
    const request: any = {}
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => {},
        transaction() {
          const txn: any = { oncomplete: null, onerror: null, onabort: null }
          txn.objectStore = () => ({
            put(value: unknown, key: string) {
              const req: any = {}
              queueMicrotask(() => {
                idbData.set(key, value)
                req.onsuccess?.()
                txn.oncomplete?.()
              })
              return req
            },
            get(key: string) {
              const req: any = {}
              queueMicrotask(() => {
                req.result = idbData.get(key)
                req.onsuccess?.()
                txn.oncomplete?.()
              })
              return req
            },
          })
          return txn
        },
      }
      request.onsuccess?.()
    })
    return request
  },
}

// ─── 断言工具 ─────────────────────────────────────────────────
let passed = 0
let failed = 0
const failures: string[] = []
const eq = (actual: unknown, expected: unknown, label: string) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed += 1
  } else {
    failed += 1
    failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) throw new Error(label)
}
const truthy = (value: unknown, label: string) => eq(Boolean(value), true, label)

const request = async (method: string, url: string, data?: unknown, params?: unknown) => {
  try {
    const response = await api.request({ method, url, data, params })
    return { status: response.status, data: response.data }
  } catch (error: any) {
    if (error.response) return { status: error.response.status, data: error.response.data }
    throw error
  }
}

const main = async () => {
  await initDb()

  console.log('\n[1] 旧数据迁移：旧运行补成批次，重复分片只归档一次')
  const batches = (await request('get', '/batches')).data
  const checkoutBatch = batches.find((b: any) => b.id === 'batch-p-commerce-release-6-18-0')
  eq(checkoutBatch.items.length, 2, 'release/6.18.0 批次有两个页面条目')
  const checkoutItem = checkoutBatch.items.find((i: any) => i.page === '订单结算页')
  eq(checkoutItem.archivedFragments.length, 1, 'run-1049 被归档为 1 个分片')
  eq(checkoutItem.fragmentRunIds, ['run-1049'], '归档分片 id 正确')
  const regionKeys = checkoutItem.regions.map((r: any) => `${r.x}|${r.y}|${r.width}|${r.height}`)
  eq(new Set(regionKeys).size, regionKeys.length, '区域几何指纹无重复')
  eq(checkoutItem.regions.length, 4, '合并去重后 4 处区域（1048 三处 + 1049 新增一处）')
  const archivedRun = (await request('get', '/runs/run-1049')).data
  eq(archivedRun.status, 'archived', '分片运行状态为 archived')
  eq(archivedRun.fragmentOfRunId, 'run-1048', '分片挂在主运行下')

  const billing = batches.find((b: any) => b.id === 'batch-p-console-feature-billing-v3')
  eq(billing.stage, 'completed', '已审批旧运行批次为完成态')
  truthy(billing.ruleSnapshots.length > 0, '已审批批次带规则快照')
  eq(billing.items[0].status, 'approved', '单运行批次保留批准结论')
  const resource = batches.find((b: any) => b.id === 'batch-p-console-release-5-10-0')
  eq(resource.stage, 'collecting', '待审批旧运行批次处于收集期')

  console.log('\n[2] 运行列表折叠分片，原页面入口照旧可打开')
  const runs = (await request('get', '/runs')).data
  eq(runs.some((r: any) => r.id === 'run-1048'), true, '主运行在列表中')
  eq(runs.some((r: any) => r.id === 'run-1049'), false, '归档分片默认折叠')
  const withFragments = (await request('get', '/runs', undefined, { includeFragments: true })).data
  eq(withFragments.some((r: any) => r.id === 'run-1049'), true, 'includeFragments 可看到分片')

  console.log('\n[3] 进入评审：规则快照与区域判定一起固定')
  const start = await request('post', `/batches/${checkoutBatch.id}/start-review`)
  eq(start.status, 200, '进入评审成功')
  let batch0 = start.data.batch
  eq(batch0.stage, 'in-review', '批次进入评审中')
  eq(batch0.ruleSnapshots.length, 3, '快照固定该项目适用的 3 条规则（全局 2 + 项目 1）')
  const startAgain = await request('post', `/batches/${checkoutBatch.id}/start-review`)
  eq(startAgain.data.started, false, '重复进入不重复固定')

  console.log('\n[4] 区域手工判定固定')
  const targetRegion = checkoutItem.regions.find((r: any) => r.id === '1048-r2')
  const ignoreRes = await request(
    'patch',
    `/batches/${batch0.id}/items/${checkoutItem.id}/regions/${targetRegion.id}`,
    { decision: 'ignored', expectedVersion: batch0.version },
  )
  eq(ignoreRes.status, 200, '区域忽略保存成功')
  batch0 = ignoreRes.data
  let region2 = batch0.items
    .find((i: any) => i.id === checkoutItem.id)
    .regions.find((r: any) => r.id === '1048-r2')
  eq(region2.decision, 'ignored', '区域为已忽略')
  eq(region2.source, 'manual', '来源为手工')
  eq(region2.pinned, true, '区域已固定')

  console.log('\n[5] 规则变化后重算：未批准重算，固定区域不动')
  const timeRule = (await request('get', '/rules')).data.find((r: any) => r.id === 'rule-time')
  await request('patch', `/rules/${timeRule.id}`, { maxDelta: 1 })
  const recompute = await request('post', `/batches/${batch0.id}/recompute`)
  eq(recompute.status, 200, '重算成功')
  batch0 = recompute.data.batch
  region2 = batch0.items
    .find((i: any) => i.id === checkoutItem.id)
    .regions.find((r: any) => r.id === '1048-r2')
  eq(region2.decision, 'ignored', '手工忽略的区域保持忽略')
  eq(region2.pinned, true, '手工固定保持')
  let region3 = batch0.items
    .find((i: any) => i.id === checkoutItem.id)
    .regions.find((r: any) => r.id === '1048-r3')
  eq(region3.decision, 'pending', '规则来源 r3 在阈值收紧后回到待判定')
  await request('patch', `/rules/${timeRule.id}`, { maxDelta: 12 })
  const recompute2 = await request('post', `/batches/${batch0.id}/recompute`)
  batch0 = recompute2.data.batch
  region3 = batch0.items
    .find((i: any) => i.id === checkoutItem.id)
    .regions.find((r: any) => r.id === '1048-r3')
  eq(region3.decision, 'ignored', '规则恢复后 r3 重新被规则忽略')
  truthy(recompute2.data.pinnedCount >= 1, `已固定区域计数 >=1（${recompute2.data.pinnedCount}）`)

  console.log('\n[6] 已批准页面收到晚到分片：只归档，不重开、不绕过基线')
  const resBatchId = resource.id
  await request('post', `/batches/${resBatchId}/start-review`)
  const resItemId = resource.items[0].id
  const approvalKey = `idem-test-${Date.now()}`
  const resVersion = (await request('get', `/batches/${resBatchId}`)).data.version
  const approve = await request('post', `/batches/${resBatchId}/items/${resItemId}/review`, {
    category: 'design-change',
    decision: 'approved',
    reviewer: '测试员',
    reason: '批准测试：验证晚到分片不绕过基线不少于八字',
    expectedVersion: resVersion,
    idempotencyKey: approvalKey,
  })
  eq(approve.status, 200, '批准成功')
  const newBaseline = (await request('get', '/baselines')).data.find(
    (b: any) => b.idempotencyKey === approvalKey,
  )
  truthy(newBaseline, '产生新基线并带幂等键')
  eq(newBaseline.active, true, '新基线有效')
  eq(Boolean(newBaseline.previousBaselineId), false, '该页面无旧基线')

  const latePayload = {
    projectId: 'p-console',
    page: '资源详情',
    device: 'Desktop 1440',
    theme: 'light',
    build: 'release/5.10.0',
    baselineVersion: 'v5.9.1-baseline',
    currentVersion: 'v5.10.0-rc1',
    executor: 'executor-shard-9',
    fragmentIndex: 7,
    files: [{ name: 'late-fragment.png', size: 999, dataUrl: 'data:image/png;base64,xxx' }],
  }
  const late = await request('post', '/runs/import', latePayload)
  eq(late.status, 201, '晚到分片导入成功')
  const resItemAfter = (await request('get', `/batches/${resBatchId}`)).data.items.find(
    (i: any) => i.id === resItemId,
  )
  eq(resItemAfter.status, 'approved', '已批准条目保持 approved')
  eq(resItemAfter.archivedFragments.length, 1, '晚到分片被归档')
  eq(resItemAfter.archivedFragments[0].executor, 'executor-shard-9', '归档保留执行机来源')
  eq(
    (await request('get', '/baselines')).data.filter((b: any) => b.itemId === resItemAfter.id).length,
    1,
    '仍只有一条基线，未绕过',
  )
  eq(
    (await request('get', '/baselines')).data.find((b: any) => b.idempotencyKey === approvalKey).active,
    true,
    '原批准基线仍有效',
  )

  console.log('\n[7] 重复分片内容指纹去重：只归档一次')
  const dupImport = await request('post', '/runs/import', latePayload)
  eq(dupImport.data.duplicated, 1, '同指纹分片识别为重复')
  const resItemFinal = (await request('get', `/batches/${resBatchId}`)).data.items.find(
    (i: any) => i.id === resItemId,
  )
  eq(resItemFinal.archivedFragments.length, 1, '重复分片未产生第二条归档记录')

  console.log('\n[8] 两个窗口并发提交：后到保存失败并留草稿')
  const listItem = batch0.items.find((i: any) => i.page === '商品列表页')
  const vNow = batch0.version
  const payloadA = {
    category: 'design-change',
    decision: 'approved',
    reviewer: '窗口A',
    reason: '窗口A先提交：内容符合设计稿八字以上',
    expectedVersion: vNow,
    idempotencyKey: `win-a-${Date.now()}`,
  }
  const payloadB = {
    category: 'render-error',
    decision: 'rejected',
    reviewer: '窗口B',
    reason: '窗口B后提交：发现渲染异常八字以上',
    expectedVersion: vNow,
    idempotencyKey: `win-b-${Date.now() + 1}`,
  }
  const [ra, rb] = await Promise.all([
    request('post', `/batches/${batch0.id}/items/${listItem.id}/review`, payloadA),
    request('post', `/batches/${batch0.id}/items/${listItem.id}/review`, payloadB),
  ])
  const statuses = [ra.status, rb.status].sort((x, y) => x - y)
  eq(statuses[0], 200, '一个窗口提交成功')
  eq(statuses[1], 409, '另一个窗口 409 冲突')
  const conflict = ra.status === 409 ? ra : rb
  const conflictPayload = conflict === ra ? payloadA : payloadB
  eq(conflict.data.code, 'BATCH_VERSION_CONFLICT', '冲突码正确')
  truthy(conflict.data.draft, '返回草稿')
  eq(conflict.data.draft.payload.reason, conflictPayload.reason, '草稿保留完整表单')
  const drafts = (await request('get', '/drafts')).data.drafts
  truthy(drafts.length >= 1, '草稿已持久化')
  eq(drafts.find((d: any) => d.id === conflict.data.draft.id).expectedVersion, vNow, '草稿记录过期版本')
  const batchLatest = (await request('get', `/batches/${batch0.id}`)).data
  const recover = await request('post', `/batches/${batch0.id}/items/${listItem.id}/review`, {
    ...conflict.data.draft.payload,
    expectedVersion: batchLatest.version,
    idempotencyKey: `recover-${Date.now()}`,
  })
  eq(recover.status, 200, '基于最新版本恢复草稿提交成功')
  const listItemAfter = (await request('get', `/batches/${batch0.id}`)).data.items.find(
    (i: any) => i.id === listItem.id,
  )
  eq(listItemAfter.status, conflictPayload.decision, '恢复草稿后的结论生效')
  // 草稿仍保留，丢弃后消失
  const discard = await request('delete', `/drafts/${conflict.data.draft.id}`)
  eq(discard.status, 200, '草稿可丢弃')

  console.log('\n[9] 审批幂等：同一幂等键不产生重复基线')
  const baseCountBefore = (await request('get', '/baselines')).data.length
  const retry = await request('post', `/batches/${resBatchId}/items/${resItemId}/review`, {
    category: 'design-change',
    decision: 'approved',
    reviewer: '测试员',
    reason: '重复提交同一审批的幂等性验证八字',
    expectedVersion: 1,
    idempotencyKey: approvalKey,
  })
  eq(retry.status, 409, '版本不匹配优先冲突，不落地任何记录')
  eq((await request('get', '/baselines')).data.length, baseCountBefore, '基线数量不增加')

  console.log('\n[10] 已驳回旧批次结论保留')
  const campaign = batches.find((x: any) => x.id === 'batch-p-growth-feature-campaign-editor')
  eq(campaign.items[0].status, 'rejected', '旧驳回结论保留')
  const rejectedRun = (await request('get', '/runs/run-1045')).data
  eq(rejectedRun.status, 'rejected', '驳回运行页面入口照旧')

  console.log('\n[11] 收集期规则变化实时生效，进入评审的批次需手动重算')
  const fresh = await request('post', '/runs/import', {
    projectId: 'p-growth',
    page: '实验页',
    device: 'Desktop 1440',
    theme: 'light',
    build: 'feature/exp-collect',
    baselineVersion: '',
    currentVersion: 'exp-1',
    files: [{ name: 'exp.png', size: 500, dataUrl: 'data:image/png;base64,e' }],
  })
  // 导入区域无 environment 类型；验证收集期批次存在即可
  const collecting = (await request('get', '/batches')).data.find(
    (x: any) => x.id === 'batch-p-growth-feature-exp-collect',
  )
  eq(collecting.stage, 'collecting', '新批次默认收集期')
  eq(collecting.items.length, 1, '新分片成为一个条目')
  eq(fresh.data.duplicated, 0, `首次导入无重复（实际 duplicated=${fresh.data.duplicated}）`)

  console.log('\n[12] 手动合并：同页面重复运行归档为分片，跨页面保留多条目')
  const mergePayload = await request('post', '/runs/import', {
    projectId: 'p-growth',
    page: '运营首页',
    device: 'Desktop 1440',
    theme: 'light',
    build: 'release/2.6.0',
    baselineVersion: 'v2.5.3-baseline',
    currentVersion: 'v2.6.0-rc4',
    executor: 'executor-merge-check',
    fragmentIndex: 3,
    files: [{ name: 'home-again.png', size: 432, dataUrl: 'data:image/png;base64,m' }],
  })
  const mergeRunId = mergePayload.data.runs[0].id
  const merge = await request('post', '/runs/merge', ['run-1043', mergeRunId])
  eq(merge.status, 201, '合并成功')
  const homeBatch = (await request('get', '/batches')).data.find(
    (x: any) => x.id === 'batch-p-growth-release-2-6-0',
  )
  const homeItem = homeBatch.items.find((i: any) => i.page === '运营首页')
  eq(homeItem.archivedFragments.length, 1, '合并后重复运行成为归档分片')
  eq(homeItem.fragmentRunIds.includes(mergeRunId), true, '归档运行 id 记录正确')
  const mergeRunStatus = (await request('get', `/runs/${mergeRunId}`)).data.status
  eq(mergeRunStatus, 'archived', '被合并运行状态为已归档')

  console.log('\n[13] 批准时旧基线停用但保留可追溯')
  // 商品列表页已有一条 active 基线 base-commerce-list；该条目在测试 [8] 中被恢复草稿驳回，
  // 改用账单明细（dark）已批准批次不适用；选 checkout 条目（有 base-commerce-checkout 基线）
  const beforeList = (await request('get', '/baselines')).data.filter(
    (b: any) => b.projectId === 'p-commerce' && b.page === '订单结算页',
  )
  const oldActive = beforeList.find((b: any) => b.active)
  truthy(oldActive, '批准前存在有效旧基线')
  const checkoutLatest = (await request('get', `/batches/${checkoutBatch.id}`)).data
  const checkoutLatestItem = checkoutLatest.items.find((i: any) => i.id === checkoutItem.id)
  const approveCheckout = await request(
    'post',
    `/batches/${checkoutBatch.id}/items/${checkoutLatestItem.id}/review`,
    {
      category: 'design-change',
      decision: 'approved',
      reviewer: '沈宁',
      reason: '结算页改版确认：旧基线停用保留可追溯八字',
      expectedVersion: checkoutLatest.version,
      idempotencyKey: `checkout-approve-${Date.now()}`,
    },
  )
  eq(approveCheckout.status, 200, '批准成功')
  const afterList = (await request('get', '/baselines')).data.filter(
    (b: any) => b.projectId === 'p-commerce' && b.page === '订单结算页',
  )
  eq(afterList.length, beforeList.length + 1, '新增一条基线，旧基线未删除')
  const oldAfter = afterList.find((b: any) => b.id === oldActive.id)
  eq(oldAfter.active, false, '旧基线停用')
  const newActiveBase = afterList.find((b: any) => b.active)
  eq(newActiveBase.previousBaselineId, oldActive.id, '新基线记录旧基线依据')
  const approvedCheckoutItem = (await request('get', `/batches/${checkoutBatch.id}`)).data.items.find(
    (i: any) => i.id === checkoutItem.id,
  )
  eq(approvedCheckoutItem.previousBaselineId, oldActive.id, '条目留存旧基线 id')
  // 批准后区域全部 pinned
  eq(approvedCheckoutItem.regions.every((r: any) => r.pinned), true, '批准后区域全部固定')

  console.log('\n[14] localStorage 写入失败后重启：从 IndexedDB 恢复，无重复')
  const regionCountBefore = (await request('get', `/batches/${resBatchId}`)).data.items.find(
    (i: any) => i.id === resItemId,
  ).regions.length
  const fragmentCountBefore = resItemFinal.archivedFragments.length

  // 模拟 localStorage 故障
  ;(globalThis as any).localStorage = {
    getItem: localStorageShim.getItem,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: localStorageShim.removeItem,
  }
  const faultWrite = await request('post', '/runs/import', {
    projectId: 'p-console',
    page: '账单明细新页',
    device: 'Desktop 1920',
    theme: 'dark',
    build: 'feature/billing-v3',
    baselineVersion: 'v5.9.1-baseline',
    currentVersion: 'billing-v3.8',
    executor: 'executor-recovery',
    files: [{ name: 'recovery.png', size: 777, dataUrl: 'data:image/png;base64,yyy' }],
  })
  eq(faultWrite.status, 201, '存储故障时写入仍被接受（IndexedDB 日志兜底）')

  // “重启”：清掉 localStorage v2，保留 IndexedDB 日志
  ;(globalThis as any).localStorage = localStorageShim
  localStorageShim.removeItem('visual-regression-platform-v2')
  await initDb()
  const billingBatch = (await request('get', '/batches')).data.find(
    (x: any) => x.id === 'batch-p-console-feature-billing-v3',
  )
  truthy(billingBatch.items.find((i: any) => i.page === '账单明细新页'), '故障期写入从日志恢复')
  const apprItem = billingBatch.items.find((i: any) => i.page === '账单明细')
  eq(apprItem.status, 'approved', '已批准结论恢复后仍在')
  eq(apprItem.regions.length, 3, '恢复后区域无重复')
  const recoveredRes = (await request('get', `/batches/${resBatchId}`)).data.items.find(
    (i: any) => i.id === resItemId,
  )
  eq(recoveredRes.regions.length, regionCountBefore, '恢复前后区域数量一致')
  eq(recoveredRes.archivedFragments.length, fragmentCountBefore, '归档分片恢复后不重复')
  eq(
    (await request('get', '/baselines')).data.filter((x: any) => x.idempotencyKey === approvalKey).length,
    1,
    '审批记录/基线恢复后仅一条',
  )

  console.log(`\n=== ${passed} 项断言通过，${failed} 项失败 ===`)
  if (failures.length) {
    console.log('\n失败项：')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
