import React, { useEffect, useMemo, useRef, useState } from 'react';
import AuditPage from './AuditPage';
import CustomDropdown from './ui/CustomDropdown';

const FINANCE_AUDIT_GAS_URL = 'https://script.google.com/macros/s/AKfycbznNbMuBEeM4yFkr2km_7n_kSMFn_nY4JKBoLG0ZzcuK418CQflrQGLLcX12_gQkVS2jg/exec';

type UserLike = {
  idNumber: string;
  fullName?: string;
  name?: string;
  role?: string;
  position?: string;
};

type FinancePageProps = {
  onBack: () => void;
  darkMode: boolean;
  user: UserLike | null;
};

type Member = { id: string; name: string };
type DueDay = { id: string; date: string; amount: number; description: string };
type CustomObligation = { id: string; title: string; amount: number; deadline: string; description: string; memberIds: string[] };
type Expense = { id: string; title: string; amount: number; date: string; description: string; payee?: string; receiptReference?: string; liquidationDetails?: string; createdBy?: string; source?: string };
type PaymentRecord = { id: string; memberId: string; obligationId: string; amount: number; paidAt: string; note: string };
type ObligationView = { id: string; title: string; amount: number; deadline: string; description: string; kind: 'daily_due' | 'accountability'; memberIds: string[] };
type FinanceConfigResponse = {
  success?: boolean;
  error?: string;
  canManage?: boolean;
  members?: Member[];
  dueDays?: DueDay[];
  customObligations?: CustomObligation[];
  payments?: PaymentRecord[];
  expenses?: Expense[];
};

const EMPTY_EXPENSE_FORM = {
  title: '',
  amount: '',
  date: toDateInputValue(),
  description: ''
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>;
}

function money(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
}

