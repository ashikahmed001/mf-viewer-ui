import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// ─── Auth token injector ─────────────────────────────────────────────────────
// Call setupAuthInterceptor(getToken) once from inside <ClerkProvider> context.
// getToken is the function returned by Clerk's useAuth() hook.
let _getToken = null;

export function setupAuthInterceptor(getToken) {
  _getToken = getToken;
}

// Exposed so raw fetch() calls (e.g. SSE streams) can attach the same token
export async function getAuthHeader() {
  if (!_getToken) return {};
  try {
    const token = await _getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// ─── Request interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  config._t0 = performance.now();
  const params = config.params ? ' ' + new URLSearchParams(config.params).toString() : '';
  console.log(
    `%c→ ${config.method?.toUpperCase()} %c${config.baseURL}${config.url}%c${params}`,
    'color:#60a5fa;font-weight:bold',
    'color:#e2e8f0',
    'color:#94a3b8'
  );

  // Attach Clerk session token if available
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      // Not signed in — let the request go through; backend will 401
    }
  }

  return config;
});

// ─── Response interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    const ms  = Math.round(performance.now() - (response.config._t0 || 0));
    const len = JSON.stringify(response.data)?.length ?? 0;
    const msColor = ms > 300 ? '#f87171' : ms > 100 ? '#fbbf24' : '#4ade80';
    console.log(
      `%c← ${response.status} %c${response.config.url} %c${ms}ms %c${(len / 1024).toFixed(1)}kb`,
      'color:#4ade80;font-weight:bold',
      'color:#e2e8f0',
      `color:${msColor}`,
      'color:#94a3b8'
    );
    return response;
  },
  (error) => {
    const ms     = Math.round(performance.now() - (error.config?._t0 || 0));
    const status = error.response?.status ?? 'ERR';
    const msg    = error.response?.data?.error ?? error.message;
    console.error(
      `%c✕ ${status} %c${error.config?.url} %c${ms}ms  ${msg}`,
      'color:#f87171;font-weight:bold',
      'color:#e2e8f0',
      'color:#94a3b8'
    );
    return Promise.reject(error);
  }
);

// ─── FUNDS ───────────────────────────────────────────────────────────────────
export const getFunds            = ()          => api.get('/funds').then(r => r.data);
export const getFund             = (id)        => api.get(`/funds/${id}`).then(r => r.data);
export const getFundExtractions  = (id)        => api.get(`/funds/${id}/extractions`).then(r => r.data);
export const compareFundMonths   = (id, months) =>
  api.get(`/funds/${id}/compare`, { params: { 'months[]': months } }).then(r => r.data);

// ─── EXTRACTIONS ─────────────────────────────────────────────────────────────
export const getExtraction = (id) => api.get(`/extractions/${id}`).then(r => r.data);

// ─── HOLDINGS ────────────────────────────────────────────────────────────────
export const getHoldings = (extractionId, params = {}) =>
  api.get(`/extractions/${extractionId}/holdings`, { params }).then(r => r.data);

export const getHoldingsSummary = (extractionId) =>
  api.get(`/extractions/${extractionId}/holdings/summary`).then(r => r.data);

export const getStockTrend = (fundId, isin) =>
  api.get(`/extractions/trend/${fundId}/${encodeURIComponent(isin)}`).then(r => r.data);

export const getCrossFundAnalysis = () =>
  api.get('/holdings/cross-fund').then(r => r.data);

export const getOverlapMatrix = () =>
  api.get('/holdings/overlap-matrix').then(r => r.data);

export const getRisingConviction = (lookback = 6, direction = 'rising') =>
  api.get('/holdings/rising-conviction', { params: { window: lookback, direction } }).then(r => r.data);

export const getOverlapTrend = (fundAId, fundBId) =>
  api.get('/holdings/overlap-trend', { params: { fund_a: fundAId, fund_b: fundBId } }).then(r => r.data);

export const getSectorDrift = (fundId) =>
  api.get(`/holdings/sector-drift/${fundId}`).then(r => r.data);

export const getHiddenGems = () =>
  api.get('/holdings/hidden-gems').then(r => r.data);

export const getEntryExitTimeline = (fundId) =>
  api.get(`/holdings/entry-exit/${fundId}`).then(r => r.data);

export const getMonthlyDiff = (fundId, monthA, monthB) =>
  api.get(`/holdings/monthly-diff/${fundId}`, { params: { month_a: monthA, month_b: monthB } }).then(r => r.data);

export const getMultiMonthRange = (fundId, start, end) =>
  api.get(`/holdings/multi-month-range/${fundId}`, { params: { start, end }, timeout: 30000 }).then(r => r.data);

export const stockSearch = (q) =>
  api.get('/holdings/stock-search', { params: { q } }).then(r => r.data);

export const getStockTracker = (isin) =>
  api.get(`/holdings/stock-tracker/${encodeURIComponent(isin)}`).then(r => r.data);

export const getStockPeers = (isin) =>
  api.get(`/holdings/stock-peers/${encodeURIComponent(isin)}`).then(r => r.data);

export const getFeed = (months = 6) =>
  api.get('/feed', { params: { months } }).then(r => r.data);

export const getAllFundsNewEntries = () =>
  api.get('/holdings/new-entries').then(r => r.data);

export const getFundChurnRates = () =>
  api.get('/holdings/churn-rates', { timeout: 30000 }).then(r => r.data);

export const getSectorRotationCalendar = () =>
  api.get('/holdings/sector-rotation').then(r => r.data);

export const getStockDiscoveryChain = () =>
  api.get('/holdings/discovery-chain').then(r => r.data);

export const getConcentrationScores = () =>
  api.get('/holdings/concentration').then(r => r.data);

