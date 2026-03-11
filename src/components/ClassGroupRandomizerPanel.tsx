import React, { useMemo, useState } from 'react';
import CustomDropdown from './ui/CustomDropdown';

type ToastType = 'info' | 'success' | 'error' | 'loading';

type UserLite = {
  idNumber: string;
  fullName?: string;
  role?: string;
  position?: string;
  sessionToken?: string;
};

type ClassmateLite = {
  idNumber: string;
  name: string;
  username?: string;
  role?: string;
  position?: string;
};

type Props = {
  gasUrl: string;
  user: UserLite | null;
  classmates: ClassmateLite[];
  courseOptions: Array<{ code: string; name?: string }>;
  darkMode?: boolean;
  addToast: (message: string, type: ToastType, progress?: number) => number;
  updateToast?: (id: number, message: string, type: ToastType, progress?: number) => void;
  removeToast?: (id: number) => void;
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>;
}

function hasOfficerAccess(user: UserLite | null) {
  const role = String(user?.role || '').toLowerCase();
  const position = String(user?.position || '').toLowerCase();
  return role === 'admin' || role === 'superadmin' || ['mayor', 'vice mayor', 'secretary', 'assistant secretary'].includes(position);
}

export default function ClassGroupRandomizerPanel({ gasUrl, user, classmates, courseOptions, addToast, updateToast, removeToast }: Props) {
  const [mode, setMode] = useState<'random' | 'manual'>('random');
  const [search, setSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<ClassmateLite[]>([]);
  const [selectedLeaders, setSelectedLeaders] = useState<ClassmateLite[]>([]);
  const [randomForm, setRandomForm] = useState({ courseCode: '', groupName: '', title: '', task: '', deadline: '', numberOfGroups: '2', description: '' });
  const [manualForm, setManualForm] = useState({ courseCode: '', groupName: '', title: '', task: '', deadline: '', description: '' });
  const [lastCreated, setLastCreated] = useState<Array<{ groupId: string; groupName: string; memberIds: string[]; teamLeaderIds: string[] }>>([]);

  const canManage = hasOfficerAccess(user);

  const filteredClassmates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return classmates.slice(0, mode === 'manual' ? 3 : 12);
    return classmates.filter(member => {
      return String(member.name || '').toLowerCase().includes(query) || String(member.username || '').toLowerCase().includes(query) || String(member.idNumber || '').toLowerCase().includes(query);
    }).slice(0, mode === 'manual' ? 8 : 12);
  }, [classmates, mode, search]);

  const selectedIds = useMemo(() => new Set([...selectedMembers, ...selectedLeaders].map(member => member.idNumber)), [selectedMembers, selectedLeaders]);
  const manualSuggestions = useMemo(() => filteredClassmates.slice(0, Math.max(3, Math.min(filteredClassmates.length, 8))), [filteredClassmates]);

  const postAction = async (payload: Record<string, unknown>) => {
    const response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.json();
  };

  const toggleSelection = (member: ClassmateLite, type: 'member' | 'leader') => {
    if (type === 'member') {
      setSelectedMembers(prev => prev.some(item => item.idNumber === member.idNumber) ? prev.filter(item => item.idNumber !== member.idNumber) : [...prev, member]);
      return;
    }
    setSelectedLeaders(prev => prev.some(item => item.idNumber === member.idNumber) ? prev.filter(item => item.idNumber !== member.idNumber) : [...prev, member]);
  };

  const addManualMember = (member: ClassmateLite) => {
    setSelectedMembers(prev => prev.some(item => item.idNumber === member.idNumber) ? prev : [...prev, member]);
  };

  const assignManualLeader = (member: ClassmateLite) => {
    setSelectedMembers(prev => prev.some(item => item.idNumber === member.idNumber) ? prev : [...prev, member]);
    setSelectedLeaders([member]);
  };

  const removeSelectedMember = (memberId: string) => {
    setSelectedMembers(prev => prev.filter(item => item.idNumber !== memberId));
    setSelectedLeaders(prev => prev.filter(item => item.idNumber !== memberId));
  };

  const resetSelections = () => {
    setSelectedMembers([]);
    setSelectedLeaders([]);
    setSearch('');
  };

  const handleCreateRandom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.sessionToken) return;
    const toastId = addToast('Creating random groups...', 'loading');
    try {
      const result = await postAction({
        action: 'createRandomCourseGroups',
        userId: user.idNumber,
        sessionToken: user.sessionToken,
        courseCode: randomForm.courseCode,
        groupName: randomForm.groupName,
        title: randomForm.title,
        task: randomForm.task,
        deadline: randomForm.deadline,
        description: randomForm.description,
        numberOfGroups: Number(randomForm.numberOfGroups),
        teamLeaderIds: selectedLeaders.map(member => member.idNumber),
        memberIds: (selectedMembers.length ? selectedMembers : classmates).map(member => member.idNumber)
      });
      if (!result.success) throw new Error(result.error || 'Failed to create random groups');
      updateToast?.(toastId, 'Random groups created', 'success');
      window.setTimeout(() => removeToast?.(toastId), 2500);
      setLastCreated(result.groups || []);
      setRandomForm({ courseCode: '', groupName: '', title: '', task: '', deadline: '', numberOfGroups: '2', description: '' });
      resetSelections();
    } catch (error: any) {
      updateToast?.(toastId, error.message || 'Failed to create random groups', 'error');
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.sessionToken) return;
    if (!selectedMembers.length) {
      addToast('Add at least one member before creating a manual group', 'error');
      return;
    }
    const toastId = addToast('Creating manual group...', 'loading');
    try {
      const result = await postAction({
        action: 'createManualCourseGrouping',
        userId: user.idNumber,
        sessionToken: user.sessionToken,
        courseCode: manualForm.courseCode,
        groupName: manualForm.groupName,
        title: manualForm.title,
        task: manualForm.task,
        deadline: manualForm.deadline,
        description: manualForm.description,
        teamLeaderIds: selectedLeaders.map(member => member.idNumber),
        memberIds: selectedMembers.map(member => member.idNumber)
      });
      if (!result.success) throw new Error(result.error || 'Failed to create manual group');
      updateToast?.(toastId, 'Manual group created', 'success');
      window.setTimeout(() => removeToast?.(toastId), 2500);
      setLastCreated(result.groupId ? [{ groupId: result.groupId, groupName: manualForm.groupName, memberIds: selectedMembers.map(member => member.idNumber), teamLeaderIds: selectedLeaders.map(member => member.idNumber) }] : []);
      setManualForm({ courseCode: '', groupName: '', title: '', task: '', deadline: '', description: '' });
      resetSelections();
    } catch (error: any) {
      updateToast?.(toastId, error.message || 'Failed to create manual group', 'error');
    }
  };

  if (!canManage) {
    return <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">Only officers, admin, or superadmin can create randomized or manual class groupings.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMode('random')} className={`rounded-xl px-4 py-2 text-sm font-medium ${mode === 'random' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>Randomizer</button>
          <button onClick={() => setMode('manual')} className={`rounded-xl px-4 py-2 text-sm font-medium ${mode === 'manual' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>Manual</button>
        </div>
        <p className="mt-3 text-sm text-stone-500">Build course-connected groupings from your current class roster with optional team leaders and task metadata.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={mode === 'random' ? handleCreateRandom : handleCreateManual} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CustomDropdown
              name="class-group-randomizer-course"
              value={mode === 'random' ? randomForm.courseCode : manualForm.courseCode}
              onChange={(value) => mode === 'random' ? setRandomForm(prev => ({ ...prev, courseCode: value })) : setManualForm(prev => ({ ...prev, courseCode: value }))}
              options={[{ value: '', label: 'Select course code' }, ...courseOptions.map((option) => ({ value: option.code, label: `${option.code}${option.name ? ` - ${option.name}` : ''}` }))]}
              placeholder="Select course code"
              required
              className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm outline-none focus:border-stone-400"
            />
            <input value={mode === 'random' ? randomForm.groupName : manualForm.groupName} onChange={(e) => mode === 'random' ? setRandomForm(prev => ({ ...prev, groupName: e.target.value })) : setManualForm(prev => ({ ...prev, groupName: e.target.value }))} placeholder={mode === 'random' ? 'Base group name' : 'Group name'} className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" required />
            <input value={mode === 'random' ? randomForm.title : manualForm.title} onChange={(e) => mode === 'random' ? setRandomForm(prev => ({ ...prev, title: e.target.value })) : setManualForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Title" className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
            {mode === 'random' ? <input type="number" min={1} value={randomForm.numberOfGroups} onChange={(e) => setRandomForm(prev => ({ ...prev, numberOfGroups: e.target.value }))} placeholder="How many groups" className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" required /> : <div className="rounded-xl border border-dashed border-stone-200 px-4 py-3 text-sm text-stone-500">Manual mode uses your selected members directly.</div>}
            <input value={mode === 'random' ? randomForm.task : manualForm.task} onChange={(e) => mode === 'random' ? setRandomForm(prev => ({ ...prev, task: e.target.value })) : setManualForm(prev => ({ ...prev, task: e.target.value }))} placeholder="Task" className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400 sm:col-span-2" />
            <input type="date" value={mode === 'random' ? randomForm.deadline : manualForm.deadline} onChange={(e) => mode === 'random' ? setRandomForm(prev => ({ ...prev, deadline: e.target.value })) : setManualForm(prev => ({ ...prev, deadline: e.target.value }))} className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
            <textarea value={mode === 'random' ? randomForm.description : manualForm.description} onChange={(e) => mode === 'random' ? setRandomForm(prev => ({ ...prev, description: e.target.value })) : setManualForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Description or notes" rows={3} className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400 sm:col-span-2" />
          </div>

          <button type="submit" className="w-full rounded-xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-900">{mode === 'random' ? 'Create randomized groups' : 'Create manual group'}</button>
        </form>

        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">{mode === 'manual' ? 'Add Members' : 'Member search'}</h4>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={mode === 'manual' ? 'Search classmates to add' : 'Search classmates'} className="mt-3 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
            {mode === 'manual' && (
              <p className="mt-2 text-xs text-stone-500">Autosuggest always shows at least 3 classmates here so you can add members quickly.</p>
            )}
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">
              {(mode === 'manual' ? manualSuggestions : filteredClassmates).map(member => (
                <div key={member.idNumber} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{member.name}</p>
                      <p className="text-xs text-stone-500">{member.username ? `@${member.username}` : member.idNumber}</p>
                    </div>
                    <div className="flex gap-2">
                      {mode === 'manual' ? (
                        <>
                          <button type="button" onClick={() => addManualMember(member)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selectedMembers.some(item => item.idNumber === member.idNumber) ? 'bg-stone-800 text-white' : 'border border-stone-200 text-stone-700 hover:bg-stone-50'}`}>{selectedMembers.some(item => item.idNumber === member.idNumber) ? 'Added' : 'Add member'}</button>
                          <button type="button" onClick={() => assignManualLeader(member)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selectedLeaders.some(item => item.idNumber === member.idNumber) ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{selectedLeaders.some(item => item.idNumber === member.idNumber) ? 'Leader' : 'Assign leader'}</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => toggleSelection(member, 'member')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selectedMembers.some(item => item.idNumber === member.idNumber) ? 'bg-stone-800 text-white' : 'border border-stone-200 text-stone-700 hover:bg-stone-50'}`}>{selectedMembers.some(item => item.idNumber === member.idNumber) ? 'Selected' : 'Member'}</button>
                          <button type="button" onClick={() => toggleSelection(member, 'leader')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selectedLeaders.some(item => item.idNumber === member.idNumber) ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>{selectedLeaders.some(item => item.idNumber === member.idNumber) ? 'Leader' : 'Set leader'}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Selection</h4>
            <div className="mt-3 space-y-3 text-sm text-stone-700">
              <div>
                <p className="font-medium text-stone-800">Members</p>
                <p className="mt-1 text-stone-500">{selectedMembers.length === 0 ? (mode === 'random' ? `Using all ${classmates.length} classmates by default.` : 'Use the search results to add members into the group.') : `${selectedMembers.length} selected`}</p>
                {mode === 'manual' && selectedMembers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMembers.map(member => (
                      <button key={member.idNumber} type="button" onClick={() => removeSelectedMember(member.idNumber)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${selectedLeaders.some(item => item.idNumber === member.idNumber) ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>
                        {member.name}{selectedLeaders.some(item => item.idNumber === member.idNumber) ? ' • Leader' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-stone-800">{mode === 'manual' ? 'Assigned leader' : 'Team leaders'}</p>
                <p className="mt-1 text-stone-500">{selectedLeaders.length === 0 ? (mode === 'manual' ? 'Assign a leader from the search results.' : 'Optional.') : `${selectedLeaders.length} selected`}</p>
              </div>
              {!!lastCreated.length && (
                <div>
                  <p className="font-medium text-stone-800">Last created</p>
                  <div className="mt-2 space-y-2">
                    {lastCreated.map(group => (
                      <div key={group.groupId} className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                        <p className="font-semibold text-stone-800">{group.groupName}</p>
                        <p className="mt-1">Members: {group.memberIds.length}</p>
                        <p>Leaders: {group.teamLeaderIds.length}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={resetSelections} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                <Icon name="refresh" className="text-sm" /> Reset selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


