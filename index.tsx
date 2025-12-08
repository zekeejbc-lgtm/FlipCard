import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import Dexie from 'dexie';

// --- Types ---

type Card = {
  id: string;
  q: string;
  a: string;
};

type Deck = {
  name: string;        // Display name from C1
  sheetName?: string;  // Original sheet name (F-xxx)
  subject?: string;    // Subject category from D1 (FL111, FL112, etc.)
  cards: Card[];
};

type Resource = {
  id?: string;
  name: string;
  title?: string;
  description?: string;
  category: 'Video' | 'Image' | 'Files' | 'Lesson PPT' | 'Lesson PDF' | 'Reviewer' | string;
  url: string;
  submittedBy?: string;
  submittedByName?: string;
  timestamp?: string;
};

type CategoryItem = {
  name: string;
  category: string;
};

type User = {
  idNumber: string;
  name: string;
  record: Record<string, any>;
};

type Toast = {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'loading';
  progress?: number;
};

type AppView = 'HOME' | 'SUBJECT' | 'DECK_OVERVIEW' | 'PLAY' | 'SUMMARY' | 'RESOURCE_VIEW' | 'ANALYTICS' | 'EXAMS' | 'ALL_RESOURCES';

type DeckProgress = {
  deckName: string;
  cardStatuses: Record<string, 'correct' | 'incorrect' | 'unanswered'>;
  currentIndex: number;
  mode: 'shuffle' | 'chronological';
  shuffledOrder?: string[]; // Card IDs in shuffled order
  lastUpdated: number | string;
};

type Subject = {
  code: string;
  name: string;
};

type Exam = {
  examId: string;
  courseCode: string;
  courseName: string;
  examType: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  proctor: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: 'upcoming' | 'ongoing' | 'done';
};

type SubjectInfo = {
  code: string;
  name: string;
};

// --- Constants ---

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxnlS12um9vSaZqrC4oS6MZbl0AVAZyop3G9Qd2uAZmtj1VMP6ZiP0APtd-mFYBGpA/exec';
const STORAGE_KEY_USER = 'flashmaster_user';
const STORAGE_KEY_STATE = 'flashcard_session_state';

// --- Database ---

const db = new Dexie('FlashMasterDB') as Dexie & {
  decks: Dexie.Table<Deck, string>;
  categories: Dexie.Table<{ subject: string; items: CategoryItem[] }, string>;
  resources: Dexie.Table<{ subject: string; items: Resource[] }, string>;
};

db.version(2).stores({
  decks: 'name',
  categories: 'subject',
  resources: 'subject'
});

// Progress storage key prefix
const PROGRESS_KEY_PREFIX = 'flashmaster_deck_progress_';