function formatDate(value: string) {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(value = new Date()) {
  return new Date(value.getTime() - (value.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function buildDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { weekday: 'long' });
}

function buildExpenseReferenceId(dateValue: string) {
  const normalizedDate = normalizeDate(dateValue) || toDateInputValue();
  const compactDate = normalizedDate.replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EXP-${compactDate}-${randomPart}`;
}

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' }
];

function enumerateMatchingDates(startDate: string, endDate: string, weekdayValue: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const targetWeekday = Number(weekdayValue);
  if (Number.isNaN(targetWeekday)) return [];
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() === targetWeekday) dates.push(toDateInputValue(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function StatCard({ label, value, icon, darkMode }: { label: string; value: string; icon: string; darkMode: boolean }) {
  return (
    <div className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{label}</p>
          <p className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? 'bg-gray-900 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <Icon name={icon} className="text-xl" />
        </div>
      </div>
    </div>
  );
}

const DEMO_MEMBERS: Member[] = [
  { id: '2025-00001', name: 'Aira Santos' },
  { id: '2025-00002', name: 'Bianca Cruz' },
  { id: '2025-00003', name: 'Carlo Reyes' },
  { id: '2025-00004', name: 'Dani Flores' },
  { id: '2025-00005', name: 'Elijah Navarro' },
  { id: '2025-00006', name: 'Faith Mercado' }
];

const INITIAL_DUE_DAYS: DueDay[] = [
  { id: 'due-2026-03-09', date: '2026-03-09', amount: 20, description: 'Regular class daily due.' },
  { id: 'due-2026-03-10', date: '2026-03-10', amount: 20, description: 'Regular class daily due.' },
  { id: 'due-2026-03-11', date: '2026-03-11', amount: 20, description: 'Regular class daily due.' },
  { id: 'due-2026-03-12', date: '2026-03-12', amount: 25, description: 'Raised for room materials.' },
  { id: 'due-2026-03-13', date: '2026-03-13', amount: 25, description: 'Raised for room materials.' }
];

const INITIAL_CUSTOM_OBLIGATIONS: CustomObligation[] = [
  { id: 'acc-intramurals', title: 'Intramurals Contribution', amount: 150, deadline: '2026-03-20', description: 'Class share for intramurals registration and banner materials.', memberIds: DEMO_MEMBERS.map((member) => member.id) },
  { id: 'acc-printing', title: 'Project Printing', amount: 80, deadline: '2026-03-22', description: 'Printing and documentation costs.', memberIds: ['2025-00001', '2025-00002', '2025-00003', '2025-00004'] }
];

const INITIAL_PAYMENTS: PaymentRecord[] = [
  { id: 'pay-1', memberId: '2025-00001', obligationId: 'due-2026-03-09', amount: 20, paidAt: '2026-03-09', note: 'Paid in full' },
  { id: 'pay-2', memberId: '2025-00002', obligationId: 'due-2026-03-09', amount: 10, paidAt: '2026-03-09', note: 'Partial payment' },
  { id: 'pay-3', memberId: '2025-00004', obligationId: 'due-2026-03-09', amount: 20, paidAt: '2026-03-09', note: 'Paid in full' },
  { id: 'pay-4', memberId: '2025-00001', obligationId: 'acc-intramurals', amount: 150, paidAt: '2026-03-10', note: 'Settled intramurals' },
  { id: 'pay-5', memberId: '2025-00003', obligationId: 'acc-printing', amount: 40, paidAt: '2026-03-11', note: 'Half payment' }
];

const INITIAL_EXPENSES: Expense[] = [
  { id: 'exp-1', title: 'Classroom cleaning materials', amount: 320, date: '2026-03-10', description: 'Broom, trash bags, disinfectant.' },
  { id: 'exp-2', title: 'Printing reimbursement', amount: 180, date: '2026-03-11', description: 'Receipt-backed reimbursement.' }
];

export default function FinancePage({ onBack, darkMode, user }: FinancePageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [dueDays, setDueDays] = useState<DueDay[]>([]);
  const [customObligations, setCustomObligations] = useState<CustomObligation[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'overview' | 'mine' | 'manage' | 'audit'>(user ? 'overview' : 'audit');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [dueBatchForm, setDueBatchForm] = useState({ amount: '25', weekday: '1', startDate: '2026-03-03', endDate: '2026-04-30', description: 'Regular class daily due.' });
  const [dueUpdateForm, setDueUpdateForm] = useState({ effectiveDate: '2026-03-12', amount: '30' });
  const [accountabilityForm, setAccountabilityForm] = useState({ title: '', amount: '', deadline: '', description: '' });
  const [editingAccountabilityId, setEditingAccountabilityId] = useState('');
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [unpaidObligationId, setUnpaidObligationId] = useState<string>('');
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [isAssigneeFocused, setIsAssigneeFocused] = useState(false);
  const [assigneeDropdownAbove, setAssigneeDropdownAbove] = useState(false);
  const [isAccountabilityModalOpen, setIsAccountabilityModalOpen] = useState(false);
  const [isDueBatchModalOpen, setIsDueBatchModalOpen] = useState(false);
  const [isDueForwardEditModalOpen, setIsDueForwardEditModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingDueDayId, setEditingDueDayId] = useState('');
  const [editingDueDayAmount, setEditingDueDayAmount] = useState('');
  const [deletingAccountabilityId, setDeletingAccountabilityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [backendCanManage, setBackendCanManage] = useState(false);
  const assigneeInputWrapRef = useRef<HTMLDivElement | null>(null);

  const normalizedRole = String(user?.role || '').toLowerCase();
  const normalizedPosition = String(user?.position || '').toLowerCase();
  const isManager = backendCanManage || normalizedRole === 'admin' || normalizedRole === 'superadmin' || normalizedPosition === 'treasurer';
  const canViewTransparency = isManager || normalizedPosition === 'auditor';
  const currentUserId = user?.idNumber || members[0]?.id || '';
  const currentUserName = user?.fullName || user?.name || members.find((member) => member.id === currentUserId)?.name || 'Student';

  const memberMap = useMemo(() => Object.fromEntries(members.map((member) => [member.id, member])), [members]);
  const obligations = useMemo<ObligationView[]>(() => {
    const dailyDueObligations = dueDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({
      id: day.id,
      title: `Daily Due - ${buildDateLabel(day.date)}`,
      amount: day.amount,
      deadline: day.date,
      description: day.description,
      kind: 'daily_due' as const,
      memberIds: members.map((member) => member.id)
    }));
    const accountabilityObligations = customObligations.map((item) => ({ id: item.id, title: item.title, amount: item.amount, deadline: item.deadline, description: item.description, kind: 'accountability' as const, memberIds: item.memberIds }));
    return [...dailyDueObligations, ...accountabilityObligations].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title));
  }, [customObligations, dueDays, members]);
  const obligationMap = useMemo(() => Object.fromEntries(obligations.map((item) => [item.id, item])), [obligations]);

  const getPaidAmount = (memberId: string, obligationId: string) =>
    payments.filter((payment) => payment.memberId === memberId && payment.obligationId === obligationId).reduce((sum, payment) => sum + payment.amount, 0);

  const getOutstandingAmount = (memberId: string, obligationId: string) => {
    const obligation = obligationMap[obligationId];
    if (!obligation || !obligation.memberIds.includes(memberId)) return 0;
    return Math.max(obligation.amount - getPaidAmount(memberId, obligationId), 0);
  };

  const totalExpected = useMemo(() => obligations.reduce((sum, obligation) => sum + (obligation.amount * obligation.memberIds.length), 0), [obligations]);
  const totalCollected = useMemo(() => payments.reduce((sum, payment) => sum + payment.amount, 0), [payments]);
  const moneyUsed = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const currentMoney = totalCollected - moneyUsed;
  const totalOutstanding = Math.max(totalExpected - totalCollected, 0);

  const myItems = useMemo(() => obligations.filter((obligation) => obligation.memberIds.includes(currentUserId)).map((obligation) => {
    const paid = getPaidAmount(currentUserId, obligation.id);
    return { ...obligation, paid, outstanding: Math.max(obligation.amount - paid, 0) };
  }), [currentUserId, obligations, payments]);

  const studentSummaries = useMemo(() => members.map((member) => {
    const assigned = obligations.filter((obligation) => obligation.memberIds.includes(member.id));
    const expected = assigned.reduce((sum, obligation) => sum + obligation.amount, 0);
    const paid = assigned.reduce((sum, obligation) => sum + getPaidAmount(member.id, obligation.id), 0);
    const outstanding = Math.max(expected - paid, 0);
    const unpaidCount = assigned.filter((obligation) => getOutstandingAmount(member.id, obligation.id) > 0).length;
    return { ...member, expected, paid, outstanding, unpaidCount };
  }), [members, obligations, payments]);

  const selectedMember = selectedMemberId ? memberMap[selectedMemberId] || null : null;
  const assigneeSuggestions = useMemo(() => {
    const currentToken = assigneeQuery.split(',').pop()?.trim().toLowerCase() || '';
    const availableMembers = members.filter((member) => !selectedMemberIds.includes(member.id));
    if (!currentToken) return availableMembers.slice(0, 3);
    return availableMembers
      .filter((member) => member.name.toLowerCase().includes(currentToken) || member.id.toLowerCase().includes(currentToken))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(currentToken) || a.id.toLowerCase().startsWith(currentToken) ? 1 : 0;
        const bStarts = b.name.toLowerCase().startsWith(currentToken) || b.id.toLowerCase().startsWith(currentToken) ? 1 : 0;
        return bStarts - aStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 3);
  }, [assigneeQuery, members, selectedMemberIds]);
  const selectedMemberLedger = useMemo(() => {
    if (!selectedMember) return [];
    return obligations.filter((obligation) => obligation.memberIds.includes(selectedMember.id)).map((obligation) => {
      const paid = getPaidAmount(selectedMember.id, obligation.id);
      const history = payments.filter((payment) => payment.memberId === selectedMember.id && payment.obligationId === obligation.id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
      return { ...obligation, paid, outstanding: Math.max(obligation.amount - paid, 0), history };
    });
  }, [selectedMember, obligations, payments]);

  const selectedObligationId = unpaidObligationId || obligations[0]?.id || '';
  const unpaidMembers = useMemo(() => {
    if (!selectedObligationId) return [];
    const obligation = obligationMap[selectedObligationId];
    if (!obligation) return [];
    return obligation.memberIds.map((memberId) => {
      const member = memberMap[memberId];
      const paid = getPaidAmount(memberId, obligation.id);
      return { memberId, memberName: member?.name || memberId, paid, outstanding: Math.max(obligation.amount - paid, 0) };
    }).filter((item) => item.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding || a.memberName.localeCompare(b.memberName));
  }, [selectedObligationId, payments, obligationMap, memberMap]);

  const visibleTabs = [
    { key: 'overview', label: 'Overview', show: !!user },
    { key: 'mine', label: 'My Account', show: !!user },
    { key: 'manage', label: 'Management', show: isManager },
    { key: 'audit', label: 'Audit', show: true }
  ].filter((item) => item.show);

  const baseInput = `w-full rounded-2xl border px-4 py-3 ${darkMode ? 'border-gray-600 bg-gray-900 text-white' : 'border-stone-200 bg-stone-50 text-stone-800'}`;
  const dropdownClass = `flex w-full items-center gap-3 text-left ${baseInput}`;

  const applyFinancePayload = (result: FinanceConfigResponse) => {
    setMembers(Array.isArray(result.members) ? result.members : []);
    setDueDays(Array.isArray(result.dueDays) ? result.dueDays : []);
    setCustomObligations(Array.isArray(result.customObligations) ? result.customObligations : []);
    setPayments(Array.isArray(result.payments) ? result.payments : []);
    setExpenses(Array.isArray(result.expenses) ? result.expenses : []);
    setBackendCanManage(!!result.canManage);
  };

  const loadFinanceConfig = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ action: 'getFinanceConfig' });
      if (user?.idNumber) params.set('userId', user.idNumber);
      const response = await fetch(`${FINANCE_AUDIT_GAS_URL}?${params.toString()}`);
      const result = await response.json() as FinanceConfigResponse;
      if (!result.success) throw new Error(result.error || 'Failed to load finance data');
      applyFinancePayload(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load finance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const postFinanceAction = async (action: string, payload: Record<string, unknown>) => {
    const response = await fetch(FINANCE_AUDIT_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        userId: user?.idNumber || '',
        ...payload
      })
    });
    const result = await response.json() as FinanceConfigResponse;
    if (!result.success) throw new Error(result.error || 'Finance action failed');
    applyFinancePayload(result);
  };

  useEffect(() => {
    if (!user) setTab('audit');
  }, [user]);

  useEffect(() => {
    void loadFinanceConfig();
  }, [user?.idNumber]);

  useEffect(() => {
    setSelectedMemberIds((current) => current.filter((memberId) => members.some((member) => member.id === memberId)));
    if (selectedMemberId && !members.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [members, selectedMemberId]);

  useEffect(() => {
    if (!isAssigneeFocused) return;

    const updateDropdownPlacement = () => {
      const container = assigneeInputWrapRef.current;
      if (!container || typeof window === 'undefined') return;

      const rect = container.getBoundingClientRect();
      const estimatedDropdownHeight = Math.min(assigneeSuggestions.length || 1, 3) * 72 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setAssigneeDropdownAbove(spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow);
    };

    updateDropdownPlacement();
    window.addEventListener('resize', updateDropdownPlacement);
    window.addEventListener('scroll', updateDropdownPlacement, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPlacement);
      window.removeEventListener('scroll', updateDropdownPlacement, true);
    };
  }, [isAssigneeFocused, assigneeSuggestions.length]);

  const recordPayment = async (memberId: string, obligationId: string, amountOverride?: number) => {
    const rawDraft = amountOverride ?? Number(paymentDrafts[`${memberId}:${obligationId}`] || 0);
    const amount = Math.max(0, rawDraft);
    const outstanding = getOutstandingAmount(memberId, obligationId);
    if (!amount || !outstanding) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('recordFinancePayment', {
        memberId,
        obligationId,
        amount: Math.min(amount, outstanding),
        paidAt: toDateInputValue(),
        note: 'Recorded by treasurer'
      });
      setPaymentDrafts((current) => ({ ...current, [`${memberId}:${obligationId}`]: '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const resetAccountabilityForm = () => {
    setAccountabilityForm({ title: '', amount: '', deadline: '', description: '' });
    setEditingAccountabilityId('');
    setAssigneeQuery('');
    setSelectedMemberIds([]);
    setIsAccountabilityModalOpen(false);
  };

  const openCreateAccountabilityModal = () => {
    setAccountabilityForm({ title: '', amount: '', deadline: '', description: '' });
    setEditingAccountabilityId('');
    setAssigneeQuery('');
    setSelectedMemberIds([]);
    setIsAccountabilityModalOpen(true);
  };

  const startEditingAccountability = (item: CustomObligation) => {
    setEditingAccountabilityId(item.id);
    setAccountabilityForm({
      title: item.title,
      amount: String(item.amount),
      deadline: item.deadline,
      description: item.description
    });
    setSelectedMemberIds(item.memberIds.slice());
    setAssigneeQuery('');
    setIsAccountabilityModalOpen(true);
  };

  const addAssigneeById = (memberId: string) => {
    if (!memberId || selectedMemberIds.includes(memberId)) return;
    setSelectedMemberIds((current) => [...current, memberId]);
  };

  const addAssigneesFromTerms = (terms: string[]) => {
    const nextIds: string[] = [];
    for (const rawTerm of terms) {
      const term = rawTerm.trim().toLowerCase();
      if (!term) continue;
      const match = members.find((member) => member.id.toLowerCase() === term) ||
        members.find((member) => member.name.toLowerCase() === term) ||
        members.find((member) => member.name.toLowerCase().startsWith(term) || member.id.toLowerCase().startsWith(term)) ||
        members.find((member) => member.name.toLowerCase().includes(term) || member.id.toLowerCase().includes(term));
      if (!match || selectedMemberIds.includes(match.id) || nextIds.includes(match.id)) continue;
      nextIds.push(match.id);
    }
    if (nextIds.length) {
      setSelectedMemberIds((current) => [...current, ...nextIds]);
    }
  };

  const saveAccountability = async () => {
    const amount = Number(accountabilityForm.amount) || 0;
    if (!accountabilityForm.title || !amount || !selectedMemberIds.length) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('saveFinanceAccountability', {
        obligationId: editingAccountabilityId,
        title: accountabilityForm.title,
        amount,
        deadline: accountabilityForm.deadline,
        description: accountabilityForm.description || 'Custom accountability',
        memberIds: selectedMemberIds
      });
      resetAccountabilityForm();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save accountability');
    } finally {
      setSaving(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm(EMPTY_EXPENSE_FORM);
    setIsExpenseModalOpen(false);
  };

  const saveExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('saveFinanceExpense', {
        expenseId: buildExpenseReferenceId(expenseForm.date),
        title: expenseForm.title,
        amount: Number(expenseForm.amount) || 0,
        date: expenseForm.date,
        description: expenseForm.description
      });
      resetExpenseForm();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const saveDueBatch = async () => {
    const amount = Number(dueBatchForm.amount) || 0;
    const startDate = normalizeDate(dueBatchForm.startDate);
    const endDate = normalizeDate(dueBatchForm.endDate);
    if (!amount || !startDate || !endDate) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('createFinanceDueBatch', {
        amount,
        weekday: dueBatchForm.weekday,
        startDate,
        endDate,
        description: dueBatchForm.description || 'Regular class daily due.'
      });
      setIsDueBatchModalOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create due batch');
    } finally {
      setSaving(false);
    }
  };

  const saveForwardDueEdit = async () => {
    const nextAmount = Number(dueUpdateForm.amount) || 0;
    const effectiveDate = normalizeDate(dueUpdateForm.effectiveDate);
    if (!nextAmount || !effectiveDate) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('updateFinanceDueAmountsFromDate', {
        effectiveDate,
        amount: nextAmount
      });
      setIsDueForwardEditModalOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update due amounts');
    } finally {
      setSaving(false);
    }
  };

  const openDueDayEditModal = (day: DueDay) => {
    setEditingDueDayId(day.id);
    setEditingDueDayAmount(String(day.amount));
  };

  const saveDueDayEdit = async () => {
    const nextAmount = Number(editingDueDayAmount) || 0;
    if (!editingDueDayId || !nextAmount) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('updateFinanceDueDay', {
        dueId: editingDueDayId,
        amount: nextAmount
      });
      setEditingDueDayId('');
      setEditingDueDayAmount('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update due day');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAccountability = async () => {
    if (!deletingAccountabilityId) return;
    setSaving(true);
    setError('');
    try {
      await postFinanceAction('deleteFinanceAccountability', {
        obligationId: deletingAccountabilityId
      });
      if (editingAccountabilityId === deletingAccountabilityId) resetAccountabilityForm();
      setDeletingAccountabilityId('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete accountability');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-stone-50'}`}>
      <header className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} sticky top-0 z-40 border-b`}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={onBack} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-stone-600 hover:bg-stone-100'}`}>
            <Icon name="arrow_back" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Finance and Audit</h1>
            <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Finance tools for officers, plus the public audit tab for transparency.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {user ? (
          <>
            <section className={`${darkMode ? 'border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900' : 'border-stone-200 bg-gradient-to-br from-white to-amber-50'} rounded-[2rem] border p-6`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-gray-700 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                    <Icon name="account_balance_wallet" className="text-sm" />
                    {isManager ? 'Treasurer/Admin controls active' : canViewTransparency ? 'Audit view active' : 'Student view active'}
                  </div>
                  <h2 className={`mt-4 text-3xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{money(currentMoney)} current class fund</h2>
                 
                </div>
                <div className="rounded-3xl border px-4 py-3 text-sm font-medium shadow-sm">
                  <p className={darkMode ? 'text-gray-300' : 'text-stone-700'}>{currentUserName}</p>
                  <p className={darkMode ? 'text-gray-500' : 'text-stone-500'}>{user?.position || user?.role || 'Student'}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Current Fund" value={money(currentMoney)} icon="savings" darkMode={darkMode} />
              <StatCard label="Expected Account" value={money(totalExpected)} icon="account_balance" darkMode={darkMode} />
              <StatCard label="Collected" value={money(totalCollected)} icon="payments" darkMode={darkMode} />
              <StatCard label="Outstanding" value={money(totalOutstanding)} icon="warning" darkMode={darkMode} />
              <StatCard label="Money Used" value={money(moneyUsed)} icon="receipt_long" darkMode={darkMode} />
            </div>
          </>
        ) : (
          <section className={`${darkMode ? 'border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900' : 'border-stone-200 bg-gradient-to-br from-white to-cyan-50'} rounded-[2rem] border p-6`}>
            <div className="max-w-4xl">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-gray-700 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                <Icon name="policy" className="text-sm" />
                Public access
              </div>
              <h2 className={`mt-4 text-3xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Audit transparency is available without sign-in</h2>
              <p className={`mt-2 text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-stone-600'}`}>
                The finance management tools stay protected, but the audit tab remains visible to everyone for transparency.
              </p>
            </div>
          </section>
        )}

        <div className={`inline-flex flex-wrap gap-2 rounded-3xl p-2 ${darkMode ? 'bg-gray-800' : 'bg-stone-100'}`}>
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as typeof tab)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ${tab === item.key ? darkMode ? 'bg-gray-700 text-white' : 'bg-white text-stone-900 shadow-sm' : darkMode ? 'text-gray-300 hover:bg-gray-700/70' : 'text-stone-600 hover:bg-white/70'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {loading ? <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Loading finance data...</p> : null}
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>
          <button
            onClick={() => void loadFinanceConfig(true)}
            disabled={refreshing || saving}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-stone-800 shadow-sm'}`}
          >
            {refreshing ? 'Refreshing...' : saving ? 'Working...' : 'Refresh Finance'}
          </button>
        </div>

        {tab === 'audit' && (
          <div className="space-y-6">
            <AuditPage
              darkMode={darkMode}
              user={user}
              embedded
              onChange={() => void loadFinanceConfig(true)}
            />

            <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Finance Transparency Ledger</h2>
                  <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                    Liquidation entries from the audit form are shown here and automatically deducted from the running balance.
                  </p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-gray-900 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
                  <Icon name="visibility" className="text-sm" />
                  Public read view
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {expenses.map((item) => (
                  <div key={item.id} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] ${darkMode ? 'bg-gray-800 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                            {item.id}
                          </span>
                          {item.source === 'legacy_expense' ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                              Legacy expense
                            </span>
                          ) : (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                              Liquidation
                            </span>
                          )}
                        </div>
                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.title}</p>
                        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.description}</p>
                        {item.payee ? <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Payee: {item.payee}</p> : null}
                        {item.receiptReference ? <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Receipt / Ref: {item.receiptReference}</p> : null}
                        {item.liquidationDetails ? <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{item.liquidationDetails}</p> : null}
                        <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Date: {formatDate(item.date)}</p>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${darkMode ? 'bg-rose-900/20 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{money(item.amount)}</div>
                    </div>
                  </div>
                ))}
                {expenses.length === 0 ? (
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No liquidation records logged yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        )}

        {tab === 'overview' && (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Daily Due Days</h2>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{dueDays.length} active due days</p>
              </div>
              <div className="mt-4 space-y-3">
                {dueDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map((item) => (
                  <div key={item.id} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{buildDateLabel(item.date)}</p>
                        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.description}</p>
                        <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{formatDate(item.date)}</p>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${darkMode ? 'bg-emerald-900/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{money(item.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>My Snapshot</h2>
              <div className="mt-4 space-y-3">
                {myItems.map((item) => (
                  <div key={item.id} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.title}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.kind === 'daily_due' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{item.kind === 'daily_due' ? 'Daily Due' : 'Accountability'}</span>
                        </div>
                        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.description}</p>
                        <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Deadline: {formatDate(item.deadline)}</p>
                      </div>
                      <div className="text-right">
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${item.outstanding === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.outstanding === 0 ? 'Settled' : 'With balance'}</div>
                        <p className={`mt-2 font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{money(item.outstanding)}</p>
                        <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Paid {money(item.paid)} of {money(item.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'mine' && (
          <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>My Accountabilities</h2>
            <div className="mt-4 space-y-3">
              {myItems.map((item) => (
                <div key={item.id} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.kind === 'daily_due' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{item.kind === 'daily_due' ? 'Daily Due' : 'Accountability'}</span>
                      </div>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.description}</p>
                      <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Deadline: {formatDate(item.deadline)}</p>
                    </div>
                    <div className="text-right">
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${item.outstanding === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.outstanding === 0 ? 'Fully paid' : 'Partially/Unpaid'}</div>
                      <p className={`mt-2 font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Balance {money(item.outstanding)}</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Paid {money(item.paid)} of {money(item.amount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'manage' && isManager && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Daily Dues</h2>
                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>All daily dues CRUD actions open as floating modals only when you press a button.</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => setIsDueBatchModalOpen(true)} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                    Add Dues
                  </button>
                  <button onClick={() => setIsDueForwardEditModalOpen(true)} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-amber-400">
                    Edit Dues
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {dueDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map((day) => (
                    <div key={day.id} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{buildDateLabel(day.date)} • {formatDate(day.date)}</p>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{day.description}</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className={`rounded-2xl px-4 py-3 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-stone-800'}`}>{money(day.amount)}</div>
                          <button onClick={() => openDueDayEditModal(day)} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="hidden">
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{editingAccountabilityId ? 'Edit Accountability' : 'Add Accountability'}</h2>
                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Examples: intramurals, project fees, uniforms, reimbursements.</p>
                <div className="mt-4 space-y-4">
                  <input className={baseInput} value={accountabilityForm.title} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, title: e.target.value })} placeholder="Intramurals contribution" />
                  <input className={baseInput} type="number" value={accountabilityForm.amount} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, amount: e.target.value })} placeholder="Amount" />
                  <input className={baseInput} type="date" value={accountabilityForm.deadline} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, deadline: e.target.value })} />
                  <textarea className={baseInput} rows={3} value={accountabilityForm.description} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, description: e.target.value })} placeholder="Description" />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={saveAccountability} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                    {editingAccountabilityId ? 'Update Accountability' : 'Save Accountability'}
                  </button>
                  {editingAccountabilityId ? (
                    <button onClick={resetAccountabilityForm} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Assign To</h2>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Search a name, pick from suggestions, and separate multiple students with commas.</p>
                  </div>
                  <button onClick={() => setSelectedMemberIds([])} className={`rounded-2xl px-3 py-2 text-sm font-medium ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-stone-100 text-stone-700'}`}>
                    Clear All
                  </button>
                </div>
                <div ref={assigneeInputWrapRef} className="relative mt-4">
                  <input
                    className={baseInput}
                    value={assigneeQuery}
                    onFocus={() => setIsAssigneeFocused(true)}
                    onBlur={() => setTimeout(() => setIsAssigneeFocused(false), 100)}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      const parts = nextValue.split(',');
                      if (parts.length > 1) {
                        const committed = parts.slice(0, -1);
                        const remainder = parts[parts.length - 1] || '';
                        addAssigneesFromTerms(committed);
                        setAssigneeQuery(remainder.trimStart());
                        return;
                      }
                      setAssigneeQuery(nextValue);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === 'Tab') && assigneeQuery.trim()) {
                        e.preventDefault();
                        addAssigneesFromTerms([assigneeQuery]);
                        setAssigneeQuery('');
                      }
                    }}
                    placeholder="Type student names or IDs, separated by commas"
                  />
                  {isAssigneeFocused && assigneeSuggestions.length ? (
                    <div className={`absolute left-0 right-0 z-20 rounded-2xl border shadow-lg ${assigneeDropdownAbove ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]'} ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
                      {assigneeSuggestions.map((member) => (
                        <button
                          key={member.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            addAssigneeById(member.id);
                            setAssigneeQuery('');
                          }}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-stone-50'}`}
                        >
                          <span>
                            <span className={`block font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{member.name}</span>
                            <span className={`block text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{member.id}</span>
                          </span>
                          <span className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Add</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedMemberIds.map((memberId) => {
                    const member = memberMap[memberId];
                    if (!member) return null;
                    return (
                      <span key={memberId} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm ${darkMode ? 'bg-amber-900/30 text-amber-200' : 'bg-amber-100 text-amber-800'}`}>
                        <span>{member.name}</span>
                        <button onClick={() => setSelectedMemberIds((current) => current.filter((id) => id !== memberId))} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs">
                          Ã—
                        </button>
                      </span>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Student Accounts</h2>
                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Tap a student to open the account panel and record partial payments.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={darkMode ? 'text-gray-400' : 'text-stone-500'}>
                        <th className="pb-3 pr-4 font-medium">Student</th>
                        <th className="pb-3 pr-4 font-medium">Expected</th>
                        <th className="pb-3 pr-4 font-medium">Paid</th>
                        <th className="pb-3 pr-4 font-medium">Balance</th>
                        <th className="pb-3 font-medium">Unpaid Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentSummaries.map((member) => (
                        <tr key={member.id} className={`cursor-pointer border-t ${darkMode ? 'border-gray-700 hover:bg-gray-900/70' : 'border-stone-200 hover:bg-stone-50'}`} onClick={() => setSelectedMemberId(member.id)}>
                          <td className="py-3 pr-4">
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{member.name}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{member.id}</p>
                          </td>
                          <td className={`py-3 pr-4 ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>{money(member.expected)}</td>
                          <td className={`py-3 pr-4 ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>{money(member.paid)}</td>
                          <td className={`py-3 pr-4 font-semibold ${member.outstanding > 0 ? 'text-amber-500' : darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{money(member.outstanding)}</td>
                          <td className={`py-3 ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>{member.unpaidCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>All Accountabilities</h2>
                  <button onClick={openCreateAccountabilityModal} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                    Add Accountability
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {customObligations.map((item) => (
                    <div key={item.id} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.title}</p>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.description}</p>
                          <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Deadline: {formatDate(item.deadline)} • Assigned to {item.memberIds.length} students</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`rounded-2xl px-4 py-3 ${darkMode ? 'bg-sky-900/20 text-sky-300' : 'bg-sky-50 text-sky-700'}`}>{money(item.amount)}</div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              onClick={() => startEditingAccountability(item)}
                              className={`rounded-2xl px-3 py-2 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-stone-700'}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingAccountabilityId(item.id)}
                              className="rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customObligations.length === 0 ? <p className={darkMode ? 'text-gray-400' : 'text-stone-500'}>No custom accountabilities yet.</p> : null}
                </div>
              </section>

              <section className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'} rounded-3xl border p-6`}>
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Unpaid Summary By Obligation</h2>
                <div className="mt-4">
                  <CustomDropdown
                    name="finance-unpaid-obligation"
                    value={selectedObligationId}
                    onChange={setUnpaidObligationId}
                    options={obligations.map((item) => ({ value: item.id, label: `${item.title} • ${formatDate(item.deadline)}` }))}
                    disabled={!obligations.length}
                    placeholder="No obligations available"
                    theme={darkMode ? 'dark' : 'light'}
                    className={dropdownClass}
                  />
                </div>
                <div className="mt-4 space-y-3">
                  {unpaidMembers.map((item) => (
                    <div key={`${selectedObligationId}-${item.memberId}`} className={`${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'} rounded-2xl border p-4`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.memberName}</p>
                          <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{item.memberId}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Paid {money(item.paid)}</p>
                          <p className="font-semibold text-amber-500">Balance {money(item.outstanding)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {unpaidMembers.length === 0 ? <p className={darkMode ? 'text-gray-400' : 'text-stone-500'}>Everyone assigned to this obligation is already settled.</p> : null}
                </div>
              </section>
            </div>
          </div>
        )}

      </main>

      {selectedMember && isManager && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button className="flex-1 cursor-default" aria-label="Close member panel" onClick={() => setSelectedMemberId(null)} />
          <aside className={`h-full w-full max-w-2xl overflow-y-auto border-l ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'} p-6 shadow-2xl`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Student Account</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{selectedMember.name}</h2>
                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{selectedMember.id}</p>
              </div>
              <button onClick={() => setSelectedMemberId(null)} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Expected" value={money(studentSummaries.find((item) => item.id === selectedMember.id)?.expected || 0)} icon="request_quote" darkMode={darkMode} />
              <StatCard label="Paid" value={money(studentSummaries.find((item) => item.id === selectedMember.id)?.paid || 0)} icon="paid" darkMode={darkMode} />
              <StatCard label="Balance" value={money(studentSummaries.find((item) => item.id === selectedMember.id)?.outstanding || 0)} icon="account_balance_wallet" darkMode={darkMode} />
            </div>

            <section className="mt-6 space-y-4">
              <div>
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Ledger</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Record payments on any daily due or accountability. Partial payments automatically reduce that specific balance.</p>
              </div>

              {selectedMemberLedger.map((item) => (
                <div key={item.id} className={`${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-stone-50'} rounded-3xl border p-5`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.kind === 'daily_due' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{item.kind === 'daily_due' ? 'Daily Due' : 'Accountability'}</span>
                      </div>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.description}</p>
                      <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Deadline: {formatDate(item.deadline)}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-right">
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Balance</p>
                      <p className="font-bold text-amber-500">{money(item.outstanding)}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Paid {money(item.paid)} of {money(item.amount)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input className={`${baseInput} sm:max-w-[180px]`} type="number" value={paymentDrafts[`${selectedMember.id}:${item.id}`] || ''} onChange={(e) => setPaymentDrafts((current) => ({ ...current, [`${selectedMember.id}:${item.id}`]: e.target.value }))} placeholder="Payment amount" />
                    <button onClick={() => recordPayment(selectedMember.id, item.id)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                      Record Payment
                    </button>
                    {item.outstanding > 0 ? (
                      <button onClick={() => recordPayment(selectedMember.id, item.id, item.outstanding)} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                        Settle Full Balance
                      </button>
                    ) : null}
                  </div>

                  {item.history.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-stone-300/40 p-4">
                      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Payment History</p>
                      <div className="mt-3 space-y-2">
                        {item.history.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                            <div>
                              <p className={darkMode ? 'text-gray-200' : 'text-stone-700'}>{formatDate(entry.paidAt)}</p>
                              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{entry.note}</p>
                            </div>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{money(entry.amount)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          </aside>
        </div>
      )}

      {isAccountabilityModalOpen && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8 lg:px-10">
          <div className={`modal-content my-auto w-full max-w-3xl overflow-y-auto rounded-[2rem] border p-4 shadow-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] sm:p-6 lg:max-h-[calc(100vh-5rem)] lg:p-7 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Accountability</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{editingAccountabilityId ? 'Edit Accountability' : 'Add Accountability'}</h2>
              </div>
              <button onClick={resetAccountabilityForm} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <input className={baseInput} value={accountabilityForm.title} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, title: e.target.value })} placeholder="Intramurals contribution" />
              <input className={baseInput} type="number" value={accountabilityForm.amount} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, amount: e.target.value })} placeholder="Amount" />
              <input className={baseInput} type="date" value={accountabilityForm.deadline} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, deadline: e.target.value })} />
              <textarea className={baseInput} rows={3} value={accountabilityForm.description} onChange={(e) => setAccountabilityForm({ ...accountabilityForm, description: e.target.value })} placeholder="Description" />
            </div>

            <section className={`mt-6 rounded-3xl border p-4 sm:p-5 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-stone-50'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Assign To</h3>
                  <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Search a name, pick from suggestions, and separate multiple students with commas.</p>
                </div>
                <button onClick={() => setSelectedMemberIds([])} className={`w-full rounded-2xl px-3 py-2 text-sm font-medium sm:w-auto ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-white text-stone-700'}`}>
                  Clear All
                </button>
              </div>
              <div ref={assigneeInputWrapRef} className="relative mt-4">
                <input
                  className={baseInput}
                  value={assigneeQuery}
                  onFocus={() => setIsAssigneeFocused(true)}
                  onBlur={() => setTimeout(() => setIsAssigneeFocused(false), 100)}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    const parts = nextValue.split(',');
                    if (parts.length > 1) {
                      const committed = parts.slice(0, -1);
                      const remainder = parts[parts.length - 1] || '';
                      addAssigneesFromTerms(committed);
                      setAssigneeQuery(remainder.trimStart());
                      return;
                    }
                    setAssigneeQuery(nextValue);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === 'Tab') && assigneeQuery.trim()) {
                      e.preventDefault();
                      addAssigneesFromTerms([assigneeQuery]);
                      setAssigneeQuery('');
                    }
                  }}
                  placeholder="Type student names or IDs, separated by commas"
                />
                {isAssigneeFocused && assigneeSuggestions.length ? (
                  <div className={`absolute left-0 right-0 z-20 rounded-2xl border shadow-lg ${assigneeDropdownAbove ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]'} ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
                    {assigneeSuggestions.map((member) => (
                      <button
                        key={member.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          addAssigneeById(member.id);
                          setAssigneeQuery('');
                        }}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-stone-50'}`}
                      >
                        <span>
                          <span className={`block font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{member.name}</span>
                          <span className={`block text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>{member.id}</span>
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Add</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedMemberIds.map((memberId) => {
                  const member = memberMap[memberId];
                  if (!member) return null;
                  return (
                    <span key={memberId} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm ${darkMode ? 'bg-amber-900/30 text-amber-200' : 'bg-amber-100 text-amber-800'}`}>
                      <span>{member.name}</span>
                      <button onClick={() => setSelectedMemberIds((current) => current.filter((id) => id !== memberId))} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs">
                        x
                      </button>
                    </span>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={resetAccountabilityForm} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                Cancel
              </button>
              <button onClick={saveAccountability} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                {editingAccountabilityId ? 'Update Accountability' : 'Save Accountability'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDueBatchModalOpen && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8 lg:px-10">
          <div className={`my-auto w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] border p-4 shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:p-6 lg:max-h-[calc(100vh-5rem)] lg:p-7 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Daily Dues</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Add Dues</h2>
              </div>
              <button onClick={() => setIsDueBatchModalOpen(false)} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input className={baseInput} type="number" value={dueBatchForm.amount} onChange={(e) => setDueBatchForm({ ...dueBatchForm, amount: e.target.value })} placeholder="Amount" />
              <CustomDropdown
                name="finance-due-weekday"
                value={dueBatchForm.weekday}
                onChange={(value) => setDueBatchForm({ ...dueBatchForm, weekday: value })}
                options={WEEKDAY_OPTIONS}
                theme={darkMode ? 'dark' : 'light'}
                className={dropdownClass}
              />
              <input className={baseInput} type="date" value={dueBatchForm.startDate} onChange={(e) => setDueBatchForm({ ...dueBatchForm, startDate: e.target.value })} />
              <input className={baseInput} type="date" value={dueBatchForm.endDate} onChange={(e) => setDueBatchForm({ ...dueBatchForm, endDate: e.target.value })} />
              <textarea className={`${baseInput} md:col-span-2`} rows={3} value={dueBatchForm.description} onChange={(e) => setDueBatchForm({ ...dueBatchForm, description: e.target.value })} placeholder="Description" />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setIsDueBatchModalOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                Cancel
              </button>
              <button onClick={saveDueBatch} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isDueForwardEditModalOpen && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8 lg:px-10">
          <div className={`my-auto w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] border p-4 shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:p-6 lg:max-h-[calc(100vh-5rem)] lg:p-7 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Daily Dues</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Edit Dues</h2>
              </div>
              <button onClick={() => setIsDueForwardEditModalOpen(false)} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <input className={baseInput} type="date" value={dueUpdateForm.effectiveDate} onChange={(e) => setDueUpdateForm({ ...dueUpdateForm, effectiveDate: e.target.value })} />
              <input className={baseInput} type="number" value={dueUpdateForm.amount} onChange={(e) => setDueUpdateForm({ ...dueUpdateForm, amount: e.target.value })} placeholder="New amount" />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setIsDueForwardEditModalOpen(false)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                Cancel
              </button>
              <button onClick={saveForwardDueEdit} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-amber-400">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDueDayId && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8 lg:px-10">
          <div className={`my-auto w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] border p-4 shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:p-6 lg:max-h-[calc(100vh-5rem)] lg:p-7 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Daily Dues</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Edit Day</h2>
              </div>
              <button onClick={() => { setEditingDueDayId(''); setEditingDueDayAmount(''); }} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <div className="mt-6">
              <input className={baseInput} type="number" value={editingDueDayAmount} onChange={(e) => setEditingDueDayAmount(e.target.value)} placeholder="New amount" />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => { setEditingDueDayId(''); setEditingDueDayAmount(''); }} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                Cancel
              </button>
              <button onClick={saveDueDayEdit} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingAccountabilityId && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8 lg:px-10">
          <div className={`my-auto w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] border p-4 shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:p-6 lg:max-h-[calc(100vh-5rem)] lg:p-7 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Accountability</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Delete Accountability</h2>
              </div>
              <button onClick={() => setDeletingAccountabilityId('')} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <p className={`mt-6 text-sm ${darkMode ? 'text-gray-300' : 'text-stone-600'}`}>This will remove the accountability and its linked payment records. This action cannot be undone.</p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setDeletingAccountabilityId('')} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                Cancel
              </button>
              <button onClick={confirmDeleteAccountability} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpenseModalOpen && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8 lg:px-10">
          <div className={`my-auto w-full max-w-3xl overflow-y-auto rounded-[2rem] border p-4 shadow-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] sm:p-6 lg:max-h-[calc(100vh-5rem)] lg:p-7 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Expenditure</p>
                <h2 className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Add Expenditure</h2>
                <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                  A reference ID will be generated automatically when you save this expense.
                </p>
              </div>
              <button onClick={resetExpenseForm} className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <Icon name="close" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input className={baseInput} value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} placeholder="Expense title" />
              <input className={baseInput} type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="Amount" />
              <div className="md:col-span-2">
                <input className={baseInput} type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <textarea className={baseInput} rows={5} value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Purpose, supplier, proof notes" />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={resetExpenseForm} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-stone-100 text-stone-700'}`}>
                Cancel
              </button>
              <button onClick={saveExpense} className="rounded-2xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">
                Save Expenditure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


