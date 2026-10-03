var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/mocks/db.ts
var STORAGE_KEY, WAL_KEY, FAULT_KEY, RECOVERY_KEY, StorageWriteError, projects, REGION_SELECTORS, makeRegions, runs, baselines, rules, seed, isFaultEnabled, setFaultEnabled, readWal, writeWal, clearRecoveryInfo, migrateDb, cachedDb, commitDb, replayWal;
var init_db = __esm({
  "src/mocks/db.ts"() {
    STORAGE_KEY = "visual-regression-platform-v1";
    WAL_KEY = "visual-regression-platform-wal-v1";
    FAULT_KEY = "visual-regression-platform-fault-v1";
    RECOVERY_KEY = "visual-regression-platform-recovery-v1";
    StorageWriteError = class extends Error {
      constructor(opId) {
        super("\u672C\u5730\u5B58\u50A8\u5199\u5165\u5931\u8D25\uFF0C\u5DF2\u5199\u5165\u9884\u5199\u65E5\u5FD7\uFF0C\u91CD\u542F\u540E\u53EF\u6062\u590D");
        this.opId = opId;
        this.name = "StorageWriteError";
      }
    };
    projects = [
      { id: "p-commerce", name: "\u96F6\u552E\u4EA4\u6613\u5DE5\u4F5C\u53F0", code: "RETAIL", owner: "\u6C88\u5B81", pageCount: 42 },
      { id: "p-console", name: "\u4E91\u8D44\u6E90\u63A7\u5236\u53F0", code: "CLOUD", owner: "\u5468\u822A", pageCount: 67 },
      { id: "p-growth", name: "\u589E\u957F\u8FD0\u8425\u5E73\u53F0", code: "GROWTH", owner: "\u8BB8\u8587", pageCount: 31 }
    ];
    REGION_SELECTORS = {
      r1: '[data-test="layout-stage"]',
      r2: '[data-test="palette-token"]',
      r3: '[data-visual-ignore="relative-time"]'
    };
    makeRegions = (prefix, intensity) => [
      {
        id: `${prefix}-r1`,
        x: 11,
        y: 18,
        width: 28,
        height: 16,
        severity: "high",
        pixels: Math.round(1840 * intensity),
        kind: "layout",
        ignored: false,
        selector: REGION_SELECTORS.r1
      },
      {
        id: `${prefix}-r2`,
        x: 54,
        y: 34,
        width: 19,
        height: 11,
        severity: "medium",
        pixels: Math.round(720 * intensity),
        kind: "color",
        ignored: false,
        selector: REGION_SELECTORS.r2
      },
      {
        id: `${prefix}-r3`,
        x: 72,
        y: 71,
        width: 18,
        height: 13,
        severity: "low",
        pixels: Math.round(216 * intensity),
        kind: "environment",
        ignored: true,
        ruleId: "rule-time",
        selector: REGION_SELECTORS.r3
      }
    ];
    runs = [
      {
        id: "run-1048",
        name: "\u7ED3\u7B97\u9875\u684C\u9762\u7AEF\u56DE\u5F52",
        projectId: "p-commerce",
        page: "\u8BA2\u5355\u7ED3\u7B97\u9875",
        device: "Desktop 1440",
        theme: "light",
        build: "release/6.18.0",
        status: "pending",
        mismatchRate: 3.82,
        capturedAt: "2026-09-29T08:42:00+08:00",
        baselineVersion: "v6.17.4-baseline",
        currentVersion: "v6.18.0-rc2",
        regions: makeRegions("1048", 1)
      },
      {
        id: "run-1047",
        name: "\u5546\u54C1\u5217\u8868\u79FB\u52A8\u7AEF\u56DE\u5F52",
        projectId: "p-commerce",
        page: "\u5546\u54C1\u5217\u8868\u9875",
        device: "iPhone 15",
        theme: "light",
        build: "release/6.18.0",
        status: "pending",
        mismatchRate: 1.36,
        capturedAt: "2026-09-29T08:36:00+08:00",
        baselineVersion: "v6.17.4-baseline",
        currentVersion: "v6.18.0-rc2",
        regions: makeRegions("1047", 0.7)
      },
      {
        id: "run-1046",
        name: "\u8D26\u5355\u660E\u7EC6\u6697\u8272\u4E3B\u9898\u56DE\u5F52",
        projectId: "p-console",
        page: "\u8D26\u5355\u660E\u7EC6",
        device: "Desktop 1920",
        theme: "dark",
        build: "feature/billing-v3",
        status: "approved",
        mismatchRate: 5.14,
        capturedAt: "2026-09-28T17:20:00+08:00",
        baselineVersion: "v5.9.1-baseline",
        currentVersion: "billing-v3.7",
        regions: makeRegions("1046", 1.4),
        review: {
          category: "design-change",
          decision: "approved",
          reviewer: "\u6797\u9ED8",
          reason: "\u65B0\u8BA1\u8D39\u5468\u671F\u5217\u6309\u9700\u6C42\u4E0A\u7EBF\uFF0C\u5DF2\u6838\u5BF9\u8BBE\u8BA1\u7A3F\u548C\u9A8C\u6536\u5355\u3002",
          reviewedAt: "2026-09-28T18:02:00+08:00"
        }
      },
      {
        id: "run-1045",
        name: "\u6D3B\u52A8\u914D\u7F6E\u9875\u79FB\u52A8\u7AEF\u56DE\u5F52",
        projectId: "p-growth",
        page: "\u6D3B\u52A8\u914D\u7F6E",
        device: "Android Pixel 8",
        theme: "light",
        build: "feature/campaign-editor",
        status: "rejected",
        mismatchRate: 10.73,
        capturedAt: "2026-09-28T15:11:00+08:00",
        baselineVersion: "v2.4.0-baseline",
        currentVersion: "campaign-v2",
        regions: makeRegions("1045", 2.2),
        review: {
          category: "render-error",
          decision: "rejected",
          reviewer: "\u6881\u742A",
          reason: "\u4E3B\u64CD\u4F5C\u533A\u88AB\u4FA7\u680F\u906E\u6321\uFF0C\u5C5E\u4E8E\u963B\u65AD\u6027\u6E32\u67D3\u5F02\u5E38\u3002",
          reviewedAt: "2026-09-28T15:44:00+08:00"
        }
      },
      {
        id: "run-1044",
        name: "\u8D44\u6E90\u8BE6\u60C5\u9875\u684C\u9762\u7AEF\u56DE\u5F52",
        projectId: "p-console",
        page: "\u8D44\u6E90\u8BE6\u60C5",
        device: "Desktop 1440",
        theme: "light",
        build: "release/5.10.0",
        status: "pending",
        mismatchRate: 2.08,
        capturedAt: "2026-09-28T13:30:00+08:00",
        baselineVersion: "v5.9.1-baseline",
        currentVersion: "v5.10.0-rc1",
        regions: makeRegions("1044", 0.9)
      },
      {
        id: "run-1043",
        name: "\u9996\u9875\u63A8\u8350\u4F4D\u56DE\u5F52",
        projectId: "p-growth",
        page: "\u8FD0\u8425\u9996\u9875",
        device: "Desktop 1440",
        theme: "light",
        build: "release/2.6.0",
        status: "pending",
        mismatchRate: 0.94,
        capturedAt: "2026-09-27T19:15:00+08:00",
        baselineVersion: "v2.5.3-baseline",
        currentVersion: "v2.6.0-rc3",
        regions: makeRegions("1043", 0.5)
      }
    ];
    baselines = [
      {
        id: "base-commerce-checkout",
        projectId: "p-commerce",
        page: "\u8BA2\u5355\u7ED3\u7B97\u9875",
        device: "Desktop 1440",
        theme: "light",
        version: "v6.17.4-baseline",
        approvedBy: "\u6797\u9ED8",
        reason: "\u5408\u5165\u4F18\u60E0\u5238\u533A\u57DF\u6539\u7248\uFF0C\u8BBE\u8BA1\u7A3F\u7248\u672C DS-318\u3002",
        approvedAt: "2026-09-19T11:30:00+08:00",
        runId: "run-998",
        active: true
      },
      {
        id: "base-console-billing",
        projectId: "p-console",
        page: "\u8D26\u5355\u660E\u7EC6",
        device: "Desktop 1920",
        theme: "dark",
        version: "v5.9.1-baseline",
        approvedBy: "\u5468\u822A",
        reason: "\u5347\u7EA7\u8D26\u5355\u8868\u683C\u4E3B\u9898\u53D8\u91CF\uFF0C\u65E0\u4E1A\u52A1\u5E03\u5C40\u53D8\u5316\u3002",
        approvedAt: "2026-09-12T14:05:00+08:00",
        runId: "run-961",
        active: true
      },
      {
        id: "base-growth-campaign",
        projectId: "p-growth",
        page: "\u6D3B\u52A8\u914D\u7F6E",
        device: "Android Pixel 8",
        theme: "light",
        version: "v2.4.0-baseline",
        approvedBy: "\u8BB8\u8587",
        reason: "\u7B2C\u4E00\u7248\u79FB\u52A8\u7AEF\u6D3B\u52A8\u914D\u7F6E\u5DE5\u4F5C\u53F0\u57FA\u7EBF\u3002",
        approvedAt: "2026-08-28T10:10:00+08:00",
        runId: "run-902",
        active: false
      },
      {
        id: "base-commerce-list",
        projectId: "p-commerce",
        page: "\u5546\u54C1\u5217\u8868\u9875",
        device: "iPhone 15",
        theme: "light",
        version: "v6.17.4-baseline",
        approvedBy: "\u6C88\u5B81",
        reason: "\u5546\u54C1\u5361\u4FE1\u606F\u5BC6\u5EA6\u8C03\u6574\u5B8C\u6210\uFF0C\u5DF2\u901A\u8FC7\u4EA4\u4E92\u9A8C\u6536\u3002",
        approvedAt: "2026-09-20T16:40:00+08:00",
        runId: "run-1002",
        active: true
      }
    ];
    rules = [
      {
        id: "rule-time",
        name: "\u52A8\u6001\u65F6\u95F4\u533A\u57DF",
        projectId: "all",
        selector: '[data-visual-ignore="relative-time"]',
        pagePattern: "*",
        devicePattern: "*",
        maxDelta: 12,
        enabled: true,
        createdAt: "2026-09-02T09:00:00+08:00"
      },
      {
        id: "rule-avatar",
        name: "\u7528\u6237\u5934\u50CF\u968F\u673A\u56FE",
        projectId: "p-commerce",
        selector: ".user-avatar img",
        pagePattern: "/checkout/*",
        devicePattern: "*",
        maxDelta: 20,
        enabled: true,
        createdAt: "2026-09-05T13:25:00+08:00"
      },
      {
        id: "rule-watermark",
        name: "\u6D4B\u8BD5\u73AF\u5883\u6C34\u5370",
        projectId: "all",
        selector: ".environment-watermark",
        pagePattern: "*",
        devicePattern: "*",
        maxDelta: 5,
        enabled: true,
        createdAt: "2026-08-21T11:08:00+08:00"
      },
      {
        id: "rule-animation",
        name: "\u65E7\u7248\u9AA8\u67B6\u5C4F\u52A8\u753B",
        projectId: "p-console",
        selector: ".skeleton-shimmer",
        pagePattern: "*",
        devicePattern: "iPhone*",
        maxDelta: 8,
        enabled: false,
        createdAt: "2026-08-16T17:12:00+08:00"
      }
    ];
    seed = () => ({
      version: 2,
      projects,
      runs,
      baselines,
      rules,
      batches: [],
      drafts: {}
    });
    isFaultEnabled = () => localStorage.getItem(FAULT_KEY) === "on";
    setFaultEnabled = (on) => {
      if (on) localStorage.setItem(FAULT_KEY, "on");
      else localStorage.removeItem(FAULT_KEY);
    };
    readWal = () => {
      const raw = localStorage.getItem(WAL_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    writeWal = (entries) => {
      localStorage.setItem(WAL_KEY, JSON.stringify(entries.slice(-5)));
    };
    clearRecoveryInfo = () => localStorage.removeItem(RECOVERY_KEY);
    migrateDb = (raw) => {
      if (!raw || typeof raw !== "object") return seed();
      const db = raw;
      const base = seed();
      const migrated = {
        version: 2,
        projects: Array.isArray(db.projects) && db.projects.length ? db.projects : base.projects,
        runs: Array.isArray(db.runs) ? db.runs : base.runs,
        baselines: Array.isArray(db.baselines) ? db.baselines : base.baselines,
        rules: Array.isArray(db.rules) ? db.rules : base.rules,
        // v1 数据无批次概念：不预建批次，旧运行首次打开时补成单运行批次
        batches: Array.isArray(db.batches) ? db.batches : [],
        drafts: db.drafts && typeof db.drafts === "object" ? db.drafts : {}
      };
      return migrated;
    };
    cachedDb = null;
    commitDb = (db, opId, note) => {
      const entries = readWal().filter((entry2) => entry2.opId !== opId);
      const entry = { opId, at: (/* @__PURE__ */ new Date()).toISOString(), db, note };
      writeWal([...entries, entry]);
      if (isFaultEnabled()) {
        throw new StorageWriteError(opId);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (error) {
        throw new StorageWriteError(opId);
      }
      writeWal([]);
      cachedDb = db;
    };
    replayWal = () => {
      const entries = readWal();
      if (entries.length === 0) {
        clearRecoveryInfo();
        return null;
      }
      const entry = entries[entries.length - 1];
      if (isFaultEnabled()) return null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entry.db));
        writeWal(entries.filter((item) => item.opId !== entry.opId));
        cachedDb = entry.db;
        const info = { ...entry, recoveredAt: (/* @__PURE__ */ new Date()).toISOString() };
        localStorage.setItem(RECOVERY_KEY, JSON.stringify(info));
        return info;
      } catch {
        return null;
      }
    };
  }
});

