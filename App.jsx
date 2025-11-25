import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, collection, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { AlertTriangle, Zap, Heart, RefreshCw, Loader, Ship, User, Globe, Code, Key, ChevronDown, CheckCircle } from 'lucide-react';

// --- CONFIGURATION AND UTILITIES ---

// NOTE: We update this to match your actual Firebase Project ID for path consistency.
const appId = 'lasers-and-feelings-685e4'; // Your Firebase Project ID

// === START OF REQUIRED PASTE AREA ===
// PASTE THE CONTENT OF YOUR FIREBASE CONFIGURATION OBJECT HERE. 
// Do NOT include the "const firebaseConfig =" part.
const firebaseConfig = {
    // PASTE YOUR REAL KEYS HERE!
    
  apiKey: "AIzaSyA-42tUYSz40xzLtw3gQMIlBbWYkb0qHXY",
  authDomain: "lasers-and-feelings-685e4.firebaseapp.com",
  projectId: "lasers-and-feelings-685e4",
  storageBucket: "lasers-and-feelings-685e4.firebasestorage.app",
  messagingSenderId: "332708070784",
  appId: "1:332708070784:web:494e23e6fa88a6dd072d65",
  measurementId: "G-TSFRCBHZHY"
};
// === END OF REQUIRED PASTE AREA ===

const initialAuthToken = null; 

// Game Data
const STYLES = ["Alien", "Android", "Human (Classic)", "Mutant", "Cyborg", "Clone"];
const ROLES = ["Captain", "Pilot", "Engineer", "Security Officer", "Doctor", "Envoy"];
const GOALS = [
    "Become Captain", "Meet New Aliens", "Shoot Bad Guys",
    "Find New Worlds", "Solve Weird Space Mysteries",
    "Prove Yourself", "Keep Being Awesome"
];
const SHIP_STRENGTHS = ["Fast", "Nimble", "Well-Armed", "Powerful Shields", "Superior Sensors", "Cloaking Device", "Fightercraft"];
const SHIP_WEAKNESSES = ["Fuel Hog", "Only One Medical Pod", "Horrible Circuit Breakers", "Grim Reputation"];

const INITIAL_CHAR_STATE = {
    name: 'New Recruit',
    number: 3,
    style: STYLES[0],
    role: ROLES[0],
    goal: GOALS[0],
};
const INITIAL_SHIP_STATE = {
    name: "U.S.S. RAPTOR",
    strengths: ["Fast", "Powerful Shields"],
    weakness: "Fuel Hog",
};

// Dice Rolling Logic (Pure Function)
const rollDie = () => Math.floor(Math.random() * 6) + 1;

const calculateOutcome = (number, type, diceResults) => {
    let successes = 0;
    let laserFeelings = false;

    diceResults.forEach(roll => {
        if (roll === number) {
            successes++;
            laserFeelings = true;
        } else if (type === 'LASERS') {
            if (roll < number) successes++;
        } else if (type === 'FEELINGS') {
            if (roll > number) successes++;
        }
    });

    let message = '';
    let status = '';

    if (successes === 0) {
        message = "It goes wrong. The GM says how things get worse somehow.";
        status = 'failure';
    } else if (successes === 1) {
        message = "You barely manage it. The GM inflicts a complication, harm, or cost.";
        status = 'mixed';
    } else if (successes === 2) {
        message = "You do it well! Good job!";
        status = 'success';
    } else if (successes >= 3) {
        message = "You get a critical success! The GM tells you some extra effect.";
        status = 'critical';
    }

    if (laserFeelings) {
        message += " **LASER FEELINGS!** You get a special insight into what's going on. Ask the GM a question.";
    }

    return { successes, message, status, laserFeelings, diceResults };
};

// --- REACT COMPONENTS (Sub-components) ---

const LoadingScreen = ({ message, error }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-100 p-8">
        {error ? (
            <div className="bg-red-800/80 p-6 rounded-xl text-white flex items-center border border-red-400">
                <AlertTriangle className="mr-3 w-6 h-6" />
                <span className="font-bold">ERROR:</span> {error}
            </div>
        ) : (
            <>
                <Loader className="animate-spin w-12 h-12 text-red-400 mb-4" />
                <p className="text-xl font-mono">{message}</p>
            </>
        )}
    </div>
);

