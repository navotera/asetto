/** Maps HTTP method + path to the in-memory store. Mirrors the REST surface a
 *  real Asetto backend is expected to expose, so swapping to `live` mode later
 *  is a config change, not a rewrite. */
import { db, ApiMockError } from './db';

type Query = Record<string, string>;

function match(path: string, pattern: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

export function handle(method: string, rawPath: string, body: any): unknown {
  const [path, qs] = rawPath.split('?');
  const query: Query = {};
  if (qs) for (const [k, v] of new URLSearchParams(qs)) query[k] = v;

  const m = method.toUpperCase();
  let p: Record<string, string> | null;

  if (m === 'GET' && path === '/me') return db.me();
  if (m === 'GET' && path === '/dashboard') return db.dashboard();
  if (m === 'GET' && path === '/categories') return db.categories();
  if (m === 'GET' && path === '/custodians') return db.custodians();

  if (m === 'GET' && path === '/assets') return db.listAssets();
  if (m === 'POST' && path === '/assets') return db.createAsset(body);
  if ((p = match(path, '/assets/:id'))) {
    if (m === 'GET') return db.getAsset(p.id) ?? notFound('Aset');
    if (m === 'PATCH') return db.updateAsset(p.id, body);
    if (m === 'DELETE') return db.deleteAsset(p.id) ?? { ok: true };
  }
  if ((p = match(path, '/assets/:id/condition')) && m === 'POST')
    return db.setCondition(p.id, body.condition);
  if ((p = match(path, '/assets/:id/reassign')) && m === 'POST')
    return db.reassign(p.id, body.custodian_id ?? null, body.location);

  if (m === 'GET' && path === '/depreciation/pending') return { period: db.pendingPeriod() };
  if (m === 'GET' && path === '/depreciation/preview')
    return db.previewRun(query.period || db.pendingPeriod() || '');
  if (m === 'GET' && path === '/depreciation/runs') return db.listRuns();
  if ((p = match(path, '/depreciation/runs/:id')) && m === 'GET')
    return db.getRun(p.id) ?? notFound('Run');
  if (m === 'POST' && path === '/depreciation/runs') return db.postRun(body.period);

  if (m === 'GET' && path === '/disposals') return db.listDisposals();
  if (m === 'POST' && path === '/disposals') return db.createDisposal(body);

  if (m === 'GET' && path === '/journals') return db.listJournals();
  if ((p = match(path, '/journals/:id')) && m === 'GET') return db.getJournal(p.id) ?? notFound('Jurnal');
  if ((p = match(path, '/journals/:id/retry')) && m === 'POST') return db.retryJournal(p.id);

  throw new ApiMockError(404, `Mock route tidak ada: ${m} ${path}`);
}

function notFound(label: string): never {
  throw new ApiMockError(404, `${label} tidak ditemukan`);
}
