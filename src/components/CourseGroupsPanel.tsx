import React, { useEffect, useMemo, useState } from 'react';
import DriveImage from './DriveImage';
import CustomDropdown from './ui/CustomDropdown';

type ToastType = 'info' | 'success' | 'error' | 'loading';

type UserLite = {
  idNumber: string;
  fullName?: string;
  role?: string;
  position?: string;
  sessionToken?: string;
};

type SearchMember = {
  idNumber: string;
  name: string;
  username?: string;
  profilePicture?: string;
  role?: string;
  position?: string;
  currentGroupId?: string;
  currentGroupName?: string;
  canAddDirectly?: boolean;
};

type ClassmateLite = {
  idNumber: string;
  name: string;
  username?: string;
  profilePicture?: string;
  role?: string;
  position?: string;
};

type GroupSummary = {
  groupId: string;
  courseCode: string;
  groupName: string;
  task?: string;
  deadline?: string;
  description?: string;
  isPermanent?: boolean;
  teamLeaderIds: string[];
  memberCount: number;
  members: Array<{ memberId: string; memberName: string }>;
};

type GroupRequest = {
  requestId: string;
  requestType: string;
  groupId: string;
  sourceGroupId?: string;
  targetMemberId: string;
  targetMemberName: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  reason?: string;
};

type GroupDetail = {
  group: {
    groupId: string;
    courseCode: string;
    groupName: string;
    task?: string;
    deadline?: string;
    description?: string;
    isPermanent?: boolean;
    teamLeaderIds: string[];
  };
  viewer: UserLite;
  canManage: boolean;
  currentGroupId: string;
  members: Array<{
    memberId: string;
    memberName: string;
    username?: string;
    profilePictureURL?: string;
    role?: string;
    position?: string;
    isTeamLeader?: boolean;
  }>;
  otherGroups: Array<{
    groupId: string;
    groupName: string;
    task?: string;
    deadline?: string;
    isPermanent?: boolean;
    memberCount: number;
  }>;
  pendingRequests: GroupRequest[];
  assignments: Array<{
    assignmentId: string;
    title: string;
    description?: string;
    deadline?: string;
    assignedToMemberId?: string;
    assignedToMemberName?: string;
    status?: string;
  }>;
};

type Props = {
  gasUrl: string;
  user: UserLite | null;
  courseCode: string;
  courseName?: string;
  classmates?: ClassmateLite[];
  darkMode?: boolean;
  addToast: (message: string, type: ToastType, progress?: number) => number;
  updateToast?: (id: number, message: string, type: ToastType, progress?: number) => void;
  removeToast?: (id: number) => void;
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>;
}

function formatDate(value?: string) {
  if (!value) return 'No deadline';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function canDisband(user: UserLite | null) {
  const role = String(user?.role || '').toLowerCase();
  const position = String(user?.position || '').toLowerCase();
  return role === 'admin' || role === 'superadmin' || ['mayor', 'vice mayor', 'secretary'].includes(position);
}

function inputClass(darkMode: boolean) {
  return `w-full rounded-xl border px-3 py-2 text-sm shadow-sm outline-none transition ${
    darkMode
      ? 'border-gray-700 bg-gray-900 text-gray-100 placeholder:text-gray-500 focus:border-cyan-500'
      : 'border-stone-200 bg-white text-stone-800 placeholder:text-stone-400 focus:border-stone-400'
  }`;
}

function Skeleton({ className = '', darkMode = false }: { className?: string; darkMode?: boolean }) {
  return <div className={`rounded-lg skeleton-shimmer ${darkMode ? 'brightness-75' : ''} ${className}`} />;
}

function Avatar({
  name,
  image,
  className = '',
  iconClassName = ''
}: {
  name: string;
  image?: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-full bg-stone-200 ${className}`}>
      {image ? (
        <DriveImage src={image} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-stone-500">
          <Icon name="person" className={iconClassName} />
        </div>
      )}
    </div>
  );
}

function MemberChip({ member, onRemove, darkMode }: { member: SearchMember; onRemove?: (id: string) => void; darkMode?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-stone-100 text-stone-700'}`}>
      <span>{member.name}</span>
      {onRemove && (
        <button type="button" onClick={() => onRemove(member.idNumber)} className="leading-none opacity-70 hover:opacity-100">
          <Icon name="close" className="text-sm" />
        </button>
      )}
    </div>
  );
}