// --- Components ---

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>
);

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`p-4 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'loading' ? 'bg-stone-800 text-white' :
            'bg-white text-stone-800 border border-stone-200'
          }`}
        >
          {toast.type === 'loading' && (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {toast.type === 'success' && <Icon name="check_circle" />}
          {toast.type === 'error' && <Icon name="error" />}
          {toast.type === 'info' && <Icon name="info" />}
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.message}</p>
            {toast.progress !== undefined && (
              <div className="mt-2 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${toast.progress}%` }}
                />
              </div>
            )}
          </div>
          {toast.type !== 'loading' && (
            <button onClick={() => removeToast(toast.id)} className="p-1 hover:opacity-70">
              <Icon name="close" className="text-sm" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Upload Modal Component
const UploadModal = ({ 
  isOpen, 
  onClose, 
  subject,
  user,
  onUploadComplete,
  addToast,
  updateToast,
  removeToast
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  subject: string;
  user: User | null;
  onUploadComplete: () => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
}) => {
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Lesson PPT' | 'Lesson PDF' | 'Video' | 'Reviewer'>('Lesson PDF');
  const [files, setFiles] = useState<File[]>([]);
  const [driveLink, setDriveLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 35 * 1024 * 1024; // 35MB limit for base64 upload

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const oversizedFiles = selectedFiles.filter(f => f.size > MAX_FILE_SIZE);
    
    if (oversizedFiles.length > 0) {
      setError(`File "${oversizedFiles[0].name}" exceeds 35MB limit. Use "Paste Link" for larger files.`);
      return;
    }
    
    setFiles(selectedFiles);
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const validateDriveLink = (url: string): boolean => {
    const patterns = [
      /drive\.google\.com/,
      /docs\.google\.com/,
      /youtube\.com/,
      /youtu\.be/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFiles([]);
    setDriveLink('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (mode === 'upload' && files.length === 0) {
      setError('Please select at least one file');
      return;
    }
    if (mode === 'link' && !driveLink.trim()) {
      setError('Please enter a link');
      return;
    }
    if (mode === 'link' && !validateDriveLink(driveLink)) {
      setError('Please enter a valid Google Drive or YouTube link');
      return;
    }
    if (!user) {
      setError('Please login first');
      return;
    }

    setUploading(true);
    setError('');

    if (mode === 'link') {
      // Direct link - just save to Resources sheet
      const toastId = addToast('Step 1/4: Validating link...', 'loading', 10);
      
      try {
        updateToast(toastId, 'Step 2/4: Connecting to server...', 'loading', 30);
        
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'addResourceByLink',
            title: title,
            description: description,
            subject: subject,
            category: category,
            link: driveLink,
            userId: user.idNumber,
            userName: user.name
          })
        });
        
        updateToast(toastId, 'Step 3/4: Processing response...', 'loading', 60);
        
        const result = await response.json();
        
        updateToast(toastId, 'Step 4/4: Finalizing...', 'loading', 90);
        
        if (result.success) {
          updateToast(toastId, '✓ Resource added successfully!', 'success', 100);
          setTimeout(() => removeToast(toastId), 3000);
          onUploadComplete();
          onClose();
          resetForm();
        } else {
          updateToast(toastId, `Error: ${result.error || 'Unknown error'}`, 'error');
          setTimeout(() => removeToast(toastId), 5000);
        }
      } catch (err: any) {
        updateToast(toastId, `Network error: ${err.message || 'Failed to connect'}`, 'error');
        setTimeout(() => removeToast(toastId), 5000);
      } finally {
        setUploading(false);
      }
    } else {
      // File upload
      const toastId = addToast('Step 1/6: Preparing upload...', 'loading', 5);
      
      try {
        let successCount = 0;
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileTitle = files.length > 1 ? `${title} (${i + 1})` : title;
          const fileNum = files.length > 1 ? ` [${i + 1}/${files.length}]` : '';
          
          updateToast(toastId, `Step 2/6: Reading file${fileNum}...`, 'loading', 15);
          
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 20) + 15;
                updateToast(toastId, `Step 2/6: Reading... ${formatFileSize(e.loaded)}/${formatFileSize(e.total)}`, 'loading', pct);
              }
            };
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
          
          updateToast(toastId, `Step 3/6: Connecting to server${fileNum}...`, 'loading', 40);
          
          const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'uploadResource',
              title: fileTitle,
              description: description,
              subject: subject,
              category: category,
              fileData: base64,
              fileName: file.name,
              mimeType: file.type,
              userId: user.idNumber,
              userName: user.name
            })
          });
          
          updateToast(toastId, `Step 4/6: Uploading to Google Drive${fileNum}...`, 'loading', 60);
          
          const result = await response.json();
          
          updateToast(toastId, `Step 5/6: Saving to database${fileNum}...`, 'loading', 80);
          
          if (result.success) {
            successCount++;
            updateToast(toastId, `Step 6/6: Verifying${fileNum}...`, 'loading', 95);
          } else {
            updateToast(toastId, `✗ Failed: ${result.error || 'Unknown error'}`, 'error');
            setTimeout(() => removeToast(toastId), 5000);
            setUploading(false);
            return;
          }
        }
        
        if (successCount === files.length) {
          updateToast(toastId, `✓ ${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully!`, 'success', 100);
          setTimeout(() => removeToast(toastId), 3000);
          onUploadComplete();
          onClose();
          resetForm();
        } else {
          updateToast(toastId, `Partial: ${successCount}/${files.length} uploaded`, 'info');
          setTimeout(() => removeToast(toastId), 5000);
        }
      } catch (err: any) {
        updateToast(toastId, `✗ Upload failed: ${err.message || 'Network error'}`, 'error');
        setTimeout(() => removeToast(toastId), 5000);
      } finally {
        setUploading(false);
      }
    }
  };

  if (!isOpen) return null;

  // Instructions Modal
  if (showInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-stone-800">How to Get a Link</h2>
            <button onClick={() => setShowInstructions(false)} className="text-stone-400 hover:text-stone-600">
              <Icon name="close" />
            </button>
          </div>
          
          <div className="space-y-4 text-sm">
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="font-semibold text-blue-800 mb-2">📁 Google Drive Files</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Go to <a href="https://drive.google.com" target="_blank" className="underline">drive.google.com</a></li>
                <li>Upload your file</li>
                <li>Right-click → Share</li>
                <li>Set to "Anyone with the link"</li>
                <li>Copy link and paste here</li>
              </ol>
            </div>
            
            <div className="bg-green-50 p-4 rounded-xl">
              <p className="font-semibold text-green-800 mb-2">🎥 YouTube Videos</p>
              <ol className="list-decimal list-inside space-y-1 text-green-700">
                <li>Go to the YouTube video</li>
                <li>Click Share → Copy link</li>
                <li>Paste here</li>
              </ol>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-xl">
              <p className="font-semibold text-amber-800 mb-2">⚠️ Important</p>
              <p className="text-amber-700">Make sure the file is set to "Anyone with the link can view"</p>
            </div>
          </div>
          
          <button onClick={() => setShowInstructions(false)} className="w-full mt-4 py-3 bg-stone-800 text-white rounded-xl font-semibold">
            Got it!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-stone-800">Add Resource</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" disabled={uploading}>
            <Icon name="close" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-4 p-1 bg-stone-100 rounded-xl">
          <button
            onClick={() => { setMode('upload'); setError(''); }}
            disabled={uploading}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              mode === 'upload' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
            }`}
          >
            <Icon name="cloud_upload" className="text-base" /> Upload
          </button>
          <button
            onClick={() => { setMode('link'); setError(''); }}
            disabled={uploading}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              mode === 'link' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
            }`}
          >
            <Icon name="link" className="text-base" /> Paste Link
          </button>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Title *</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource title" disabled={uploading}
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional" rows={2} disabled={uploading}
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none resize-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Subject</label>
            <input type="text" value={subject} readOnly className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-500" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Category *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Lesson PPT', 'Lesson PDF', 'Reviewer', 'Video'] as const).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} disabled={uploading}
                  className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${
                    category === cat ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >{cat}</button>
              ))}
            </div>
          </div>

          {/* Submitted By */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Submitted by</label>
            <input type="text" value={user ? `${user.name} (${user.idNumber})` : 'Login required'} readOnly 
              className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-500" />
          </div>

          {/* Upload Mode */}
          {mode === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">File * <span className="text-stone-400">(Max 35MB)</span></label>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" disabled={uploading} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="w-full p-4 border-2 border-dashed border-stone-300 rounded-xl text-stone-500 hover:border-stone-400 flex items-center justify-center gap-2"
              >
                <Icon name="cloud_upload" /> Select files
              </button>
              <p className="text-xs text-stone-400 mt-1">For larger files, use <button onClick={() => setMode('link')} className="text-blue-500 underline">Paste Link</button></p>
              
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg text-sm">
                      <Icon name="description" className="text-stone-400" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-stone-400">{formatFileSize(f.size)}</span>
                      <button onClick={() => removeFile(i)} disabled={uploading} className="text-stone-400 hover:text-red-500">
                        <Icon name="close" className="text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Link Mode */}
          {mode === 'link' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-stone-600">Link *</label>
                <button onClick={() => setShowInstructions(true)} className="text-xs text-blue-500 flex items-center gap-1">
                  <Icon name="help" className="text-sm" /> How?
                </button>
              </div>
              <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/..." disabled={uploading}
                className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
              />
              <p className="text-xs text-stone-400 mt-1">Google Drive, Docs, Sheets, Slides, or YouTube</p>
            </div>
          )}

          {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

          <button onClick={handleSubmit} disabled={uploading || !user}
            className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {mode === 'link' ? 'Saving...' : 'Uploading...'}</>
            ) : (
              <><Icon name={mode === 'link' ? 'add_link' : 'cloud_upload'} /> {mode === 'link' ? 'Add Resource' : 'Upload'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  confirmColor = 'red'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: 'red' | 'green' | 'stone';
}) => {
  if (!isOpen) return null;

  const colorClasses = {
    red: 'bg-red-500 hover:bg-red-600',
    green: 'bg-green-500 hover:bg-green-600',
    stone: 'bg-stone-800 hover:bg-stone-900'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="warning" className="text-2xl text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-stone-800 text-center mb-2">{title}</h3>
          <p className="text-stone-600 text-center text-sm">{message}</p>
        </div>
        <div className="flex border-t border-stone-200">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-white font-medium transition-colors ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Exam Modal Component
const AddExamModal = ({ 
  isOpen, 
  onClose, 
  subject,
  subjectName,
  user,
  onAddExam,
  addToast,
  updateToast,
  removeToast
}: { 
  isOpen: boolean; 
  onClose: () => void;
  subject: string;
  subjectName: string;
  user: User | null;
  onAddExam: (exam: { courseCode: string; courseName: string; examType: string; date: string; startTime: string; endTime: string; room: string; proctor: string; notes: string }) => Promise<boolean>;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
}) => {
  const [examType, setExamType] = useState('Midterm');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [proctor, setProctor] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      addToast('Please login first', 'error');
      return;
    }
    
    if (!examType || !date || !startTime || !endTime || !room) {
      addToast('Please fill all required fields', 'error');
      return;
    }
    
    setSubmitting(true);
    
    const success = await onAddExam({
      courseCode: subject,
      courseName: subjectName || subject,
      examType,
      date,
      startTime,
      endTime,
      room,
      proctor,
      notes
    });
    
    setSubmitting(false);
    
    if (success) {
      // Reset form
      setExamType('Midterm');
      setDate('');
      setStartTime('');
      setEndTime('');
      setRoom('');
      setProctor('');
      setNotes('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-stone-800">Add Exam</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full">
              <Icon name="close" className="text-stone-500" />
            </button>
          </div>
          
          <p className="text-sm text-stone-500 mb-4">Schedule an exam for {subjectName || subject}</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Exam Type *</label>
              <select 
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              >
                <option value="LE Deadline">LE Deadline</option>
                <option value="Quiz">Quiz</option>
                <option value="Midterm Exam">Midterm Exam</option>
                <option value="Final Exam">Final Exam</option>
                <option value="Reporting">Reporting</option>
                <option value="Performance">Performance</option>
                <option value="Presentation">Presentation</option>
                <option value="Submission">Submission</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                <input 
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                <input 
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
              <input 
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g., Room 101, Lab A"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
              <input 
                type="text"
                value={proctor}
                onChange={(e) => setProctor(e.target.value)}
                placeholder="e.g., Prof. Santos"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none"
              />
            </div>
          </div>
          
          <button 
            onClick={handleSubmit} 
            disabled={submitting || !user}
            className="w-full mt-6 py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...</>
            ) : (
              <><Icon name="event" /> Add Exam</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Login Modal Component
const LoginModal = ({ 
  isOpen, 
  onClose, 
  onLogin,
  addToast,
  updateToast,
  removeToast
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onLogin: (user: User) => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
}) => {
  const [idNumber, setIdNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateIdFormat = (id: string) => /^\d{4}-\d{5}$/.test(id);

  const handleSubmit = async () => {
    setError('');
    
    if (!validateIdFormat(idNumber)) {
      setError('Invalid ID format. Use: 2025-00000');
      return;
    }
    
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    const toastId = addToast('Logging in...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', idNumber, name: name.trim() })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const user: User = result.user;
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        onLogin(user);
        updateToast(toastId, result.isNew ? 'Account created successfully!' : 'Welcome back!', 'success');
        setTimeout(() => removeToast(toastId), 3000);
        onClose();
      } else {
        // Fallback to local-only mode
        const user: User = { idNumber, name: name.trim(), record: {} };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        onLogin(user);
        updateToast(toastId, 'Logged in (offline mode)', 'info');
        setTimeout(() => removeToast(toastId), 3000);
        onClose();
      }
    } catch (err) {
      // Fallback to local-only mode
      const user: User = { idNumber, name: name.trim(), record: {} };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      onLogin(user);
      updateToast(toastId, 'Logged in (offline mode)', 'info');
      setTimeout(() => removeToast(toastId), 3000);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-stone-800">Login / Sign Up</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">ID Number</label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="2025-00000"
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
            />
            <p className="text-xs text-stone-400 mt-1">Format: YYYY-NNNNN (e.g., 2025-12345)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50 transition-all"
          >
            {loading ? 'Please wait...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Resource Viewer Component
const ResourceViewer = ({ 
  resource, 
  onClose 
}: { 
  resource: Resource; 
  onClose: () => void;
}) => {
  const [iframeError, setIframeError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getFileId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || 
                  url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
    return match || null;
  };

  const getEmbedUrl = (url: string, useGoogleViewer = false) => {
    // Google Drive file
    if (url.includes('drive.google.com')) {
      const fileId = getFileId(url);
      if (fileId) {
        if (useGoogleViewer) {
          // Use Google Docs viewer as fallback (works better for PDFs)
          return `https://docs.google.com/viewer?srcid=${fileId}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
        }
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    return url;
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setIframeError(true);
  };

  const renderContent = () => {
    const isPDF = resource.category === 'Lesson PDF' || resource.name.toLowerCase().endsWith('.pdf');
    const embedUrl = getEmbedUrl(resource.url, iframeError && isPDF);
    
    if (resource.category === 'Video') {
      return (
        <iframe
          src={embedUrl}
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
        />
      );
    }
    
    if (resource.category === 'Image') {
      return (
        <img 
          src={embedUrl} 
          alt={resource.name} 
          className="max-w-full max-h-full object-contain rounded-lg"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      );
    }
    
    // Files (PDF, PPT, etc.)
    return (
      <div className="w-full h-full relative">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-800 rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
            <p className="text-white text-sm">Loading document...</p>
            <p className="text-stone-400 text-xs mt-2">If loading takes too long, try "Open Externally"</p>
          </div>
        )}
        <iframe
          key={iframeError ? 'fallback' : 'primary'}
          src={embedUrl}
          className="w-full h-full rounded-lg bg-white"
          title={resource.name}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      <div className="flex justify-between items-center p-4 bg-stone-900">
        <h2 className="text-white font-semibold truncate flex-1 mr-4">{resource.name}</h2>
        <div className="flex items-center gap-2">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            title="Open in Google Drive"
          >
            <Icon name="open_in_new" className="text-lg" />
            <span className="text-sm hidden sm:inline">Open Externally</span>
          </a>
          <button onClick={onClose} className="text-white hover:text-stone-300 p-2">
            <Icon name="close" className="text-2xl" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        {renderContent()}
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  // User State
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallToast, setShowInstallToast] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = (message: string, type: Toast['type'], progress?: number): number => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type, progress }]);
    return id;
  };

  const updateToast = (id: number, message: string, type: Toast['type'], progress?: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, message, type, progress } : t));
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Data State
  const [view, setView] = useState<AppView>(() => {
    const saved = localStorage.getItem('flashmaster_lastView');
    return (saved as AppView) || 'HOME';
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Content State
  const [decks, setDecks] = useState<Deck[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryItem[]>>({});
  const [resources, setResources] = useState<Record<string, Resource[]>>({});
  const [apiSubjects, setApiSubjects] = useState<string[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjectInfo, setSubjectInfo] = useState<Record<string, SubjectInfo>>({});
  const [showAddExam, setShowAddExam] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date()); // For real-time exam status
  const [examToDelete, setExamToDelete] = useState<string | null>(null); // For delete confirmation
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null); // For editing exam
  
  // Navigation State
  const [activeSubject, setActiveSubject] = useState<string | null>(() => {
    return localStorage.getItem('flashmaster_lastSubject');
  });
  const [activeTab, setActiveTab] = useState<'Flashcards' | 'Resources' | 'Exams'>(() => {
    const saved = localStorage.getItem('flashmaster_lastTab');
    return (saved as 'Flashcards' | 'Resources' | 'Exams') || 'Flashcards';
  });
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [deckLoading, setDeckLoading] = useState<string | null>(null); // Track which deck is loading
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [previousView, setPreviousView] = useState<AppView>('HOME'); // Track where we came from

  // Save navigation state to localStorage
  useEffect(() => {
    localStorage.setItem('flashmaster_lastView', view);
  }, [view]);

  useEffect(() => {
    if (activeSubject) {
      localStorage.setItem('flashmaster_lastSubject', activeSubject);
    }
  }, [activeSubject]);

  useEffect(() => {
    localStorage.setItem('flashmaster_lastTab', activeTab);
  }, [activeTab]);

  // Real-time exam status updates - refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Session State
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [playMode, setPlayMode] = useState<'shuffle' | 'chronological'>('shuffle');
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState<DeckProgress | null>(null);

  // Analytics State
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ALL_RESOURCES View Filter States (must be at top level for hooks rules)
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');

  // --- Initialization ---

  useEffect(() => {
    const initApp = async () => {
      // Load user from storage
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          localStorage.removeItem(STORAGE_KEY_USER);
        }
      }

      // Load cached data
      const cachedDecks = await db.decks.toArray();
      setDecks(cachedDecks);
      
      // Load cached subjects
      const cachedSubjects = localStorage.getItem('flashmaster_subjects');
      if (cachedSubjects) {
        try {
          setApiSubjects(JSON.parse(cachedSubjects));
        } catch (e) {
          // ignore
        }
      }
      
      // Load cached subject info (code to name mapping)
      const cachedSubjectInfo = localStorage.getItem('flashmaster_subjectInfo');
      if (cachedSubjectInfo) {
        try {
          setSubjectInfo(JSON.parse(cachedSubjectInfo));
        } catch (e) {
          // ignore
        }
      }
      
      // Load cached exams
      const cachedExams = localStorage.getItem('flashmaster_exams');
      if (cachedExams) {
        try {
          setExams(JSON.parse(cachedExams));
        } catch (e) {
          // ignore
        }
      }
      
      // Load cached resources
      const cachedResources = await db.resources.toArray();
      if (cachedResources.length > 0) {
        const resourceMap: Record<string, Resource[]> = {};
        cachedResources.forEach(r => {
          resourceMap[r.subject] = r.items;
        });
        setResources(resourceMap);
      }
      
      // Validate restored view - if SUBJECT view but no subject, go HOME
      const savedView = localStorage.getItem('flashmaster_lastView') as AppView;
      const savedSubject = localStorage.getItem('flashmaster_lastSubject');
      if (savedView === 'SUBJECT' && !savedSubject) {
        setView('HOME');
      }
      
      setLoading(false);

      // Sync with backend
      if (navigator.onLine) {
        syncData();
      }
    };

    initApp();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- PWA Install Prompt & Cache Management ---
  
  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    const dismissedInstall = localStorage.getItem('flashmaster_install_dismissed');
    
    if (isStandalone) {
      setIsAppInstalled(true);
      localStorage.setItem('flashmaster_installed', 'true');
    } else if (!dismissedInstall && !localStorage.getItem('flashmaster_installed')) {
      // Show install prompt after 3 seconds
      const timer = setTimeout(() => {
        setShowInstallToast(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setShowInstallToast(false);
      setDeferredPrompt(null);
      localStorage.setItem('flashmaster_installed', 'true');
      addToast('App installed successfully!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // --- Cache Management - Auto clear on new version ---
  
  useEffect(() => {
    const APP_VERSION = '1.1.0'; // Increment this to trigger cache clear
    const storedVersion = localStorage.getItem('flashmaster_version');
    
    if (storedVersion !== APP_VERSION) {
      // New version detected - clear caches
      const clearCaches = async () => {
        try {
          // Clear IndexedDB cache
          await db.decks.clear();
          await db.categories.clear();
          await db.resources.clear();
          
          // Clear service worker caches if available
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          
          // Update stored version
          localStorage.setItem('flashmaster_version', APP_VERSION);
          
          console.log('Cache cleared for new version:', APP_VERSION);
          
          // Reload data
          if (navigator.onLine) {
            syncData(true);
          }
        } catch (e) {
          console.error('Error clearing cache:', e);
        }
      };
      
      clearCaches();
    }
  }, []);

  // --- Periodic Data Refresh (every hour) ---
  
  useEffect(() => {
    const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
    const LAST_REFRESH_KEY = 'flashmaster_last_refresh';
    
    const checkAndRefresh = () => {
      const lastRefresh = localStorage.getItem(LAST_REFRESH_KEY);
      const now = Date.now();
      
      if (!lastRefresh || (now - parseInt(lastRefresh)) > REFRESH_INTERVAL) {
        console.log('Hourly refresh triggered');
        localStorage.setItem(LAST_REFRESH_KEY, now.toString());
        
        if (navigator.onLine) {
          syncData(false); // Silent refresh (no toast)
        }
      }
    };
    
    // Check on mount
    checkAndRefresh();
    
    // Set up interval for periodic checks (check every 5 minutes if tab is active)
    const intervalId = setInterval(checkAndRefresh, 5 * 60 * 1000);
    
    // Also refresh when tab becomes visible after being hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // PWA Install handlers
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallToast(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      addToast('Add to Home Screen from your browser menu', 'info');
      setShowInstallToast(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallToast(false);
    localStorage.setItem('flashmaster_install_dismissed', Date.now().toString());
  };

  // --- Data Sync ---

  const syncData = async (showToast = true) => {
    let toastId: number | null = null;
    
    if (showToast) {
      toastId = addToast('Loading data...', 'loading', 10);
    }
    
    try {
      if (toastId) updateToast(toastId, 'Connecting to server...', 'loading', 20);
      
      const response = await fetch(`${GAS_URL}?action=getAll`, {
        redirect: 'follow'
      });
      
      if (toastId) updateToast(toastId, 'Fetching flashcards...', 'loading', 40);
      
      const data = await response.json();

      if (data.error) {
        console.error('Sync error:', data.error);
        if (toastId) {
          updateToast(toastId, `Sync error: ${data.error}`, 'error');
          setTimeout(() => removeToast(toastId!), 4000);
        }
        return;
      }

      if (toastId) updateToast(toastId, 'Processing flashcards...', 'loading', 50);

      // Process decks - format: { displayName: { sheetName, subject, cards } }
      if (data.decks) {
        const parsedDecks: Deck[] = Object.entries(data.decks).map(([displayName, deckData]: [string, any]) => ({
          name: displayName,
          sheetName: deckData.sheetName || displayName,
          subject: deckData.subject || 'Uncategorized',
          cards: deckData.cards.map((c: any, idx: number) => ({
            id: `${displayName}-${idx}`,
            q: c.q || '',
            a: c.a || ''
          }))
        }));
        await db.decks.bulkPut(parsedDecks);
        setDecks(parsedDecks);
      }

      if (toastId) updateToast(toastId, 'Loading categories...', 'loading', 65);

      // Process categories (auto-generated from deck subjects)
      if (data.categories) {
        setCategories(data.categories);
        for (const [subject, items] of Object.entries(data.categories)) {
          await db.categories.put({ subject, items: items as CategoryItem[] });
        }
      }

      if (toastId) updateToast(toastId, 'Loading resources...', 'loading', 80);

      // Process resources
      if (data.resources) {
        setResources(data.resources);
        for (const [subject, items] of Object.entries(data.resources)) {
          await db.resources.put({ subject, items: items as Resource[] });
        }
      }

      if (toastId) updateToast(toastId, 'Loading exam schedule...', 'loading', 90);

      // Process subjects from Category sheet (now with code and name)
      if (data.subjects && Array.isArray(data.subjects)) {
        setApiSubjects(data.subjects.map((s: any) => typeof s === 'string' ? s : s.code));
        localStorage.setItem('flashmaster_subjects', JSON.stringify(data.subjects.map((s: any) => typeof s === 'string' ? s : s.code)));
      }
      
      // Process subject info (code to name mapping)
      if (data.subjectInfo && typeof data.subjectInfo === 'object') {
        setSubjectInfo(data.subjectInfo);
        localStorage.setItem('flashmaster_subjectInfo', JSON.stringify(data.subjectInfo));
      }
      
      // Process exams
      if (data.exams && Array.isArray(data.exams)) {
        setExams(data.exams);
        localStorage.setItem('flashmaster_exams', JSON.stringify(data.exams));
      }

      if (toastId) updateToast(toastId, 'Finalizing...', 'loading', 95);
      
      if (toastId) {
        updateToast(toastId, '✓ Data loaded successfully!', 'success', 100);
        setTimeout(() => removeToast(toastId!), 2000);
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      if (toastId) {
        updateToast(toastId, `Sync failed: ${error.message || 'Network error'}`, 'error');
        setTimeout(() => removeToast(toastId!), 4000);
      }
    }
  };

  // --- Analytics Functions ---

  const saveSessionAnalytics = async (correct: number, incorrect: number) => {
    if (!user || !activeDeck || !activeSubject) return;
    
    const timeSpent = Math.round((Date.now() - sessionStartTime) / 1000); // in seconds
    
    try {
      await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveAnalytics',
          idNumber: user.idNumber,
          subject: activeSubject,
          deck: activeDeck.name,
          correct,
          incorrect,
          timeSpent
        })
      });
    } catch (error) {
      console.error('Failed to save analytics:', error);
    }
  };

  const fetchUserAnalytics = async () => {
    if (!user) return;
    
    setLoadingAnalytics(true);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getAnalytics',
          idNumber: user.idNumber
        })
      });
      const data = await response.json();
      if (data.success) {
        setUserAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // --- Actions ---

  const ADMIN_USER_ID = '2025-00046';

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const handleAdminClearAllCache = () => {
    if (!user || user.idNumber !== ADMIN_USER_ID) return;
    
    if (!confirm('Are you sure you want to clear ALL cache for ALL users? This will:\n\n• Clear all localStorage data\n• Clear all sessionStorage data\n• Unregister service workers\n• Clear browser cache\n\nUsers will need to login again.')) {
      return;
    }
    
    const toastId = addToast('Admin: Clearing all cache...', 'loading');
    
    try {
      // Clear all localStorage
      localStorage.clear();
      
      // Clear all sessionStorage
      sessionStorage.clear();
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
      
      // Clear caches (Cache API)
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      
      updateToast(toastId, 'Cache cleared! Reloading...', 'success');
      
      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      updateToast(toastId, 'Failed to clear cache', 'error');
      setTimeout(() => removeToast(toastId), 3000);
    }
  };

  const openSubject = (subject: string) => {
    setActiveSubject(subject);
    setActiveTab('Flashcards');
    setView('SUBJECT');
  };

  const openDeck = async (deck: Deck) => {
    // Show loading state
    setDeckLoading(deck.name);
    const loadingToast = addToast('loading', `Loading ${deck.name}...`);
    
    // Small delay to show loading state (prevents flash)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setActiveDeck(deck);
    
    // First check backend for progress if user is logged in
    if (user && navigator.onLine) {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'getDeckProgress',
            idNumber: user.idNumber,
            deckName: deck.name
          })
        });
        const data = await response.json();
        
        if (data.success && data.progress) {
          // Use backend progress
          const progress = data.progress as DeckProgress;
          const hasProgress = Object.values(progress.cardStatuses).some(s => s !== 'unanswered');
          if (hasProgress) {
            // Save to local storage as well
            saveDeckProgressLocal(deck.name, progress);
            setSavedProgress(progress);
            removeToast(loadingToast);
            setDeckLoading(null);
            setShowContinueModal(true);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to fetch progress from backend:', e);
      }
    }
    
    // Fall back to local storage
    const progressKey = PROGRESS_KEY_PREFIX + deck.name;
    const savedProgressStr = localStorage.getItem(progressKey);
    if (savedProgressStr) {
      try {
        const progress: DeckProgress = JSON.parse(savedProgressStr);
        // Check if progress has any answered cards
        const hasProgress = Object.values(progress.cardStatuses).some(s => s !== 'unanswered');
        if (hasProgress) {
          setSavedProgress(progress);
          removeToast(loadingToast);
          setDeckLoading(null);
          setShowContinueModal(true);
          return;
        }
      } catch (e) {
        // ignore parse error
      }
    }
    
    removeToast(loadingToast);
    setDeckLoading(null);
    setView('DECK_OVERVIEW');
  };

  const getDeckProgress = (deckName: string): DeckProgress | null => {
    const progressKey = PROGRESS_KEY_PREFIX + deckName;
    const savedProgressStr = localStorage.getItem(progressKey);
    if (savedProgressStr) {
      try {
        return JSON.parse(savedProgressStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const saveDeckProgressLocal = (deckName: string, progress: DeckProgress) => {
    const progressKey = PROGRESS_KEY_PREFIX + deckName;
    localStorage.setItem(progressKey, JSON.stringify(progress));
  };

  const saveDeckProgress = async (deckName: string, progress: DeckProgress) => {
    // Save locally first
    saveDeckProgressLocal(deckName, progress);
    
    // Sync to backend if user is logged in
    if (user && navigator.onLine) {
      try {
        await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'saveDeckProgress',
            idNumber: user.idNumber,
            deckName: deckName,
            cardStatuses: progress.cardStatuses,
            currentIndex: progress.currentIndex,
            mode: progress.mode,
            shuffledOrder: progress.shuffledOrder
          })
        });
      } catch (e) {
        console.error('Failed to save progress to backend:', e);
      }
    }
  };

  const clearDeckProgress = async (deckName: string) => {
    const progressKey = PROGRESS_KEY_PREFIX + deckName;
    localStorage.removeItem(progressKey);
    
    // Clear from backend if user is logged in
    if (user && navigator.onLine) {
      try {
        await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'clearDeckProgress',
            idNumber: user.idNumber,
            deckName: deckName
          })
        });
      } catch (e) {
        console.error('Failed to clear progress from backend:', e);
      }
    }
  };

  // Sync all deck progress from backend on login
  const syncProgressFromBackend = async () => {
    if (!user || !navigator.onLine) return;
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getAllDeckProgress',
          idNumber: user.idNumber
        })
      });
      const data = await response.json();
      
      if (data.success && data.progress) {
        // Merge backend progress with local progress
        Object.entries(data.progress).forEach(([deckName, progress]) => {
          const localProgress = getDeckProgress(deckName);
          const backendProgress = progress as DeckProgress;
          
          // Use backend if it's newer or local doesn't exist
          const backendTime = backendProgress.lastUpdated ? new Date(backendProgress.lastUpdated).getTime() : 0;
          const localTime = localProgress?.lastUpdated ? new Date(localProgress.lastUpdated).getTime() : 0;
          
          if (!localProgress || backendTime > localTime) {
            saveDeckProgressLocal(deckName, backendProgress);
          }
        });
      }
    } catch (e) {
      console.error('Failed to sync progress from backend:', e);
    }
  };

  // Sync progress from backend when user logs in
  useEffect(() => {
    if (user) {
      syncProgressFromBackend();
    }
  }, [user]);

  // --- Exam Functions ---
  
  // Helper to parse time from various formats (HH:MM, H:MM, decimal from Google Sheets, etc.)
  const parseTimeString = (timeStr: string | number): { hour: number; min: number } => {
    if (typeof timeStr === 'number') {
      // Google Sheets stores time as decimal fraction of day (e.g., 0.333... for 8:00 AM)
      const totalMinutes = Math.round(timeStr * 24 * 60);
      return { hour: Math.floor(totalMinutes / 60), min: totalMinutes % 60 };
    }
    
    const str = String(timeStr || '').trim();
    if (!str) return { hour: 0, min: 0 };
    
    // Handle "HH:MM" or "H:MM" format
    if (str.includes(':')) {
      const parts = str.split(':');
      return { hour: parseInt(parts[0]) || 0, min: parseInt(parts[1]) || 0 };
    }
    
    // Handle just hour number
    const hourNum = parseInt(str);
    if (!isNaN(hourNum)) {
      return { hour: hourNum, min: 0 };
    }
    
    return { hour: 0, min: 0 };
  };
  
  const getExamStatus = (exam: Exam): 'upcoming' | 'ongoing' | 'completed' => {
    // Use currentTime state for real-time updates
    const now = currentTime;
    
    // Parse date correctly - split to avoid timezone issues
    const dateStr = String(exam.date);
    let examDate: Date;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      examDate = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      examDate = new Date(dateStr);
    }
    
    const { hour: startHour, min: startMin } = parseTimeString(exam.startTime);
    const { hour: endHour, min: endMin } = parseTimeString(exam.endTime || '23:59');
    
    const startDateTime = new Date(examDate);
    startDateTime.setHours(startHour, startMin, 0, 0);
    
    const endDateTime = new Date(examDate);
    endDateTime.setHours(endHour || 23, endMin || 59, 0, 0);
    
    // Handle case where end time equals or is before start time (use end of day instead)
    if (endDateTime.getTime() <= startDateTime.getTime()) {
      endDateTime.setHours(23, 59, 59, 999);
    }
    
    if (now < startDateTime) return 'upcoming';
    if (now >= startDateTime && now <= endDateTime) return 'ongoing';
    return 'completed';
  };
  
  const getSubjectExams = (subjectCode: string): Exam[] => {
    return exams.filter(e => e.courseCode === subjectCode);
  };
  
  const formatExamDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const formatExamTime = (time: string | number): string => {
    const { hour, min } = parseTimeString(time);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
  };
  
  const addExamToBackend = async (exam: { courseCode: string; courseName: string; examType: string; date: string; startTime: string; endTime: string; room: string; proctor: string; notes: string }) => {
    if (!user) {
      addToast('Please login to add exams', 'error');
      return false;
    }
    
    const toastId = addToast('Adding exam...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addExam',
          ...exam,
          userId: user.idNumber,
          userName: user.name
        })
      });
      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, 'Exam added!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        syncData(); // Refresh exams
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to add exam', 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return false;
      }
    } catch (e) {
      updateToast(toastId, 'Failed to add exam', 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    }
  };
  
  const deleteExamFromBackend = async (examId: string) => {
    if (!user) {
      addToast('Please login to delete exams', 'error');
      return false;
    }
    
    const toastId = addToast('Deleting exam...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteExam',
          examId,
          userId: user.idNumber
        })
      });
      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, 'Exam deleted!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        syncData(); // Refresh exams
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to delete exam', 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return false;
      }
    } catch (e) {
      updateToast(toastId, 'Failed to delete exam', 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    }
  };

  const updateExamToBackend = async (examId: string, updates: Partial<Exam>) => {
    if (!user) {
      addToast('Please login to edit exams', 'error');
      return false;
    }
    
    const toastId = addToast('Updating exam...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateExam',
          examId,
          ...updates,
          userId: user.idNumber
        })
      });
      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, 'Exam updated!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        syncData(); // Refresh exams
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to update exam', 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return false;
      }
    } catch (e) {
      updateToast(toastId, 'Failed to update exam', 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    }
  };

  const openResource = (resource: Resource) => {
    setActiveResource(resource);
    setPreviousView('SUBJECT');
    setView('RESOURCE_VIEW');
  };

  const startSession = (mode: 'new' | 'retry' | 'smart' | 'continue', selectedPlayMode?: 'shuffle' | 'chronological') => {
    if (!activeDeck) return;
    let newQueue: Card[] = [];
    let startIndex = 0;
    let initialScores: Record<string, 'correct' | 'incorrect'> = {};
    const currentPlayMode = selectedPlayMode || playMode;

    if (mode === 'continue' && savedProgress) {
      // Continue from saved progress - get cards that haven't been answered
      const unansweredIds = Object.entries(savedProgress.cardStatuses)
        .filter(([_, status]) => status === 'unanswered')
        .map(([id]) => id);
      
      if (savedProgress.shuffledOrder) {
        // Keep the original shuffle order but filter to unanswered
        newQueue = savedProgress.shuffledOrder
          .filter(id => unansweredIds.includes(id))
          .map(id => activeDeck.cards.find(c => c.id === id)!)
          .filter(Boolean);
      } else {
        newQueue = activeDeck.cards.filter(c => unansweredIds.includes(c.id));
      }
      
      // Convert card statuses to scores for already answered cards
      Object.entries(savedProgress.cardStatuses).forEach(([id, status]) => {
        if (status === 'correct') initialScores[id] = 'correct';
        else if (status === 'incorrect') initialScores[id] = 'incorrect';
      });
      setPlayMode(savedProgress.mode);
    } else if (mode === 'new') {
      if (currentPlayMode === 'shuffle') {
        newQueue = [...activeDeck.cards].sort(() => Math.random() - 0.5);
      } else {
        newQueue = [...activeDeck.cards];
      }
      setPlayMode(currentPlayMode);
    } else if (mode === 'retry') {
      const progress = getDeckProgress(activeDeck.name);
      const incorrectIds = progress ? Object.entries(progress.cardStatuses).filter(([_, s]) => s === 'incorrect').map(([id]) => id) : Object.keys(scores).filter(id => scores[id] === 'incorrect');
      newQueue = activeDeck.cards.filter(c => incorrectIds.includes(c.id));
      if (currentPlayMode === 'shuffle') {
        newQueue = newQueue.sort(() => Math.random() - 0.5);
      }
    } else if (mode === 'smart') {
      const progress = getDeckProgress(activeDeck.name);
      const incorrectIds = progress ? Object.entries(progress.cardStatuses).filter(([_, s]) => s === 'incorrect').map(([id]) => id) : Object.keys(scores).filter(id => scores[id] === 'incorrect');
      const incorrect = activeDeck.cards.filter(c => incorrectIds.includes(c.id));
      const others = activeDeck.cards.filter(c => !incorrectIds.includes(c.id));
      if (currentPlayMode === 'shuffle') {
        newQueue = [...incorrect.sort(() => Math.random() - 0.5), ...others.sort(() => Math.random() - 0.5)];
      } else {
        newQueue = [...incorrect, ...others];
      }
    }

    if (newQueue.length === 0) {
      alert("No cards to play!");
      return;
    }

    // For continue mode, preserve the existing progress, just update currentIndex
    if (mode === 'continue' && savedProgress) {
      // Keep existing progress, just mark we're continuing
      const updatedProgress = { ...savedProgress, lastUpdated: Date.now() };
      saveDeckProgress(activeDeck.name, updatedProgress);
    } else {
      // Initialize progress for this session (new, retry, smart modes)
      const newProgress: DeckProgress = {
        deckName: activeDeck.name,
        cardStatuses: {},
        currentIndex: 0,
        mode: currentPlayMode,
        shuffledOrder: newQueue.map(c => c.id),
        lastUpdated: Date.now()
      };
      // Populate initial card statuses - include all deck cards
      activeDeck.cards.forEach(card => {
        newProgress.cardStatuses[card.id] = initialScores[card.id] ? (initialScores[card.id] as 'correct' | 'incorrect') : 'unanswered';
      });
      saveDeckProgress(activeDeck.name, newProgress);
    }

    setScores(initialScores);
    setQueue(newQueue);
    setCurrentIndex(startIndex);
    setIsFlipped(false);
    setSessionStartTime(Date.now());
    setSavedProgress(null);
    setShowContinueModal(false);
    setView('PLAY');
  };

  const handleScore = (result: 'correct' | 'incorrect') => {
    const card = queue[currentIndex];
    const newScores = { ...scores, [card.id]: result };
    setScores(newScores);
    
    // Update saved progress
    if (activeDeck) {
      const progress = getDeckProgress(activeDeck.name);
      if (progress) {
        progress.cardStatuses[card.id] = result;
        progress.currentIndex = currentIndex + 1;
        progress.lastUpdated = Date.now();
        saveDeckProgress(activeDeck.name, progress);
      }
    }
    
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < queue.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Session ended - calculate final scores and save analytics
        const correct = Object.values(newScores).filter(s => s === 'correct').length;
        const incorrect = Object.values(newScores).filter(s => s === 'incorrect').length;
        saveSessionAnalytics(correct, incorrect);
        setView('SUMMARY');
      }
    }, 200);
  };

  const resetHome = () => {
    setView('HOME');
    setActiveSubject(null);
    setActiveDeck(null);
    setActiveResource(null);
    setQueue([]);
    setCurrentIndex(0);
    setScores({});
  };

  // Get subjects from decks (using the subject property from D1)
  const deckSubjects = [...new Set(decks.map(d => d.subject).filter(Boolean))] as string[];
  
  // Default subjects if no decks loaded yet
  const defaultSubjects = ['FL111', 'FL112', 'EDUC112', 'EDUC111', 'GE111', 'GE112', 'PE111', 'NSTP111'];
  
  // Priority: apiSubjects from Category sheet > deckSubjects from D1 > defaults
  const displaySubjects = apiSubjects.length > 0 ? apiSubjects : (deckSubjects.length > 0 ? deckSubjects : defaultSubjects);

  // --- Views ---

  // HOME View
  if (view === 'HOME') {
    return (
      <div className="min-h-screen bg-[#F5F5F4]">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {/* PWA Install Toast */}
        {showInstallToast && !isAppInstalled && (
          <div className="fixed bottom-20 left-4 right-4 z-[90] animate-slide-up">
            <div className="max-w-md mx-auto bg-gradient-to-r from-stone-800 to-stone-700 text-white p-4 rounded-2xl shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="download" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Install FlashMaster</p>
                <p className="text-sm text-stone-300">Get faster access & offline support</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button 
                  onClick={handleDismissInstall}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Icon name="close" className="text-stone-300" />
                </button>
                <button 
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-white text-stone-800 rounded-xl font-semibold hover:bg-stone-100 transition-colors"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        )}
        
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={setUser}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                <Icon name="school" className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-stone-800">FlashMaster</h1>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-stone-400'}`}></span>
                  <span className="text-xs text-stone-500">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('EXAMS')}
                className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                title="Schedule"
              >
                <Icon name="event" className="text-stone-600" />
              </button>
              {user && (
                <button
                  onClick={() => { setUserAnalytics(null); setView('ANALYTICS'); }}
                  className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                  title="View Analytics"
                >
                  <Icon name="analytics" className="text-stone-600" />
                </button>
              )}
              <button
                onClick={() => user ? handleLogout() : setShowLogin(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
              >
                <Icon name={user ? 'logout' : 'login'} className="text-stone-600" />
                <span className="text-sm font-medium text-stone-700">
                  {user ? user.name.split(' ')[0] : 'Login'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto p-4">
          {user && (
            <div className="bg-gradient-to-r from-stone-800 to-stone-700 rounded-2xl p-4 mb-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm opacity-80">Welcome back,</p>
                  <p className="text-xl font-bold">{user.name}</p>
                  <p className="text-xs opacity-60 mt-1">ID: {user.idNumber}</p>
                </div>
                {user.idNumber === ADMIN_USER_ID && (
                  <button
                    onClick={handleAdminClearAllCache}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs rounded-lg transition-colors"
                    title="Admin: Clear all users cache"
                  >
                    <Icon name="delete_sweep" className="text-sm" />
                    <span>Clear All Cache</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <h2 className="text-lg font-bold text-stone-800 mb-4">Subjects</h2>
          
          {loading ? (
            <div className="text-center py-12 text-stone-400">
              <span className="animate-pulse">Loading...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {displaySubjects.map(subject => {
                const deckCount = decks.filter(d => d.subject === subject).length;
                const resourceCount = (resources[subject] || []).length;
                const info = subjectInfo[subject];
                const courseName = info?.name || null;
                return (
                  <button
                    key={subject}
                    onClick={() => openSubject(subject)}
                    className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-stone-400 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-stone-800 group-hover:text-white transition-colors">
                      <Icon name="book_2" />
                    </div>
                    <h3 className="font-semibold text-stone-800">{subject}</h3>
                    {courseName && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{courseName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                      <span>{deckCount} {deckCount === 1 ? 'deck' : 'decks'}</span>
                      {resourceCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Icon name="folder" className="text-xs" />
                            {resourceCount}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Uncategorized Decks Section */}
          {decks.filter(d => !d.subject || d.subject === 'Uncategorized' || !displaySubjects.includes(d.subject)).length > 0 && (
            <>
              <h2 className="text-lg font-bold text-stone-800 mb-4 mt-8">Uncategorized</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {decks.filter(d => !d.subject || d.subject === 'Uncategorized' || !displaySubjects.includes(d.subject)).map(deck => (
                  <button
                    key={deck.name}
                    onClick={() => openDeck(deck)}
                    className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-stone-400 transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                      <Icon name="style" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-800">{deck.name}</h3>
                      <p className="text-xs text-stone-400">{deck.cards.length} cards</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-3 mt-8">
            {/* Exams Quick View */}
            <button
              onClick={() => setView('EXAMS')}
              className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-amber-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                  <Icon name="event" />
                </div>
                {exams.filter(e => getExamStatus(e) === 'ongoing').length > 0 && (
                  <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium animate-pulse">
                    {exams.filter(e => getExamStatus(e) === 'ongoing').length} NOW
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-stone-800">Schedule</h3>
              <p className="text-xs text-stone-400 mt-1">
                {exams.filter(e => getExamStatus(e) === 'upcoming').length} upcoming
                {exams.filter(e => getExamStatus(e) === 'completed').length > 0 && ` • ${exams.filter(e => getExamStatus(e) === 'completed').length} done`}
              </p>
            </button>

            {/* Resources Quick View */}
            {(() => {
              const totalResources = Object.values(resources).reduce((sum, arr) => sum + arr.length, 0);
              return (
                <button
                  onClick={() => setView('ALL_RESOURCES')}
                  className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-2">
                    <Icon name="folder_open" />
                  </div>
                  <h3 className="font-semibold text-stone-800">Resources</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    {totalResources} files across {Object.keys(resources).length} subjects
                  </p>
                </button>
              );
            })()}
          </div>

          {/* Upcoming Exam Preview (show only if there are upcoming exams) */}
          {exams.filter(e => getExamStatus(e) === 'upcoming' || getExamStatus(e) === 'ongoing').length > 0 && (
            <>
              <h2 className="text-lg font-bold text-stone-800 mb-4 mt-8 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Icon name="event" className="text-amber-500" /> Next Exams
                </span>
                <button onClick={() => setView('EXAMS')} className="text-sm text-stone-500 hover:text-stone-700">
                  View all →
                </button>
              </h2>
              <div className="space-y-2">
                {/* Show ongoing first, then up to 3 upcoming */}
                {[...exams.filter(e => getExamStatus(e) === 'ongoing'), ...exams.filter(e => getExamStatus(e) === 'upcoming').slice(0, 3)].slice(0, 4).map(exam => {
                  const isOngoing = getExamStatus(exam) === 'ongoing';
                  return (
                    <div 
                      key={exam.examId} 
                      className={`p-3 rounded-xl border ${isOngoing ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'} flex items-center gap-3`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOngoing ? 'bg-green-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                        <Icon name={isOngoing ? 'schedule' : 'event'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isOngoing ? 'text-green-800' : 'text-stone-800'}`}>{exam.courseCode}</span>
                          <span className={`text-xs ${isOngoing ? 'text-green-600' : 'text-stone-500'}`}>• {exam.examType}</span>
                        </div>
                        <p className={`text-xs ${isOngoing ? 'text-green-600' : 'text-stone-400'}`}>
                          {isOngoing ? `Now until ${formatExamTime(exam.endTime)}` : `${formatExamDate(exam.date)} • ${formatExamTime(exam.startTime)}`} • Room: {exam.room}
                        </p>
                      </div>
                      {isOngoing && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium animate-pulse">NOW</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  // SUBJECT View
  if (view === 'SUBJECT' && activeSubject) {
    const subjectResources = resources[activeSubject] || [];
    
    // Get decks for this subject using the subject property
    const subjectDecks = decks.filter(d => d.subject === activeSubject);
    
    // Organize resources by category
    const lessonPPTResources = subjectResources.filter(r => r.category === 'Lesson PPT');
    const lessonPDFResources = subjectResources.filter(r => r.category === 'Lesson PDF');
    const reviewerResources = subjectResources.filter(r => r.category === 'Reviewer');
    const videoResources = subjectResources.filter(r => r.category === 'Video');
    // Legacy categories
    const imageResources = subjectResources.filter(r => r.category === 'Image');
    const fileResources = subjectResources.filter(r => r.category === 'Files' || !['Lesson PPT', 'Lesson PDF', 'Reviewer', 'Video', 'Image'].includes(r.category));

    const handleDeleteResource = async (resource: Resource) => {
      if (!user) {
        addToast('Please login to delete resources', 'error');
        return;
      }
      
      if (resource.submittedBy !== user.idNumber) {
        addToast('You can only delete your own submissions', 'error');
        return;
      }
      
      if (!confirm(`Delete "${resource.name}"?`)) return;
      
      const toastId = addToast('Deleting resource...', 'loading');
      
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteResource',
            resourceUrl: resource.url,
            userId: user.idNumber
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          updateToast(toastId, 'Resource deleted!', 'success');
          setTimeout(() => removeToast(toastId), 3000);
          syncData(); // Refresh resources
        } else {
          updateToast(toastId, result.error || 'Delete failed', 'error');
          setTimeout(() => removeToast(toastId), 5000);
        }
      } catch (err) {
        updateToast(toastId, 'Delete failed. Please try again.', 'error');
        setTimeout(() => removeToast(toastId), 5000);
      }
    };

    const renderResourceCard = (r: Resource, i: number, icon: string, iconBg: string, iconColor: string, borderColor: string) => (
      <div
        key={i}
        className={`bg-white p-4 rounded-xl border border-stone-200 hover:${borderColor} hover:shadow-md transition-all cursor-pointer`}
        onClick={() => openResource(r)}
      >
        <div className="flex gap-3">
          <div className={`w-12 h-12 flex-shrink-0 ${iconBg} rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon name={icon} className="text-xl" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-stone-800 text-base leading-snug">{r.name || r.title}</h4>
            {r.description && (
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">{r.description}</p>
            )}
            {r.submittedByName && (
              <p className="text-xs text-stone-400 mt-2">by {r.submittedByName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-stone-100">
          <button
            onClick={(e) => { e.stopPropagation(); openResource(r); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Icon name="visibility" className="text-sm" />
            <span>View</span>
          </button>
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-stone-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="open_in_new" className="text-sm" />
            <span>Open</span>
          </a>
          {user && r.submittedBy === user.idNumber && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteResource(r); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Icon name="delete" className="text-sm" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-[#F5F5F4]">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={setUser}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        <UploadModal 
          isOpen={showUpload} 
          onClose={() => setShowUpload(false)} 
          subject={activeSubject || ''}
          user={user}
          onUploadComplete={syncData}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        <AddExamModal
          isOpen={showAddExam}
          onClose={() => setShowAddExam(false)}
          subject={activeSubject || ''}
          subjectName={subjectInfo[activeSubject || '']?.name || ''}
          user={user}
          onAddExam={addExamToBackend}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={resetHome} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
              <Icon name="arrow_back" className="text-stone-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-stone-800 text-lg">{activeSubject}</h1>
              {subjectInfo[activeSubject || '']?.name && (
                <p className="text-xs text-stone-500 truncate">{subjectInfo[activeSubject || ''].name}</p>
              )}
            </div>
            {activeTab === 'Resources' && (
              <button
                onClick={() => user ? setShowUpload(true) : setShowLogin(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors"
              >
                <Icon name="cloud_upload" className="text-sm" />
                Upload
              </button>
            )}
            {activeTab === 'Exams' && (
              <button
                onClick={() => user ? setShowAddExam(true) : setShowLogin(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors"
              >
                <Icon name="add" className="text-sm" />
                Add Exam
              </button>
            )}
          </div>
          
          {/* Tabs */}
          <div className="max-w-5xl mx-auto px-4 flex gap-4">
            {['Flashcards', 'Resources', 'Exams'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab 
                    ? 'border-stone-800 text-stone-800' 
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4">
          {activeTab === 'Flashcards' ? (
            <div className="space-y-4">
              {subjectDecks.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  No flashcard decks available for this subject
                </div>
              ) : (
                subjectDecks.map(deck => {
                  const deckProgress = getDeckProgress(deck.name);
                  const totalCards = deck.cards.length;
                  const answeredCount = deckProgress 
                    ? Object.values(deckProgress.cardStatuses).filter(s => s !== 'unanswered').length 
                    : 0;
                  const correctCount = deckProgress
                    ? Object.values(deckProgress.cardStatuses).filter(s => s === 'correct').length
                    : 0;
                  const progressPercent = totalCards > 0 ? Math.round((answeredCount / totalCards) * 100) : 0;
                  const isLoading = deckLoading === deck.name;
                  
                  return (
                    <button
                      key={deck.name}
                      onClick={() => openDeck(deck)}
                      disabled={isLoading}
                      className={`w-full bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-stone-400 transition-all ${isLoading ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 ${isLoading ? 'animate-pulse' : ''}`}>
                          {isLoading ? (
                            <Icon name="hourglass_empty" className="animate-spin" />
                          ) : (
                            <Icon name="style" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-stone-800">{deck.name}</h3>
                          <p className="text-sm text-stone-400">{deck.cards.length} cards</p>
                          
                          {/* Progress indicator */}
                          {answeredCount > 0 ? (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-stone-500">{answeredCount}/{totalCards} answered</span>
                                <span className="text-green-600 font-medium">{correctCount} correct</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-400 to-green-500 rounded-full transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 mt-1 italic">No progress yet • Tap to study</p>
                          )}
                        </div>
                        <Icon name="chevron_right" className="text-stone-300 flex-shrink-0" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : activeTab === 'Resources' ? (
            <div className="space-y-6">
              {/* Lesson PPT */}
              {lessonPPTResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="slideshow" className="text-orange-500" /> Lesson PPT
                  </h3>
                  <div className="space-y-2">
                    {lessonPPTResources.map((r, i) => renderResourceCard(r, i, 'slideshow', 'bg-orange-100', 'text-orange-500', 'border-orange-300'))}
                  </div>
                </div>
              )}

              {/* Lesson PDF */}
              {lessonPDFResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="picture_as_pdf" className="text-red-500" /> Lesson PDF
                  </h3>
                  <div className="space-y-2">
                    {lessonPDFResources.map((r, i) => renderResourceCard(r, i, 'picture_as_pdf', 'bg-red-100', 'text-red-500', 'border-red-300'))}
                  </div>
                </div>
              )}

              {/* Reviewers */}
              {reviewerResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="quiz" className="text-purple-500" /> Reviewers
                  </h3>
                  <div className="space-y-2">
                    {reviewerResources.map((r, i) => renderResourceCard(r, i, 'quiz', 'bg-purple-100', 'text-purple-500', 'border-purple-300'))}
                  </div>
                </div>
              )}

              {/* Videos */}
              {videoResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="play_circle" className="text-blue-500" /> Videos
                  </h3>
                  <div className="space-y-2">
                    {videoResources.map((r, i) => renderResourceCard(r, i, 'play_circle', 'bg-blue-100', 'text-blue-500', 'border-blue-300'))}
                  </div>
                </div>
              )}

              {/* Images (legacy) */}
              {imageResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="image" className="text-teal-500" /> Images
                  </h3>
                  <div className="space-y-2">
                    {imageResources.map((r, i) => renderResourceCard(r, i, 'image', 'bg-teal-100', 'text-teal-500', 'border-teal-300'))}
                  </div>
                </div>
              )}

              {/* Other Files (legacy) */}
              {fileResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="folder" className="text-emerald-500" /> Other Files
                  </h3>
                  <div className="space-y-2">
                    {fileResources.map((r, i) => renderResourceCard(r, i, 'description', 'bg-emerald-100', 'text-emerald-500', 'border-emerald-300'))}
                  </div>
                </div>
              )}

              {subjectResources.length === 0 && (
                <div className="text-center py-12">
                  <Icon name="cloud_upload" className="text-4xl text-stone-300 mb-3" />
                  <p className="text-stone-400 mb-4">No resources available for this subject</p>
                  <button
                    onClick={() => user ? setShowUpload(true) : setShowLogin(true)}
                    className="px-6 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-900 transition-colors"
                  >
                    Upload First Resource
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'Exams' ? (
            <div className="space-y-4">
              {/* Upcoming Exams */}
              {(() => {
                const subjectExams = getSubjectExams(activeSubject);
                const upcomingExams = subjectExams.filter(e => getExamStatus(e) === 'upcoming');
                const ongoingExams = subjectExams.filter(e => getExamStatus(e) === 'ongoing');
                const completedExams = subjectExams.filter(e => getExamStatus(e) === 'completed');
                
                if (subjectExams.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Icon name="event" className="text-4xl text-stone-300 mb-3" />
                      <p className="text-stone-400 mb-4">No exams scheduled for this subject</p>
                      <button
                        onClick={() => user ? setShowAddExam(true) : setShowLogin(true)}
                        className="px-6 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-900 transition-colors"
                      >
                        Add First Exam
                      </button>
                    </div>
                  );
                }
                
                return (
                  <>
                    {/* Ongoing Exams */}
                    {ongoingExams.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          Ongoing Now
                        </h3>
                        <div className="space-y-2">
                          {ongoingExams.map(exam => (
                            <div key={exam.examId} className="bg-green-50 border border-green-200 p-4 rounded-xl">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-green-800">{exam.examType}</p>
                                  <p className="text-sm text-green-700">{formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)}</p>
                                  <p className="text-xs text-green-600 mt-1">Room: {exam.room} • Proctor: {exam.proctor}</p>
                                </div>
                                <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium">
                                  In Progress
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Upcoming Exams */}
                    {upcomingExams.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                          <Icon name="schedule" className="text-amber-500" /> Upcoming
                        </h3>
                        <div className="space-y-2">
                          {upcomingExams.map(exam => (
                            <div key={exam.examId} className="bg-white border border-stone-200 p-4 rounded-xl hover:border-amber-300 transition-all">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-stone-800">{exam.examType}</p>
                                  <p className="text-sm text-stone-600">{formatExamDate(exam.date)}</p>
                                  <p className="text-sm text-stone-500">{formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)}</p>
                                  <p className="text-xs text-stone-400 mt-1">Room: {exam.room} • Proctor: {exam.proctor}</p>
                                  {exam.notes && <p className="text-xs text-stone-400 mt-1 italic">Note: {exam.notes}</p>}
                                  {exam.createdByName && <p className="text-xs text-stone-400 mt-1">Added by: {exam.createdByName}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                    Upcoming
                                  </span>
                                  {user && user.idNumber === exam.createdBy && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setExamToEdit(exam)}
                                        className="p-1 text-stone-400 hover:text-blue-500"
                                        title="Edit exam"
                                      >
                                        <Icon name="edit" className="text-sm" />
                                      </button>
                                      <button
                                        onClick={() => setExamToDelete(exam.examId)}
                                        className="p-1 text-stone-400 hover:text-red-500"
                                        title="Delete exam"
                                      >
                                        <Icon name="delete" className="text-sm" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Completed Exams */}
                    {completedExams.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                          <Icon name="check_circle" className="text-stone-400" /> Completed
                        </h3>
                        <div className="space-y-2">
                          {completedExams.map(exam => (
                            <div key={exam.examId} className="bg-stone-50 border border-stone-200 p-4 rounded-xl opacity-70">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-stone-600">{exam.examType}</p>
                                  <p className="text-sm text-stone-500">{formatExamDate(exam.date)}</p>
                                  <p className="text-sm text-stone-400">{formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)}</p>
                                  <p className="text-xs text-stone-400 mt-1">Room: {exam.room}</p>
                                </div>
                                <span className="px-2 py-1 bg-stone-200 text-stone-600 text-xs rounded-full font-medium">
                                  Done
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : null}
        </main>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!examToDelete}
          title="Delete Exam"
          message="Are you sure you want to delete this exam? This action cannot be undone."
          onConfirm={async () => {
            if (examToDelete) {
              await deleteExamFromBackend(examToDelete);
            }
          }}
          onClose={() => setExamToDelete(null)}
        />

        {/* Edit Exam Modal */}
        {examToEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Edit Exam</h2>
                  <button onClick={() => setExamToEdit(null)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await updateExamToBackend(examToEdit.examId, {
                    courseCode: formData.get('courseCode') as string,
                    courseName: subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    setExamToEdit(null);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course *</label>
                    <select name="courseCode" required defaultValue={examToEdit.courseCode} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500">
                      <option value="">Select a course</option>
                      {displaySubjects.map(s => (
                        <option key={s} value={s}>{s} {subjectInfo[s]?.name ? `- ${subjectInfo[s].name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Exam Type *</label>
                    <select name="examType" required defaultValue={examToEdit.examType} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500">
                      <option value="LE Deadline">LE Deadline</option>
                      <option value="Quiz">Quiz</option>
                      <option value="Midterm Exam">Midterm Exam</option>
                      <option value="Final Exam">Final Exam</option>
                      <option value="Reporting">Reporting</option>
                      <option value="Performance">Performance</option>
                      <option value="Presentation">Presentation</option>
                      <option value="Submission">Submission</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={examToEdit.date} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required defaultValue={examToEdit.startTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required defaultValue={examToEdit.endTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required defaultValue={examToEdit.room} placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" defaultValue={examToEdit.proctor || ''} placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} defaultValue={examToEdit.notes || ''} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="save" /> Save Changes
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RESOURCE_VIEW
  if (view === 'RESOURCE_VIEW' && activeResource) {
    return (
      <ResourceViewer 
        resource={activeResource} 
        onClose={() => { 
          setActiveResource(null); 
          setView(previousView === 'ALL_RESOURCES' ? 'ALL_RESOURCES' : 'SUBJECT'); 
        }} 
      />
    );
  }

  // DECK_OVERVIEW View
  if (view === 'DECK_OVERVIEW' && activeDeck) {
    const deckProgress = getDeckProgress(activeDeck.name);
    const answeredCount = deckProgress ? Object.values(deckProgress.cardStatuses).filter(s => s !== 'unanswered').length : 0;
    const correctCount = deckProgress ? Object.values(deckProgress.cardStatuses).filter(s => s === 'correct').length : 0;
    const incorrectCount = deckProgress ? Object.values(deckProgress.cardStatuses).filter(s => s === 'incorrect').length : 0;
    const progressPercent = activeDeck.cards.length > 0 ? Math.round((answeredCount / activeDeck.cards.length) * 100) : 0;
    const hasProgress = answeredCount > 0;

    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col">
        {/* Continue Modal */}
        {showContinueModal && savedProgress && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h2 className="text-xl font-bold text-stone-800 mb-2">Continue Progress?</h2>
              <p className="text-stone-500 text-sm mb-4">
                You have saved progress on this deck.
              </p>
              <div className="bg-stone-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-stone-500">Progress</span>
                  <span className="font-semibold text-stone-800">
                    {Object.values(savedProgress.cardStatuses).filter(s => s !== 'unanswered').length} / {activeDeck.cards.length} cards
                  </span>
                </div>
                <div className="h-2 bg-stone-200 rounded-full overflow-hidden mb-3">
                  <div 
                    className="h-full bg-stone-800 rounded-full transition-all"
                    style={{ width: `${(Object.values(savedProgress.cardStatuses).filter(s => s !== 'unanswered').length / activeDeck.cards.length) * 100}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Icon name="check_circle" className="text-sm" />
                    {Object.values(savedProgress.cardStatuses).filter(s => s === 'correct').length} correct
                  </span>
                  <span className="text-red-500 flex items-center gap-1">
                    <Icon name="cancel" className="text-sm" />
                    {Object.values(savedProgress.cardStatuses).filter(s => s === 'incorrect').length} missed
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => startSession('continue')}
                  className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Icon name="play_arrow" /> Continue
                </button>
                <button
                  onClick={() => {
                    clearDeckProgress(activeDeck.name);
                    setSavedProgress(null);
                    setShowContinueModal(false);
                    setView('DECK_OVERVIEW');
                  }}
                  className="w-full py-3 bg-stone-100 text-stone-800 rounded-xl font-semibold"
                >
                  Start Fresh
                </button>
                <button
                  onClick={() => {
                    setShowContinueModal(false);
                    setView('DECK_OVERVIEW');
                  }}
                  className="w-full py-2 text-stone-500 text-sm"
                >
                  View Deck
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="bg-white border-b border-stone-200 sticky top-0 z-10 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => activeSubject ? setView('SUBJECT') : resetHome()} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
                <Icon name="arrow_back" className="text-stone-600" />
              </button>
              <div>
                <h1 className="font-bold text-stone-800">{activeDeck.name}</h1>
                <p className="text-xs text-stone-500">{activeDeck.cards.length} cards</p>
              </div>
            </div>
          </div>
        </header>

        {/* Progress Bar & Stats */}
        {hasProgress && (
          <div className="bg-white border-b border-stone-200 px-4 py-3">
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-stone-600">Your Progress</span>
                <span className="text-sm text-stone-500">{progressPercent}% complete</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-2">
                <div className="h-full flex">
                  <div 
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${(correctCount / activeDeck.cards.length) * 100}%` }}
                  />
                  <div 
                    className="bg-red-400 transition-all"
                    style={{ width: `${(incorrectCount / activeDeck.cards.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-600 flex items-center gap-1">
                  <Icon name="check_circle" className="text-sm" /> {correctCount} correct
                </span>
                <span className="text-red-500 flex items-center gap-1">
                  <Icon name="cancel" className="text-sm" /> {incorrectCount} missed
                </span>
                <span className="text-stone-400 flex items-center gap-1">
                  <Icon name="radio_button_unchecked" className="text-sm" /> {activeDeck.cards.length - answeredCount} remaining
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Play Options */}
        <div className="bg-white border-b border-stone-200 px-4 py-3">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-stone-100 rounded-xl flex-shrink-0">
                <button
                  onClick={() => setPlayMode('shuffle')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    playMode === 'shuffle' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
                  }`}
                >
                  <Icon name="shuffle" className="text-base" /> Shuffle
                </button>
                <button
                  onClick={() => setPlayMode('chronological')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    playMode === 'chronological' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
                  }`}
                >
                  <Icon name="format_list_numbered" className="text-base" /> In Order
                </button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 flex-1">
                <button 
                  onClick={() => startSession('new', playMode)}
                  className="flex-1 bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Icon name="play_arrow" /> {hasProgress ? 'Start Over' : 'Start'}
                </button>
                {hasProgress && incorrectCount > 0 && (
                  <button 
                    onClick={() => startSession('retry', playMode)}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold flex items-center gap-2"
                  >
                    <Icon name="refresh" /> Retry Missed ({incorrectCount})
                  </button>
                )}
              </div>
            </div>
            {hasProgress && (
              <button
                onClick={() => {
                  if (confirm('Clear all progress for this deck?')) {
                    clearDeckProgress(activeDeck.name);
                    setScores({});
                  }
                }}
                className="mt-2 text-xs text-stone-400 hover:text-red-500 flex items-center gap-1"
              >
                <Icon name="delete" className="text-sm" /> Clear Progress
              </button>
            )}
          </div>
        </div>

        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDeck.cards.map((card, i) => {
              const cardStatus = deckProgress?.cardStatuses[card.id];
              return (
                <div 
                  key={i} 
                  className={`bg-white rounded-xl p-4 border transition-all ${
                    cardStatus === 'correct' ? 'border-emerald-300 bg-emerald-50/50' :
                    cardStatus === 'incorrect' ? 'border-red-300 bg-red-50/50' :
                    'border-stone-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-stone-300">#{i + 1}</span>
                    {cardStatus === 'correct' && (
                      <span className="text-emerald-500 flex items-center gap-1 text-xs">
                        <Icon name="check_circle" className="text-sm" /> Got it
                      </span>
                    )}
                    {cardStatus === 'incorrect' && (
                      <span className="text-red-500 flex items-center gap-1 text-xs">
                        <Icon name="cancel" className="text-sm" /> Missed
                      </span>
                    )}
                  </div>
                  <p className="text-stone-800 font-medium mt-1">{card.q}</p>
                  <div className="h-px bg-stone-100 my-2"></div>
                  <p className="text-stone-500 text-sm">{card.a}</p>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // PLAY View
  if (view === 'PLAY' && queue.length > 0) {
    const card = queue[currentIndex];
    const progress = Math.round(((currentIndex + 1) / queue.length) * 100);
    const correctSoFar = Object.values(scores).filter(s => s === 'correct').length;
    const incorrectSoFar = Object.values(scores).filter(s => s === 'incorrect').length;

    return (
      <div className="h-[100dvh] bg-[#E7E5E4] flex flex-col overflow-hidden">
        <header className="flex-shrink-0 bg-[#F5F5F4] px-4 py-3 border-b border-stone-200/50">
          <div className="flex justify-between items-center">
            <button onClick={() => setView('DECK_OVERVIEW')} className="p-2 -ml-2">
              <Icon name="close" className="text-stone-500" />
            </button>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-stone-800">{activeDeck?.name}</p>
              <p className="text-xs text-stone-400">
                {playMode === 'shuffle' ? 'Shuffled' : 'In Order'} • Card {currentIndex + 1} of {queue.length}
              </p>
            </div>
            <div className="w-10" />
          </div>
          {/* Progress Bar */}
          <div className="mt-2">
            <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full flex transition-all">
                <div 
                  className="bg-emerald-500"
                  style={{ width: `${(correctSoFar / queue.length) * 100}%` }}
                />
                <div 
                  className="bg-red-400"
                  style={{ width: `${(incorrectSoFar / queue.length) * 100}%` }}
                />
                <div 
                  className="bg-stone-400"
                  style={{ width: `${((currentIndex - correctSoFar - incorrectSoFar) / queue.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <div className="flex gap-3">
                <span className="text-emerald-600 flex items-center gap-1">
                  <Icon name="check" className="text-xs" /> {correctSoFar}
                </span>
                <span className="text-red-500 flex items-center gap-1">
                  <Icon name="close" className="text-xs" /> {incorrectSoFar}
                </span>
              </div>
              <span className="text-stone-500">{progress}%</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 perspective-1000 min-h-0">
          <div 
            className="w-full max-w-sm h-full max-h-[60vh] md:max-h-[65vh] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`w-full h-full duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl p-6 flex flex-col items-center justify-between">
                <div className="w-full flex justify-between text-xs font-bold text-stone-300 uppercase">
                  <span>Question</span>
                  <span>{currentIndex + 1}/{queue.length}</span>
                </div>
                <p className="text-lg md:text-xl font-medium text-stone-800 text-center px-2 overflow-y-auto max-h-[70%]">{card.q}</p>
                <p className="text-xs text-stone-300 uppercase">Tap to flip</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-stone-800 rounded-3xl shadow-xl p-6 flex flex-col items-center justify-between text-white">
                <div className="w-full flex justify-between text-xs font-bold text-stone-500 uppercase">
                  <span>Answer</span>
                  <span>{currentIndex + 1}/{queue.length}</span>
                </div>
                <p className="text-lg md:text-xl font-medium text-center px-2 overflow-y-auto max-h-[70%]">{card.a}</p>
                <p className="text-xs text-stone-500 uppercase">Mark result</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="flex-shrink-0 bg-[#F5F5F4] p-4 border-t border-stone-200">
          <div className="max-w-sm mx-auto">
            {!isFlipped ? (
              <div className="flex gap-3">
                <button 
                  onClick={() => currentIndex > 0 && setCurrentIndex(c => c - 1)}
                  disabled={currentIndex === 0}
                  className="w-14 h-14 rounded-xl bg-stone-200 flex items-center justify-center disabled:opacity-30"
                >
                  <Icon name="arrow_back" className="text-stone-600" />
                </button>
                <button 
                  onClick={() => setIsFlipped(true)}
                  className="flex-1 h-14 bg-stone-800 text-white rounded-xl font-semibold"
                >
                  Reveal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleScore('incorrect')}
                  className="h-14 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Icon name="close" /> Missed
                </button>
                <button 
                  onClick={() => handleScore('correct')}
                  className="h-14 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Icon name="check" /> Got it
                </button>
              </div>
            )}
          </div>
        </footer>
      </div>
    );
  }

  // SUMMARY View
  if (view === 'SUMMARY') {
    const total = queue.length;
    const correct = queue.filter(c => scores[c.id] === 'correct').length;
    const incorrect = queue.filter(c => scores[c.id] === 'incorrect').length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Get full deck progress
    const fullProgress = activeDeck ? getDeckProgress(activeDeck.name) : null;
    const totalDeckCards = activeDeck?.cards.length || 0;
    const totalAnswered = fullProgress ? Object.values(fullProgress.cardStatuses).filter(s => s !== 'unanswered').length : 0;
    const totalCorrect = fullProgress ? Object.values(fullProgress.cardStatuses).filter(s => s === 'correct').length : 0;

    return (
      <div className="min-h-screen bg-[#F5F5F4] p-4 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <svg className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="35" stroke="#E7E5E4" strokeWidth="6" fill="none" />
              <circle cx="40" cy="40" r="35" stroke={percentage >= 70 ? '#10B981' : percentage >= 50 ? '#F59E0B' : '#EF4444'} strokeWidth="6" fill="none" 
                strokeDasharray="220" strokeDashoffset={220 - (220 * percentage / 100)} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">{percentage}%</span>
          </div>
          
          <h2 className="text-xl font-bold text-stone-800 mb-1">
            {percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good Job!' : percentage >= 40 ? 'Keep Practicing!' : 'Keep Going!'}
          </h2>
          <p className="text-stone-500 text-sm mb-4">Session Complete</p>

          {/* Session Stats */}
          <div className="flex justify-center gap-6 mb-4 p-4 bg-stone-50 rounded-xl">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{correct}</div>
              <div className="text-xs text-stone-400">Correct</div>
            </div>
            <div className="w-px bg-stone-200"></div>
            <div>
              <div className="text-2xl font-bold text-red-500">{incorrect}</div>
              <div className="text-xs text-stone-400">Missed</div>
            </div>
          </div>

          {/* Overall Deck Progress */}
          {fullProgress && totalDeckCards > total && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl text-left">
              <p className="text-xs text-blue-600 font-semibold mb-2">Overall Deck Progress</p>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(totalAnswered / totalDeckCards) * 100}%` }}
                />
              </div>
              <p className="text-xs text-blue-700">
                {totalAnswered} of {totalDeckCards} cards completed ({Math.round((totalAnswered / totalDeckCards) * 100)}%)
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Accuracy: {totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%
              </p>
            </div>
          )}

          <div className="space-y-2">
            {incorrect > 0 && (
              <button onClick={() => startSession('retry', playMode)} className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold flex items-center justify-center gap-2">
                <Icon name="refresh" /> Review Missed ({incorrect})
              </button>
            )}
            <button onClick={() => startSession('new', playMode)} className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
              <Icon name="replay" /> Play Again
            </button>
            <button onClick={() => startSession('smart', playMode)} className="w-full py-3 bg-stone-100 text-stone-800 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Icon name="psychology" /> Smart Review
            </button>
            <button onClick={() => setView('DECK_OVERVIEW')} className="w-full py-3 text-stone-500 text-sm">
              Back to Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ANALYTICS View
  if (view === 'ANALYTICS') {
    // Fetch analytics if not loaded
    if (!userAnalytics && !loadingAnalytics && user) {
      fetchUserAnalytics();
    }

    return (
      <div className="min-h-screen bg-[#F5F5F4]">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={setUser}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={resetHome} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-lg">
              <Icon name="arrow_back" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-stone-800">My Analytics</h1>
              <p className="text-sm text-stone-500">Track your learning progress</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          {!user ? (
            <div className="text-center py-12">
              <Icon name="person" className="text-4xl text-stone-300 mb-2" />
              <p className="text-stone-500 mb-4">Sign in to view your analytics</p>
              <button 
                onClick={() => setShowLogin(true)}
                className="px-6 py-2 bg-stone-800 text-white rounded-xl font-semibold"
              >
                Sign In
              </button>
            </div>
          ) : loadingAnalytics ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-stone-500">Loading analytics...</p>
            </div>
          ) : !userAnalytics || !userAnalytics.analytics || userAnalytics.analytics.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="school" className="text-4xl text-stone-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-800 mb-2">No Analytics Yet</h3>
              <p className="text-stone-500 mb-1">You haven't completed any flashcard sessions yet.</p>
              <p className="text-stone-400 text-sm mb-6">Start studying to track your progress!</p>
              <button 
                onClick={() => { setView('HOME'); }}
                className="px-6 py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-700 transition-colors inline-flex items-center gap-2"
              >
                <Icon name="play_arrow" />
                Start Studying
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Stats */}
              {userAnalytics.summary?.analytics && (
                <div className="bg-white rounded-2xl p-6 border border-stone-200">
                  <h2 className="font-bold text-stone-800 mb-4">Overall Progress</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      const subjects = userAnalytics.summary.analytics.subjects || {};
                      let totalAttempts = 0;
                      let totalCorrect = 0;
                      let totalDecks = 0;
                      Object.values(subjects).forEach((s: any) => {
                        totalAttempts += s.totalAttempts || 0;
                        totalCorrect += s.correct || 0;
                        totalDecks += Object.keys(s.decks || {}).length;
                      });
                      const avgScore = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
                      return (
                        <>
                          <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <div className="text-2xl font-bold text-stone-800">{Object.keys(subjects).length}</div>
                            <div className="text-xs text-stone-500">Subjects</div>
                          </div>
                          <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <div className="text-2xl font-bold text-stone-800">{totalDecks}</div>
                            <div className="text-xs text-stone-500">Decks Played</div>
                          </div>
                          <div className="text-center p-4 bg-stone-50 rounded-xl">
                            <div className="text-2xl font-bold text-stone-800">{totalAttempts}</div>
                            <div className="text-xs text-stone-500">Total Cards</div>
                          </div>
                          <div className="text-center p-4 bg-emerald-50 rounded-xl">
                            <div className="text-2xl font-bold text-emerald-600">{avgScore}%</div>
                            <div className="text-xs text-stone-500">Avg Score</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Per Subject */}
              {userAnalytics.summary?.analytics?.subjects && Object.entries(userAnalytics.summary.analytics.subjects).map(([subject, data]: [string, any]) => (
                <div key={subject} className="bg-white rounded-2xl p-6 border border-stone-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-stone-800">{subject}</h2>
                    <span className="text-sm text-stone-500">
                      {data.totalAttempts > 0 ? Math.round((data.correct / data.totalAttempts) * 100) : 0}% accuracy
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-stone-100 rounded-full mb-4 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${data.totalAttempts > 0 ? (data.correct / data.totalAttempts) * 100 : 0}%` }}
                    ></div>
                  </div>

                  <div className="flex gap-4 text-sm mb-4">
                    <span className="text-emerald-600"><strong>{data.correct}</strong> correct</span>
                    <span className="text-red-500"><strong>{data.incorrect}</strong> incorrect</span>
                    <span className="text-stone-500">{Object.keys(data.decks || {}).length} decks</span>
                  </div>

                  {/* Decks breakdown */}
                  {data.decks && Object.entries(data.decks).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-400 uppercase tracking-wide">Decks</p>
                      {Object.entries(data.decks).map(([deckName, deckData]: [string, any]) => (
                        <div key={deckName} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg text-sm">
                          <span className="font-medium text-stone-700 truncate flex-1">{deckName}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-600">{deckData.correct}✓</span>
                            <span className="text-red-500">{deckData.incorrect}✗</span>
                            <span className="bg-stone-200 px-2 py-0.5 rounded text-stone-600">Best: {deckData.bestScore}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Detailed Table */}
              {userAnalytics.analytics && userAnalytics.analytics.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-stone-200">
                  <h2 className="font-bold text-stone-800 mb-4">Session History</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200">
                          <th className="text-left py-2 text-stone-500 font-medium">Subject</th>
                          <th className="text-left py-2 text-stone-500 font-medium">Deck</th>
                          <th className="text-right py-2 text-stone-500 font-medium">Attempts</th>
                          <th className="text-right py-2 text-stone-500 font-medium">Best</th>
                          <th className="text-right py-2 text-stone-500 font-medium">Avg</th>
                          <th className="text-right py-2 text-stone-500 font-medium">Last Played</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userAnalytics.analytics.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b border-stone-100">
                            <td className="py-2 text-stone-700">{row.subject}</td>
                            <td className="py-2 text-stone-700 truncate max-w-32">{row.deck}</td>
                            <td className="py-2 text-right text-stone-600">{row.totalAttempts}</td>
                            <td className="py-2 text-right text-emerald-600">{row.bestScore}%</td>
                            <td className="py-2 text-right text-stone-600">{row.averageScore}%</td>
                            <td className="py-2 text-right text-stone-400 text-xs">
                              {row.lastPlayed ? new Date(row.lastPlayed).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // EXAMS View - All Exams Schedule
  // ALL_RESOURCES View
  if (view === 'ALL_RESOURCES') {
    // Get all resources flattened with subject info
    const allResourcesList = Object.entries(resources).flatMap(([subject, items]) => 
      items.map(r => ({ ...r, subject }))
    );
    
    // Get unique resource categories (types)
    const resourceCategories = Array.from(new Set(allResourcesList.map(r => r.category))).sort();
    
    // Filter resources (using state from top level)
    const filteredResources = allResourcesList.filter(r => {
      const matchesSearch = !resourceSearchQuery || 
        r.name.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
        r.subject.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
        (subjectInfo[r.subject]?.name || '').toLowerCase().includes(resourceSearchQuery.toLowerCase());
      const matchesSubject = !selectedSubjectFilter || r.subject === selectedSubjectFilter;
      const matchesCategory = !selectedCategoryFilter || r.category === selectedCategoryFilter;
      return matchesSearch && matchesSubject && matchesCategory;
    });

    const getResourceIcon = (category: string) => {
      switch (category.toLowerCase()) {
        case 'lesson ppt':
        case 'ppt':
          return 'slideshow';
        case 'lesson pdf':
        case 'pdf':
          return 'picture_as_pdf';
        case 'reviewer':
          return 'quiz';
        case 'video':
          return 'play_circle';
        case 'link':
          return 'link';
        default:
          return 'description';
      }
    };

    const getResourceColor = (category: string) => {
      switch (category.toLowerCase()) {
        case 'lesson ppt':
        case 'ppt':
          return 'bg-orange-100 text-orange-600';
        case 'lesson pdf':
        case 'pdf':
          return 'bg-red-100 text-red-600';
        case 'reviewer':
          return 'bg-purple-100 text-purple-600';
        case 'video':
          return 'bg-pink-100 text-pink-600';
        case 'link':
          return 'bg-blue-100 text-blue-600';
        default:
          return 'bg-stone-100 text-stone-600';
      }
    };
    
    return (
      <div className="min-h-screen bg-[#F5F5F4]">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={setUser}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={resetHome} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
              <Icon name="arrow_back" className="text-stone-600" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-stone-800 text-lg">All Resources</h1>
              <p className="text-xs text-stone-500">{allResourcesList.length} total files</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4">
          {/* Search and Filters */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 mb-4 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search resources by name, type, or subject..."
                value={resourceSearchQuery}
                onChange={(e) => setResourceSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {resourceSearchQuery && (
                <button
                  onClick={() => setResourceSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-100 rounded-full"
                >
                  <Icon name="close" className="text-stone-400 text-sm" />
                </button>
              )}
            </div>
            
            {/* Filter Dropdowns */}
            <div className="flex gap-3">
              {/* Subject Filter */}
              <div className="flex-1">
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">All Subjects</option>
                  {displaySubjects.map(s => (
                    <option key={s} value={s}>{s} {subjectInfo[s]?.name ? `- ${subjectInfo[s].name}` : ''}</option>
                  ))}
                </select>
              </div>
              
              {/* Type Filter */}
              <div className="flex-1">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">All Types</option>
                  {resourceCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Active Filters Display */}
            {(selectedSubjectFilter || selectedCategoryFilter || resourceSearchQuery) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-500">Filters:</span>
                {resourceSearchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                    "{resourceSearchQuery}"
                    <button onClick={() => setResourceSearchQuery('')} className="hover:text-blue-900">
                      <Icon name="close" className="text-xs" />
                    </button>
                  </span>
                )}
                {selectedSubjectFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                    {selectedSubjectFilter}
                    <button onClick={() => setSelectedSubjectFilter('')} className="hover:text-green-900">
                      <Icon name="close" className="text-xs" />
                    </button>
                  </span>
                )}
                {selectedCategoryFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                    {selectedCategoryFilter}
                    <button onClick={() => setSelectedCategoryFilter('')} className="hover:text-purple-900">
                      <Icon name="close" className="text-xs" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setResourceSearchQuery('');
                    setSelectedSubjectFilter('');
                    setSelectedCategoryFilter('');
                  }}
                  className="text-xs text-stone-500 hover:text-stone-700 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-stone-500">
              Showing {filteredResources.length} of {allResourcesList.length} resources
            </p>
          </div>

          {/* Resources Grid */}
          {filteredResources.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="search_off" className="text-5xl text-stone-300 mb-4" />
              <h3 className="text-lg font-semibold text-stone-600 mb-2">No Resources Found</h3>
              <p className="text-stone-400">
                {allResourcesList.length === 0 
                  ? 'No resources have been added yet' 
                  : 'Try adjusting your filters or search query'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredResources.map((resource, idx) => (
                <button
                  key={`${resource.subject}-${resource.name}-${idx}`}
                  onClick={() => {
                    setActiveSubject(resource.subject);
                    setActiveResource(resource);
                    setPreviousView('ALL_RESOURCES');
                    setView('RESOURCE_VIEW');
                  }}
                  className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${getResourceColor(resource.category)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon name={getResourceIcon(resource.category)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-800 truncate group-hover:text-blue-600 transition-colors">
                        {resource.name}
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {resource.subject} {subjectInfo[resource.subject]?.name && `• ${subjectInfo[resource.subject].name}`}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 ${getResourceColor(resource.category)} rounded-full text-xs font-medium`}>
                          {resource.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (view === 'EXAMS') {
    const ongoingExams = exams.filter(e => getExamStatus(e) === 'ongoing');
    const upcomingExams = exams.filter(e => getExamStatus(e) === 'upcoming');
    const completedExams = exams.filter(e => getExamStatus(e) === 'completed');
    
    return (
      <div className="min-h-screen bg-[#F5F5F4]">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={setUser}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
        />
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={resetHome} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
              <Icon name="arrow_back" className="text-stone-600" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-stone-800 text-lg">Schedule</h1>
              <p className="text-xs text-stone-500">{exams.length} total exams</p>
            </div>
            <button
              onClick={() => user ? setShowAddExam(true) : setShowLogin(true)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors"
            >
              <Icon name="add" className="text-sm" />
              Add Exam
            </button>
          </div>
        </header>

        {/* Add Exam Modal */}
        {showAddExam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Add Exam</h2>
                  <button onClick={() => setShowAddExam(false)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await addExamToBackend({
                    courseCode: formData.get('courseCode') as string,
                    courseName: formData.get('courseName') as string || subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    setShowAddExam(false);
                    form.reset();
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Code *</label>
                    <select name="courseCode" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500">
                      <option value="">Select a course</option>
                      {displaySubjects.map(s => (
                        <option key={s} value={s}>{s} {subjectInfo[s]?.name ? `- ${subjectInfo[s].name}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Name</label>
                    <input type="text" name="courseName" placeholder="e.g., Introduction to Language" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Exam Type *</label>
                    <select name="examType" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500">
                      <option value="LE Deadline">LE Deadline</option>
                      <option value="Quiz">Quiz</option>
                      <option value="Midterm Exam">Midterm Exam</option>
                      <option value="Final Exam">Final Exam</option>
                      <option value="Reporting">Reporting</option>
                      <option value="Performance">Performance</option>
                      <option value="Presentation">Presentation</option>
                      <option value="Submission">Submission</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="event" /> Add Exam
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-5xl mx-auto p-4">
          {exams.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="event" className="text-5xl text-stone-300 mb-4" />
              <h3 className="text-lg font-semibold text-stone-600 mb-2">No Exams Scheduled</h3>
              <p className="text-stone-400 mb-4">Add your first exam to get started</p>
              <button
                onClick={() => user ? setShowAddExam(true) : setShowLogin(true)}
                className="px-6 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-900 transition-colors"
              >
                Add Exam
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ongoing Exams */}
              {ongoingExams.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Ongoing Now ({ongoingExams.length})
                  </h2>
                  <div className="space-y-3">
                    {ongoingExams.map(exam => (
                      <div key={exam.examId} className="bg-green-50 border border-green-200 p-4 rounded-xl">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white">
                              <Icon name="schedule" className="text-xl" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-green-800">{exam.courseCode}</span>
                                <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">
                                  {exam.examType}
                                </span>
                              </div>
                              {exam.courseName && <p className="text-sm text-green-700">{exam.courseName}</p>}
                              <p className="text-sm text-green-600 mt-1">
                                {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)} • Room: {exam.room}
                              </p>
                              {exam.proctor && <p className="text-xs text-green-600">Proctor: {exam.proctor}</p>}
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full font-semibold animate-pulse">
                            IN PROGRESS
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Exams */}
              {upcomingExams.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="schedule" className="text-amber-500" />
                    Upcoming ({upcomingExams.length})
                  </h2>
                  <div className="space-y-3">
                    {upcomingExams.map(exam => (
                      <div key={exam.examId} className="bg-white border border-stone-200 p-4 rounded-xl hover:border-amber-300 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                              <Icon name="event" className="text-xl" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-800">{exam.courseCode}</span>
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                  {exam.examType}
                                </span>
                              </div>
                              {exam.courseName && <p className="text-sm text-stone-500">{exam.courseName}</p>}
                              <p className="text-sm text-stone-600 mt-1">
                                <span className="font-medium">{formatExamDate(exam.date)}</span>
                              </p>
                              <p className="text-sm text-stone-500">
                                {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)} • Room: {exam.room}
                              </p>
                              {exam.proctor && <p className="text-xs text-stone-400">Proctor: {exam.proctor}</p>}
                              {exam.notes && <p className="text-xs text-stone-400 italic mt-1">"{exam.notes}"</p>}
                              {exam.createdByName && <p className="text-xs text-stone-400">Added by: {exam.createdByName}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              Upcoming
                            </span>
                            {user && user.idNumber === exam.createdBy && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setExamToEdit(exam)}
                                  className="p-1 text-stone-400 hover:text-blue-500"
                                  title="Edit exam"
                                >
                                  <Icon name="edit" className="text-sm" />
                                </button>
                                <button
                                  onClick={() => setExamToDelete(exam.examId)}
                                  className="p-1 text-stone-400 hover:text-red-500"
                                  title="Delete exam"
                                >
                                  <Icon name="delete" className="text-sm" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Exams */}
              {completedExams.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="check_circle" className="text-stone-400" />
                    Completed ({completedExams.length})
                  </h2>
                  <div className="space-y-3">
                    {completedExams.map(exam => (
                      <div key={exam.examId} className="bg-stone-50 border border-stone-200 p-4 rounded-xl opacity-60">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-stone-200 rounded-xl flex items-center justify-center text-stone-500">
                              <Icon name="check" className="text-xl" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-600">{exam.courseCode}</span>
                                <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-xs rounded-full font-medium">
                                  {exam.examType}
                                </span>
                              </div>
                              {exam.courseName && <p className="text-sm text-stone-500">{exam.courseName}</p>}
                              <p className="text-sm text-stone-500 mt-1">
                                {formatExamDate(exam.date)} • {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)}
                              </p>
                              <p className="text-xs text-stone-400">Room: {exam.room}</p>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-stone-200 text-stone-600 text-xs rounded-full font-medium">
                            Done
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!examToDelete}
          title="Delete Exam"
          message="Are you sure you want to delete this exam? This action cannot be undone."
          onConfirm={async () => {
            if (examToDelete) {
              await deleteExamFromBackend(examToDelete);
            }
          }}
          onClose={() => setExamToDelete(null)}
        />

        {/* Edit Exam Modal */}
        {examToEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Edit Exam</h2>
                  <button onClick={() => setExamToEdit(null)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await updateExamToBackend(examToEdit.examId, {
                    courseCode: formData.get('courseCode') as string,
                    courseName: subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    setExamToEdit(null);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course *</label>
                    <select name="courseCode" required defaultValue={examToEdit.courseCode} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500">
                      <option value="">Select a course</option>
                      {displaySubjects.map(s => (
                        <option key={s} value={s}>{s} {subjectInfo[s]?.name ? `- ${subjectInfo[s].name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Exam Type *</label>
                    <select name="examType" required defaultValue={examToEdit.examType} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500">
                      <option value="LE Deadline">LE Deadline</option>
                      <option value="Quiz">Quiz</option>
                      <option value="Midterm Exam">Midterm Exam</option>
                      <option value="Final Exam">Final Exam</option>
                      <option value="Reporting">Reporting</option>
                      <option value="Performance">Performance</option>
                      <option value="Presentation">Presentation</option>
                      <option value="Submission">Submission</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={examToEdit.date} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required defaultValue={examToEdit.startTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required defaultValue={examToEdit.endTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required defaultValue={examToEdit.room} placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" defaultValue={examToEdit.proctor || ''} placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} defaultValue={examToEdit.notes || ''} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="save" /> Save Changes
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
