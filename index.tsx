import React, { useState, useEffect } from 'react';
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
  name: string;
  category: 'Video' | 'Image' | 'Files';
  url: string;
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

type AppView = 'HOME' | 'SUBJECT' | 'DECK_OVERVIEW' | 'PLAY' | 'SUMMARY' | 'RESOURCE_VIEW';

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

// Login Modal Component
const LoginModal = ({ 
  isOpen, 
  onClose, 
  onLogin 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onLogin: (user: User) => void;
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
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', idNumber, name: name.trim() }),
        mode: 'no-cors'
      });
      
      // Since no-cors doesn't return data, we'll store locally
      const user: User = { idNumber, name: name.trim(), record: {} };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      onLogin(user);
      onClose();
    } catch (err) {
      // Fallback to local-only mode
      const user: User = { idNumber, name: name.trim(), record: {} };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      onLogin(user);
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

  // Data State
  const [view, setView] = useState<AppView>('HOME');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Content State
  const [decks, setDecks] = useState<Deck[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryItem[]>>({});
  const [resources, setResources] = useState<Record<string, Resource[]>>({});
  const [apiSubjects, setApiSubjects] = useState<string[]>([]);
  
  // Navigation State
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Flashcards' | 'Resources'>('Flashcards');
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);

  // Session State
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState<Record<string, 'correct' | 'incorrect'>>({});

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

  // --- Data Sync ---

  const syncData = async () => {
    try {
      const response = await fetch(`${GAS_URL}?action=getAll`);
      const data = await response.json();

      if (data.error) {
        console.error('Sync error:', data.error);
        return;
      }

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

      // Process categories (auto-generated from deck subjects)
      if (data.categories) {
        setCategories(data.categories);
        for (const [subject, items] of Object.entries(data.categories)) {
          await db.categories.put({ subject, items: items as CategoryItem[] });
        }
      }

      // Process resources
      if (data.resources) {
        setResources(data.resources);
        for (const [subject, items] of Object.entries(data.resources)) {
          await db.resources.put({ subject, items: items as Resource[] });
        }
      }

      // Process subjects from Category sheet
      if (data.subjects && Array.isArray(data.subjects)) {
        setApiSubjects(data.subjects);
        localStorage.setItem('flashmaster_subjects', JSON.stringify(data.subjects));
      }
    } catch (error) {
      console.error('Sync failed:', error);
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
    setView('PLAY');
  };

  const handleScore = (result: 'correct' | 'incorrect') => {
    const card = queue[currentIndex];
    setScores(prev => ({ ...prev, [card.id]: result }));
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < queue.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
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
        <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} onLogin={setUser} />
        
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

          {/* All Flashcards Section */}
          {decks.length > 0 && (
            <>
              <h2 className="text-lg font-bold text-stone-800 mb-4 mt-8">All Flashcard Decks</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {decks.map(deck => (
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
    
    const videoResources = subjectResources.filter(r => r.category === 'Video');
    const imageResources = subjectResources.filter(r => r.category === 'Image');
    const fileResources = subjectResources.filter(r => r.category === 'Files');

    return (
      <div className="min-h-screen bg-[#F5F5F4]">
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={resetHome} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
              <Icon name="arrow_back" className="text-stone-600" />
            </button>
            <h1 className="font-bold text-stone-800 text-lg">{activeSubject}</h1>
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
              {/* Videos */}
              {videoResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="play_circle" className="text-red-500" /> Videos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {videoResources.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => openResource(r)}
                        className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-red-300 transition-all flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-500">
                          <Icon name="play_arrow" />
                        </div>
                        <span className="font-medium text-stone-700">{r.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Images */}
              {imageResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="image" className="text-blue-500" /> Images
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {imageResources.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => openResource(r)}
                        className="bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-blue-300 transition-all"
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-500 mb-2">
                          <Icon name="image" />
                        </div>
                        <span className="text-sm font-medium text-stone-700 line-clamp-2">{r.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {fileResources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                    <Icon name="description" className="text-emerald-500" /> Files
                  </h3>
                  <div className="space-y-2">
                    {fileResources.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => openResource(r)}
                        className="w-full bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-emerald-300 transition-all flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-500">
                          <Icon name="description" />
                        </div>
                        <span className="font-medium text-stone-700">{r.name}</span>
                        <Icon name="open_in_new" className="text-stone-300 ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {videoResources.length === 0 && imageResources.length === 0 && fileResources.length === 0 && (
                <div className="text-center py-12 text-stone-400">
                  No resources available for this subject
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

  return null;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
