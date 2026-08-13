/**
 * Benchmark Midway keyword.add2 with the same fixture data.
 *
 * Usage (run in cool-admin-midway):
 *   npx ts-node -r tsconfig-paths/register scripts/benchmark-keyword-add2-http.ts
 *
 * Optional env:
 *   MIDWAY_BASE_URL=http://127.0.0.1:8001
 *   MIDWAY_ADD2_ENDPOINT=/admin/app/keyword/add2
 *   MIDWAY_FIXTURE_PATH=../keyword-research-ms-go/tests/fixtures/task_b0fvg1fk4t_uk.json
 *   MIDWAY_ADMIN_BEARER=<token>
 *   MIDWAY_COOKIE=<cookie>
 *   MIDWAY_REPEAT=1
 */

import axios from 'axios';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type FixtureKeyword = {
  value: string;
  traffic_score: number;
};

type Fixture = {
  target_key: string;
  marketplace: string;
  reference_titles: string[];
  keywords: FixtureKeyword[];
  options?: {
    top_n_per_market?: number;
  };
};

type MidwayAdd2Row = {
  asin: string;
  marketplaces: string;
  value: string;
  title: string;
  trafficPercentage: number;
  keyword_type?: string | null;
};

function resolveFixturePath(rawPath: string): string {
  if (existsSync(rawPath)) return rawPath;
  const byScriptsDir = join(__dirname, rawPath);
  if (existsSync(byScriptsDir)) return byScriptsDir;
  const byProjectRoot = join(__dirname, '..', rawPath);
  if (existsSync(byProjectRoot)) return byProjectRoot;
  throw new Error(`fixture not found: ${rawPath}`);
}

function loadFixture(pathLike: string): Fixture {
  const p = resolveFixturePath(pathLike);
  const raw = readFileSync(p, 'utf-8');
  return JSON.parse(raw) as Fixture;
}

function buildAdd2Payload(fx: Fixture): MidwayAdd2Row[] {
  const topN = fx.options?.top_n_per_market && fx.options.top_n_per_market > 0
    ? fx.options.top_n_per_market
    : 30;
  const sorted = [...fx.keywords].sort((a, b) => (b.traffic_score || 0) - (a.traffic_score || 0));
  const selected = sorted.slice(0, topN);
  const sharedTitle = (fx.reference_titles && fx.reference_titles.length > 0)
    ? fx.reference_titles[0]
    : '';

  return selected.map((k) => ({
    asin: fx.target_key,
    marketplaces: fx.marketplace,
    value: k.value,
    title: sharedTitle,
    trafficPercentage: Number(k.traffic_score || 0),
    keyword_type: null,
  }));
}

async function once(baseURL: string, endpoint: string, rows: MidwayAdd2Row[], bearer?: string, cookie?: string) {
  const url = `${baseURL.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Midway admin authority middleware verifies Authorization header as raw JWT string.
  // Do NOT force "Bearer " prefix here.
  if (bearer) headers.Authorization = bearer;
  if (cookie) headers.Cookie = cookie;

  const t0 = Date.now();
  const resp = await axios.post(url, rows, {
    headers,
    timeout: 60 * 60 * 1000,
    validateStatus: () => true,
  });
  const elapsedMs = Date.now() - t0;

  return {
    elapsedMs,
    status: resp.status,
    bodyType: typeof resp.data,
  };
}

async function main() {
  const baseURL = process.env.MIDWAY_BASE_URL || 'http://127.0.0.1:8001';
  const endpoint = process.env.MIDWAY_ADD2_ENDPOINT || '/admin/app/keyword/add2';
  const fixturePath = process.env.MIDWAY_FIXTURE_PATH || '../keyword-research-ms-go/tests/fixtures/task_b0fvg1fk4t_uk.json';
  const bearer = process.env.MIDWAY_ADMIN_BEARER;
  const cookie = process.env.MIDWAY_COOKIE;
  const repeat = Number(process.env.MIDWAY_REPEAT || '1');

  if (!Number.isFinite(repeat) || repeat <= 0) {
    throw new Error(`invalid MIDWAY_REPEAT: ${process.env.MIDWAY_REPEAT}`);
  }

  const fx = loadFixture(fixturePath);
  const rows = buildAdd2Payload(fx);

  console.log(`[bench] midway add2 benchmark start`);
  console.log(`[bench] baseURL=${baseURL}`);
  console.log(`[bench] endpoint=${endpoint}`);
  console.log(`[bench] fixture=${fixturePath}`);
  console.log(`[bench] asin=${fx.target_key} marketplace=${fx.marketplace}`);
  console.log(`[bench] rows=${rows.length} repeat=${repeat}`);

  const all: number[] = [];
  for (let i = 1; i <= repeat; i++) {
    const out = await once(baseURL, endpoint, rows, bearer, cookie);
    all.push(out.elapsedMs);
    console.log(
      `[bench] run=${i}/${repeat} status=${out.status} elapsed_ms=${out.elapsedMs} body_type=${out.bodyType}`
    );
  }

  const sum = all.reduce((a, b) => a + b, 0);
  const avg = sum / all.length;
  const min = Math.min(...all);
  const max = Math.max(...all);
  console.log(`[bench] done avg_ms=${avg.toFixed(2)} min_ms=${min} max_ms=${max}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[bench] failed:', e?.message || e);
    process.exit(1);
  });
}

