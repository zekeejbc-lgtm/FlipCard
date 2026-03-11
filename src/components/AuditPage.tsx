import React, { useEffect, useMemo, useState } from 'react';
import CustomDropdown from './ui/CustomDropdown';

const AUDIT_GAS_URL = 'https://script.google.com/macros/s/AKfycbznNbMuBEeM4yFkr2km_7n_kSMFn_nY4JKBoLG0ZzcuK418CQflrQGLLcX12_gQkVS2jg/exec';
const AUDIT_STATUS_OPTIONS = ['Draft', 'In Review', 'Published', 'Resolved'];
const AUDIT_CATEGORY_OPTIONS = ['Financial', 'Event', 'Project', 'Supplies', 'Reimbursement', 'General'];

type ToastType = 'info' | 'success' | 'error' | 'loading';
type AuditUser = { idNumber: string; name?: string; fullName?: string; position?: string };
type AuditEntry = {
  auditId: string;
  auditDate: string;
  title: string;
  area: string;
  category: string;
  status: string;
  summary: string;
  findings: string;
  recommendations: string;
  amount: number;
  payee: string;
  receiptReference: string;
  liquidationDetails: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};
type AuditPageProps = {
  onBack?: () => void;
  darkMode: boolean;
  user: AuditUser | null;
  addToast?: (message: string, type: ToastType, progress?: number) => number;
  removeToast?: (id: number) => void;
  embedded?: boolean;
  onChange?: () => void;
};
type AuditFormState = {
  auditId: string;
  auditDate: string;
  title: string;
  area: string;
  category: string;
  status: string;
  amount: string;
  payee: string;
  receiptReference: string;
  summary: string;
  liquidationDetails: string;
  findings: string;
  recommendations: string;
};
type AuditConfigResponse = { success?: boolean; error?: string; canEdit?: boolean; audits?: AuditEntry[] };

const EMPTY_FORM: AuditFormState = {
  auditId: '',
  auditDate: '',
  title: '',
  area: 'General Fund',
  category: 'Financial',
  status: 'Published',
  amount: '',
  payee: '',
  receiptReference: '',
  summary: '',
  liquidationDetails: '',
  findings: '',
  recommendations: ''
};

const inputClass = (darkMode: boolean) =>
  `w-full rounded-2xl border px-4 py-3 text-sm shadow-sm outline-none transition ${
    darkMode
      ? 'border-stone-700 bg-stone-950 text-white placeholder:text-stone-500 focus:border-cyan-500'
      : 'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-cyan-500'
  }`;
const dropdownClass = (darkMode: boolean) => `flex w-full items-center gap-3 text-left ${inputClass(darkMode)}`;

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>;
}

