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

type AppView = 'HOME' | 'SUBJECT' | 'DECK_OVERVIEW' | 'PLAY' | 'SUMMARY' | 'RESOURCE_VIEW' | 'ANALYTICS';

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
  const getEmbedUrl = (url: string) => {
    // Google Drive file
    if (url.includes('drive.google.com')) {
      const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || 
                     url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
      if (fileId) {
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

  const renderContent = () => {
    const embedUrl = getEmbedUrl(resource.url);
    
    if (resource.category === 'Video') {
      return (
        <iframe
          src={embedUrl}
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    
    if (resource.category === 'Image') {
      return (
        <img 
          src={embedUrl} 
          alt={resource.name} 
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      );
    }
    
    // Files (PDF, PPT, etc.)
    return (
      <iframe
        src={embedUrl}
        className="w-full h-full rounded-lg bg-white"
        title={resource.name}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      <div className="flex justify-between items-center p-4 bg-stone-900">
        <h2 className="text-white font-semibold truncate">{resource.name}</h2>
        <button onClick={onClose} className="text-white hover:text-stone-300 p-2">
          <Icon name="close" className="text-2xl" />
        </button>
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
  
  // Navigation State
  const [activeSubject, setActiveSubject] = useState<string | null>(() => {
    return localStorage.getItem('flashmaster_lastSubject');
  });
  const [activeTab, setActiveTab] = useState<'Flashcards' | 'Resources'>(() => {
    const saved = localStorage.getItem('flashmaster_lastTab');
    return (saved as 'Flashcards' | 'Resources') || 'Flashcards';
  });
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);

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

  // Session State
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  // Analytics State
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

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

      if (toastId) updateToast(toastId, 'Finalizing...', 'loading', 95);

      // Process subjects from Category sheet
      if (data.subjects && Array.isArray(data.subjects)) {
        setApiSubjects(data.subjects);
        localStorage.setItem('flashmaster_subjects', JSON.stringify(data.subjects));
      }
      
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

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const openSubject = (subject: string) => {
    setActiveSubject(subject);
    setActiveTab('Flashcards');
    setView('SUBJECT');
  };

  const openDeck = (deck: Deck) => {
    setActiveDeck(deck);
    setView('DECK_OVERVIEW');
  };

  const openResource = (resource: Resource) => {
    setActiveResource(resource);
    setView('RESOURCE_VIEW');
  };

  const startSession = (mode: 'new' | 'retry' | 'smart') => {
    if (!activeDeck) return;
    let newQueue: Card[] = [];

    if (mode === 'new') {
      newQueue = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    } else if (mode === 'retry') {
      newQueue = activeDeck.cards.filter(c => scores[c.id] === 'incorrect');
    } else {
      const incorrect = activeDeck.cards.filter(c => scores[c.id] === 'incorrect');
      const correct = activeDeck.cards.filter(c => scores[c.id] !== 'incorrect');
      newQueue = [...incorrect.sort(() => Math.random() - 0.5), ...correct.sort(() => Math.random() - 0.5)];
    }

    if (newQueue.length === 0) {
      alert("No cards to play!");
      return;
    }

    setScores({});
    setQueue(newQueue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionStartTime(Date.now());
    setView('PLAY');
  };

  const handleScore = (result: 'correct' | 'incorrect') => {
    const card = queue[currentIndex];
    const newScores = { ...scores, [card.id]: result };
    setScores(newScores);
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
              <p className="text-sm opacity-80">Welcome back,</p>
              <p className="text-xl font-bold">{user.name}</p>
              <p className="text-xs opacity-60 mt-1">ID: {user.idNumber}</p>
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
                    <p className="text-xs text-stone-400 mt-1">
                      {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                    </p>
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
        className={`bg-white p-4 rounded-xl border border-stone-200 hover:${borderColor} transition-all`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => openResource(r)}
            className="flex-1 flex items-center gap-3 text-left"
          >
            <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center ${iconColor}`}>
              <Icon name={icon} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-700 truncate">{r.name || r.title}</p>
              {r.description && <p className="text-xs text-stone-400 truncate">{r.description}</p>}
              {r.submittedByName && (
                <p className="text-xs text-stone-400">by {r.submittedByName}</p>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openResource(r)}
              className="p-2 text-stone-400 hover:text-stone-600"
            >
              <Icon name="open_in_new" className="text-sm" />
            </button>
            {user && r.submittedBy === user.idNumber && (
              <button
                onClick={() => handleDeleteResource(r)}
                className="p-2 text-stone-400 hover:text-red-500"
                title="Delete"
              >
                <Icon name="delete" className="text-sm" />
              </button>
            )}
          </div>
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
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={resetHome} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
              <Icon name="arrow_back" className="text-stone-600" />
            </button>
            <h1 className="font-bold text-stone-800 text-lg flex-1">{activeSubject}</h1>
            {activeTab === 'Resources' && (
              <button
                onClick={() => user ? setShowUpload(true) : setShowLogin(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors"
              >
                <Icon name="cloud_upload" className="text-sm" />
                Upload
              </button>
            )}
          </div>
          
          {/* Tabs */}
          <div className="max-w-5xl mx-auto px-4 flex gap-4">
            {['Flashcards', 'Resources'].map(tab => (
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
                subjectDecks.map(deck => (
                  <button
                    key={deck.name}
                    onClick={() => openDeck(deck)}
                    className="w-full bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-stone-400 transition-all flex items-center gap-3"
                  >
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                      <Icon name="style" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-stone-800">{deck.name}</h3>
                      <p className="text-sm text-stone-400">{deck.cards.length} cards</p>
                    </div>
                    <Icon name="chevron_right" className="text-stone-300" />
                  </button>
                ))
              )}
            </div>
          ) : (
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
          )}
        </main>
      </div>
    );
  }

  // RESOURCE_VIEW
  if (view === 'RESOURCE_VIEW' && activeResource) {
    return (
      <ResourceViewer 
        resource={activeResource} 
        onClose={() => { setActiveResource(null); setView('SUBJECT'); }} 
      />
    );
  }

  // DECK_OVERVIEW View
  if (view === 'DECK_OVERVIEW' && activeDeck) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col">
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
            <button 
              onClick={() => startSession('new')}
              className="bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              <Icon name="play_arrow" /> Start
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDeck.cards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-stone-200">
                <span className="text-xs font-bold text-stone-300">#{i + 1}</span>
                <p className="text-stone-800 font-medium mt-1">{card.q}</p>
                <div className="h-px bg-stone-100 my-2"></div>
                <p className="text-stone-500 text-sm">{card.a}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // PLAY View
  if (view === 'PLAY' && queue.length > 0) {
    const card = queue[currentIndex];
    const progress = Math.round(((currentIndex + 1) / queue.length) * 100);

    return (
      <div className="min-h-screen bg-[#E7E5E4] flex flex-col">
        <header className="bg-[#F5F5F4] px-4 py-3 flex justify-between items-center border-b border-stone-200/50">
          <button onClick={() => setView('DECK_OVERVIEW')} className="p-2 -ml-2">
            <Icon name="close" className="text-stone-500" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-800">{activeDeck?.name}</p>
            <div className="h-1 w-20 bg-stone-200 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-stone-800" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 flex items-center justify-center p-4 perspective-1000">
          <div 
            className="w-full max-w-sm aspect-[3/4] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`w-full h-full duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl p-6 flex flex-col items-center justify-between">
                <div className="w-full flex justify-between text-xs font-bold text-stone-300 uppercase">
                  <span>Question</span>
                  <span>{currentIndex + 1}/{queue.length}</span>
                </div>
                <p className="text-xl font-medium text-stone-800 text-center">{card.q}</p>
                <p className="text-xs text-stone-300 uppercase">Tap to flip</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-stone-800 rounded-3xl shadow-xl p-6 flex flex-col items-center justify-between text-white">
                <div className="w-full flex justify-between text-xs font-bold text-stone-500 uppercase">
                  <span>Answer</span>
                  <span>{currentIndex + 1}/{queue.length}</span>
                </div>
                <p className="text-xl font-medium text-center">{card.a}</p>
                <p className="text-xs text-stone-500 uppercase">Mark result</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-[#F5F5F4] p-4 border-t border-stone-200">
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

    return (
      <div className="min-h-screen bg-[#F5F5F4] p-4 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <svg className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="35" stroke="#E7E5E4" strokeWidth="6" fill="none" />
              <circle cx="40" cy="40" r="35" stroke="#292524" strokeWidth="6" fill="none" 
                strokeDasharray="220" strokeDashoffset={220 - (220 * percentage / 100)} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">{percentage}%</span>
          </div>
          
          <h2 className="text-xl font-bold text-stone-800 mb-1">Session Complete</h2>
          <p className="text-stone-500 text-sm mb-6">Great effort!</p>

          <div className="flex justify-center gap-6 mb-6 p-4 bg-stone-50 rounded-xl">
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

          <div className="space-y-2">
            {incorrect > 0 && (
              <button onClick={() => startSession('retry')} className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold">
                Review Missed ({incorrect})
              </button>
            )}
            <button onClick={() => startSession('smart')} className="w-full py-3 bg-stone-100 text-stone-800 rounded-xl font-semibold">
              Smart Shuffle
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

  return null;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