export const getBlendedHoldings = (fundIds) =>
  api.get('/holdings/blend', { params: { funds: fundIds.join(',') } }).then(r => r.data);

// ─── ADMIN ───────────────────────────────────────────────────────────────────
export const adminGetIsinIssues    = ()                              => api.get('/admin/isin-issues').then(r => r.data);
export const adminRemapIsin        = (old_isin, new_isin)            => api.post('/admin/isin-remap', { old_isin, new_isin }).then(r => r.data);
export const adminGetNameIssues    = ()                              => api.get('/admin/name-issues').then(r => r.data);
export const adminFixName          = (isin, canonical_name)          => api.post('/admin/name-fix', { isin, canonical_name }).then(r => r.data);
export const adminScanOverlapping  = ()                              => api.get('/admin/scan-overlapping').then(r => r.data);
export const adminGetFunds         = ()                              => api.get('/admin/funds').then(r => r.data);
export const adminGetFundMonths    = (id)                            => api.get(`/admin/funds/${id}/months`).then(r => r.data);
export const adminRenameFund       = (id, name)                      => api.put(`/admin/funds/${id}/rename`, { name }).then(r => r.data);
export const adminMergeFunds       = (source_id, target_id)          => api.post('/admin/funds/merge', { source_id, target_id }).then(r => r.data);
export const adminDeleteFund        = (id)                           => api.delete(`/admin/funds/${id}`).then(r => r.data);
export const adminGetFundExtractions  = (id)                         => api.get(`/admin/funds/${id}/extractions`).then(r => r.data);
export const adminDeleteExtraction    = (id)                         => api.delete(`/admin/extractions/${id}`).then(r => r.data);
export const adminBulkDeleteFunds     = (ids)                        => api.delete('/admin/funds/bulk', { data: { ids } }).then(r => r.data);
export const adminBulkDeleteExtractions = (ids)                      => api.delete('/admin/extractions/bulk', { data: { ids } }).then(r => r.data);
export const adminGetFundGaps      = ()                              => api.get('/admin/fund-gaps').then(r => r.data);
export const adminGetCacheStats    = ()              => api.get('/admin/cache').then(r => r.data);
export const adminClearCache       = ()              => api.delete('/admin/cache').then(r => r.data);
export const adminGetCacheEnabled  = ()              => api.get('/admin/cache/enabled').then(r => r.data);
export const adminSetCacheEnabled  = (enabled)       => api.patch('/admin/cache/enabled', { enabled }).then(r => r.data);

// ─── BILLING ─────────────────────────────────────────────────────────────────
export const togglePayments        = (enabled)       => api.patch('/features/payments', { enabled }).then(r => r.data);

export const getSubscriptionStatus = ()              => api.get('/billing/status').then(r => r.data);
export const createCheckout        = (cycle)         => api.post('/billing/checkout', { cycle }).then(r => r.data);
export const verifyPayment         = (payload)       => api.post('/billing/verify', payload).then(r => r.data);

// ─── NAV ─────────────────────────────────────────────────────────────────────
export const getNavMappings    = ()                                  => api.get('/nav/mappings').then(r => r.data);
export const searchNavSchemes  = (q, fund_name)                      => api.get('/nav/search', { params: { q, fund_name } }).then(r => r.data);
export const autoMatchNav      = ()                                  => api.post('/nav/auto-match', {}, { timeout: 60000 }).then(r => r.data);
export const confirmNavMapping = (fundId, scheme_code, scheme_name)  => api.post(`/nav/confirm/${fundId}`, { scheme_code, scheme_name }).then(r => r.data);
export const syncNavFund       = (fundId)                            => api.post(`/nav/sync/${fundId}`, {}, { timeout: 60000 }).then(r => r.data);
export const syncAllNav        = ()                                  => api.post('/nav/sync-all', {}, { timeout: 120000 }).then(r => r.data);
export const getFundNav        = (fundId)                            => api.get(`/nav/${fundId}`).then(r => r.data);
export const removeNavMapping  = (fundId)                            => api.delete(`/nav/mapping/${fundId}`).then(r => r.data);
export const syncLatestNav     = ()                                  => api.post('/nav/sync-latest', {}, { timeout: 10000 }).then(r => r.data);

export default api;

// ─── UPLOAD / EXTRACT ────────────────────────────────────────────────────────

export const uploadSingleFile = async (file) => {
  const form = new FormData();
  form.append('file', file);
  const r = await api.post('/admin/upload/single', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return r.data;
};

export const uploadBatchStream = (files, { onStart, onProgress, onResult, onDone, onError } = {}) => {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  let closed = false;
  const abort = new AbortController();
  (async () => {
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(
        (api.defaults.baseURL || '') + '/admin/upload/batch',
        { method: 'POST', body: form, signal: abort.signal, headers: authHeader }
      );
      if (!res.ok) { onError?.({ error: `Server ${res.status}` }); return; }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const chunk of parts) {
          const eventLine = chunk.match(/^event: (.+)$/m)?.[1];
          const dataLine  = chunk.match(/^data: (.+)$/m)?.[1];
          if (!dataLine) continue;
          let data; try { data = JSON.parse(dataLine); } catch { continue; }
          if (eventLine === 'start')    onStart?.(data);
          if (eventLine === 'progress') onProgress?.(data);
          if (eventLine === 'result')   onResult?.(data);
          if (eventLine === 'done')     onDone?.(data);
          if (eventLine === 'error')    onError?.(data);
        }
      }
    } catch (err) { if (!closed) onError?.({ error: err.message }); }
  })();
  return () => { closed = true; abort.abort(); };
};

export const importExtraction = (draft, replace = false) =>
  api.post('/admin/import', { ...draft, replace }, { timeout: 60000 }).then(r => r.data);

export const adminGetCounts = () => api.get('/admin/counts').then(r => r.data);