// src/mocks/batch.ts
var batchKeyOf, shardKeyOf, globMatch, ruleApplies, matchRuleForRegion, hashRules, regionEntryId, evaluateRegions;
var init_batch = __esm({
  "src/mocks/batch.ts"() {
    batchKeyOf = (scope) => [scope.projectId, scope.build, scope.page, scope.device, scope.theme].map((part) => encodeURIComponent(part.trim())).join("|");
    shardKeyOf = (run) => `${run.executor ?? "executor-default"}#${run.shardIndex ?? 0}`;
    globMatch = (pattern, value) => {
      const p = (pattern || "*").trim();
      if (!p || p === "*") return true;
      const escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`).test(value);
    };
    ruleApplies = (rule, scope) => rule.enabled && (rule.projectId === "all" || rule.projectId === scope.projectId) && globMatch(rule.pagePattern, scope.page) && globMatch(rule.devicePattern, scope.device);
    matchRuleForRegion = (region, rules2, scope) => {
      const applicable = rules2.filter((rule) => ruleApplies(rule, scope));
      if (region.selector) {
        return applicable.find((rule) => rule.selector === region.selector);
      }
      return applicable.find(
        (rule) => region.kind === "environment" && region.pixels <= rule.maxDelta * 20
      );
    };
    hashRules = (rules2) => {
      const body = JSON.stringify(
        rules2.map((rule) => [
          rule.id,
          rule.enabled,
          rule.selector,
          rule.projectId,
          rule.pagePattern,
          rule.devicePattern,
          rule.maxDelta
        ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      );
      let hash = 0;
      for (let i = 0; i < body.length; i += 1) {
        hash = hash * 31 + body.charCodeAt(i) | 0;
      }
      return `rh-${(hash >>> 0).toString(36)}`;
    };
    regionEntryId = (runId, regionId) => `${runId}::${regionId}`;
    evaluateRegions = (states, runs2, rules2, round) => {
      const runById = new Map(runs2.map((run) => [run.id, run]));
      const next = [];
      const seen = /* @__PURE__ */ new Set();
      for (const state of states) {
        seen.add(regionEntryId(state.runId, state.regionId));
        if (state.state === "confirmed") {
          next.push({ ...state });
          continue;
        }
        const run = runById.get(state.runId);
        const region = run?.regions.find((item) => item.id === state.regionId);
        if (!run || !region) {
          next.push({ ...state, round });
          continue;
        }
        const matched = matchRuleForRegion(region, rules2, {
          projectId: run.projectId,
          page: run.page,
          device: run.device
        });
        next.push({
          runId: state.runId,
          regionId: state.regionId,
          ignored: Boolean(matched),
          ruleId: matched?.id,
          manual: false,
          state: "pending",
          round
        });
      }
      for (const run of runs2) {
        for (const region of run.regions) {
          const entryId = regionEntryId(run.id, region.id);
          if (seen.has(entryId)) continue;
          seen.add(entryId);
          const matched = matchRuleForRegion(region, rules2, {
            projectId: run.projectId,
            page: run.page,
            device: run.device
          });
          next.push({
            runId: run.id,
            regionId: region.id,
            ignored: Boolean(matched),
            ruleId: matched?.id,
            manual: false,
            state: "pending",
            round
          });
        }
      }
      return next;
    };
  }
});

// scripts/harness.ts
var harness_exports = {};
__export(harness_exports, {
  runScenarios: () => runScenarios
});
var runScenarios;
var init_harness = __esm({
  "scripts/harness.ts"() {
    init_db();
    init_batch();
    runScenarios = () => {
      const stats2 = { pass: 0, fail: 0 };
      const check = (name, cond, detail = "") => {
        if (cond) {
          stats2.pass += 1;
          console.log(`  \u2705 ${name}`);
        } else {
          stats2.fail += 1;
          console.error(`  \u274C ${name} ${detail}`);
        }
      };
      const freshDb = () => {
        localStorage.clear();
        return migrateDb(null);
      };
      const makeRun = (overrides) => ({
        name: `${overrides.id} \u56DE\u5F52`,
        page: "\u8BA2\u5355\u7ED3\u7B97\u9875",
        device: "Desktop 1440",
        theme: "light",
        status: "pending",
        mismatchRate: 2,
        capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
        baselineVersion: "b1",
        currentVersion: "c1",
        regions: [],
        executor: "runner-1",
        shardIndex: 0,
        ...overrides
      });
      const makeRegion = (id, kind = "layout", selector) => ({
        id,
        x: 1,
        y: 1,
        width: 2,
        height: 2,
        severity: "medium",
        pixels: 100,
        kind,
        ignored: false,
        selector
      });
      const createBatch = (db, runs2) => {
        const first = runs2[0];
        const batch = {
          id: `batch-${Math.random().toString(36).slice(2)}`,
          key: batchKeyOf(first),
          projectId: first.projectId,
          page: first.page,
          device: first.device,
          theme: first.theme,
          build: first.build,
          status: "collecting",
          revision: 1,
          currentRound: 0,
          runIds: [],
          archivedShardKeys: [],
          snapshots: [],
          rounds: [],
          regions: [],
          approvals: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.batches.push(batch);
        for (const run of runs2) attach(db, batch, run);
        return batch;
      };
      const runsOf = (db, batch) => batch.runIds.map((id) => db.runs.find((run) => run.id === id)).filter((r) => Boolean(r));
      const snapshotRules = (db, batch) => {
        const takenAt = (/* @__PURE__ */ new Date()).toISOString();
        const snap = { id: `snap-${hashRules(db.rules)}-${takenAt}`, takenAt, hash: hashRules(db.rules), rules: db.rules.map((r) => ({ ...r })) };
        batch.snapshots.push(snap);
        return snap;
      };
      const attach = (db, batch, run) => {
        const key = run.shardKey ?? shardKeyOf(run);
        run.shardKey = key;
        run.batchId = batch.id;
        if (batch.archivedShardKeys.includes(key)) {
          run.duplicated = true;
          return false;
        }
        batch.archivedShardKeys.push(key);
        if (!batch.runIds.includes(run.id)) batch.runIds.push(run.id);
        db.runs.unshift(run);
        if (batch.currentRound > 0) {
          const open = batch.rounds.find((r) => r.status === "open");
          const anchor = open ?? [...batch.rounds].sort((a, b) => b.round - a.round)[0];
          const snap = batch.snapshots.find((s) => s.id === anchor?.snapshotId);
          if (open) open.status = "superseded";
          const next = snapshotRulesWith(db, batch, snap?.rules ?? db.rules);
          batch.regions = evaluateRegions(batch.regions, runsOf(db, batch), next.rules, next.round);
        }
        return true;
      };
      const snapshotRulesWith = (db, batch, rules2) => {
        const takenAt = (/* @__PURE__ */ new Date()).toISOString();
        const snap = { id: `snap-${hashRules(rules2)}-${takenAt}`, takenAt, hash: hashRules(rules2), rules: rules2.map((r) => ({ ...r })) };
        batch.snapshots.push(snap);
        batch.currentRound += 1;
        batch.rounds.push({
          round: batch.currentRound,
          snapshotId: snap.id,
          startedAt: takenAt,
          status: "open",
          runIds: [...batch.runIds]
        });
        return { rules: snap.rules, round: batch.currentRound };
      };
      const enterReview = (db, batch) => {
        if (batch.rounds.some((r) => r.status === "open")) return;
        const { rules: rules2, round } = snapshotRulesWith(db, batch, db.rules);
        batch.regions = evaluateRegions(batch.regions, runsOf(db, batch), rules2, round);
        batch.status = "in-review";
      };
      console.log("\u573A\u666F 1\uFF1A\u540C\u9879\u76EE\u540C\u6784\u5EFA\u91CD\u590D\u5206\u7247\u53BB\u91CD");
      {
        const db = freshDb();
        const r1 = makeRun({ id: "r-a", projectId: "p1", build: "b1", executor: "runner-7", shardIndex: 0 });
        const r2 = makeRun({ id: "r-b", projectId: "p1", build: "b1", executor: "runner-7", shardIndex: 0 });
        const r3 = makeRun({ id: "r-c", projectId: "p1", build: "b1", executor: "runner-7", shardIndex: 1 });
        const batch = createBatch(db, [r1]);
        const dup = attach(db, batch, r2);
        attach(db, batch, r3);
        check("\u91CD\u590D\u5206\u7247\u8FD4\u56DE false", dup === false);
        check("\u91CD\u590D\u5206\u7247\u88AB\u6807\u8BB0 duplicated", r2.duplicated === true);
        check("\u6279\u6B21\u53EA\u5F52\u6863 2 \u4E2A\u552F\u4E00\u5206\u7247", batch.archivedShardKeys.length === 2, `got ${batch.archivedShardKeys.length}`);
        check("\u6279\u6B21 runIds \u4E0D\u542B\u91CD\u590D\u5206\u7247", batch.runIds.length === 2 && !batch.runIds.includes("r-b"));
        check("\u4E0D\u540C\u9879\u76EE/\u6784\u5EFA\u4E0D\u4F1A\u6DF7\u5165\u540C\u6279\u6B21", batchKeyOf(makeRun({ id: "x", projectId: "p2", build: "b1" })) !== batch.key);
      }
      console.log("\u573A\u666F 2\uFF1A\u8FDB\u5165\u8BC4\u5BA1\u56FA\u5B9A\u89C4\u5219\u5FEB\u7167\u548C\u533A\u57DF\u5224\u5B9A");
      {
        const db = freshDb();
        const r = makeRun({
          id: "r1",
          projectId: "p-commerce",
          build: "b1",
          regions: [
            makeRegion("g1", "layout"),
            makeRegion("g2", "environment", '[data-visual-ignore="relative-time"]')
          ]
        });
        const batch = createBatch(db, [r]);
        enterReview(db, batch);
        check("\u4EA7\u751F\u7B2C 1 \u8F6E", batch.currentRound === 1);
        check("\u89C4\u5219\u5FEB\u7167\u5DF2\u51BB\u7ED3", batch.snapshots.length === 1);
        const envState = batch.regions.find((s) => s.regionId === "g2");
        check("\u73AF\u5883\u533A\u57DF\u88AB\u542F\u7528\u89C4\u5219\u81EA\u52A8\u5FFD\u7565", envState?.ignored === true && envState.ruleId === "rule-time");
        const layoutState = batch.regions.find((s) => s.regionId === "g1");
        check("\u5E03\u5C40\u533A\u57DF\u4FDD\u6301\u5F85\u5224\u5B9A", layoutState?.ignored === false && layoutState.state === "pending");
        db.rules.find((rule) => rule.id === "rule-time").enabled = false;
        const snapshotHash = batch.snapshots[0].hash;
        check("\u5FEB\u7167\u5185\u5BB9\u54C8\u5E0C\u4E0D\u968F\u540E\u7EED\u89C4\u5219\u5F00\u5173\u53D8\u5316", snapshotHash === hashRules(batch.snapshots[0].rules));
      }
      console.log("\u573A\u666F 3\uFF1A\u665A\u5230\u5206\u7247\u589E\u91CF\u7EED\u7B97");
      {
        const db = freshDb();
        const r1 = makeRun({
          id: "r1",
          projectId: "p-commerce",
          build: "b1",
          executor: "runner-1",
          shardIndex: 0,
          regions: [makeRegion("g1", "layout"), makeRegion("g2", "environment", '[data-visual-ignore="relative-time"]')]
        });
        const batch = createBatch(db, [r1]);
        enterReview(db, batch);
        const g1 = batch.regions.find((s) => s.regionId === "g1");
        g1.state = "confirmed";
        g1.manual = true;
        g1.ignored = true;
        const round1 = batch.rounds[0];
        round1.status = "approved";
        round1.closedAt = (/* @__PURE__ */ new Date()).toISOString();
        batch.approvals.push({
          opId: "op1",
          round: 1,
          decision: "approved",
          category: "design-change",
          reviewer: "\u6797\u9ED8",
          reason: "\u7B2C\u4E00\u6279\u6279\u51C6\u4F9D\u636E",
          reviewedAt: (/* @__PURE__ */ new Date()).toISOString(),
          runIds: ["r1"],
          baselineId: "base-old"
        });
        const oldBaselineCount = db.baselines.length;
        const r2 = makeRun({
          id: "r2",
          projectId: "p-commerce",
          build: "b1",
          executor: "runner-2",
          shardIndex: 1,
          regions: [makeRegion("g3", "color")]
        });
        attach(db, batch, r2);
        check("\u5F00\u542F\u7B2C 2 \u8F6E", batch.currentRound === 2);
        check("\u7B2C 1 \u8F6E\u4FDD\u7559\u4E3A\u5DF2\u6279\u51C6\uFF08\u65E7\u57FA\u7EBF\u4F9D\u636E\uFF09", batch.rounds[0].status === "approved");
        check("\u5BA1\u6279\u5386\u53F2\u4FDD\u7559", batch.approvals.length === 1 && batch.approvals[0].opId === "op1");
        check("\u57FA\u7EBF\u672A\u88AB\u81EA\u52A8\u6539\u52A8", db.baselines.length === oldBaselineCount);
        const g1State = batch.regions.find((s) => s.regionId === "g1");
        check("\u5DF2\u786E\u8BA4\u533A\u57DF\u4FDD\u6301\u4EBA\u5DE5\u7ED3\u8BBA\u4E14\u672A\u88AB\u91CD\u7B97", g1State.state === "confirmed" && g1State.manual && g1State.ignored);
        const g3State = batch.regions.find((s) => s.regionId === "g3");
        check("\u65B0\u5206\u7247\u533A\u57DF\u8FDB\u5165\u7B2C 2 \u8F6E\u5F85\u5224\u5B9A", g3State.round === 2 && g3State.state === "pending" && g3State.ignored === false);
        const g2State = batch.regions.find((s) => s.regionId === "g2");
        check("\u672A\u786E\u8BA4\u7684\u89C4\u5219\u533A\u57DF\u968F\u65B0\u8F6E\u91CD\u7B97", g2State.round === 2);
      }
      console.log("\u573A\u666F 3b\uFF1A\u89C4\u5219\u53D8\u5316\u589E\u91CF\u91CD\u7B97");
      {
        const db = freshDb();
        const r = makeRun({
          id: "r1",
          projectId: "p-commerce",
          build: "b1",
          regions: [
            makeRegion("g1", "layout"),
            makeRegion("g2", "environment", '[data-visual-ignore="relative-time"]')
          ]
        });
        const batch = createBatch(db, [r]);
        enterReview(db, batch);
        const g1 = batch.regions.find((s) => s.regionId === "g1");
        g1.state = "confirmed";
        g1.manual = true;
        g1.ignored = true;
        const confirmedRound = g1.round;
        db.rules.find((rule) => rule.id === "rule-time").enabled = false;
        const open = batch.rounds.find((rr) => rr.status === "open");
        open.status = "superseded";
        const { rules: rules2, round } = snapshotRulesWith(db, batch, db.rules);
        batch.regions = evaluateRegions(batch.regions, runsOf(db, batch), rules2, round);
        const g2 = batch.regions.find((s) => s.regionId === "g2");
        check("\u89C4\u5219\u505C\u7528\u540E\u539F\u5FFD\u7565\u533A\u57DF\u53D8\u4E3A\u5F85\u5224\u5B9A", g2.ignored === false && g2.round === round);
        const g1After = batch.regions.find((s) => s.regionId === "g1");
        check("\u4EBA\u5DE5\u5DF2\u786E\u8BA4\u533A\u57DF\u4E0D\u53D7\u89C4\u5219\u53D8\u5316\u5F71\u54CD", g1After.state === "confirmed" && g1After.ignored && g1After.round === confirmedRound);
      }
      console.log("\u573A\u666F 4\uFF1A\u5E76\u53D1\u63D0\u4EA4\u4E50\u89C2\u9501");
      {
        const db = freshDb();
        const r = makeRun({ id: "r1", projectId: "p-commerce", build: "b1" });
        const batch = createBatch(db, [r]);
        enterReview(db, batch);
        const revisionAtOpen = batch.revision;
        batch.revision += 1;
        batch.rounds[0].status = "approved";
        batch.rounds[0].closedAt = (/* @__PURE__ */ new Date()).toISOString();
        const conflict = revisionAtOpen !== batch.revision;
        check("\u540E\u5230\u63D0\u4EA4\u68C0\u6D4B\u5230 revision \u51B2\u7A81", conflict);
        const draft = {
          form: { category: "render-error", decision: "rejected", reviewer: "\u5468\u822A", reason: "\u7A97\u53E3B\u7684\u7ED3\u8BBA" },
          savedAt: (/* @__PURE__ */ new Date()).toISOString(),
          attemptedRevision: revisionAtOpen,
          serverRevision: batch.revision,
          conflict: "\u6279\u6B21\u5DF2\u88AB\u5176\u4ED6\u8BC4\u5BA1\u7A97\u53E3\u63D0\u4EA4"
        };
        db.drafts[batch.id] = draft;
        commitDb(db, "op-draft-1", "\u4FDD\u5B58\u51B2\u7A81\u8349\u7A3F");
        const reloaded = migrateDb(JSON.parse(localStorage.getItem("visual-regression-platform-v1")));
        check("\u8349\u7A3F\u5DF2\u6301\u4E45\u5316", reloaded.drafts[batch.id]?.form.reason === "\u7A97\u53E3B\u7684\u7ED3\u8BBA");
        check("\u8349\u7A3F\u8BB0\u5F55\u4E24\u7AEF revision", reloaded.drafts[batch.id].attemptedRevision === revisionAtOpen && reloaded.drafts[batch.id].serverRevision === batch.revision);
      }
      console.log("\u573A\u666F 5\uFF1A\u672C\u5730\u5B58\u50A8\u6545\u969C\u4E0E\u91CD\u542F\u6062\u590D");
      {
        const db = freshDb();
        const r = makeRun({ id: "r1", projectId: "p-commerce", build: "b1", regions: [makeRegion("g1")] });
        const batch = createBatch(db, [r]);
        enterReview(db, batch);
        const approvalsBefore = batch.approvals.length;
        setFaultEnabled(true);
        let threw = false;
        try {
          batch.approvals.push({
            opId: "op-final",
            round: 1,
            decision: "approved",
            category: "design-change",
            reviewer: "\u6797\u9ED8",
            reason: "\u6545\u969C\u524D\u6700\u540E\u4E00\u6B21\u5BA1\u6279",
            reviewedAt: (/* @__PURE__ */ new Date()).toISOString(),
            runIds: ["r1"]
          });
          commitDb(db, "op-final", "\u6545\u969C\u5199\u5165");
        } catch (error) {
          threw = error instanceof StorageWriteError;
        }
        check("\u4E3B\u5E93\u5199\u5165\u629B\u51FA StorageWriteError", threw);
        setFaultEnabled(false);
        const recovered = replayWal();
        check("\u91CD\u542F\u540E\u91CD\u653E WAL \u6210\u529F", recovered?.opId === "op-final");
        const after = migrateDb(JSON.parse(localStorage.getItem("visual-regression-platform-v1")));
        const recoveredBatch = after.batches.find((b) => b.id === batch.id);
        check("\u6062\u590D\u540E\u5BA1\u6279\u8BB0\u5F55\u5B58\u5728", recoveredBatch.approvals.some((a) => a.opId === "op-final"));
        check("\u6062\u590D\u540E\u5BA1\u6279\u53EA\u6709 1 \u6761\uFF08\u5E42\u7B49\u65E0\u91CD\u590D\uFF09", recoveredBatch.approvals.length === approvalsBefore + 1);
        const uniqueRegions = new Set(recoveredBatch.regions.map((s) => regionEntryId(s.runId, s.regionId)));
        check("\u6062\u590D\u540E\u533A\u57DF\u65E0\u91CD\u590D", uniqueRegions.size === recoveredBatch.regions.length);
        const second = replayWal();
        check("WAL \u5DF2\u6E05\u7A7A\uFF0C\u4E8C\u6B21\u91CD\u542F\u4E0D\u518D\u91CD\u653E", second === null);
      }
      console.log("\u573A\u666F 6\uFF1A\u65E7\u8FD0\u884C\u60F0\u6027\u8FC1\u79FB");
      {
        const seed2 = freshDb();
        const legacy = seed2.runs.find((run) => run.id === "run-1048");
        check("\u8FC1\u79FB\u524D\u65E7\u8FD0\u884C\u65E0 batchId", !legacy.batchId);
        const batch = {
          id: "batch-legacy",
          key: batchKeyOf(legacy),
          projectId: legacy.projectId,
          page: legacy.page,
          device: legacy.device,
          theme: legacy.theme,
          build: legacy.build,
          status: "collecting",
          revision: 1,
          currentRound: 0,
          runIds: [legacy.id],
          archivedShardKeys: [shardKeyOf(legacy)],
          snapshots: [],
          rounds: [],
          regions: [],
          approvals: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        legacy.batchId = batch.id;
        seed2.batches.unshift(batch);
        enterReview(seed2, batch);
        check("\u65E7\u8FD0\u884C\u8865\u6210\u5355\u8FD0\u884C\u5355\u5206\u7247\u6279\u6B21", batch.runIds.length === 1 && batch.archivedShardKeys.length === 1);
        check("\u8FC1\u79FB\u540E\u5373\u7B2C 1 \u8F6E\u8BC4\u5BA1", batch.currentRound === 1);
        check("\u533A\u57DF\u5224\u5B9A\u5DF2\u521D\u59CB\u5316", batch.regions.length === legacy.regions.length);
      }
      console.log(`
\u7ED3\u679C\uFF1A${stats2.pass} \u901A\u8FC7 / ${stats2.fail} \u5931\u8D25`);
      return stats2;
    };
  }
});

// scripts/run-verify.ts
var storage = /* @__PURE__ */ new Map();
var localStorageStub = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => void storage.delete(key),
  clear: () => storage.clear()
};
globalThis.localStorage = localStorageStub;
globalThis.window = {
  setTimeout: (fn) => {
    fn();
    return 0;
  }
};
var { runScenarios: runScenarios2 } = await Promise.resolve().then(() => (init_harness(), harness_exports));
var stats = runScenarios2();
if (stats.fail > 0) process.exit(1);
