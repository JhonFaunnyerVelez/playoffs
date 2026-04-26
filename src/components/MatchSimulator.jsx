import { useState, useEffect } from 'react'
import { Timer, Goal, AlertTriangle, ShieldAlert, CheckCircle2, XCircle, Hand, Target, Shield, ArrowRight } from 'lucide-react'

export default function MatchSimulator({ match, onComplete }) {
  const { team1, team2, round, index, leg, matchData } = match
  
  const previousIda1 = matchData?.ida1 || 0
  const previousIda2 = matchData?.ida2 || 0

  const [matchPhase, setMatchPhase] = useState('regular')
  const [minute, setMinute] = useState(0)
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [events, setEvents] = useState([])
  const [winner, setWinner] = useState(null)
  const [giantGoal, setGiantGoal] = useState(null)

  const [penHistory1, setPenHistory1] = useState([])
  const [penHistory2, setPenHistory2] = useState([])
  const [isTeam1Turn, setIsTeam1Turn] = useState(true)
  
  // Roster de cobradores para no repetir
  const [kickers1, setKickers1] = useState([])
  const [kickers2, setKickers2] = useState([])

  // Estado único para cualquier penal (regular o tanda)
  // { type: 'regular' | 'shootout', team, player, count }
  const [activePenalty, setActivePenalty] = useState(null)

  const [yellowCards, setYellowCards] = useState({ [team1.id]: [], [team2.id]: [] })
  const [redCards, setRedCards] = useState({ [team1.id]: [], [team2.id]: [] })

  const localTeam = leg === 'vuelta' ? team2 : team1

  // Bucle de partido regular
  useEffect(() => {
    if (matchPhase !== 'regular' || giantGoal || activePenalty) return

    if (minute >= 90) {
      if (leg === 'ida') {
        finishMatch(null)
      } else {
        const global1 = previousIda1 + score1
        const global2 = previousIda2 + score2
        if (global1 !== global2) {
          finishMatch(global1 > global2 ? team1 : team2)
        } else {
          setEvents(prev => [{ 
            minute: '90+', 
            message: '⏱️ ¡EMPATE GLOBAL! Definición por penales', 
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, 
            color: 'text-amber-600 font-black uppercase tracking-widest',
            teamId: 'sys' 
          }, ...prev])
          setMatchPhase('penalties')
        }
      }
      return
    }

    const timer = setTimeout(() => {
      setMinute(prev => prev + 1)
      generateRandomEvent(minute + 1)
    }, 666)

    return () => clearTimeout(timer)
  }, [minute, matchPhase, giantGoal, activePenalty])

  // Motor de resolución de la cuenta regresiva de penales
  useEffect(() => {
    if (!activePenalty) return
    
    if (activePenalty.count > 0) {
      const timer = setTimeout(() => {
         setActivePenalty(prev => ({ ...prev, count: prev.count - 1 }))
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      // ¡El contador llegó a cero! Ejecutar el penal
      const { type, team, player } = activePenalty
      setActivePenalty(null) // Quitar el estado del penal
      
      const isGoal = Math.random() < 0.70 // 70% gol, 30% fallo
      
      if (type === 'regular') {
         if (isGoal) {
           const message = `⚽ ¡PENAL y GOL de ${team.name}! Anota ${player}`
           const icon = team.logoUrl ? <img src={team.logoUrl} className="w-5 h-5 rounded-sm object-cover" /> : <Goal className="w-5 h-5 text-emerald-500" />
           const color = 'text-emerald-600 font-black text-lg'
           
           setGiantGoal({ team, player: `De Penal: ${player}` })
           setTimeout(() => setGiantGoal(null), 2500)

           if (team.id === team1.id) setScore1(s => s + 1)
           else setScore2(s => s + 1)
           setEvents(prev => [{ minute, message, icon, color, teamId: team.id, type: 'goal', player: `${player} (P)` }, ...prev])
         } else {
           const message = `❌ ¡PENAL FALLADO! ${player} (${team.name}) erró desde los 12 pasos`
           const icon = <XCircle className="w-5 h-5 text-red-500" />
           const color = 'text-red-500 font-bold'
           setEvents(prev => [{ minute, message, icon, color, teamId: team.id }, ...prev])
         }
      } else {
         // Shootout
         const isTeam1TurnLocal = team.id === team1.id
         if (isTeam1TurnLocal) setPenHistory1(prev => [...prev, isGoal ? 'goal' : 'miss'])
         else setPenHistory2(prev => [...prev, isGoal ? 'goal' : 'miss'])

         setEvents(prev => [{ 
            minute: 'PEN', 
            message: isGoal ? `⚽ ¡GOLLLLLL de ${player}! (${team.name})` : `❌ ¡LO BOTÓÓÓÓ! ${player} falla el penal`, 
            icon: isGoal ? <Goal className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />, 
            color: isGoal ? 'text-emerald-500 font-black text-lg' : 'text-red-500 font-black text-lg',
            teamId: team.id,
            type: isGoal ? 'goal' : null,
            player: isGoal ? player : null
         }, ...prev])

         setIsTeam1Turn(!isTeam1TurnLocal)
      }
    }
  }, [activePenalty, minute])

  // Bucle de tanda de penales
  useEffect(() => {
    if (matchPhase !== 'penalties' || activePenalty !== null || giantGoal) return
    const timer = setTimeout(() => triggerShootoutPenalty(), 1500)
    return () => clearTimeout(timer)
  }, [penHistory1, penHistory2, isTeam1Turn, matchPhase, activePenalty, giantGoal])

  const getRandomPlayer = (team, excludeRole = null) => {
    let players = team.players || []
    
    const expelled = redCards[team.id] || []
    players = players.filter(p => !expelled.includes(p))

    if (excludeRole === 'gk') {
      const originalGk = team.players[0]
      players = players.filter(p => p !== originalGk)
    }

    if (players.length === 0) return "Jugador"
    return players[Math.floor(Math.random() * players.length)]
  }

  const getRandomPenaltyKicker = (team, historyList) => {
    const expelled = redCards[team.id] || []
    let available = team.players.filter(p => !expelled.includes(p))
    
    let untouched = available.filter(p => !historyList.includes(p))
    
    if (untouched.length === 0) {
      // Ya patearon todos, reiniciamos lista
      if (team.id === team1.id) setKickers1([])
      else setKickers2([])
      untouched = available
    }

    if (untouched.length === 0) return "Jugador"
    return untouched[Math.floor(Math.random() * untouched.length)]
  }

  const generateRandomEvent = (currentMinute) => {
    const global1 = previousIda1 + score1
    const global2 = previousIda2 + score2
    
    let eventProbability = 0.18
    let overrideScoringTeam = null

    // Emoción de final
    if (currentMinute >= 85) {
      if (global1 === global2) {
        eventProbability = 0.05 
      } else {
        const diff = Math.abs(global1 - global2)
        if (diff >= 3) {
           eventProbability = 0.4
           overrideScoringTeam = global1 < global2 ? team1 : team2
        } else if (diff === 1) {
           eventProbability = 0.3
        }
      }
    }

    if (Math.random() > eventProbability) return 

    // Balanceo global por goleada en CUALQUIER minuto
    let team1Prob = 0.5
    const diff = Math.abs(global1 - global2)
    if (diff >= 3) {
      const losingTeamIs1 = global1 < global2
      if (losingTeamIs1) team1Prob += 0.25 // Más empuje para remontar
      else team1Prob -= 0.25
    }

    // Balanceo por expulsiones: -20% por cada roja
    const reds1 = redCards[team1.id]?.length || 0
    const reds2 = redCards[team2.id]?.length || 0
    team1Prob -= (reds1 * 0.20)
    team1Prob += (reds2 * 0.20)
    team1Prob = Math.max(0.1, Math.min(0.9, team1Prob)) 

    let isTeam1 = Math.random() < team1Prob
    if (overrideScoringTeam) {
       isTeam1 = overrideScoringTeam.id === team1.id
    }

    const team = isTeam1 ? team1 : team2
    const opponentTeam = isTeam1 ? team2 : team1

    const eventTypeRand = overrideScoringTeam ? 0.1 : Math.random() 
    
    let message, icon, color
    
    if (eventTypeRand < 0.22) {
      const player = getRandomPlayer(team, 'gk')
      message = `⚽ ¡GOL de ${team.name}! Anota ${player}`
      icon = team.logoUrl ? <img src={team.logoUrl} className="w-5 h-5 rounded-sm object-cover" /> : <Goal className="w-5 h-5 text-emerald-500" />
      color = 'text-emerald-600 font-black text-lg'
      
      setGiantGoal({ team, player })
      setTimeout(() => setGiantGoal(null), 2500)

      if (isTeam1) setScore1(s => s + 1)
      else setScore2(s => s + 1)
      setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id, type: 'goal', player }, ...prev])
    
    } else if (eventTypeRand < 0.25) {
      // PENAL en tiempo regular (Probabilidad baja del 3%)
      const player = getRandomPlayer(team, 'gk')
      setActivePenalty({ type: 'regular', team, player, count: 3 })
      // No seguimos procesando, el partido entra en pausa.
      return

    } else if (eventTypeRand < 0.50) {
      const player = getRandomPlayer(team, 'gk')
      message = `⚠️ ${player} (${team.name}) falla una ocasión clara`
      icon = <AlertTriangle className="w-5 h-5 text-slate-400" />
      color = 'text-slate-500 font-bold'
      setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id }, ...prev])
    } else if (eventTypeRand < 0.70) {
      const player = getRandomPlayer(team)
      message = `💥 ¡AL PALO! Remate de ${player} que impacta en el poste`
      icon = <Target className="w-5 h-5 text-orange-500" />
      color = 'text-orange-600 font-black'
      setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id }, ...prev])
    } else if (eventTypeRand < 0.85) {
      const originalGk = opponentTeam.players[0] || "Portero"
      const expelledOpponents = redCards[opponentTeam.id] || []
      const gk = expelledOpponents.includes(originalGk) ? "Suplente del Arquero" : originalGk
      
      message = `🧤 ¡ATAJADÓN de ${gk}! Salva a ${opponentTeam.name}`
      icon = <Hand className="w-5 h-5 text-blue-500" />
      color = 'text-blue-600 font-black'
      setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: opponentTeam.id }, ...prev])
    } else if (eventTypeRand < 0.98) {
      let player = getRandomPlayer(team)
      if (player === team.players[0] && Math.random() < 0.8) {
         player = getRandomPlayer(team, 'gk')
      }

      if (yellowCards[team.id].includes(player)) {
        setRedCards(prev => ({ ...prev, [team.id]: [...prev[team.id], player] }))
        message = `🟥 ¡DOBLE AMARILLA! Expulsado ${player} (${team.name})`
        icon = <ShieldAlert className="w-4 h-4 text-red-500" />
        color = 'text-red-600 font-black'
        setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id, type: 'red', player }, ...prev])
      } else {
        setYellowCards(prev => ({ ...prev, [team.id]: [...prev[team.id], player] }))
        message = `🟨 Tarjeta Amarilla para ${player} (${team.name})`
        icon = <div className="w-3 h-4 bg-yellow-400 rounded-sm border border-yellow-500 shadow-sm flex items-center justify-center"></div>
        color = 'text-yellow-600 font-bold'
        setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id, type: 'yellow', player }, ...prev])
      }
    } else {
      let player = getRandomPlayer(team)
      if (player === team.players[0] && Math.random() < 0.9) {
         player = getRandomPlayer(team, 'gk')
      }
      setRedCards(prev => ({ ...prev, [team.id]: [...prev[team.id], player] }))
      message = `🟥 ¡EXPULSIÓN! Roja directa para ${player} (${team.name})`
      icon = <ShieldAlert className="w-4 h-4 text-red-500" />
      color = 'text-red-600 font-black'
      setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id, type: 'red', player }, ...prev])
    }
  }

  const triggerShootoutPenalty = () => {
    const penScore1 = penHistory1.filter(h => h === 'goal').length
    const penScore2 = penHistory2.filter(h => h === 'goal').length
    const remaining1 = Math.max(5 - penHistory1.length, 0)
    const remaining2 = Math.max(5 - penHistory2.length, 0)

    if (penHistory1.length === penHistory2.length) {
      if (penScore1 > penScore2 + remaining2) return finishMatch(team1, true)
      if (penScore2 > penScore1 + remaining1) return finishMatch(team2, true)
      if (penHistory1.length >= 5 && penScore1 !== penScore2) {
        return finishMatch(penScore1 > penScore2 ? team1 : team2, true)
      }
    } else {
      if (penScore1 > penScore2 + remaining2) return finishMatch(team1, true)
      if (penScore2 > penScore1 + remaining1) return finishMatch(team2, true)
    }

    const currentTeam = isTeam1Turn ? team1 : team2
    const historyList = isTeam1Turn ? kickers1 : kickers2
    const player = getRandomPenaltyKicker(currentTeam, historyList)

    if (isTeam1Turn) setKickers1(prev => [...prev, player])
    else setKickers2(prev => [...prev, player])

    setActivePenalty({ type: 'shootout', team: currentTeam, player, count: 3 })
  }

  const finishMatch = (matchWinner, wasPenalties = false) => {
    setMatchPhase('finished')
    setWinner(matchWinner)
    
    const msg = matchWinner 
      ? `🏆 ¡FINAL! ${matchWinner.name} clasifica${wasPenalties ? ' por penales' : ''}`
      : '⏱️ ¡FINAL! Todo se define en la vuelta'

    setEvents(prev => [{ 
      minute: 'FIN', 
      message: msg, 
      icon: <CheckCircle2 className="w-6 h-6 text-indigo-600" />, 
      color: 'text-indigo-600 font-black text-xl uppercase tracking-tighter',
      teamId: 'sys' 
    }, ...prev])
  }

  const handleContinue = () => {
    onComplete(round, index, leg, score1, score2, winner)
  }

  const global1 = previousIda1 + score1
  const global2 = previousIda2 + score2

  const renderPenaltyCircles = (history, isActive) => {
    const isSuddenDeath = history.length >= 5 || (history.length === 4 && isActive)
    
    const firstRound = history.slice(0, 5)
    const suddenDeath = history.slice(5)

    const buildCircles = (arr, maxLen, activeInThisLine) => {
      const circles = []
      const total = Math.max(maxLen, arr.length + (activeInThisLine && !activePenalty ? 1 : 0))
      for (let i = 0; i < total; i++) {
        if (i < arr.length) {
          const isGoal = arr[i] === 'goal'
          circles.push(
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg transform transition-all scale-110 ${isGoal ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`}>
              {isGoal ? '✓' : '✕'}
            </div>
          )
        } else if (i === arr.length && activeInThisLine && !activePenalty) {
          circles.push(<div key={i} className="w-8 h-8 rounded-full bg-indigo-50 border-4 border-indigo-500 animate-pulse shadow-indigo-100 shadow-lg"></div>)
        } else {
          circles.push(<div key={i} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-200"></div>)
        }
      }
      return circles
    }

    return (
      <div className="flex flex-col items-center gap-2 mt-6">
        <div className="flex gap-3 justify-center">{buildCircles(firstRound, 5, isActive && history.length < 5)}</div>
        {isSuddenDeath && (
          <>
            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-2 animate-pulse">Muerte Súbita</div>
            <div className="flex gap-3 justify-center flex-wrap max-w-[200px]">{buildCircles(suddenDeath, 1, isActive && history.length >= 5)}</div>
          </>
        )}
      </div>
    )
  }

  const renderTeamSummary = (team) => {
    const teamEvents = events.filter(e => e.teamId === team.id && e.type).reverse() 
    const goals = teamEvents.filter(e => e.type === 'goal')
    const yellows = teamEvents.filter(e => e.type === 'yellow')
    const reds = teamEvents.filter(e => e.type === 'red')

    return (
      <div className="flex flex-col gap-2 mt-6 w-full max-w-[280px] bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/60 shadow-sm text-xs font-medium">
        {goals.length > 0 && (
          <div className="flex items-start gap-2">
            <span>⚽</span>
            <span className="text-slate-700 leading-tight">
              {goals.map(g => `${g.player} ${g.minute}'`).join(', ')}
            </span>
          </div>
        )}
        {yellows.length > 0 && (
          <div className="flex items-start gap-2">
            <span>🟨</span>
            <span className="text-yellow-700 leading-tight">
              {yellows.map(g => `${g.player} ${g.minute}'`).join(', ')}
            </span>
          </div>
        )}
        {reds.length > 0 && (
          <div className="flex items-start gap-2">
            <span>🟥</span>
            <span className="text-red-600 leading-tight font-bold">
              {reds.map(g => `${g.player} ${g.minute}'`).join(', ')}
            </span>
          </div>
        )}
      </div>
    )
  }

  const renderTeamBlock = (team, score, penHistory, isTurn) => {
    return (
      <div className="flex-1 flex flex-col items-center">
        <div 
          className={`w-32 h-32 rounded-[2rem] bg-white flex items-center justify-center shadow-xl border-4 transition-all duration-500 overflow-hidden relative
            ${(matchPhase === 'penalties' && isTurn) || (activePenalty?.team?.id === team.id) ? 'scale-110 border-blue-500 ring-8 ring-blue-50' : 'border-slate-100'}`}
        >
          {activePenalty?.team?.id === team.id && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-20 backdrop-blur-sm animate-fade-in p-2 text-center">
              <span className="text-[10px] text-slate-300 font-bold leading-tight uppercase mb-1">{activePenalty.player}</span>
              <span className="text-5xl font-black text-white animate-pop-out leading-none">{activePenalty.count}</span>
            </div>
          )}
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <Shield className="w-16 h-16 text-slate-300" />
          )}
        </div>
        <div className="text-center mt-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{team.name}</h2>
        </div>
        {matchPhase === 'penalties' && renderPenaltyCircles(penHistory, isTurn)}
        
        {renderTeamSummary(team)}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in p-4 max-w-6xl mx-auto w-full relative">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_center,_#000_0%,_transparent_70%)] mix-blend-multiply rounded-full"></div>

      {giantGoal && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none bg-slate-900/40 backdrop-blur-md">
          <h1 
            className="text-8xl font-black italic tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] animate-giantGoal uppercase leading-none text-white"
            style={{ WebkitTextStroke: `2px #000` }}
          >
            ¡GOOOL!
          </h1>
          <div className="animate-pop-out mt-4 bg-white px-6 py-2 rounded-2xl shadow-2xl border-2 border-white transform scale-125 flex flex-col items-center">
             {giantGoal.team.logoUrl && <img src={giantGoal.team.logoUrl} className="w-12 h-12 mb-2" />}
            <p className="text-lg font-black text-slate-900 uppercase tracking-widest">{giantGoal.team.name}</p>
            <p className="text-sm font-bold text-indigo-600 uppercase text-center mt-1">{giantGoal.player}</p>
          </div>
        </div>
      )}

      <div className="glass-panel w-full rounded-[2.5rem] p-8 mb-8 relative border border-white/60 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] bg-gradient-to-br from-white to-slate-50">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
          <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-slate-100 shadow-sm">
            <Timer className={`w-4 h-4 ${(matchPhase === 'regular' && !giantGoal && !activePenalty) ? 'text-indigo-600 animate-spin-slow' : 'text-slate-400'}`} />
            <span className="font-mono font-black text-xl text-slate-900 tracking-tighter">
              {matchPhase === 'regular' ? `${minute}'` : matchPhase === 'penalties' ? 'P' : 'F'}
            </span>
          </div>
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 bg-slate-100 px-2 py-0.5 rounded-full">
            {leg === 'ida' ? 'Ida' : 'Vuelta'}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 mt-8 w-full relative z-0">
          {/* Local Team */}
          {renderTeamBlock(leg === 'vuelta' ? team2 : team1, leg === 'vuelta' ? score2 : score1, leg === 'vuelta' ? penHistory2 : penHistory1, leg === 'vuelta' ? !isTeam1Turn : isTeam1Turn)}
          
          {/* Score Center */}
          <div className="flex flex-col items-center gap-4 px-6 mt-16 flex-shrink-0">
            <div className="flex items-center gap-6">
              <span className="text-7xl font-black font-mono tracking-tighter text-slate-900 leading-none">{leg === 'vuelta' ? score2 : score1}</span>
              <span className="text-4xl text-slate-200 font-black mb-4">-</span>
              <span className="text-7xl font-black font-mono tracking-tighter text-slate-900 leading-none">{leg === 'vuelta' ? score1 : score2}</span>
            </div>
            
            {leg === 'vuelta' && (
              <div className="flex flex-col items-center gap-2 mt-2">
                <div className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black shadow-xl border border-slate-700 text-lg tracking-tighter">
                  GLOBAL: <span className="text-yellow-400">{leg === 'vuelta' ? global2 : global1}</span> - <span className="text-yellow-400">{leg === 'vuelta' ? global1 : global2}</span>
                </div>
                {matchPhase === 'penalties' && (
                  <div className="bg-white text-slate-900 px-6 py-1 rounded-full font-black shadow-sm border border-slate-200 text-sm tracking-tighter flex items-center gap-2">
                    PENALES: <span className="text-blue-600">{leg === 'vuelta' ? penHistory2.filter(h=>h==='goal').length : penHistory1.filter(h=>h==='goal').length}</span> - <span className="text-red-600">{leg === 'vuelta' ? penHistory1.filter(h=>h==='goal').length : penHistory2.filter(h=>h==='goal').length}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visitor Team */}
          {renderTeamBlock(leg === 'vuelta' ? team1 : team2, leg === 'vuelta' ? score1 : score2, leg === 'vuelta' ? penHistory1 : penHistory2, leg === 'vuelta' ? isTeam1Turn : !isTeam1Turn)}
        </div>
      </div>

      {/* Events Feed */}
      <div className="w-full max-w-4xl bg-white rounded-[2.5rem] h-[250px] flex flex-col overflow-hidden border border-white shadow-xl relative">
        <div className="bg-slate-50/50 p-4 border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-[0.3em] text-center">
          Transmisión en Vivo
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3 custom-scrollbar">
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-30">
               <div className="w-12 h-1 bg-slate-200 rounded-full mb-4 animate-pulse"></div>
               <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Los equipos saltan al campo...</p>
            </div>
          )}
          {events.map((ev, i) => (
            <div key={i} className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl animate-slide-in border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
              <div className="font-mono font-black text-sm text-slate-400 bg-white w-12 h-8 flex items-center justify-center rounded-xl shadow-sm border border-slate-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">{ev.minute}'</div>
              <div className="w-8 flex justify-center transform group-hover:scale-125 transition-transform">{ev.icon}</div>
              <span className={`flex-1 text-sm tracking-tight ${ev.color}`}>{ev.message}</span>
            </div>
          ))}
        </div>
        <div className="absolute top-[52px] left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent pointer-events-none"></div>
      </div>

      {/* Action Area */}
      <div className={`mt-8 transition-all duration-700 ${matchPhase === 'finished' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}>
        <button
          onClick={handleContinue}
          className="group relative py-5 px-12 bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 text-white font-black text-xl rounded-[2rem] transition-all shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-1 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative flex items-center gap-4 uppercase tracking-widest drop-shadow-md">
            {leg === 'ida' ? 'Continuar a la Vuelta' : 'Regresar al Torneo'}
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </span>
        </button>
      </div>
    </div>
  )
}
