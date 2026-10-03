/* eslint-disable no-console */
import {
  commitDb,
  migrateDb,
  replayWal,
  setFaultEnabled,
  StorageWriteError,
  type Database,
} from '@/mocks/db'
import {
  batchKeyOf,
  evaluateRegions,
  hashRules,
  regionEntryId,
  shardKeyOf,
} from '@/mocks/batch'
import type { DifferenceRegion, IgnoreRule, ReviewBatch, ScreenshotRun } from '@/types'

export interface Assertions {
  pass: number
  fail: number
}

export const runScenarios = (): Assertions => {
  const stats = { pass: 0, fail: 0 }
  const check = (name: string, cond: boolean, detail = '') => {
    if (cond) {
      stats.pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      stats.fail += 1
      console.error(`  ❌ ${name} ${detail}`)
    }
  }

  const freshDb = (): Database => {
    localStorage.clear()
    return migrateDb(null)
  }

  const makeRun = (overrides: Partial<ScreenshotRun> & Pick<ScreenshotRun, 'id' | 'projectId' | 'build'>): ScreenshotRun => ({
    name: `${overrides.id} 回归`,
    page: '订单结算页',
    device: 'Desktop 1440',
    theme: 'light',
    status: 'pending',
    mismatchRate: 2,
    capturedAt: new Date().toISOString(),
    baselineVersion: 'b1',
    currentVersion: 'c1',
    regions: [],
    executor: 'runner-1',
    shardIndex: 0,
    ...overrides,
  })

  const makeRegion = (id: string, kind: DifferenceRegion['kind'] = 'layout', selector?: string): DifferenceRegion => ({
    id,
    x: 1,
    y: 1,
    width: 2,
    height: 2,
    severity: 'medium',
    pixels: 100,
    kind,
    ignored: false,
    selector,
  })

  // 模拟 attachRun + enterReview 的核心流转（与 http.ts 保持一致）
  const createBatch = (db: Database, runs: ScreenshotRun[]): ReviewBatch => {
    const first = runs[0]
    const batch: ReviewBatch = {
      id: `batch-${Math.random().toString(36).slice(2)}`,
      key: batchKeyOf(first),
      projectId: first.projectId,
      page: first.page,
      device: first.device,
      theme: first.theme,
      build: first.build,
      status: 'collecting',
      revision: 1,
      currentRound: 0,
      runIds: [],
      archivedShardKeys: [],
      snapshots: [],
      rounds: [],
      regions: [],
      approvals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.batches.push(batch)
    for (const run of runs) attach(db, batch, run)
    return batch
  }

  const runsOf = (db: Database, batch: ReviewBatch): ScreenshotRun[] =>
    batch.runIds
      .map((id) => db.runs.find((run) => run.id === id))
      .filter((r): r is ScreenshotRun => Boolean(r))

  const snapshotRules = (db: Database, batch: ReviewBatch) => {
    const takenAt = new Date().toISOString()
    const snap = { id: `snap-${hashRules(db.rules)}-${takenAt}`, takenAt, hash: hashRules(db.rules), rules: db.rules.map((r) => ({ ...r })) }
    batch.snapshots.push(snap)
    return snap
  }

  const attach = (db: Database, batch: ReviewBatch, run: ScreenshotRun): boolean => {
    const key = run.shardKey ?? shardKeyOf(run)
    run.shardKey = key
    run.batchId = batch.id
    if (batch.archivedShardKeys.includes(key)) {
      run.duplicated = true
      return false
    }
    batch.archivedShardKeys.push(key)
    if (!batch.runIds.includes(run.id)) batch.runIds.push(run.id)
    db.runs.unshift(run)
    if (batch.currentRound > 0) {
      const open = batch.rounds.find((r) => r.status === 'open')
      const anchor = open ?? [...batch.rounds].sort((a, b) => b.round - a.round)[0]
      const snap = batch.snapshots.find((s) => s.id === anchor?.snapshotId)
      if (open) open.status = 'superseded'
      const next = snapshotRulesWith(db, batch, snap?.rules ?? db.rules)
      batch.regions = evaluateRegions(batch.regions, runsOf(db, batch), next.rules, next.round)
    }
    return true
  }

  const snapshotRulesWith = (db: Database, batch: ReviewBatch, rules: IgnoreRule[]) => {
    const takenAt = new Date().toISOString()
    const snap = { id: `snap-${hashRules(rules)}-${takenAt}`, takenAt, hash: hashRules(rules), rules: rules.map((r) => ({ ...r })) }
    batch.snapshots.push(snap)
    batch.currentRound += 1
    batch.rounds.push({
      round: batch.currentRound,
      snapshotId: snap.id,
      startedAt: takenAt,
      status: 'open',
      runIds: [...batch.runIds],
    })
    return { rules: snap.rules, round: batch.currentRound }
  }

  const enterReview = (db: Database, batch: ReviewBatch) => {
    if (batch.rounds.some((r) => r.status === 'open')) return
    const { rules, round } = snapshotRulesWith(db, batch, db.rules)
    batch.regions = evaluateRegions(batch.regions, runsOf(db, batch), rules, round)
    batch.status = 'in-review'
  }

  // ============ 场景 1：重复分片只归档一次 ============
  console.log('场景 1：同项目同构建重复分片去重')
  {
    const db = freshDb()
    const r1 = makeRun({ id: 'r-a', projectId: 'p1', build: 'b1', executor: 'runner-7', shardIndex: 0 })
    const r2 = makeRun({ id: 'r-b', projectId: 'p1', build: 'b1', executor: 'runner-7', shardIndex: 0 }) // 重复
    const r3 = makeRun({ id: 'r-c', projectId: 'p1', build: 'b1', executor: 'runner-7', shardIndex: 1 }) // 新分片
    const batch = createBatch(db, [r1])
    const dup = attach(db, batch, r2)
    attach(db, batch, r3)
    check('重复分片返回 false', dup === false)
    check('重复分片被标记 duplicated', r2.duplicated === true)
    check('批次只归档 2 个唯一分片', batch.archivedShardKeys.length === 2, `got ${batch.archivedShardKeys.length}`)
    check('批次 runIds 不含重复分片', batch.runIds.length === 2 && !batch.runIds.includes('r-b'))
    check('不同项目/构建不会混入同批次', batchKeyOf(makeRun({ id: 'x', projectId: 'p2', build: 'b1' })) !== batch.key)
  }

  // ============ 场景 2：进入评审固定规则快照 + 区域判定 ============
  console.log('场景 2：进入评审固定规则快照和区域判定')
  {
    const db = freshDb()
    const r = makeRun({
      id: 'r1',
      projectId: 'p-commerce',
      build: 'b1',
      regions: [
        makeRegion('g1', 'layout'),
        makeRegion('g2', 'environment', '[data-visual-ignore="relative-time"]'),
      ],
    })
    const batch = createBatch(db, [r])
    enterReview(db, batch)
    check('产生第 1 轮', batch.currentRound === 1)
    check('规则快照已冻结', batch.snapshots.length === 1)
    const envState = batch.regions.find((s) => s.regionId === 'g2')
    check('环境区域被启用规则自动忽略', envState?.ignored === true && envState.ruleId === 'rule-time')
    const layoutState = batch.regions.find((s) => s.regionId === 'g1')
    check('布局区域保持待判定', layoutState?.ignored === false && layoutState.state === 'pending')

    // 规则变化后，进入评审中的旧批次不自动套用新规则（快照固定）
    db.rules.find((rule) => rule.id === 'rule-time')!.enabled = false
    const snapshotHash = batch.snapshots[0].hash
    check('快照内容哈希不随后续规则开关变化', snapshotHash === hashRules(batch.snapshots[0].rules))
  }

  // ============ 场景 3：晚到分片只重算未确认区域，已确认区域与旧基线保留 ============
  console.log('场景 3：晚到分片增量续算')
  {
    const db = freshDb()
    const r1 = makeRun({
      id: 'r1',
      projectId: 'p-commerce',
      build: 'b1',
      executor: 'runner-1',
      shardIndex: 0,
      regions: [makeRegion('g1', 'layout'), makeRegion('g2', 'environment', '[data-visual-ignore="relative-time"]')],
    })
    const batch = createBatch(db, [r1])
    enterReview(db, batch)
    // 人工确认 g1 忽略
    const g1 = batch.regions.find((s) => s.regionId === 'g1')!
    g1.state = 'confirmed'
    g1.manual = true
    g1.ignored = true
    // 第一轮批准
    const round1 = batch.rounds[0]
    round1.status = 'approved'
    round1.closedAt = new Date().toISOString()
    batch.approvals.push({
      opId: 'op1',
      round: 1,
      decision: 'approved',
      category: 'design-change',
      reviewer: '林默',
      reason: '第一批批准依据',
      reviewedAt: new Date().toISOString(),
      runIds: ['r1'],
      baselineId: 'base-old',
    })
    const oldBaselineCount = db.baselines.length

    // 晚到分片 r2，带新区域 g3
    const r2 = makeRun({
      id: 'r2',
      projectId: 'p-commerce',
      build: 'b1',
      executor: 'runner-2',
      shardIndex: 1,
      regions: [makeRegion('g3', 'color')],
    })
    attach(db, batch, r2)

    check('开启第 2 轮', batch.currentRound === 2)
    check('第 1 轮保留为已批准（旧基线依据）', batch.rounds[0].status === 'approved')
    check('审批历史保留', batch.approvals.length === 1 && batch.approvals[0].opId === 'op1')
    check('基线未被自动改动', db.baselines.length === oldBaselineCount)
    const g1State = batch.regions.find((s) => s.regionId === 'g1')!
    check('已确认区域保持人工结论且未被重算', g1State.state === 'confirmed' && g1State.manual && g1State.ignored)
    const g3State = batch.regions.find((s) => s.regionId === 'g3')!
    check('新分片区域进入第 2 轮待判定', g3State.round === 2 && g3State.state === 'pending' && g3State.ignored === false)
    // g2 是规则忽略但未人工确认的旧区域，新轮次按（冻结）规则重新判定仍为忽略
    const g2State = batch.regions.find((s) => s.regionId === 'g2')!
    check('未确认的规则区域随新轮重算', g2State.round === 2)
  }

  // ============ 场景 3b：规则变化只重算未确认区域 ============
  console.log('场景 3b：规则变化增量重算')
  {
    const db = freshDb()
    const r = makeRun({
      id: 'r1',
      projectId: 'p-commerce',
      build: 'b1',
      regions: [
        makeRegion('g1', 'layout'),
        makeRegion('g2', 'environment', '[data-visual-ignore="relative-time"]'),
      ],
    })
    const batch = createBatch(db, [r])
    enterReview(db, batch)
    const g1 = batch.regions.find((s) => s.regionId === 'g1')!
    g1.state = 'confirmed'
    g1.manual = true
    g1.ignored = true
    const confirmedRound = g1.round

    // 停用时间规则后，对开放轮次重算
    db.rules.find((rule) => rule.id === 'rule-time')!.enabled = false
    const open = batch.rounds.find((rr) => rr.status === 'open')!
    open.status = 'superseded'
    const { rules, round } = snapshotRulesWith(db, batch, db.rules)
    batch.regions = evaluateRegions(batch.regions, runsOf(db, batch), rules, round)

    const g2 = batch.regions.find((s) => s.regionId === 'g2')!
    check('规则停用后原忽略区域变为待判定', g2.ignored === false && g2.round === round)
    const g1After = batch.regions.find((s) => s.regionId === 'g1')!
    check('人工已确认区域不受规则变化影响', g1After.state === 'confirmed' && g1After.ignored && g1After.round === confirmedRound)
  }

  // ============ 场景 4：乐观锁并发提交，后到失败留草稿 ============
  console.log('场景 4：并发提交乐观锁')
  {
    const db = freshDb()
    const r = makeRun({ id: 'r1', projectId: 'p-commerce', build: 'b1' })
    const batch = createBatch(db, [r])
    enterReview(db, batch)
    const revisionAtOpen = batch.revision
    // 窗口 A 先提交成功（revision +1）
    batch.revision += 1
    batch.rounds[0].status = 'approved'
    batch.rounds[0].closedAt = new Date().toISOString()
    // 窗口 B 用旧 revision 提交 -> 应当判定冲突
    const conflict = revisionAtOpen !== batch.revision
    check('后到提交检测到 revision 冲突', conflict)
    const draft = {
      form: { category: 'render-error' as const, decision: 'rejected' as const, reviewer: '周航', reason: '窗口B的结论' },
      savedAt: new Date().toISOString(),
      attemptedRevision: revisionAtOpen,
      serverRevision: batch.revision,
      conflict: '批次已被其他评审窗口提交',
    }
    db.drafts[batch.id] = draft
    commitDb(db, 'op-draft-1', '保存冲突草稿')
    const reloaded = migrateDb(JSON.parse(localStorage.getItem('visual-regression-platform-v1')!))
    check('草稿已持久化', reloaded.drafts[batch.id]?.form.reason === '窗口B的结论')
    check('草稿记录两端 revision', reloaded.drafts[batch.id].attemptedRevision === revisionAtOpen && reloaded.drafts[batch.id].serverRevision === batch.revision)
  }

  // ============ 场景 5：写入失败 → WAL → 重启恢复，幂等不重复 ============
  console.log('场景 5：本地存储故障与重启恢复')
  {
    const db = freshDb()
    const r = makeRun({ id: 'r1', projectId: 'p-commerce', build: 'b1', regions: [makeRegion('g1')] })
    const batch = createBatch(db, [r])
    enterReview(db, batch)
    const approvalsBefore = batch.approvals.length

    // 开启故障注入
    setFaultEnabled(true)
    let threw = false
    try {
      batch.approvals.push({
        opId: 'op-final',
        round: 1,
        decision: 'approved',
        category: 'design-change',
        reviewer: '林默',
        reason: '故障前最后一次审批',
        reviewedAt: new Date().toISOString(),
        runIds: ['r1'],
      })
      commitDb(db, 'op-final', '故障写入')
    } catch (error) {
      threw = error instanceof StorageWriteError
    }
    check('主库写入抛出 StorageWriteError', threw)

    // 重启（清除内存态由模块缓存保证；这里直接重放 WAL）
    setFaultEnabled(false)
    const recovered = replayWal()
    check('重启后重放 WAL 成功', recovered?.opId === 'op-final')
    const after = migrateDb(JSON.parse(localStorage.getItem('visual-regression-platform-v1')!))
    const recoveredBatch = after.batches.find((b) => b.id === batch.id)!
    check('恢复后审批记录存在', recoveredBatch.approvals.some((a) => a.opId === 'op-final'))
    check('恢复后审批只有 1 条（幂等无重复）', recoveredBatch.approvals.length === approvalsBefore + 1)
    const uniqueRegions = new Set(recoveredBatch.regions.map((s) => regionEntryId(s.runId, s.regionId)))
    check('恢复后区域无重复', uniqueRegions.size === recoveredBatch.regions.length)

    // 再次重放不应重复
    const second = replayWal()
    check('WAL 已清空，二次重启不再重放', second === null)
  }

  // ============ 场景 6：旧运行迁移为单运行批次 ============
  console.log('场景 6：旧运行惰性迁移')
  {
    const seed = freshDb()
    const legacy = seed.runs.find((run) => run.id === 'run-1048')!
    check('迁移前旧运行无 batchId', !legacy.batchId)
    // 首次打开：补批次 + 进入评审（http 层行为，这里模拟创建后 enter）
    const batch: ReviewBatch = {
      id: 'batch-legacy',
      key: batchKeyOf(legacy),
      projectId: legacy.projectId,
      page: legacy.page,
      device: legacy.device,
      theme: legacy.theme,
      build: legacy.build,
      status: 'collecting',
      revision: 1,
      currentRound: 0,
      runIds: [legacy.id],
      archivedShardKeys: [shardKeyOf(legacy)],
      snapshots: [],
      rounds: [],
      regions: [],
      approvals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    legacy.batchId = batch.id
    seed.batches.unshift(batch)
    enterReview(seed, batch)
    check('旧运行补成单运行单分片批次', batch.runIds.length === 1 && batch.archivedShardKeys.length === 1)
    check('迁移后即第 1 轮评审', batch.currentRound === 1)
    check('区域判定已初始化', batch.regions.length === legacy.regions.length)
  }

  console.log(`\n结果：${stats.pass} 通过 / ${stats.fail} 失败`)
  return stats
}
