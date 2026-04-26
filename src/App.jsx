import { useState, useEffect } from 'react'
import TeamSetup from './components/TeamSetup'
import DrawSimulator from './components/DrawSimulator'
import Bracket from './components/Bracket'
import MatchSimulator from './components/MatchSimulator'
import TournamentHistory from './components/TournamentHistory'
import Login from './components/Login'
import { Trophy, History, LogOut } from 'lucide-react'
import { db, auth } from './firebase'
import { collection, onSnapshot, query, where, writeBatch, doc, addDoc, updateDoc, increment } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import colombiaLogo from './assets/colombia.png'

const DEFAULT_PLAYERS = [
  "Portero", "Defensa 1", "Defensa 2", "Defensa 3", "Defensa 4",
  "Medio 1", "Medio 2", "Medio 3", "Extremo 1", "Extremo 2", "Delantero"
]

const INITIAL_TEAMS = [
  { name: 'Real Madrid', color: '#ffffff', bg: '#1a1a1a', short: 'RMA', players: [...DEFAULT_PLAYERS] },
  { name: 'Barcelona', color: '#a50044', bg: '#004d98', short: 'BAR', players: [...DEFAULT_PLAYERS] },
  { name: 'Bayern Munich', color: '#dc052d', bg: '#000000', short: 'BAY', players: [...DEFAULT_PLAYERS] },
  { name: 'Man City', color: '#6cabdd', bg: '#1c2c5b', short: 'MCI', players: [...DEFAULT_PLAYERS] },
  { name: 'Arsenal', color: '#ef0107', bg: '#063672', short: 'ARS', players: [...DEFAULT_PLAYERS] },
  { name: 'PSG', color: '#004170', bg: '#da291c', short: 'PSG', players: [...DEFAULT_PLAYERS] },
  { name: 'Juventus', color: '#000000', bg: '#ffffff', short: 'JUV', players: [...DEFAULT_PLAYERS] },
  { name: 'Inter Milan', color: '#0058ab', bg: '#000000', short: 'INT', players: [...DEFAULT_PLAYERS] }
]

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [phase, setPhase] = useState(() => localStorage.getItem('fpc_phase') || 'setup')
  const [teams, setTeams] = useState([])
  const [seededPositions, setSeededPositions] = useState(() => {
    const saved = localStorage.getItem('fpc_seededPositions')
    return saved ? JSON.parse(saved) : Array(8).fill(null)
  })

  const [bracketState, setBracketState] = useState(() => {
    const saved = localStorage.getItem('fpc_bracketState')
    return saved ? JSON.parse(saved) : {
      qf: Array(4).fill({ team1: null, team2: null, ida1: null, ida2: null, vuelta1: null, vuelta2: null, winner: null }),
      sf: Array(2).fill({ team1: null, team2: null, ida1: null, ida2: null, vuelta1: null, vuelta2: null, winner: null }),
      final: { team1: null, team2: null, ida1: null, ida2: null, vuelta1: null, vuelta2: null, winner: null },
      champion: null
    }
  })
  
  const [currentMatch, setCurrentMatch] = useState(() => {
    const saved = localStorage.getItem('fpc_currentMatch')
    return saved ? JSON.parse(saved) : null
  })

  const [tournamentTeams, setTournamentTeams] = useState(() => {
    const saved = localStorage.getItem('fpc_tournamentTeams')
    return saved ? JSON.parse(saved) : []
  })

  // Persistencia de estados
  useEffect(() => {
    localStorage.setItem('fpc_phase', phase)
    localStorage.setItem('fpc_seededPositions', JSON.stringify(seededPositions))
    localStorage.setItem('fpc_bracketState', JSON.stringify(bracketState))
    localStorage.setItem('fpc_currentMatch', JSON.stringify(currentMatch))
    localStorage.setItem('fpc_tournamentTeams', JSON.stringify(tournamentTeams))
  }, [phase, seededPositions, bracketState, currentMatch, tournamentTeams])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setTeams([])
      return
    }

    const q = query(collection(db, 'teams'))
    let isFirstLoad = true

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      if (snapshot.empty && isFirstLoad) {
        const batch = writeBatch(db)
        INITIAL_TEAMS.forEach((team, index) => {
          const docRef = doc(collection(db, 'teams'))
          const { id, ...teamData } = team 
          batch.set(docRef, { ...teamData, order: index + 1, userId: 'system', stars: 0 })
        })
        await batch.commit()
      } else {
        teamsData.sort((a, b) => a.order - b.order)
        setTeams(teamsData)
      }
      isFirstLoad = false
    })

    return () => unsubscribe()
  }, [user])

  const createMatch = (team1, team2) => ({
    team1, team2, 
    ida1: null, ida2: null, 
    vuelta1: null, vuelta2: null, 
    winner: null
  })

  const handleStartDraw = (finalSeeded, selectedTeams) => {
    setSeededPositions(finalSeeded)
    setTournamentTeams(selectedTeams)
    setPhase('draw')
  }

  const handleDrawComplete = (finalPositions) => {
    const newQf = []
    for (let i = 0; i < 4; i++) {
      newQf.push(createMatch(finalPositions[i * 2], finalPositions[i * 2 + 1]))
    }
    setBracketState(prev => ({ ...prev, qf: newQf }))
    setPhase('bracket')
  }

  const handleSimulateMatch = (round, index, team1, team2, leg) => {
    setCurrentMatch({ round, index, team1, team2, leg, matchData: round === 'final' ? bracketState.final : bracketState[round][index] })
    setPhase('match')
  }

  const handleMatchComplete = (round, index, leg, score1, score2, winner = null) => {
    const newBracket = { ...bracketState }
    
    if (round === 'final') {
      if (leg === 'ida') {
        newBracket.final.ida1 = score1
        newBracket.final.ida2 = score2
      } else {
        newBracket.final.vuelta1 = score1
        newBracket.final.vuelta2 = score2
        newBracket.final.winner = winner
        newBracket.champion = winner
      }
    } else {
      const match = newBracket[round][index]
      if (leg === 'ida') {
        match.ida1 = score1
        match.ida2 = score2
      } else {
        match.vuelta1 = score1
        match.vuelta2 = score2
        match.winner = winner

        if (round === 'qf') {
          const sfIndex = Math.floor(index / 2)
          const isTeam1 = index % 2 === 0
          const currentSf = { ...newBracket.sf[sfIndex] }
          if (isTeam1) currentSf.team1 = winner
          else currentSf.team2 = winner
          newBracket.sf[sfIndex] = currentSf
        } else if (round === 'sf') {
          const isTeam1 = index === 0
          const currentFinal = { ...newBracket.final }
          if (isTeam1) currentFinal.team1 = winner
          else currentFinal.team2 = winner
          newBracket.final = currentFinal
        }
      }
      newBracket[round][index] = match
    }

    setBracketState(newBracket)
    setCurrentMatch(null)
    setPhase('bracket')

    // AUTO-GUARDAR si hay campeón
    if (newBracket.champion) {
      autoSaveTournament(newBracket)
    }
  }

  const autoSaveTournament = async (finalBracket) => {
    try {
      await addDoc(collection(db, 'tournaments'), {
        date: new Date().toISOString(),
        champion: finalBracket.champion,
        bracket: finalBracket,
        authorId: user.uid,
        authorName: user.displayName || 'Míster Anónimo',
        authorPhoto: user.photoURL || null
      })

      if (finalBracket.champion && finalBracket.champion.id) {
        const championRef = doc(db, 'teams', finalBracket.champion.id)
        await updateDoc(championRef, { stars: increment(1) })
      }
      console.log("Torneo guardado automáticamente")
    } catch (err) {
      console.error("Error auto-saving tournament", err)
    }
  }

  const handleResetTournament = () => {
    setBracketState({
      qf: Array(4).fill({ team1: null, team2: null, ida1: null, ida2: null, vuelta1: null, vuelta2: null, winner: null }),
      sf: Array(2).fill({ team1: null, team2: null, ida1: null, ida2: null, vuelta1: null, vuelta2: null, winner: null }),
      final: { team1: null, team2: null, ida1: null, ida2: null, vuelta1: null, vuelta2: null, winner: null },
      champion: null
    })
    setPhase('setup')
  }

  const handleLogout = () => {
    if(confirm("¿Seguro que deseas salir?")) {
      signOut(auth)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col gap-4">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white font-bold uppercase tracking-widest">Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col">
      <header className="p-4 border-b border-white/20 bg-white/70 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
              <img src={colombiaLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic text-slate-900">
              PLAYOFFS <span className="text-red-600">FPC</span>
            </h1>
          </div>
          <div className="flex gap-6 text-[11px] font-black uppercase tracking-tighter italic text-slate-400 items-center">
            <button onClick={() => setPhase('setup')} className={`hover:text-blue-500 transition-colors ${phase === 'setup' ? 'text-blue-600' : ''}`}>1. Config</button>
            <button onClick={() => { if(phase !== 'setup') setPhase('draw') }} className={`hover:text-blue-500 transition-colors ${phase === 'draw' ? 'text-blue-600' : ''}`}>2. Sorteo</button>
            <button onClick={() => { if(bracketState.qf[0].team1) setPhase('bracket') }} className={`hover:text-blue-500 transition-colors ${phase === 'bracket' || phase === 'match' ? 'text-blue-600' : ''}`}>3. Torneo</button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button onClick={() => setPhase('history')} className={`flex items-center gap-1 hover:text-indigo-500 transition-colors ${phase === 'history' ? 'text-indigo-600' : ''}`}>
              Historial
            </button>
            
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
               {user.photoURL ? (
                 <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-slate-200" />
               ) : (
                 <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{user.email?.[0].toUpperCase()}</div>
               )}
               <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
                 <LogOut className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {phase === 'setup' && (
          <TeamSetup 
            teams={teams} 
            setTeams={setTeams}
            onStartDraw={handleStartDraw} 
            user={user}
          />
        )}
        
        {phase === 'draw' && (
          <DrawSimulator 
            teams={tournamentTeams} 
            seededPositions={seededPositions} 
            onComplete={handleDrawComplete} 
          />
        )}

        {phase === 'bracket' && (
          <Bracket 
            bracketState={bracketState} 
            onSimulateMatch={handleSimulateMatch} 
            onResetTournament={handleResetTournament}
          />
        )}

        {phase === 'match' && currentMatch && (
          <MatchSimulator 
            match={currentMatch} 
            onComplete={handleMatchComplete} 
          />
        )}

        {phase === 'history' && (
          <TournamentHistory user={user} />
        )}
      </main>
    </div>
  )
}

export default App