const SessionSetup = ({ setMode, setInputCode, inputCode, handleJoinSession, handleCreateSession, error }) => (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
        <div className="w-full max-w-md p-8 bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-700 space-y-6">
            <h1 className="text-3xl font-extrabold text-red-400 text-center tracking-wide font-mono">JOIN THE RAPTOR CREW</h1>
            {error && (
                <div className="bg-red-800/80 p-3 rounded-lg text-white text-sm flex items-center">
                    <AlertTriangle className="mr-2 w-4 h-4" /> {error}
                </div>
            )}
            
            <div className="border-b border-gray-700 pb-6 space-y-4">
                <h2 className="text-xl font-semibold flex items-center text-teal-300"><User className="w-5 h-5 mr-2" /> ARE YOU THE GAME MASTER?</h2>
                <button
                    onClick={() => handleCreateSession('GM')}
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/40 transform hover:scale-[1.01] active:scale-[0.99] border-b-2 border-red-900 flex items-center justify-center"
                >
                    <Code className="w-4 h-4 mr-2" /> START NEW SESSION
                </button>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center text-indigo-300"><Key className="w-5 h-5 mr-2" /> JOIN AS A PLAYER</h2>
                <input
                    type="text"
                    placeholder="ENTER 4-DIGIT SESSION CODE"
                    maxLength="4"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.replace(/[^0-9]/g, '').substring(0, 4))}
                    className="w-full p-4 bg-gray-700 border border-gray-600 rounded-xl text-lg text-white text-center tracking-widest focus:ring-indigo-500 focus:border-indigo-500 shadow-inner shadow-gray-900/50"
                />
                <button
                    onClick={handleJoinSession}
                    disabled={inputCode.length !== 4}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/40 transform hover:scale-[1.01] active:scale-[0.99] border-b-2 border-purple-900 flex items-center justify-center"
                >
                    JOIN GAME
                </button>
            </div>
        </div>
    </div>
);

const DiceRoller = React.memo(({ character, updateRollState }) => {
    const [diceCount, setDiceCount] = useState(1);
    const [rollType, setRollType] = useState('LASERS');
    const [rollResult, setRollResult] = useState(null);
    const number = character?.number || 3;

    const handleRoll = useCallback(() => {
        const outcome = calculateOutcome(number, rollType, Array.from({ length: diceCount }, rollDie));
        setRollResult({ ...outcome, rollType, diceCount });
        updateRollState(outcome); // Optional callback to parent (GM could use this)
    }, [number, rollType, diceCount, updateRollState]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'success': case 'critical': return 'bg-green-600/90 border-green-700 shadow-lg shadow-green-900/50';
            case 'mixed': return 'bg-yellow-600/90 border-yellow-700 shadow-lg shadow-yellow-900/50';
            case 'failure': return 'bg-red-600/90 border-red-700 shadow-lg shadow-red-900/50';
            default: return 'bg-gray-700/50 border-gray-600';
        }
    };

    return (
        <div className="p-6 bg-gray-800 rounded-xl shadow-2xl border-2 border-purple-500/30 space-y-4">
            <h2 className="text-2xl font-extrabold mb-4 flex items-center text-purple-400 border-b border-purple-500/50 pb-2 font-mono">
                <Globe className="w-5 h-5 mr-2" /> ACTION ROLL
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Dice ($1d6$)</label>
                    <input
                        type="number"
                        min="1" max="3"
                        value={diceCount}
                        onChange={(e) => setDiceCount(Math.max(1, Math.min(3, parseInt(e.target.value) || 1)))}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-lg text-white text-center focus:ring-purple-500 focus:border-purple-500 shadow-inner shadow-gray-900/50"
                    />
                    <p className="mt-1 text-xs text-gray-500 italic">1d base + 2d max modifiers</p>
                </div>

                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Roll Type</label>
                    <div className="flex space-x-2 h-10">
                        <button
                            onClick={() => setRollType('LASERS')}
                            className={`flex-1 flex items-center justify-center p-2 rounded-lg text-white font-semibold transition-all border-2 ${
                                rollType === 'LASERS' ? 'bg-red-500 shadow-lg shadow-red-500/50 border-white' : 'bg-gray-700 hover:bg-gray-600 border-transparent'
                            }`}
                        >
                            <Zap className="w-4 h-4 mr-1" /> LASERS
                        </button>
                        <button
                            onClick={() => setRollType('FEELINGS')}
                            className={`flex-1 flex items-center justify-center p-2 rounded-lg text-white font-semibold transition-all border-2 ${
                                rollType === 'FEELINGS' ? 'bg-blue-500 shadow-lg shadow-blue-500/50 border-white' : 'bg-gray-700 hover:bg-gray-600 border-transparent'
                            }`}
                        >
                            <Heart className="w-4 h-4 mr-1" /> FEELINGS
                        </button>
                    </div>
                </div>
            </div>

            <button
                onClick={handleRoll}
                className="w-full py-4 text-xl font-extrabold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white transition-all shadow-lg shadow-purple-600/50 active:scale-[0.99] border-b-2 border-purple-900 flex items-center justify-center"
            >
                <RefreshCw className="w-5 h-5 mr-3" /> EXECUTE ROLL ({diceCount}D6)
            </button>

            {rollResult && (
                <div className={`mt-6 p-4 rounded-xl text-white border-2 ${getStatusStyle(rollResult.status)}`}>
                    <h3 className="text-xl font-bold mb-2 uppercase">
                        {rollResult.rollType} Result: {rollResult.status}
                    </h3>
                    <div className="flex space-x-2 mb-3">
                        {rollResult.diceResults.map((result, index) => (
                            <div
                                key={index}
                                className={`w-10 h-10 flex items-center justify-center text-xl font-extrabold rounded-full border-2 ${
                                    (rollResult.rollType === 'LASERS' && result < number) || (rollResult.rollType === 'FEELINGS' && result > number) || result === number
                                        ? 'bg-white text-gray-900 border-yellow-400'
                                        : 'bg-gray-900 text-white border-gray-400'
                                }`}
                            >
                                {result}
                            </div>
                        ))}
                    </div>
                    <p className="text-lg font-semibold border-b border-white/30 pb-2 mb-2">Successes: {rollResult.successes}</p>
                    <p className="base italic">{rollResult.message}</p>
                </div>
            )}
        </div>
    );
});