export default function CourseGroupsPanel({ gasUrl, user, courseCode, courseName, classmates = [], darkMode = false, addToast, updateToast, removeToast }: Props) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [requests, setRequests] = useState<GroupRequest[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<SearchMember[]>([]);
  const [selectedLeaders, setSelectedLeaders] = useState<SearchMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchMember[]>([]);
  const [createForm, setCreateForm] = useState({ groupName: '', task: '', deadline: '', description: '', isPermanent: false });
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', deadline: '', assignedToMemberId: '' });
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const isLoggedIn = Boolean(user?.idNumber && user?.sessionToken);
  const canManageSelected = Boolean(selectedGroup?.canManage);
  const dropdownClass = `flex w-full items-center gap-3 text-left ${inputClass(darkMode)}`;
  const classmateLookup = useMemo(() => {
    const lookup = new Map<string, ClassmateLite>();
    classmates.forEach((member) => {
      lookup.set(String(member.idNumber), member);
    });
    return lookup;
  }, [classmates]);

  const getProfilePicture = (memberId?: string, fallback?: string) => {
    const directoryPicture = memberId ? classmateLookup.get(String(memberId))?.profilePicture : undefined;
    return directoryPicture || fallback;
  };

  const postAction = async (payload: Record<string, unknown>) => {
    const response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.json();
  };

  const loadGroups = async (focusGroupId?: string) => {
    if (!isLoggedIn || !courseCode) {
      setGroups([]);
      setRequests([]);
      setCurrentGroupId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await postAction({ action: 'getCourseGroups', userId: user?.idNumber, sessionToken: user?.sessionToken, courseCode });
      if (!result.success) throw new Error(result.error || 'Failed to load groups');
      setGroups(result.groups || []);
      setRequests(result.requests || []);
      setCurrentGroupId(result.currentGroupId || '');
      const nextGroupId = focusGroupId || selectedGroupId || result.currentGroupId || result.groups?.[0]?.groupId || '';
      setSelectedGroupId(nextGroupId);
    } catch (error: any) {
      addToast(error.message || 'Failed to load groups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async (groupId: string) => {
    if (!groupId || !isLoggedIn) {
      setSelectedGroup(null);
      return;
    }

    setDetailLoading(true);
    try {
      const result = await postAction({ action: 'getCourseGroupDetails', userId: user?.idNumber, sessionToken: user?.sessionToken, groupId });
      if (!result.success) throw new Error(result.error || 'Failed to load group details');
      setSelectedGroup(result as GroupDetail);
    } catch (error: any) {
      addToast(error.message || 'Failed to load group details', 'error');
      setSelectedGroup(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, [courseCode, user?.idNumber, user?.sessionToken]);

  useEffect(() => {
    if (selectedGroupId) {
      void loadGroupDetails(selectedGroupId);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (!memberQuery.trim() || !isLoggedIn) {
      setMemberResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const result = await postAction({
          action: 'searchCourseGroupMembers',
          userId: user?.idNumber,
          sessionToken: user?.sessionToken,
          courseCode,
          query: memberQuery.trim()
        });
        if (result.success) {
          setMemberResults(result.members || []);
        }
      } catch {
        setMemberResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [memberQuery, courseCode, user?.idNumber, user?.sessionToken]);

  useEffect(() => {
    if (!selectedGroupId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedGroupId('');
        setSelectedGroup(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setAddMemberOpen(false);
      setMemberQuery('');
    }
  }, [selectedGroupId]);

  const localMemberResults = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    const pool = classmates.filter((member) => member.idNumber !== user?.idNumber);

    const mapped = pool.map<SearchMember>((member) => ({
      idNumber: member.idNumber,
      name: member.name,
      username: member.username,
      profilePicture: member.profilePicture,
      role: member.role,
      position: member.position
    }));

    if (!query) {
      return mapped.slice(0, 6);
    }

    return mapped.filter((member) => (
      String(member.name || '').toLowerCase().includes(query) ||
      String(member.username || '').toLowerCase().includes(query) ||
      String(member.idNumber || '').toLowerCase().includes(query)
    )).slice(0, 12);
  }, [classmates, memberQuery, user?.idNumber]);

  const combinedMemberResults = useMemo(() => {
    const lookup = new Map<string, SearchMember>();

    localMemberResults.forEach((member) => {
      lookup.set(member.idNumber, member);
    });

    memberResults.forEach((member) => {
      const existing = lookup.get(member.idNumber);
      lookup.set(member.idNumber, {
        ...existing,
        ...member,
        name: member.name || existing?.name || '',
        username: member.username || existing?.username,
        profilePicture: member.profilePicture || existing?.profilePicture,
        role: member.role || existing?.role,
        position: member.position || existing?.position
      });
    });

    return Array.from(lookup.values());
  }, [localMemberResults, memberResults]);

  const availableMemberResults = useMemo(() => {
    const taken = new Set([...selectedMembers, ...selectedLeaders].map(item => item.idNumber));
    return combinedMemberResults.filter(item => !taken.has(item.idNumber));
  }, [combinedMemberResults, selectedMembers, selectedLeaders]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) return;
    const toastId = addToast('Creating group...', 'loading');
    try {
      const result = await postAction({
        action: 'createCourseGroup',
        userId: user?.idNumber,
        sessionToken: user?.sessionToken,
        courseCode,
        groupName: createForm.groupName,
        task: createForm.task,
        deadline: createForm.deadline,
        description: createForm.description,
        isPermanent: createForm.isPermanent,
        teamLeaderIds: selectedLeaders.map(item => item.idNumber),
        memberIds: selectedMembers.map(item => item.idNumber)
      });
      if (!result.success) throw new Error(result.error || 'Failed to create group');
      updateToast?.(toastId, 'Group created', 'success');
      window.setTimeout(() => removeToast?.(toastId), 2500);
      setCreateOpen(false);
      setCreateForm({ groupName: '', task: '', deadline: '', description: '', isPermanent: false });
      setSelectedLeaders([]);
      setSelectedMembers([]);
      setMemberQuery('');
      await loadGroups(result.groupId);
    } catch (error: any) {
      updateToast?.(toastId, error.message || 'Failed to create group', 'error');
    }
  };

  const handleAddMember = async (memberId: string) => {
    if (!selectedGroup || !isLoggedIn) return;
    const result = await postAction({ action: 'addCourseGroupMember', userId: user?.idNumber, sessionToken: user?.sessionToken, groupId: selectedGroup.group.groupId, memberId });
    if (!result.success) {
      addToast(result.error || 'Failed to add member', 'error');
      return;
    }
    addToast(result.message || 'Member update sent', 'success');
    setMemberQuery('');
    setAddMemberOpen(false);
    await loadGroups(selectedGroup.group.groupId);
    await loadGroupDetails(selectedGroup.group.groupId);
  };

  const handleLeave = async () => {
    if (!selectedGroup || !isLoggedIn) return;
    const result = await postAction({ action: 'requestLeaveCourseGroup', userId: user?.idNumber, sessionToken: user?.sessionToken, groupId: selectedGroup.group.groupId });
    if (!result.success) {
      addToast(result.error || 'Failed to request leave', 'error');
      return;
    }
    addToast(result.message || 'Leave request submitted', 'success');
    await loadGroups(selectedGroup.group.groupId);
    await loadGroupDetails(selectedGroup.group.groupId);
  };

  const handleReview = async (requestId: string, decision: 'approve' | 'reject') => {
    if (!isLoggedIn || !selectedGroup) return;
    const result = await postAction({ action: 'reviewCourseGroupRequest', userId: user?.idNumber, sessionToken: user?.sessionToken, requestId, decision });
    if (!result.success) {
      addToast(result.error || 'Failed to review request', 'error');
      return;
    }
    addToast(result.message || 'Request updated', 'success');
    await loadGroups(selectedGroup.group.groupId);
    await loadGroupDetails(selectedGroup.group.groupId);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroup || !isLoggedIn) return;
    const result = await postAction({ action: 'removeCourseGroupMember', userId: user?.idNumber, sessionToken: user?.sessionToken, groupId: selectedGroup.group.groupId, memberId });
    if (!result.success) {
      addToast(result.error || 'Failed to remove member', 'error');
      return;
    }
    addToast('Member removed', 'success');
    await loadGroups(selectedGroup.group.groupId);
    await loadGroupDetails(selectedGroup.group.groupId);
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !isLoggedIn) return;
    const result = await postAction({ action: 'assignCourseGroupTask', userId: user?.idNumber, sessionToken: user?.sessionToken, groupId: selectedGroup.group.groupId, ...assignmentForm });
    if (!result.success) {
      addToast(result.error || 'Failed to assign task', 'error');
      return;
    }
    addToast('Task assigned', 'success');
    setAssignmentForm({ title: '', description: '', deadline: '', assignedToMemberId: '' });
    await loadGroupDetails(selectedGroup.group.groupId);
  };

  const handleDisband = async () => {
    if (!selectedGroup || !isLoggedIn) return;
    const result = await postAction({ action: 'disbandCourseGroup', userId: user?.idNumber, sessionToken: user?.sessionToken, groupId: selectedGroup.group.groupId });
    if (!result.success) {
      addToast(result.error || 'Failed to disband group', 'error');
      return;
    }
    addToast('Group disbanded', 'success');
    setSelectedGroup(null);
    setSelectedGroupId('');
    setAddMemberOpen(false);
    await loadGroups();
  };

  if (!isLoggedIn) {
    return <div className={`rounded-2xl border p-6 text-sm ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-stone-200 text-stone-600'}`}>Log in to manage and join course groups.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Course Groups</p>
          <h3 className="mt-1 text-lg font-semibold text-stone-800">{courseCode}</h3>
          {courseName && <p className="mt-1 text-sm text-stone-500">{courseName}</p>}
          <p className="mt-1 text-sm text-stone-500">{groups.length} active group{groups.length === 1 ? '' : 's'}</p>
          <p className="mt-1 text-sm text-stone-500">Create, inspect, transfer, and manage course-specific teams.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadGroups(selectedGroupId)} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
            Refresh
          </button>
          <button onClick={() => setCreateOpen(prev => !prev)} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-900">
            {createOpen ? 'Close Creator' : 'Create Group'}
          </button>
        </div>
      </div>

      {createOpen && (
        <form onSubmit={handleCreateGroup} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={createForm.groupName} onChange={(e) => setCreateForm(prev => ({ ...prev, groupName: e.target.value }))} placeholder="Group name" className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" required />
            <input value={createForm.task} onChange={(e) => setCreateForm(prev => ({ ...prev, task: e.target.value }))} placeholder="Task" className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
            <input type="date" value={createForm.deadline} onChange={(e) => setCreateForm(prev => ({ ...prev, deadline: e.target.value }))} className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
            <textarea value={createForm.description} onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Group description" className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400 sm:col-span-2" rows={3} />
            <label className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={createForm.isPermanent}
                onChange={(e) => setCreateForm(prev => ({ ...prev, isPermanent: e.target.checked }))}
                className="h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-400"
              />
              <span>Permanent grouping</span>
              <span className="text-xs text-stone-500">Optional</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Search members or leaders</label>
            <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search by name, username, or ID" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
            {availableMemberResults.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-stone-200 p-2">
                {availableMemberResults.map(member => (
                  <div key={member.idNumber} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-stone-50">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={member.name}
                        image={getProfilePicture(member.idNumber, member.profilePicture)}
                        className="h-10 w-10"
                        iconClassName="text-base"
                      />
                      <div>
                        <p className="text-sm font-medium text-stone-800">{member.name}</p>
                        <p className="text-xs text-stone-500">{member.username ? `@${member.username}` : member.idNumber}{member.currentGroupName ? ` • ${member.currentGroupName}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedMembers(prev => [...prev, member])} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">Add Member</button>
                      <button type="button" onClick={() => setSelectedLeaders(prev => [...prev, member])} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200">Leader</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {availableMemberResults.length === 0 && (
              <p className="text-xs text-stone-500">
                {memberQuery.trim() ? 'No matching classmates found.' : 'Start typing or pick from your class roster suggestions.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-700">Team leaders</p>
            <div className="flex flex-wrap gap-2">{selectedLeaders.length > 0 ? selectedLeaders.map(member => <MemberChip key={`leader-${member.idNumber}`} member={member} onRemove={(id) => setSelectedLeaders(prev => prev.filter(item => item.idNumber !== id))} />) : <span className="text-sm text-stone-400">Optional</span>}</div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-700">Extra members</p>
            <div className="flex flex-wrap gap-2">{selectedMembers.length > 0 ? selectedMembers.map(member => <MemberChip key={`member-${member.idNumber}`} member={member} onRemove={(id) => setSelectedMembers(prev => prev.filter(item => item.idNumber !== id))} />) : <span className="text-sm text-stone-400">You will be added automatically</span>}</div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="rounded-xl bg-stone-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-900">Create course group</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`group-skeleton-${index}`} className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton darkMode={darkMode} className="h-7 w-32 rounded-full" />
                    <Skeleton darkMode={darkMode} className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton darkMode={darkMode} className="mt-3 h-4 w-24" />
                  <Skeleton darkMode={darkMode} className="mt-4 h-4 w-48" />
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <Skeleton darkMode={darkMode} className="h-10 w-10 rounded-full border-2 border-white" />
                      <Skeleton darkMode={darkMode} className="h-10 w-10 rounded-full border-2 border-white" />
                      <Skeleton darkMode={darkMode} className="h-10 w-10 rounded-full border-2 border-white" />
                    </div>
                    <Skeleton darkMode={darkMode} className="h-4 w-24" />
                  </div>
                </div>
                <div className="w-24">
                  <Skeleton darkMode={darkMode} className="h-3 w-10" />
                  <Skeleton darkMode={darkMode} className="mt-2 h-5 w-20" />
                </div>
              </div>
            </div>
          ))
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">No groups yet for this course. Create one to start grouping your class.</div>
        ) : groups.map(group => {
          const isCurrent = currentGroupId === group.groupId;
          const isSelected = selectedGroupId === group.groupId;
          const previewMembers = group.members.slice(0, 4);
          const extraMembers = Math.max(group.memberCount - previewMembers.length, 0);
          return (
            <button key={group.groupId} onClick={() => setSelectedGroupId(group.groupId)} className={`w-full rounded-[28px] border p-5 text-left transition-all ${isSelected ? 'border-stone-800 bg-stone-50 shadow-lg shadow-stone-200/50' : 'border-stone-200 bg-white hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-stone-800">{group.groupName}</h4>
                    {isCurrent && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Your group</span>}
                    {group.isPermanent && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Permanent</span>}
                  </div>
                  <p className="mt-2 text-sm text-stone-500">{group.memberCount} member{group.memberCount === 1 ? '' : 's'}</p>
                  <p className="mt-3 text-sm text-stone-700">{group.task || 'No task set'}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {previewMembers.map((member) => (
                        <Avatar
                          key={`${group.groupId}-${member.memberId}`}
                          name={member.memberName}
                          image={getProfilePicture(member.memberId)}
                          className="h-10 w-10 border-2 border-white shadow-sm"
                          iconClassName="text-base"
                        />
                      ))}
                      {extraMembers > 0 && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-stone-800 text-xs font-semibold text-white shadow-sm">
                          +{extraMembers}
                        </div>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-stone-400">Tap to open details</span>
                  </div>
                </div>
                <div className="text-right text-xs text-stone-500">
                  <p>Due</p>
                  <p className="mt-1 font-medium text-stone-700">{formatDate(group.deadline)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedGroupId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 p-3 sm:p-6"
          onClick={() => {
            setSelectedGroupId('');
            setSelectedGroup(null);
          }}
        >
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Group Panel</p>
                <p className="mt-1 text-sm text-stone-500">Inspect members, assignments, and requests in one place.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId('');
                  setSelectedGroup(null);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 text-stone-600 transition hover:bg-stone-100"
                aria-label="Close group panel"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            {detailLoading || !selectedGroup ? (
              <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-4 sm:p-6">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-stone-200 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Skeleton darkMode={darkMode} className="h-8 w-40 rounded-full" />
                          <Skeleton darkMode={darkMode} className="h-6 w-24 rounded-full" />
                        </div>
                        <Skeleton darkMode={darkMode} className="mt-3 h-4 w-24" />
                        <Skeleton darkMode={darkMode} className="mt-4 h-4 w-56" />
                        <Skeleton darkMode={darkMode} className="mt-2 h-4 w-36" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton darkMode={darkMode} className="h-11 w-32 rounded-xl" />
                        <Skeleton darkMode={darkMode} className="h-11 w-28 rounded-xl" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-stone-200 p-4">
                        <Skeleton darkMode={darkMode} className="h-4 w-24" />
                        <div className="mt-4 space-y-3">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <div key={`member-skeleton-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 px-3 py-3">
                              <div className="flex items-center gap-3">
                                <Skeleton darkMode={darkMode} className="h-12 w-12 rounded-full" />
                                <div>
                                  <Skeleton darkMode={darkMode} className="h-4 w-40" />
                                  <Skeleton darkMode={darkMode} className="mt-2 h-3 w-24" />
                                </div>
                              </div>
                              <Skeleton darkMode={darkMode} className="h-9 w-20 rounded-xl" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-stone-200 p-4">
                        <Skeleton darkMode={darkMode} className="h-4 w-28" />
                        <div className="mt-4 space-y-3">
                          <Skeleton darkMode={darkMode} className="h-24 w-full rounded-2xl" />
                          <Skeleton darkMode={darkMode} className="h-24 w-full rounded-2xl" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Skeleton darkMode={darkMode} className="h-48 w-full rounded-[28px]" />
                      <Skeleton darkMode={darkMode} className="h-44 w-full rounded-[28px]" />
                      <Skeleton darkMode={darkMode} className="h-36 w-full rounded-[28px]" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-4 sm:p-6">
                <div className="space-y-4 rounded-2xl">
                  <div className="flex flex-col gap-3 rounded-[28px] border border-stone-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold text-stone-800">{selectedGroup.group.groupName}</h3>
                        {selectedGroup.currentGroupId === selectedGroup.group.groupId && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Current group</span>}
                        {selectedGroup.group.isPermanent && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Permanent</span>}
                      </div>
                      <p className="mt-1 text-sm text-stone-500">{selectedGroup.group.courseCode}</p>
                      <p className="mt-3 text-sm text-stone-700">{selectedGroup.group.task || 'No task yet.'}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-400">Deadline</p>
                      <p className="text-sm font-medium text-stone-700">{formatDate(selectedGroup.group.deadline)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedGroup.currentGroupId === selectedGroup.group.groupId && (
                        <button onClick={handleLeave} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Request leave</button>
                      )}
                      {canManageSelected && canDisband(user) && (
                        <button onClick={handleDisband} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Disband</button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-[28px] border border-stone-200 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Members</h4>
                        <div className="mt-3 space-y-2">
                          {selectedGroup.members.map(member => (
                            <div key={member.memberId} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${selectedGroup.currentGroupId === selectedGroup.group.groupId && user?.idNumber === member.memberId ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}>
                              <div className="flex items-center gap-3">
                                <Avatar
                                  name={member.memberName}
                                  image={getProfilePicture(member.memberId, member.profilePictureURL)}
                                  className="h-10 w-10"
                                  iconClassName="text-base"
                                />
                                <div>
                                  <p className="text-sm font-medium text-stone-800">{member.memberName}</p>
                                  <p className="text-xs text-stone-500">{member.username ? `@${member.username}` : member.memberId}{member.isTeamLeader ? ' • Team leader' : ''}</p>
                                </div>
                              </div>
                              {canManageSelected && user?.idNumber !== member.memberId && (
                                <button onClick={() => void handleRemoveMember(member.memberId)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-red-50 hover:text-red-600">Remove</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {selectedGroup.otherGroups.length > 0 && (
                        <div className="rounded-[28px] border border-stone-200 p-4">
                          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Other groups</h4>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedGroup.otherGroups.map(group => (
                              <button key={group.groupId} onClick={() => setSelectedGroupId(group.groupId)} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">{group.groupName}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-[28px] border border-stone-200 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Assignments</h4>
                        <div className="mt-3 space-y-2">
                          {selectedGroup.assignments.length === 0 ? <p className="text-sm text-stone-500">No group tasking yet.</p> : selectedGroup.assignments.map(item => (
                            <div key={item.assignmentId} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-stone-800">{item.title}</p>
                                  <p className="mt-1 text-sm text-stone-600">{item.description || 'No description'}</p>
                                </div>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{item.assignedToMemberName || 'Whole group'}</span>
                              </div>
                              <p className="mt-2 text-xs text-stone-500">Deadline: {formatDate(item.deadline)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {canManageSelected && (
                        <>
                          <div className="rounded-[28px] border border-stone-200 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-stone-800">Add member</h4>
                                <p className="mt-1 text-xs text-stone-500">Open the directory picker only when needed.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAddMemberOpen((prev) => !prev)}
                                className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                              >
                                {addMemberOpen ? 'Hide directory' : 'Open directory'}
                              </button>
                            </div>
                            {addMemberOpen && (
                              <div className="mt-3 space-y-2">
                                <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search class member" className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" />
                                {availableMemberResults.slice(0, 5).map(member => (
                                  <div key={`quick-${member.idNumber}`} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                                    <div className="flex items-center gap-3">
                                      <Avatar
                                        name={member.name}
                                        image={getProfilePicture(member.idNumber, member.profilePicture)}
                                        className="h-10 w-10"
                                        iconClassName="text-base"
                                      />
                                      <div>
                                        <p className="text-sm font-medium text-stone-800">{member.name}</p>
                                        <p className="text-xs text-stone-500">{member.currentGroupName || 'No current group'}</p>
                                      </div>
                                    </div>
                                    <button onClick={() => void handleAddMember(member.idNumber)} className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900">Add</button>
                                  </div>
                                ))}
                                {availableMemberResults.length === 0 && <p className="text-xs text-stone-500">Search the class directory to find members to add.</p>}
                              </div>
                            )}
                          </div>

                          <form onSubmit={handleAssignTask} className="rounded-[28px] border border-stone-200 p-4">
                            <h4 className="text-sm font-semibold text-stone-800">Assign tasking</h4>
                            <div className="mt-3 space-y-2">
                              <input value={assignmentForm.title} onChange={(e) => setAssignmentForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Task title" className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" required />
                              <textarea value={assignmentForm.description} onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Task description" className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" rows={3} />
                              <input type="date" value={assignmentForm.deadline} onChange={(e) => setAssignmentForm(prev => ({ ...prev, deadline: e.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400" />
                              <CustomDropdown
                                name="course-group-assignee"
                                value={assignmentForm.assignedToMemberId}
                                onChange={(value) => setAssignmentForm(prev => ({ ...prev, assignedToMemberId: value }))}
                                options={[{ value: '', label: 'Whole group' }, ...selectedGroup.members.map((member) => ({ value: member.memberId, label: member.memberName }))]}
                                className={dropdownClass}
                              />
                              <button type="submit" className="w-full rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900">Assign task</button>
                            </div>
                          </form>
                        </>
                      )}

                      <div className="rounded-[28px] border border-stone-200 p-4">
                        <h4 className="text-sm font-semibold text-stone-800">Pending requests</h4>
                        <div className="mt-3 space-y-2">
                          {selectedGroup.pendingRequests.length === 0 ? <p className="text-sm text-stone-500">No pending leave or transfer requests.</p> : selectedGroup.pendingRequests.map(request => (
                            <div key={request.requestId} className="rounded-xl bg-stone-50 p-3">
                              <p className="text-sm font-medium text-stone-800">{request.targetMemberName}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">{request.requestType}</p>
                              <p className="mt-1 text-sm text-stone-600">{request.reason || 'No reason provided'}</p>
                              {canManageSelected && (
                                <div className="mt-3 flex gap-2">
                                  <button onClick={() => void handleReview(request.requestId, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Approve</button>
                                  <button onClick={() => void handleReview(request.requestId, 'reject')} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">Reject</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Your pending requests</h4>
          <div className="mt-3 space-y-2">
            {requests.map(request => (
              <div key={request.requestId} className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
                {request.requestType} request for <span className="font-medium">{request.targetMemberName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




