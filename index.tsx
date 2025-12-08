import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import Dexie from 'dexie';

// --- Types & Constants ---

type Card = {
  id: string;
  q: string;
  a: string;
};

type Deck = {
  name: string;
  cards: Card[];
  lastUpdated?: number;
};

type AppView = 'HOME' | 'DECK_OVERVIEW' | 'PLAY' | 'SUMMARY' | 'SETTINGS';

const STORAGE_KEY_URL = 'flashcard_gas_url';
const STORAGE_KEY_STATE = 'flashcard_session_state';

// --- Database (Dexie) ---

const db = new Dexie('FlashMasterDB') as Dexie & {
  decks: Dexie.Table<Deck, string>;
};

db.version(1).stores({
  decks: 'name'
});

// --- Mock Data (Fallback) ---
const DEMO_DECKS: Deck[] = [
  {
    name: "Demo: History",
    cards: [
      { id: "h1", q: "Who was the first President of the USA?", a: "George Washington" },
      { id: "h2", q: "In which year did the Titanic sink?", a: "1912" },
      { id: "h3", q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci" },
      { id: "h4", q: "What empire did Genghis Khan found?", a: "The Mongol Empire" },
      { id: "h5", q: "When did the Berlin Wall fall?", a: "1989" }
    ]
  },
  {
    name: "Demo: Science",
    cards: [
      { id: "s1", q: "What is the chemical symbol for Gold?", a: "Au" },
      { id: "s2", q: "What planet is known as the Red Planet?", a: "Mars" },
      { id: "s3", q: "What is the powerhouse of the cell?", a: "Mitochondria" },
      { id: "s4", q: "What gas do plants absorb?", a: "Carbon Dioxide" }
    ]
  }
];

// --- Components ---

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-rounded select-none ${className}`}>
    {name}
  </span>
);

// --- Main Application ---

const App = () => {
  // Global State
  const [view, setView] = useState<AppView>('HOME');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gasUrl, setGasUrl] = useState(localStorage.getItem(STORAGE_KEY_URL) || '');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Session State
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState<Record<string, 'correct' | 'incorrect'>>({});

  // --- Persistence & Initialization ---

  useEffect(() => {
    // 1. Initialize logic
    const initApp = async () => {
      // Load Decks from Dexie
      let localDecks = await db.decks.toArray();
      if (localDecks.length === 0 && !gasUrl) {
        localDecks = DEMO_DECKS;
      }
      setDecks(localDecks);
      setLoading(false);

      // Restore Session if exists
      const savedState = localStorage.getItem(STORAGE_KEY_STATE);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          // Only restore if we have valid data
          if (parsed.view && parsed.view !== 'HOME') {
             setView(parsed.view);
             if (parsed.activeDeck) setActiveDeck(parsed.activeDeck);
             if (parsed.queue) setQueue(parsed.queue);
             if (typeof parsed.currentIndex === 'number') setCurrentIndex(parsed.currentIndex);
             if (parsed.scores) setScores(parsed.scores);
          }
        } catch (e) {
          console.error("Failed to restore state", e);
          localStorage.removeItem(STORAGE_KEY_STATE);
        }
      }

      // Initial Sync if configured
      if (gasUrl && navigator.onLine) {
        syncDecks(gasUrl, false);
      }
    };

    initApp();

    // 2. Setup Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    // Auto-sync when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && gasUrl) {
        console.log("App focused, checking for updates...");
        syncDecks(gasUrl, true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Run once on mount

  // --- Auto-Save State ---
  useEffect(() => {
    if (!loading) {
      const stateToSave = {
        view,
        activeDeck,
        queue,
        currentIndex,
        scores
      };
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(stateToSave));
    }
  }, [view, activeDeck, queue, currentIndex, scores, loading]);


  // --- Logic ---

  const syncDecks = async (url: string = gasUrl, silent = false) => {
    if (!url || !navigator.onLine) return;
    if (!silent) setSyncing(true);
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const data = await response.json();
      
      // Transform Data
      const parsedDecks: Deck[] = Object.keys(data).map(name => ({
        name,
        cards: data[name].map((c: any, idx: number) => ({
          id: `${name}-${idx}`,
          q: c.q || "Empty Question",
          a: c.a || "Empty Answer"
        })),
        lastUpdated: Date.now()
      }));

      // Update DB
      await db.decks.bulkPut(parsedDecks);
      
      // Check if we need to update state (simple check: length or name change)
      // For a real app, deep compare is better, but this is sufficient to trigger re-render
      setDecks(prev => {
        // If we are currently viewing a deck, update its content in memory too if it changed
        if (activeDeck) {
            const updatedActive = parsedDecks.find(d => d.name === activeDeck.name);
            if (updatedActive) {
                // We update active deck reference silently so next session uses new cards
                // But we don't disrupt current session queue
                setActiveDeck(updatedActive); 
            }
        }
        return parsedDecks;
      });

    } catch (error) {
      console.error("Sync failed:", error);
      if (!silent) alert("Sync failed. Using local data.");
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  const openDeck = (deck: Deck) => {
    setActiveDeck(deck);
    setView('DECK_OVERVIEW');
  };

  const startSession = (mode: 'new' | 'retry' | 'smart') => {
    if (!activeDeck) return;
    let newQueue: Card[] = [];

    if (mode === 'new') {
      newQueue = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    } else if (mode === 'retry') {
      newQueue = activeDeck.cards.filter(c => scores[c.id] === 'incorrect');
    } else if (mode === 'smart') {
      const incorrect = activeDeck.cards.filter(c => scores[c.id] === 'incorrect');
      const correct = activeDeck.cards.filter(c => scores[c.id] !== 'incorrect');
      newQueue = [
        ...incorrect.sort(() => Math.random() - 0.5),
        ...correct.sort(() => Math.random() - 0.5)
      ];
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

  const handleSkip = () => {
    setIsFlipped(false);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setView('SUMMARY');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const resetHome = () => {
     setView('HOME');
     setActiveDeck(null);
     setQueue([]);
     setCurrentIndex(0);
     setScores({});
     localStorage.removeItem(STORAGE_KEY_STATE);
  };

  // --- Views ---

  if (view === 'HOME') {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto flex flex-col">
        <header className="flex justify-between items-center mb-8 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">My Library</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-stone-400'}`}></span>
              <p className="text-stone-500 text-sm">{isOnline ? 'Online' : 'Offline Mode'}</p>
            </div>
          </div>
          <div className="flex gap-2">
             {/* Settings button removed from here as requested */}
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex justify-center items-center text-stone-400">
            <span className="animate-pulse">Loading Decks...</span>
          </div>
        ) : (
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
              {decks.length === 0 && (
                <div className="col-span-full text-center p-8 bg-white rounded-2xl border border-stone-200 text-stone-500">
                  No decks found. Set up your data source.
                </div>
              )}
              {decks.map(deck => (
                <button 
                  key={deck.name}
                  onClick={() => openDeck(deck)}
                  className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col items-start gap-4 hover:border-stone-400 transition-all text-left group active:scale-[0.99] h-full"
                >
                  <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600 group-hover:bg-stone-800 group-hover:text-white transition-colors">
                    <Icon name="style" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-stone-800">{deck.name}</h3>
                    <p className="text-sm text-stone-400 font-medium">{deck.cards.length} Cards</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer Settings Link */}
            <div className="text-center pb-8 pt-4 border-t border-stone-200 mt-auto">
               <button 
                 onClick={() => setView('SETTINGS')}
                 className="text-stone-400 text-sm hover:text-stone-600 flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-lg hover:bg-stone-100 transition-colors"
               >
                 <Icon name="settings" className="text-lg" />
                 <span>Manage Data Source</span>
               </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'DECK_OVERVIEW') {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col">
        <div className="sticky top-0 z-20 bg-[#F5F5F4]/95 backdrop-blur-sm border-b border-stone-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={resetHome} className="p-2 -ml-2 text-stone-500 hover:text-stone-800 rounded-full transition-colors">
                <Icon name="arrow_back" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-stone-800 leading-tight">{activeDeck?.name}</h1>
                <p className="text-xs text-stone-500">{activeDeck?.cards.length} cards</p>
              </div>
            </div>
            <button 
              onClick={() => startSession('new')}
              className="bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-md hover:bg-stone-900 transition-colors flex items-center gap-2"
            >
              <Icon name="play_arrow" className="text-lg" />
              <span className="hidden sm:inline">Start Session</span>
              <span className="sm:hidden">Start</span>
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeDeck?.cards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-stone-200 shadow-sm flex flex-col gap-3 group hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">Card {i + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="text-stone-800 font-medium mb-2">{card.q}</p>
                  <div className="h-px bg-stone-100 my-2"></div>
                  <p className="text-stone-500 text-sm">{card.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'PLAY') {
    const card = queue[currentIndex];
    const progress = Math.round(((currentIndex + 1) / queue.length) * 100);

    return (
      <div className="min-h-screen bg-[#E7E5E4] flex flex-col relative overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center bg-[#F5F5F4] z-10 border-b border-stone-200/50">
          <button onClick={() => setView('DECK_OVERVIEW')} className="text-stone-500 p-2 -ml-2 hover:text-stone-800">
            <Icon name="close" />
          </button>
          <div className="text-center">
            <h2 className="text-stone-800 font-semibold text-sm max-w-[200px] truncate">{activeDeck?.name}</h2>
            <div className="h-1 w-24 bg-stone-200 rounded-full mt-1 mx-auto overflow-hidden">
              <div className="h-full bg-stone-800 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          <div className="w-8" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 perspective-1000">
          <div 
            className="w-full max-w-sm aspect-[3/4] cursor-pointer group relative"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
              
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-[#FDFBF7] rounded-3xl shadow-xl shadow-stone-300 border border-stone-100 flex flex-col p-8 items-center text-center justify-between">
                <div className="w-full flex justify-between text-stone-300 text-xs font-bold uppercase tracking-widest">
                  <span>Question</span>
                  <span>{currentIndex + 1} / {queue.length}</span>
                </div>
                <div className="flex-1 flex items-center justify-center w-full overflow-y-auto no-scrollbar">
                  <p className="text-2xl font-medium text-stone-800 leading-relaxed">{card.q}</p>
                </div>
                <div className="text-xs font-bold tracking-widest text-stone-300 uppercase mt-4">Tap to Flip</div>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#292524] rounded-3xl shadow-xl flex flex-col p-8 items-center text-center justify-between text-[#FDFBF7]">
                <div className="w-full flex justify-between text-stone-500 text-xs font-bold uppercase tracking-widest">
                  <span>Answer</span>
                  <span>{currentIndex + 1} / {queue.length}</span>
                </div>
                <div className="flex-1 flex items-center justify-center w-full overflow-y-auto no-scrollbar">
                  <p className="text-2xl font-medium leading-relaxed">{card.a}</p>
                </div>
                <div className="text-xs font-bold tracking-widest text-stone-600 uppercase mt-4">Mark Result</div>
              </div>

            </div>
          </div>
        </div>

        <div className="bg-[#F5F5F4] p-6 pb-8 border-t border-stone-200">
          <div className="max-w-sm mx-auto h-16">
            {!isFlipped ? (
              <div className="flex gap-3 h-full">
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  disabled={currentIndex === 0}
                  className={`w-16 h-full rounded-2xl font-bold transition-all flex items-center justify-center ${currentIndex === 0 ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-stone-200 text-stone-600 hover:bg-stone-300 active:scale-[0.98]'}`}
                >
                  <Icon name="arrow_back" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleSkip(); }}
                  className="w-1/3 h-full bg-stone-200 text-stone-600 rounded-2xl font-bold hover:bg-stone-300 active:scale-[0.98] transition-all"
                >
                  Skip
                </button>
                <button 
                  onClick={() => setIsFlipped(true)}
                  className="flex-1 h-full bg-stone-800 text-[#FDFBF7] rounded-2xl font-semibold shadow-lg shadow-stone-400/50 hover:bg-stone-900 active:scale-[0.98] transition-all"
                >
                  Reveal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 h-full">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleScore('incorrect'); }}
                  className="bg-red-50 text-red-700 border border-red-200 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-[0.98]"
                >
                  <Icon name="close" /> Missed
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleScore('correct'); }}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors active:scale-[0.98]"
                >
                  <Icon name="check" /> Got it
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'SUMMARY') {
    const total = queue.length;
    const correct = queue.filter(c => scores[c.id] === 'correct').length;
    const incorrect = queue.filter(c => scores[c.id] === 'incorrect').length;
    const skipped = total - correct - incorrect;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <div className="min-h-screen bg-[#F5F5F4] p-6 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-200 p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <svg className="w-full h-full transform -rotate-90 absolute">
               <circle cx="48" cy="48" r="40" stroke="#E7E5E4" strokeWidth="8" fill="none" />
               <circle cx="48" cy="48" r="40" stroke="#292524" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * percentage / 100)} className="transition-all duration-1000 ease-out" />
            </svg>
            <span className="text-2xl font-bold text-stone-800">{percentage}%</span>
          </div>
          
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Session Complete</h2>
          <p className="text-stone-500 text-sm mb-8">Good effort! Here is how you did.</p>

          <div className="flex justify-center gap-6 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{correct}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Correct</div>
            </div>
            <div className="w-px bg-stone-200"></div>
            <div>
              <div className="text-2xl font-bold text-red-500">{incorrect}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Missed</div>
            </div>
            <div className="w-px bg-stone-200"></div>
            <div>
              <div className="text-2xl font-bold text-stone-500">{skipped}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Skipped</div>
            </div>
          </div>

          <div className="space-y-3">
            {incorrect > 0 && (
              <button 
                onClick={() => startSession('retry')}
                className="w-full py-4 bg-stone-800 text-[#FDFBF7] rounded-2xl font-semibold shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <Icon name="refresh" /> Review Missed ({incorrect})
              </button>
            )}
            <button 
              onClick={() => startSession('smart')}
              className="w-full py-4 bg-[#F5F5F4] text-stone-800 border border-stone-200 rounded-2xl font-semibold hover:bg-stone-100 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="shuffle" /> Smart Shuffle
            </button>
            <button 
              onClick={() => setView('DECK_OVERVIEW')}
              className="w-full py-4 text-stone-500 font-medium hover:text-stone-800 transition-colors text-sm"
            >
              Back to Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Settings View
  return (
    <div className="min-h-screen bg-[#F5F5F4] p-6 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-8 mt-2">
        <button onClick={resetHome} className="p-2 -ml-2 text-stone-500 hover:bg-white rounded-full transition-colors">
          <Icon name="arrow_back" />
        </button>
        <h1 className="text-xl font-bold text-stone-800">Settings</h1>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 mb-6">
        <label className="block text-sm font-bold text-stone-700 uppercase tracking-wider mb-3">
          Google Apps Script URL
        </label>
        <input 
          type="text" 
          value={gasUrl}
          onChange={(e) => setGasUrl(e.target.value)}
          placeholder="https://script.google.com/..."
          className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 text-sm focus:ring-2 focus:ring-stone-400 outline-none transition-shadow"
        />
        <p className="text-xs text-stone-400 mt-2">Leave empty to use demo mode.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
        <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
          <Icon name="code" className="text-stone-400" /> Backend Setup Guide
        </h3>
        <p className="text-sm text-stone-600 mb-4 leading-relaxed">
           Deploy the code from <code className="bg-stone-100 px-1 rounded">backend.gs</code> as a Web App:
        </p>
        <ol className="list-decimal pl-4 space-y-2 text-sm text-stone-600 marker:text-stone-400 mb-4">
          <li>Create a Google Spreadsheet</li>
          <li>Go to Extensions → Apps Script</li>
          <li>Paste the backend.gs code</li>
          <li>Deploy → Web App (Execute: Me, Access: Anyone)</li>
          <li>Copy the Web App URL and paste above</li>
        </ol>
        <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Sheet Format:</p>
          <ul className="list-disc pl-4 space-y-1 text-sm text-stone-600 marker:text-stone-400">
            <li>Each Sheet = One Deck (e.g., "FL111 exam (1)")</li>
            <li>Row 1 = Headers (ignored)</li>
            <li>Column A = Question</li>
            <li>Column B = Answer</li>
          </ul>
        </div>
      </div>

      <button 
        onClick={() => {
          localStorage.setItem(STORAGE_KEY_URL, gasUrl);
          syncDecks(gasUrl, false);
          resetHome();
        }}
        className="w-full mt-6 py-4 bg-stone-800 text-[#FDFBF7] rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-transform"
      >
        Save & Return
      </button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);