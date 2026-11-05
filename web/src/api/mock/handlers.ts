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

  if (m === 'GET' && path === '/integration/status') return db.integrationStatus();
  if (m === 'POST' && path === '/integration/register') return db.registerIntegration(body ?? {});
  if (m === 'POST' && path === '/integration/register/cancel') return db.cancelIntegration();

  if (m === 'GET' && path === '/me') return db.me();
  if (m === 'GET' && path === '/dashboard') return db.dashboard();
  if (m === 'GET' && path === '/categories') return db.categories();
  if (m === 'POST' && path === '/categories') return db.createCategory(body);
  if ((p = match(path, '/categories/:id'))) {
    if (m === 'PATCH') return db.updateCategory(p.id, body);
    if (m === 'DELETE') return db.deleteCategory(p.id);
  }
  if (m === 'GET' && path === '/custodians') return db.custodians();
  if (m === 'GET' && path === '/entities') return db.entities();
  if (m === 'POST' && path === '/entities') return db.createEntity(body);

  if (m === 'GET' && path === '/assets') return db.listAssets(query);
  if (m === 'GET' && path === '/assets/mine') return db.myAssets();
  if (m === 'POST' && path === '/assets/import')
    return db.importAssets(body.rows ?? [], !!body.commit);
  if (m === 'POST' && path === '/assets') return db.createAsset(body);
  if ((p = match(path, '/assets/:id'))) {
    if (m === 'GET') return db.getAsset(p.id) ?? notFound('Aset');
    if (m === 'PATCH') return db.updateAsset(p.id, body);
    if (m === 'DELETE') return db.deleteAsset(p.id) ?? { ok: true };
  }
  if ((p = match(path, '/assets/:id/condition')) && m === 'POST')
    return db.setCondition(p.id, body.condition);
  if ((p = match(path, '/assets/:id/reassign')) && m === 'POST')
    return db.reassign(p.id, body);
  if ((p = match(path, '/assets/:id/custody-history')) && m === 'GET')
    return db.custodyHistory(p.id);
  if ((p = match(path, '/assets/:id/depreciation')) && m === 'GET')
    return db.assetDepreciation(p.id);
  if ((p = match(path, '/assets/:id/audit')) && m === 'GET')
    return db.assetAudit(p.id);
  if ((p = match(path, '/assets/:id/journals')) && m === 'GET')
    return db.assetJournals(p.id);
  if ((p = match(path, '/assets/:id/photos'))) {
    if (m === 'GET') return db.listPhotos(p.id);
    if (m === 'POST') return db.addPhoto(p.id, body);
  }
  if ((p = match(path, '/photos/:id')) && m === 'DELETE') return db.deletePhoto(p.id);
  if ((p = match(path, '/assets/:id/purchase'))) {
    if (m === 'GET') return db.getPurchase(p.id);
    if (m === 'POST') return db.savePurchase(p.id, body);
  }

  if (m === 'GET' && path === '/depreciation/report')
    return db.depreciationReport(query.from || '', query.to || '');
  if ((p = match(path, '/depreciation/report/:category')) && m === 'GET')
    return db.depreciationReportCategory(p.category, query.from || '', query.to || '');
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
  if ((p = match(path, '/journals/:id/trash')) && m === 'POST') return db.trashJournal(p.id);

  if ((p = match(path, '/depreciation/runs/:id/commit')) && m === 'POST')
    return db.getRun(p.id) ?? notFound('Run');

  if (m === 'GET' && path === '/scheduler/health') return db.schedulerHealth();
  if (m === 'GET' && path === '/settings') return db.getSettings();
  if (m === 'PUT' && path === '/settings') return db.saveSettings(body);

  // RBAC
  if (m === 'GET' && path === '/role-management') return db.roleManagement();
  if (m === 'POST' && path === '/role-management/assign') return db.assignRole();
  if (m === 'POST' && path === '/role-management/stop-impersonation') return db.stopImpersonation();
  if ((p = match(path, '/role-management/:id/impersonate')) && m === 'POST') return db.impersonate();
  if ((p = match(path, '/role-management/:id')) && m === 'PATCH') return db.updateAssignment();
  if (m === 'GET' && path === '/permission-matrix') return db.permissionMatrix();
  if ((p = match(path, '/permission-matrix/:roleCode')) && m === 'PUT') return db.saveRoleMatrix(p.roleCode, body.permissions ?? []);
  if ((p = match(path, '/custodians/:id')) && m === 'PATCH') return db.linkCustodian(p.id, body.user_id ?? null);

  throw new ApiMockError(404, `Mock route tidak ada: ${m} ${path}`);
}

function notFound(label: string): never {
  throw new ApiMockError(404, `${label} tidak ditemukan`);
}