function money(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AuditPage({ onBack, darkMode, user, addToast, removeToast, embedded = false, onChange }: AuditPageProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [formState, setFormState] = useState<AuditFormState>({ ...EMPTY_FORM, auditDate: today() });
  const pushToast = addToast || (() => 0);
  const dismissToast = removeToast || (() => {});

  const loadAuditConfig = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ action: 'getAuditConfig' });
      if (user?.idNumber) params.set('userId', user.idNumber);
      const response = await fetch(`${AUDIT_GAS_URL}?${params.toString()}`);
      const result = await response.json() as AuditConfigResponse;
      if (!result.success) throw new Error(result.error || 'Failed to load liquidation records');
      setAudits(Array.isArray(result.audits) ? result.audits : []);
      setCanEdit(!!result.canEdit);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load liquidation records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAuditConfig();
  }, [user?.idNumber]);

  const filteredAudits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return audits.filter((audit) => {
      const matchesQuery = !query || [
        audit.title, audit.area, audit.category, audit.status, audit.summary, audit.payee,
        audit.receiptReference, audit.liquidationDetails, audit.findings, audit.recommendations, String(audit.amount || '')
      ].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || audit.category === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [audits, categoryFilter, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: audits.length,
    totalLiquidated: audits.reduce((sum, audit) => sum + (Number(audit.amount) || 0), 0),
    payees: new Set(audits.map((audit) => audit.payee).filter(Boolean)).size,
    actionCount: audits.filter((audit) => audit.status === 'Draft' || audit.status === 'In Review').length
  }), [audits]);

  const resetForm = () => {
    setFormState({ ...EMPTY_FORM, auditDate: today() });
    setIsFormOpen(false);
  };

  const saveAudit = async () => {
    const amount = Number(formState.amount);
    if (!formState.title.trim()) return;
    if (!(amount > 0)) return;
    setSaving(true);
    const toastId = pushToast(formState.auditId ? 'Updating liquidation entry...' : 'Saving liquidation entry...', 'loading');
    try {
      const response = await fetch(AUDIT_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveAuditEntry', userId: user?.idNumber || '', ...formState, amount })
      });
      const result = await response.json() as AuditConfigResponse;
      if (!result.success) throw new Error(result.error || 'Failed to save liquidation entry');
      setAudits(Array.isArray(result.audits) ? result.audits : []);
      resetForm();
      onChange?.();
      dismissToast(toastId);
      const successId = pushToast(formState.auditId ? 'Liquidation entry updated.' : 'Liquidation entry added.', 'success');
      setTimeout(() => dismissToast(successId), 2200);
    } catch (requestError) {
      dismissToast(toastId);
      const errorId = pushToast(requestError instanceof Error ? requestError.message : 'Failed to save liquidation entry', 'error');
      setTimeout(() => dismissToast(errorId), 3200);
    } finally {
      setSaving(false);
    }
  };

  const deleteAudit = async (auditId: string) => {
    setDeletingId(auditId);
    const toastId = pushToast('Removing liquidation entry...', 'loading');
    try {
      const response = await fetch(AUDIT_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteAuditEntry', userId: user?.idNumber || '', auditId })
      });
      const result = await response.json() as AuditConfigResponse;
      if (!result.success) throw new Error(result.error || 'Failed to delete liquidation entry');
      setAudits(Array.isArray(result.audits) ? result.audits : []);
      onChange?.();
      dismissToast(toastId);
      const successId = pushToast('Liquidation entry removed.', 'success');
      setTimeout(() => dismissToast(successId), 2200);
    } catch (requestError) {
      dismissToast(toastId);
      const errorId = pushToast(requestError instanceof Error ? requestError.message : 'Failed to delete liquidation entry', 'error');
      setTimeout(() => dismissToast(errorId), 3200);
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className={embedded ? '' : `min-h-screen ${darkMode ? 'bg-stone-950 text-stone-100' : 'bg-stone-50 text-stone-900'}`}>
      <div className={embedded ? '' : 'mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8'}>
        <div className={`overflow-hidden rounded-[2rem] border ${darkMode ? 'border-stone-800 bg-stone-900 text-stone-100' : 'border-stone-200 bg-white text-stone-900'} shadow-sm`}>
          <div className={`border-b px-6 py-5 ${darkMode ? 'border-stone-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,#111827,#0f172a)]' : 'border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,#f8fafc,#eef2ff)]'}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                {!embedded && onBack ? <button onClick={onBack} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${darkMode ? 'bg-stone-800 text-stone-200' : 'bg-white/80 text-stone-700'}`}><Icon name="arrow_back" className="text-base" />Back</button> : null}
                <div className="mt-5 flex items-center gap-3">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${darkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}><Icon name="receipt_long" className="text-3xl" /></div>
                  <div>
                    <h1 className="text-3xl font-bold">Liquidation Audit</h1>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-stone-300' : 'text-stone-600'}`}>These entries also feed the finance deduction ledger.</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => void loadAuditConfig(true)} disabled={refreshing} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-stone-800 text-stone-200' : 'bg-white text-stone-700'}`}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
                {canEdit ? <button onClick={() => { setFormState({ ...EMPTY_FORM, auditDate: today() }); setIsFormOpen(true); }} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white">New liquidation</button> : null}
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Total liquidations', String(stats.total)],
                ['Total liquidated', money(stats.totalLiquidated)],
                ['Payees recorded', String(stats.payees)],
                ['Needs action', String(stats.actionCount)]
              ].map(([label, value]) => (
                <div key={label} className={`rounded-3xl border p-5 ${darkMode ? 'border-stone-800 bg-stone-950' : 'border-stone-200 bg-stone-50'}`}>
                  <p className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{label}</p>
                  <p className="mt-2 text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.8fr_0.8fr]">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search title, payee, receipt, amount..." className={inputClass(darkMode)} />
              <CustomDropdown
                name="audit-status-filter"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[{ value: 'all', label: 'All statuses' }, ...AUDIT_STATUS_OPTIONS.map((status) => ({ value: status, label: status }))]}
                theme={darkMode ? 'dark' : 'light'}
                className={dropdownClass(darkMode)}
              />
              <CustomDropdown
                name="audit-category-filter"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[{ value: 'all', label: 'All categories' }, ...AUDIT_CATEGORY_OPTIONS.map((category) => ({ value: category, label: category }))]}
                theme={darkMode ? 'dark' : 'light'}
                className={dropdownClass(darkMode)}
              />
            </div>

            {loading ? <div className="mt-6 text-sm">Loading liquidation records...</div> : null}
            {error ? <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div> : null}

            {!loading && !error ? (
              <div className="mt-6 space-y-4">
                {filteredAudits.map((audit) => (
                  <article key={audit.auditId} className={`overflow-hidden rounded-3xl border ${darkMode ? 'border-stone-800 bg-stone-950' : 'border-stone-200 bg-white'} shadow-sm`}>
                    <div className={`border-b px-6 py-5 ${darkMode ? 'border-stone-800' : 'border-stone-100'}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ${darkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>{audit.auditId}</span>
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">{audit.status || 'Draft'}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-600'}`}>{audit.category || 'Financial'}</span>
                          </div>
                          <h2 className="mt-4 text-2xl font-bold">{audit.title}</h2>
                          <p className={`mt-2 text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{formatDate(audit.auditDate)} • {money(audit.amount)}</p>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-stone-300' : 'text-stone-600'}`}>{audit.summary || 'No summary added.'}</p>
                        </div>
                        {canEdit ? <div className="flex gap-2"><button onClick={() => { setFormState({ auditId: audit.auditId, auditDate: audit.auditDate || today(), title: audit.title || '', area: audit.area || 'General Fund', category: audit.category || 'Financial', status: audit.status || 'Published', amount: audit.amount ? String(audit.amount) : '', payee: audit.payee || '', receiptReference: audit.receiptReference || '', summary: audit.summary || '', liquidationDetails: audit.liquidationDetails || '', findings: audit.findings || '', recommendations: audit.recommendations || '' }); setIsFormOpen(true); }} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${darkMode ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-700'}`}>Edit</button><button onClick={() => void deleteAudit(audit.auditId)} disabled={deletingId === audit.auditId} className="rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">{deletingId === audit.auditId ? 'Removing...' : 'Delete'}</button></div> : null}
                      </div>
                    </div>
                    <div className="grid gap-4 px-6 py-6 lg:grid-cols-2">
                      <div className={`rounded-3xl border p-5 ${darkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50'}`}><h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-600">Breakdown</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{audit.liquidationDetails || 'No liquidation breakdown was added yet.'}</p></div>
                      <div className={`rounded-3xl border p-5 ${darkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50'}`}><h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-600">Details</h3><p className="mt-3 text-sm">Payee: {audit.payee || 'Not specified'}</p><p className="mt-2 text-sm">Receipt / Ref: {audit.receiptReference || 'Not specified'}</p><p className="mt-2 text-sm">Fund / Area: {audit.area || 'Not specified'}</p></div>
                      <div className={`rounded-3xl border p-5 ${darkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50'}`}><h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">Audit Findings</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{audit.findings || 'No findings were added yet.'}</p></div>
                      <div className={`rounded-3xl border p-5 ${darkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50'}`}><h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600">Recommendations</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{audit.recommendations || 'No recommendations were added yet.'}</p></div>
                    </div>
                    <div className={`flex flex-col gap-2 border-t px-6 py-4 text-xs sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'border-stone-800 text-stone-400' : 'border-stone-100 text-stone-500'}`}>
                      <p>Created by {audit.createdBy || 'Unknown'}{audit.createdAt ? ` on ${formatTimestamp(audit.createdAt)}` : ''}</p>
                      <p>{audit.updatedAt ? `Last updated by ${audit.updatedBy || 'Unknown'} on ${formatTimestamp(audit.updatedAt)}` : 'No revisions yet'}</p>
                    </div>
                  </article>
                ))}
                {filteredAudits.length === 0 ? <div className={`rounded-3xl border p-10 text-center ${darkMode ? 'border-stone-800 bg-stone-950 text-stone-300' : 'border-stone-200 bg-stone-50 text-stone-600'}`}>No liquidation entries matched the current filters.</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isFormOpen && canEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-3 py-4 backdrop-blur-[2px]">
          <div className={`my-auto w-full max-w-4xl rounded-[2rem] border shadow-2xl ${darkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-white'}`}>
            <div className={`flex items-start justify-between gap-4 border-b px-6 py-5 ${darkMode ? 'border-stone-800' : 'border-stone-100'}`}>
              <div>
                <h2 className="text-2xl font-bold">{formState.auditId ? 'Edit Liquidation Entry' : 'New Liquidation Entry'}</h2>
                <p className={`mt-1 text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>This entry also affects the finance balance.</p>
              </div>
              <button onClick={resetForm} className={`rounded-2xl p-2 ${darkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}><Icon name="close" className="text-xl" /></button>
            </div>
            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <input value={formState.title} onChange={(e) => setFormState({ ...formState, title: e.target.value })} placeholder="Liquidation title" className={inputClass(darkMode)} />
              <input type="number" value={formState.amount} onChange={(e) => setFormState({ ...formState, amount: e.target.value })} placeholder="Amount" className={inputClass(darkMode)} />
              <input type="date" value={formState.auditDate} onChange={(e) => setFormState({ ...formState, auditDate: e.target.value })} className={inputClass(darkMode)} />
              <input value={formState.area} onChange={(e) => setFormState({ ...formState, area: e.target.value })} placeholder="Fund / Area" className={inputClass(darkMode)} />
              <input value={formState.payee} onChange={(e) => setFormState({ ...formState, payee: e.target.value })} placeholder="Payee / Recipient" className={inputClass(darkMode)} />
              <input value={formState.receiptReference} onChange={(e) => setFormState({ ...formState, receiptReference: e.target.value })} placeholder="Receipt / Reference" className={inputClass(darkMode)} />
              <CustomDropdown
                name="audit-form-category"
                value={formState.category}
                onChange={(value) => setFormState({ ...formState, category: value })}
                options={AUDIT_CATEGORY_OPTIONS.map((category) => ({ value: category, label: category }))}
                theme={darkMode ? 'dark' : 'light'}
                className={dropdownClass(darkMode)}
              />
              <CustomDropdown
                name="audit-form-status"
                value={formState.status}
                onChange={(value) => setFormState({ ...formState, status: value })}
                options={AUDIT_STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
                theme={darkMode ? 'dark' : 'light'}
                className={dropdownClass(darkMode)}
              />
              <textarea rows={3} value={formState.summary} onChange={(e) => setFormState({ ...formState, summary: e.target.value })} placeholder="Purpose / Summary" className={`${inputClass(darkMode)} md:col-span-2`} />
              <textarea rows={4} value={formState.liquidationDetails} onChange={(e) => setFormState({ ...formState, liquidationDetails: e.target.value })} placeholder="Liquidation Breakdown" className={`${inputClass(darkMode)} md:col-span-2`} />
              <textarea rows={4} value={formState.findings} onChange={(e) => setFormState({ ...formState, findings: e.target.value })} placeholder="Audit Findings" className={inputClass(darkMode)} />
              <textarea rows={4} value={formState.recommendations} onChange={(e) => setFormState({ ...formState, recommendations: e.target.value })} placeholder="Recommendations" className={inputClass(darkMode)} />
            </div>
            <div className={`flex flex-col-reverse gap-3 border-t px-6 py-5 sm:flex-row sm:justify-end ${darkMode ? 'border-stone-800' : 'border-stone-100'}`}>
              <button onClick={resetForm} className={`rounded-2xl px-5 py-3 text-sm font-semibold ${darkMode ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-700'}`}>Cancel</button>
              <button onClick={() => void saveAudit()} disabled={saving} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white">{saving ? 'Saving...' : formState.auditId ? 'Save changes' : 'Save liquidation'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

