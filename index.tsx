import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// --- Types & Constants ---

type Card = {
  id: string;
  q: string;
  a: string;
};

type Deck = {
  name: string;
  cards: Card[];
};

type AppView = 'HOME' | 'PLAY' | 'SUMMARY' | 'SETTINGS';

const STORAGE_KEY = 'flashcard_gas_url';

// --- Mock Data (Fallback) ---
const DEMO_DECKS: Deck[] = [
  {
    name: "Demo: History",
    cards: [
      { id: "h1", q: "Who was the first President of the USA?", a: "George Washington" },
      { id: "h2", q: "In which year did the Titanic sink?", a: "1912" },
      { id: "h3", q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci" }
    ]
  },
  {
    name: "Demo: Science",
    cards: [
      { id: "s1", q: "What is the chemical symbol for Gold?", a: "Au" },
      { id: "s2", q: "What planet is known as the Red Planet?", a: "Mars" }
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
  const [view, setView] = useState<AppView>('HOME');
  const [loading, setLoading] = useState(false);
  const [gasUrl, setGasUrl] = useState(localStorage.getItem(STORAGE_KEY) || '');
  const [decks, setDecks] = useState<Deck[]>([]);
  
  // Session State
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState<Record<string, 'correct' | 'incorrect'>>({});

  useEffect(() => {
    loadDecks();
  }, [gasUrl]);

  const loadDecks = async () => {
    setLoading(true);
    try {
      if (!gasUrl) {
        setDecks(DEMO_DECKS);
      } else {
        const response = await fetch(gasUrl);
        const data = await response.json();
        // Backend returns: { "Sheet1": [{q,a}, ...], "Sheet2": ... }
        const parsedDecks: Deck[] = Object.keys(data).map(name => ({
          name,
          cards: data[name].map((c: any, idx: number) => ({
            id: `${name}-${idx}`,
            q: c.q || "Empty Question",
            a: c.a || "Empty Answer"
          }))
        }));
        setDecks(parsedDecks);
      }
    } catch (error) {
      console.error(error);
      // Quiet fail to demo for better UX if URL is bad
      setDecks(DEMO_DECKS); 
    } finally {
      setLoading(false);
    }
  };

  const startSession = (deck: Deck, mode: 'new' | 'retry' | 'smart') => {
    setActiveDeck(deck);
    let newQueue: Card[] = [];

    if (mode === 'new') {
      // Shuffle all
      newQueue = [...deck.cards].sort(() => Math.random() - 0.5);
      setScores({});
    } else if (mode === 'retry') {
      // Only incorrect
      newQueue = deck.cards.filter(c => scores[c.id] === 'incorrect');
      // Keep existing scores for others, but reset for these so we can re-test
      // Actually, standard spaced repetition: re-queue them.
    } else if (mode === 'smart') {
      // Incorrect first, then random others
      const incorrect = deck.cards.filter(c => scores[c.id] === 'incorrect');
      const correct = deck.cards.filter(c => scores[c.id] !== 'incorrect');
      newQueue = [
        ...incorrect.sort(() => Math.random() - 0.5),
        ...correct.sort(() => Math.random() - 0.5)
      ];
    }

    if (newQueue.length === 0) {
      alert("No cards to play!");
      return;
    }

    setQueue(newQueue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setView('PLAY');
  };

  const handleScore = (result: 'correct' | 'incorrect') => {
    const card = queue[currentIndex];
    setScores(prev => ({ ...prev, [card.id]: result }));
    
    setIsFlipped(false);
    // Short delay for better UX
    setTimeout(() => {
      if (currentIndex < queue.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setView('SUMMARY');
      }
    }, 200);
  };

  // --- Views ---

  if (view === 'HOME') {
    return (
      <div className="min-h-screen p-6 max-w-md mx-auto flex flex-col">
        <header className="flex justify-between items-center mb-8 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">My Library</h1>
            <p className="text-stone-500 text-sm">Select a deck to study</p>
          </div>
          <button onClick={() => setView('SETTINGS')} className="p-2 bg-white rounded-full border border-stone-200 text-stone-600 shadow-sm hover:bg-stone-50 transition-colors">
            <Icon name="settings" />
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex justify-center items-center text-stone-400">
            <span className="animate-pulse">Loading Decks...</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {decks.length === 0 && (
              <div className="text-center p-8 bg-white rounded-2xl border border-stone-200 text-stone-500">
                No decks found. Check settings.
              </div>
            )}
            {decks.map(deck => (
              <button 
                key={deck.name}
                onClick={() => startSession(deck, 'new')}
                className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between hover:border-stone-400 transition-all text-left group active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600 group-hover:bg-stone-800 group-hover:text-white transition-colors">
                    <Icon name="style" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-800">{deck.name}</h3>
                    <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{deck.cards.length} Cards</p>
                  </div>
                </div>
                <Icon name="chevron_right" className="text-stone-300 group-hover:text-stone-600" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'PLAY') {
    const card = queue[currentIndex];
    const progress = Math.round(((currentIndex + 1) / queue.length) * 100);

    return (
      <div className="min-h-screen bg-[#E7E5E4] flex flex-col relative overflow-hidden">
        {/* Top Bar */}
        <div className="px-6 py-4 flex justify-between items-center bg-[#F5F5F4] z-10 border-b border-stone-200/50">
          <button onClick={() => setView('HOME')} className="text-stone-500 p-2 -ml-2 hover:text-stone-800">
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

        {/* Card Area */}
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

        {/* Controls */}
        <div className="bg-[#F5F5F4] p-6 pb-8 border-t border-stone-200">
          <div className="max-w-sm mx-auto h-16">
            {!isFlipped ? (
              <button 
                onClick={() => setIsFlipped(true)}
                className="w-full h-full bg-stone-800 text-[#FDFBF7] rounded-2xl font-semibold shadow-lg shadow-stone-400/50 hover:bg-stone-900 active:scale-[0.98] transition-all"
              >
                Reveal Answer
              </button>
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
    const missed = total - correct;
    const percentage = Math.round((correct / total) * 100);

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

          <div className="flex justify-center gap-8 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{correct}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Correct</div>
            </div>
            <div className="w-px bg-stone-200"></div>
            <div>
              <div className="text-2xl font-bold text-red-500">{missed}</div>
              <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Missed</div>
            </div>
          </div>

          <div className="space-y-3">
            {missed > 0 && (
              <button 
                onClick={() => startSession(activeDeck!, 'retry')}
                className="w-full py-4 bg-stone-800 text-[#FDFBF7] rounded-2xl font-semibold shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <Icon name="refresh" /> Review Missed ({missed})
              </button>
            )}
            <button 
              onClick={() => startSession(activeDeck!, 'smart')}
              className="w-full py-4 bg-[#F5F5F4] text-stone-800 border border-stone-200 rounded-2xl font-semibold hover:bg-stone-100 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="shuffle" /> Smart Shuffle
            </button>
            <button 
              onClick={() => setView('HOME')}
              className="w-full py-4 text-stone-500 font-medium hover:text-stone-800 transition-colors text-sm"
            >
              Back to Library
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
        <button onClick={() => setView('HOME')} className="p-2 -ml-2 text-stone-500 hover:bg-white rounded-full transition-colors">
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
          <Icon name="code" className="text-stone-400" /> Backend Info
        </h3>
        <p className="text-sm text-stone-600 mb-4 leading-relaxed">
           To connect your own data, deploy a Google Apps Script Web App that returns JSON.
        </p>
        <ul className="list-disc pl-4 space-y-2 text-sm text-stone-600 marker:text-stone-400">
          <li>Sheet Name = Deck Title</li>
          <li>Row 1 = Headers (Ignored)</li>
          <li>Row 2+ = Cards</li>
          <li>Col 1 = Question</li>
          <li>Col 2 = Answer</li>
        </ul>
      </div>

      <button 
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, gasUrl);
          loadDecks(); // reload logic
          setView('HOME');
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