const CharacterCard = React.memo(({ char }) => (
    <div className="p-4 bg-gray-700 rounded-xl border border-gray-600 shadow-md">
        <h3 className="text-xl font-bold text-red-400 mb-2 truncate flex items-center">
            {char.isGM && <CheckCircle className="w-4 h-4 mr-2 text-teal-400" />}
            {char.name}
        </h3>
        <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-400">Your Number:</span>
            <span className={`text-2xl font-extrabold p-1 rounded ${char.number >= 4 ? 'bg-red-800' : 'bg-blue-800'}`}>
                {char.number}
            </span>
        </div>
        <div className="text-sm">
            <p><span className="font-semibold text-gray-300">Style:</span> {char.style}</p>
            <p><span className="font-semibold text-gray-300">Role:</span> {char.role}</p>
            <p><span className="font-semibold text-gray-300">Goal:</span> {char.goal}</p>
        </div>
        <p className="mt-2 text-xs text-gray-500 truncate">ID: {char.userId.substring(0, 8)}...</p>
    </div>
));


// --- MAIN APP COMPONENT ---

export default function App() {
    const [mode, setMode] = useState(null);
    const [sessionCode, setSessionCode] = useState(() => localStorage.getItem('lf_session_code'));
    const [inputCode, setInputCode] = useState('');
    const [userId, setUserId] = useState(null);
    const [db, setDb] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [myCharacter, setMyCharacter] = useState(() => {
        const stored = localStorage.getItem('lf_my_character');
        return stored ? JSON.parse(stored) : INITIAL_CHAR_STATE;
    });
    const [ship, setShip] = useState(INITIAL_SHIP_STATE);
    const [allCharacters, setAllCharacters] = useState([]);

    // --- FIREBASE INITIALIZATION & AUTH ---
    useEffect(() => {
        // Clear any previous general error message if we start initialization
        if (error === "Firebase API Key is invalid or project ID is incorrect. Please update firebaseConfig.") {
             setError(null);
        }

        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const firestore = getFirestore(app);
            setDb(firestore);

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    localStorage.setItem('lf_user_id', user.uid);
                    // Attempt to determine mode if sessionCode is present from previous session
                    if (sessionCode) {
                        setLoading(true);
                        // Using try-catch here to gracefully handle Firebase errors if keys are bad
                        try {
                            // Check if a valid Firestore instance exists before calling getDoc
                            if (firestore) {
                                const sessionDoc = await getDoc(doc(firestore, `artifacts/${appId}/public/data/lf_sessions/${sessionCode}`));
                                if (sessionDoc.exists() && sessionDoc.data().gmUserId === user.uid) {
                                    setMode('GM');
                                } else {
                                    setMode('Player');
                                }
                            }
                        } catch (e) {
                             console.error("Error during session check:", e);
                             // If session check fails (often due to bad API key), clear session and let the user re-enter
                             setSessionCode(null);
                             localStorage.removeItem('lf_session_code');
                        }
                    }
                    setLoading(false);
                } else {
                    await signInAnonymously(auth);
                }
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase init failed:", e);
            // This error often means the authDomain is missing or misconfigured in the host environment.
            setError("Firebase Auth Configuration Missing: Double-check your `authDomain` is set correctly in `firebaseConfig` and that Firebase Authentication is enabled in your project.");
            setLoading(false);
        }
    }, []);

    // --- FIRESTORE UTILITY HOOKS (Memoized accessors) ---
    const sessionRef = useMemo(() => db && sessionCode ? doc(db, `artifacts/${appId}/public/data/lf_sessions/${sessionCode}`) : null, [db, sessionCode]);
    const charRef = useMemo(() => db && sessionCode && userId ? doc(db, `artifacts/${appId}/public/data/lf_sessions/${sessionCode}/characters/${userId}`) : null, [db, sessionCode, userId]);
    const charsColRef = useMemo(() => sessionRef ? collection(sessionRef, 'characters') : null, [sessionRef]);

    // --- REAL-TIME DATA LISTENER ---
    useEffect(() => {
        if (!db || !userId || !sessionCode || !sessionRef || !charRef) return;

        // 1. Listen for Ship Data (Master Session Doc)
        const unsubscribeShip = onSnapshot(sessionRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().ship) {
                setShip(docSnap.data().ship);
                if (docSnap.data().gmUserId === userId) setMode('GM'); // Re-verify GM status
            } else if (mode === 'GM') {
                // Initialize session if GM is creating it (only happens once)
                setDoc(sessionRef, { ship: INITIAL_SHIP_STATE, gmUserId: userId, created: Date.now() }, { merge: true })
                    .catch(e => console.error("Error initializing session:", e));
            }
        }, (e) => console.error("Ship Listener Error:", e));

        // 2. Listen for ALL Characters (Used by GM and Player for roster/self-update)
        const unsubscribeAllChars = onSnapshot(charsColRef, (snapshot) => {
            const chars = snapshot.docs.map(doc => ({
                ...doc.data(),
                isGM: doc.data().userId === sessionRef?.gmUserId,
            })).filter(char => char.name !== 'New Recruit');

            // Find GM ID from the session document data (if it exists)
            const gmId = sessionRef?.gmUserId;
            
            setAllCharacters(chars.map(char => ({
                ...char,
                isGM: char.userId === gmId
            })));

            const myUpdatedChar = chars.find(c => c.userId === userId);
            if (myUpdatedChar) {
                setMyCharacter(myUpdatedChar);
                localStorage.setItem('lf_my_character', JSON.stringify(myUpdatedChar));
            }
        }, (e) => console.error("All Characters Listener Error:", e));

        // 3. Ensure My Character Exists (Write once on join/load)
        const initChar = async () => {
            const docSnap = await getDoc(charRef);
            if (!docSnap.exists()) {
                const charData = { 
                    ...INITIAL_CHAR_STATE, 
                    userId, 
                    name: `${INITIAL_CHAR_STATE.name} ${userId.substring(0, 4)}` 
                };
                await setDoc(charRef, charData);
                setMyCharacter(charData);
                localStorage.setItem('lf_my_character', JSON.stringify(charData));
            }
        };
        initChar();

        return () => {
            unsubscribeShip();
            unsubscribeAllChars();
        };
    }, [db, userId, sessionCode, mode, sessionRef, charRef, charsColRef]);

    // --- DATA SAVERS (Writes to Firestore) ---

    const saveCharacter = useCallback((updates) => {
        if (!charRef) return;
        const newCharacter = { ...myCharacter, ...updates };
        setDoc(charRef, newCharacter, { merge: true }).catch(e => console.error("Error saving character:", e));
        setMyCharacter(newCharacter); // Optimistic UI update
    }, [charRef, myCharacter]);

    const saveShip = useCallback((updates) => {
        if (!sessionRef || mode !== 'GM') return;
        const newShip = { ...ship, ...updates };
        updateDoc(sessionRef, { ship: newShip }).catch(e => console.error("Error saving ship:", e));
        setShip(newShip); // Optimistic UI update
    }, [sessionRef, mode, ship]);

    const toggleStrength = useCallback((strength) => {
        let newStrengths = [...ship.strengths];
        if (newStrengths.includes(strength)) {
            newStrengths = newStrengths.filter(s => s !== strength);
        } else if (newStrengths.length < 2) {
            newStrengths.push(strength);
        }
        saveShip({ strengths: newStrengths });
    }, [ship, saveShip]);


    // --- SESSION HANDLERS ---
    const generateSessionCode = () => Math.floor(1000 + Math.random() * 9000).toString();

    const handleCreateSession = useCallback((newMode) => {
        if (!db || !userId) return;
        const newCode = generateSessionCode();
        setSessionCode(newCode);
        localStorage.setItem('lf_session_code', newCode);
        setMode(newMode);
        // Initialization happens in the useEffect listener
    }, [db, userId]);

    const handleJoinSession = useCallback(async () => {
        if (!db || !userId || inputCode.length !== 4) return setError("Invalid session code.");
        setLoading(true);
        setError(null);

        const targetSessionRef = doc(db, `artifacts/${appId}/public/data/lf_sessions/${inputCode}`);
        try {
            const docSnap = await getDoc(targetSessionRef);

            if (docSnap.exists()) {
                setSessionCode(inputCode);
                localStorage.setItem('lf_session_code', inputCode);
                setMode('Player');
            } else {
                setError("Session not found. Check the 4-digit code.");
            }
        } catch (e) {
             setError("Error connecting to database. Check the API Key.");
        }
        
        setLoading(false);
    }, [db, userId, inputCode]);

    const handleLeaveSession = useCallback(() => {
        setSessionCode(null);
        setMode(null);
        setAllCharacters([]);
        localStorage.removeItem('lf_session_code');
        // Delete my character document from the session if I'm leaving
        if (charRef) deleteDoc(charRef).catch(e => console.error("Error deleting doc:", e));
    }, [charRef]);

    // --- UI RENDERINGS ---

    if (loading || !userId) {
        return <LoadingScreen message={"Initializing Starship Systems..."} error={error} />;
    }

    if (!sessionCode) {
        return <SessionSetup {...{ setMode, setInputCode, inputCode, handleJoinSession, handleCreateSession, error }} />;
    }

    // Main App Layout
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 font-mono max-w-7xl mx-auto w-full">
            
            {/* --- HEADER --- */}
            <header className="text-center mb-6 border-b border-gray-700 pb-4">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-red-400 drop-shadow-lg font-mono">
                    LASERS & FEELINGS
                </h1>
                <p className="text-xl text-indigo-300 mt-1 font-mono">
                    {mode === 'GM' ? 'GAME MASTER' : 'PLAYER'} VIEW
                </p>
                <div className="mt-3 flex flex-wrap justify-center items-center space-x-4">
                    <p className="text-lg font-bold bg-gray-700 py-2 px-4 rounded-lg flex items-center shadow-inner shadow-gray-900/50">
                        <Code className="w-4 h-4 mr-2 text-yellow-400"/> SESSION CODE: <span className="text-yellow-400 ml-2">{sessionCode}</span>
                    </p>
                    <button onClick={handleLeaveSession} className="text-sm text-gray-400 hover:text-red-400 transition-colors py-2 px-3 rounded-lg border border-transparent hover:border-red-400">
                        [LEAVE SESSION]
                    </button>
                </div>
            </header>

            {error && <div className="bg-red-800 p-4 rounded-lg mb-6 flex items-center border border-red-400 font-bold"><AlertTriangle className="mr-2" /> {error}</div>}

            {/* --- MAIN GRID LAYOUT --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUMN 1: Ship Details (Editable by GM) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="p-6 bg-gray-800 rounded-xl shadow-2xl border-2 border-teal-500/30 space-y-4">
                        <h2 className="text-2xl font-extrabold flex items-center text-teal-400 border-b border-teal-500/50 pb-2 font-mono">
                            <Ship className="w-5 h-5 mr-2" /> {ship.name}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-teal-300">Strengths (Max 2)</h3>
                                <div className="space-y-2">
                                    {SHIP_STRENGTHS.map(strength => (
                                        <button
                                            key={strength}
                                            onClick={mode === 'GM' ? () => toggleStrength(strength) : undefined}
                                            disabled={mode !== 'GM'}
                                            className={`w-full text-left p-3 rounded-lg text-sm transition-all flex justify-between items-center ${
                                                ship.strengths.includes(strength)
                                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-700/30 border border-teal-400'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-700'
                                            } ${mode !== 'GM' ? 'opacity-75 cursor-default' : ''}`}
                                        >
                                            {strength}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-teal-300">Weakness (1)</h3>
                                <div className="space-y-2">
                                    {SHIP_WEAKNESSES.map(weakness => (
                                        <button
                                            key={weakness}
                                            onClick={mode === 'GM' ? () => saveShip({ weakness }) : undefined}
                                            disabled={mode !== 'GM'}
                                            className={`w-full text-left p-3 rounded-lg text-sm transition-all flex justify-between items-center ${
                                                ship.weakness === weakness
                                                    ? 'bg-red-600 text-white shadow-md shadow-red-700/30 border border-red-400'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-700'
                                            } ${mode !== 'GM' ? 'opacity-75 cursor-default' : ''}`}
                                        >
                                            {weakness}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMN 2 & 3: Roster or Player Sheet/Dice Roller */}
                <div className="lg:col-span-2 space-y-6">

                    {mode === 'GM' ? (
                        /* GM Roster View */
                        <div className="p-6 bg-gray-800 rounded-xl shadow-2xl border-2 border-yellow-500/30">
                            <h2 className="text-3xl font-extrabold mb-4 text-yellow-400 border-b border-yellow-500/50 pb-2 font-mono">
                                CREW ROSTER ({allCharacters.length}/{MAX_PLAYERS})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {allCharacters.map((char) => (
                                    <CharacterCard key={char.userId} char={char} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Player Character Sheet and Dice Roller */
                        <>
                            <h2 className="text-3xl font-extrabold mb-4 text-red-400 font-mono">
                                YOUR CHARACTER SHEET
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Character Edit */}
                                <div className="p-6 bg-gray-800 rounded-xl shadow-2xl border-2 border-yellow-500/30 space-y-4">
                                    <h3 className="text-2xl font-extrabold flex items-center text-yellow-400 border-b border-yellow-500/50 pb-2 font-mono">
                                        <User className="w-5 h-5 mr-2" /> PERSONAL DATA
                                    </h3>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={myCharacter.name}
                                            onChange={(e) => setMyCharacter({ ...myCharacter, name: e.target.value })}
                                            onBlur={(e) => saveCharacter({ name: e.target.value })}
                                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-lg text-white focus:ring-red-500 focus:border-red-500 shadow-inner shadow-gray-900/50"
                                            placeholder="Sparks McGee"
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Your Number (2-5)</label>
                                        <div className="flex justify-between space-x-2">
                                            {[2, 3, 4, 5].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => saveCharacter({ number: num })}
                                                    className={`flex-1 p-4 rounded-xl text-xl font-extrabold transition-all border-2 border-transparent ${
                                                        myCharacter.number === num
                                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 border-white'
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs text-gray-400 italic">
                                            Low number = <span className="text-blue-400">FEELINGS</span>. High number = <span className="text-red-400">LASERS</span>.
                                        </p>
                                    </div>

                                    {['style', 'role', 'goal'].map(field => (
                                        <div className="mb-4" key={field}>
                                            <label className="block text-sm font-medium text-gray-400 mb-1 capitalize">{field}</label>
                                            <div className="relative">
                                                <select
                                                    value={myCharacter[field]}
                                                    onChange={(e) => saveCharacter({ [field]: e.target.value })}
                                                    className="w-full appearance-none p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-red-500 focus:border-red-500 shadow-inner shadow-gray-900/50 cursor-pointer"
                                                >
                                                    {(field === 'style' ? STYLES : field === 'role' ? ROLES : GOALS).map(option => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    ))}

                                    <h3 className="text-xl font-semibold mt-6 mb-2 text-red-300 border-t border-gray-700 pt-3">Standard Equipment</h3>
                                    <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside ml-4">
                                        <li>Consortium uniform (with built-in vacc-suit)</li>
                                        <li>Super-sweet space-phone-camera-communicator-scanner thing</li>
                                        <li>Variable-beam phase pistol (set to stun, usually)</li>
                                    </ul>
                                </div>

                                {/* Dice Roller */}
                                <DiceRoller character={myCharacter} updateRollState={(r) => console.log("Roll Result:", r)} />

                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
