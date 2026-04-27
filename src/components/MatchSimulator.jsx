import { useState, useEffect } from 'react'
import { Timer, Goal, AlertTriangle, ShieldAlert, CheckCircle2, XCircle, Hand, Target, Shield, ArrowRight, Monitor, Play, ArrowLeft } from 'lucide-react'
import penalImg from '../assets/penal.png'
import varImg from '../assets/VAR.png'
import callingVarImg from '../assets/llamandoVar.png'

export default function MatchSimulator({ match, onComplete, onBack, user, realismEnabled, tournamentTeams }) {
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
  const [giantPenalty, setGiantPenalty] = useState(null)
  const [giantMiss, setGiantMiss] = useState(null)
  const [giantVar, setGiantVar] = useState(null) // { type: 'calling' | 'confirmed' | 'annulled', team, player }
  const [activeVar, setActiveVar] = useState(null) // { team, player, count }
  const [giantStoppage, setGiantStoppage] = useState(null) // count

  const [penHistory1, setPenHistory1] = useState([])
  const [penHistory2, setPenHistory2] = useState([])
  const [isTeam1Turn, setIsTeam1Turn] = useState(true)
  
  // Roster de cobradores para no repetir
  const [kickers1, setKickers1] = useState([])
  const [kickers2, setKickers2] = useState([])

  // Estado único para cualquier penal (regular o tanda)
  // { type: 'regular' | 'shootout', team, player, count }
  const [activePenalty, setActivePenalty] = useState(null)
  const [stoppageTime] = useState(() => Math.floor(Math.random() * 6) + 3) // 3, 4, 5, 6, 7, 8

  const [yellowCards, setYellowCards] = useState({ [team1.id]: [], [team2.id]: [] })
  const [redCards, setRedCards] = useState({ [team1.id]: [], [team2.id]: [] })

  const localTeam = leg === 'vuelta' ? team2 : team1

  const referees = ['Nicolás Gallo', 'Alexander Guzmán', 'Wilmar Roldán', 'Carlos Ortega', 'Luis Matorel']
  const [referee] = useState(() => {
    if (round === 'final') {
      return Math.random() < 0.5 ? 'Wilmar Roldán' : 'Luis Matorel'
    }
    return referees[Math.floor(Math.random() * referees.length)]
  })

  // REALISM BONUS LOGIC
  const t1Index = realismEnabled ? tournamentTeams.findIndex(t => t.id === team1.id) : -1
  const t2Index = realismEnabled ? tournamentTeams.findIndex(t => t.id === team2.id) : -1
  const t1Bonus = t1Index !== -1 ? (8 - t1Index) * 0.01 : 0 
  const t2Bonus = t2Index !== -1 ? (8 - t2Index) * 0.01 : 0

  // UNDERDOG BOOST LOGIC (+1% per advanced phase for positions 5-8)
  const getUnderdogBonus = (idx) => {
    if (idx < 4 || idx === -1) return 0
    if (round === 'sf') return 0.01 // Advanced from QF
    if (round === 'final') return 0.02 // Advanced from QF and SF
    return 0
  }

  const t1UnderdogBonus = realismEnabled ? getUnderdogBonus(t1Index) : 0
  const t2UnderdogBonus = realismEnabled ? getUnderdogBonus(t2Index) : 0

  // Localía Logic as requested:
  // El primero de la llave (Team 1) comienza de local (IDA).
  // El segundo de la llave (Team 2) cierra de local (VUELTA).
  const currentLeg = (leg || '').toLowerCase().trim()
  const isT1Local = currentLeg === 'ida' || currentLeg === 'final'
  
  const t1LocaliaBonus = realismEnabled && isT1Local ? 0.01 : 0
  const t2LocaliaBonus = realismEnabled && !isT1Local ? 0.01 : 0

  const t1TotalBonus = t1Bonus + t1UnderdogBonus + t1LocaliaBonus
  const t2TotalBonus = t2Bonus + t2UnderdogBonus + t2LocaliaBonus
  
  const getRoundName = () => {
    if (round === 'qf') return 'Cuartos de Final'
    if (round === 'sf') return 'Semifinal'
    return 'Gran Final'
  }

  // Evento de inicio del partido
  useEffect(() => {
    if (minute === 0 && events.length === 0) {
      setEvents([{ 
        minute: 0, 
        message: '🏁 ¡PITAZO INICIAL! Comienza el partido', 
        icon: <Play className="w-5 h-5 text-indigo-500 fill-current" />, 
        color: 'text-indigo-600 font-black uppercase tracking-widest' 
      }])
    }
  }, [])

  // Bucle de partido regular
  useEffect(() => {
    if (matchPhase !== 'regular' || giantGoal || activePenalty || activeVar || giantVar || giantMiss || giantStoppage || giantPenalty) return

    const maxTime = 90 + stoppageTime

    if (minute >= maxTime) {
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
      if (minute === 89) {
        // Al llegar a 90 (en el siguiente tick), mostramos la adición
        setGiantStoppage(stoppageTime)
        setTimeout(() => setGiantStoppage(null), 3000)
        
        setEvents(prev => [{ 
          minute: '90', 
          message: `⏱️ +${stoppageTime} MINUTOS DE ADICIÓN`, 
          icon: <Timer className="w-5 h-5 text-amber-500" />, 
          color: 'text-amber-600 font-black' 
        }, ...prev])
      }

      setMinute(prev => prev + 1)
      // Solo generamos eventos si NO estamos en el último segundo del partido
      if (minute + 1 < maxTime) {
        generateRandomEvent(minute + 1)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [minute, matchPhase, giantGoal, activePenalty, activeVar, giantVar, giantMiss, stoppageTime, giantStoppage, giantPenalty])

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
      
      let goalProb = 0.70 // Default para penales en tiempo regular
      
      if (type === 'shootout') {
        const totalKicks = penHistory1.length + penHistory2.length
        const isSuddenDeath = penHistory1.length >= 5 && penHistory2.length >= 5
        
        if (isSuddenDeath) {
          goalProb = 0.30 // Muerte súbita: 30% anota, 70% lo bota
        } else {
          goalProb = 0.50 // Tanda regular (primeros 5): 50% / 50%
        }
      }

      const isGoal = Math.random() < goalProb 
      
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
           
           setGiantMiss({ team, player })
           setTimeout(() => setGiantMiss(null), 2500)
           
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

         if (!isGoal) {
            setGiantMiss({ team, player })
            setTimeout(() => setGiantMiss(null), 2500)
         }

         setIsTeam1Turn(!isTeam1TurnLocal)
      }
    }
  }, [activePenalty, minute])

  // Motor de resolución de VAR
  useEffect(() => {
    if (!activeVar) return

    if (activeVar.count > 0) {
      const timer = setTimeout(() => {
        setActiveVar(prev => ({ ...prev, count: prev.count - 1 }))
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      const { team, player } = activeVar
      setActiveVar(null)
      
      const isConfirmed = Math.random() < 0.5
      
      if (isConfirmed) {
        setGiantVar({ type: 'confirmed', team, player })
        
        if (team.id === team1.id) setScore1(s => s + 1)
        else setScore2(s => s + 1)
        
        setTimeout(() => {
          setGiantVar(null)
          
          setEvents(prev => [{ 
            minute, 
            message: `✅ ¡VAR CONFIRMA EL GOL! de ${player} (${team.name})`, 
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, 
            color: 'text-emerald-600 font-black',
            teamId: team.id,
            type: 'goal',
            player
          }, ...prev])
        }, 4000)
      } else {
        setGiantVar({ type: 'annulled', team, player })
        setTimeout(() => {
          setGiantVar(null)
          setEvents(prev => [{ 
            minute, 
            message: `❌ ¡GOL ANULADO POR EL VAR! (${team.name})`, 
            icon: <XCircle className="w-5 h-5 text-red-500" />, 
            color: 'text-red-600 font-black',
            teamId: team.id
          }, ...prev])
        }, 3000)
      }
    }
  }, [activeVar, minute])

  // Bucle de tanda de penales
  useEffect(() => {
    if (matchPhase !== 'penalties' || activePenalty !== null || giantGoal || giantMiss) return
    const timer = setTimeout(() => triggerShootoutPenalty(), 1500)
    return () => clearTimeout(timer)
  }, [penHistory1, penHistory2, isTeam1Turn, matchPhase, activePenalty, giantGoal, giantMiss])

  const getRandomPlayer = (team, excludeRole = null, isScoring = false) => {
    let players = team.players || []
    
    const expelled = redCards[team.id] || []
    players = players.filter(p => !expelled.includes(p))

    if (excludeRole === 'gk') {
      const originalGk = team.players[0]
      players = players.filter(p => p !== originalGk)
    }

    if (players.length === 0) return "Jugador"
    
    if (isScoring) {
      let weightedPlayers = []
      players.forEach(p => {
        weightedPlayers.push(p)
        if (p.includes('Delantero') || p.includes('Extremo')) {
          weightedPlayers.push(p, p, p)
        } else if (p.includes('Medio')) {
          weightedPlayers.push(p, p)
        }
      })
      return weightedPlayers[Math.floor(Math.random() * weightedPlayers.length)]
    }

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
    
    let weightedPlayers = []
    untouched.forEach(p => {
      weightedPlayers.push(p)
      if (p.includes('Delantero') || p.includes('Extremo')) {
        weightedPlayers.push(p, p, p)
      } else if (p.includes('Medio')) {
        weightedPlayers.push(p, p)
      }
    })
    
    return weightedPlayers[Math.floor(Math.random() * weightedPlayers.length)]
  }

  const generateRandomEvent = (currentMinute) => {
    const global1 = previousIda1 + score1
    const global2 = previousIda2 + score2
    
    let eventProbability = 0.18
    let overrideScoringTeam = null

    // Emoción de final
    if (currentMinute >= 85) {
      if (global1 === global2) {
        eventProbability = 0.25 // More likely to break the tie at the end
      } else {
        const diff = Math.abs(global1 - global2)
        if (diff >= 3) {
           eventProbability = 0.4
           overrideScoringTeam = global1 < global2 ? team1 : team2
        } else if (diff <= 2) {
           eventProbability = 0.35 // High intensity if it's close
        }
      }
    }

    // Boost goals in Vuelta
    if (leg === 'vuelta') {
      eventProbability *= 1.4 // 40% more events/goals in return leg
    }

    // Si hay rojas, el partido se abre más (más ataques)
    const totalReds = (redCards[team1.id]?.length || 0) + (redCards[team2.id]?.length || 0)
    if (totalReds > 0) {
      eventProbability += (totalReds * 0.05) // +5% por cada roja global
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

    // EMPUJE AL EMPATE: Si falta poco y la diferencia es de solo 1 gol global
    if (currentMinute >= 80 && diff === 1) {
      const losingTeamIs1 = global1 < global2
      if (losingTeamIs1) team1Prob += 0.35 // Fuerte empuje para el empate
      else team1Prob -= 0.35
    }

    team1Prob = Math.max(0.05, Math.min(0.95, team1Prob)) 

    // Apply Realism Bonus
    if (realismEnabled) {
      team1Prob += (t1TotalBonus - t2TotalBonus)
      team1Prob = Math.max(0.1, Math.min(0.9, team1Prob))
    }

    let isTeam1 = Math.random() < team1Prob
    if (overrideScoringTeam) {
       isTeam1 = overrideScoringTeam.id === team1.id
    }

    const team = isTeam1 ? team1 : team2
    const opponentTeam = isTeam1 ? team2 : team1

    const eventTypeRand = overrideScoringTeam ? 0.1 : Math.random() 
    
    let message, icon, color

    // Ajuste de probabilidades de tipo de evento después del minuto 80
    // Aumentamos la probabilidad de PENAL (normalmente es 3%, lo subimos a ~12%)
    let penaltyThreshold = 0.25
    if (currentMinute >= 80) {
      penaltyThreshold = 0.32 // 10% penalty chance now (0.22 + 0.10)
    }
    
    if (eventTypeRand < 0.22) {
      const player = getRandomPlayer(team, 'gk', true)
      const isVarCheck = Math.random() < 0.25 // 25% VAR chance now
      
      // Siempre mostramos el grito de GOL primero para saber qué se celebra
      setGiantGoal({ team, player })
      
      setTimeout(() => {
        setGiantGoal(null)
        
        if (isVarCheck) {
          // Interrupción por VAR
          setGiantVar({ type: 'calling', team, player })
          setTimeout(() => {
            setGiantVar(null)
            setActiveVar({ team, player, count: 15 })
          }, 3000)
        } else {
          // Gol normal sin VAR
          if (isTeam1) setScore1(s => s + 1)
          else setScore2(s => s + 1)
          
          setEvents(prev => [{ 
            minute: currentMinute, 
            message: `⚽ ¡GOL de ${team.name}! Anota ${player}`, 
            icon: team.logoUrl ? <img src={team.logoUrl} className="w-5 h-5 rounded-sm object-cover" /> : <Goal className="w-5 h-5 text-emerald-500" />, 
            color: 'text-emerald-600 font-black text-lg', 
            teamId: team.id, 
            type: 'goal', 
            player 
          }, ...prev])
        }
      }, 2500)
      
      return // Pausamos el bucle mientras duran las animaciones
    
    } else if (eventTypeRand < penaltyThreshold) {
      // PENAL en tiempo regular
      const player = getRandomPlayer(team, 'gk', true)
      setGiantPenalty({ team, player })
      setTimeout(() => {
        setGiantPenalty(null)
        setActivePenalty({ type: 'regular', team, player, count: 10 })
      }, 3000)
      return

    } else if (eventTypeRand < 0.50) {
      const player = getRandomPlayer(team, 'gk')
      message = `⚠️ ${player} (${team.name}) falla una ocasión clara`
      icon = <AlertTriangle className="w-5 h-5 text-slate-400" />
      color = 'text-slate-500 font-bold'
      setEvents(prev => [{ minute: currentMinute, message, icon, color, teamId: team.id }, ...prev])
    } else if (eventTypeRand < 0.70) {
      const player = getRandomPlayer(team, null, true)
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

  const checkShootoutWinner = () => {
    const p1Len = penHistory1.length;
    const p2Len = penHistory2.length;
    const s1 = penHistory1.filter(h => h === 'goal').length;
    const s2 = penHistory2.filter(h => h === 'goal').length;

    if (p1Len <= 5 && p2Len <= 5) {
      if (s1 > s2 + (5 - p2Len)) return team1;
      if (s2 > s1 + (5 - p1Len)) return team2;
      if (p1Len === 5 && p2Len === 5 && s1 !== s2) return s1 > s2 ? team1 : team2;
    } else if (p1Len === p2Len) {
      if (s1 > s2) return team1;
      if (s2 > s1) return team2;
    }
    return null;
  }

  const triggerShootoutPenalty = () => {
    const winner = checkShootoutWinner();
    if (winner) return finishMatch(winner, true);

    const currentTeam = isTeam1Turn ? team1 : team2
    const historyList = isTeam1Turn ? kickers1 : kickers2
    const player = getRandomPenaltyKicker(currentTeam, historyList)

    if (isTeam1Turn) setKickers1(prev => [...prev, player])
    else setKickers2(prev => [...prev, player])

    setActivePenalty({ type: 'shootout', team: currentTeam, player, count: 10 })
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

  const forcePenalties = () => {
    // Igualamos los marcadores para asegurar que se vayan a penales
    // Calculamos cuántos goles le faltan al equipo con menos goles para empatar la serie global
    const global1 = previousIda1 + score1
    const global2 = previousIda2 + score2
    
    if (global1 < global2) {
      setScore1(s => s + (global2 - global1))
    } else if (global2 < global1) {
      setScore2(s => s + (global1 - global2))
    }
    
    setMinute(90)
    setEvents(prev => [{ 
      minute: '90+', 
      message: '⏱️ ¡ADMIN FORZÓ EMPATE Y PENALES!', 
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, 
      color: 'text-amber-600 font-black uppercase tracking-widest',
      teamId: 'sys' 
    }, ...prev])
    setMatchPhase('penalties')
  }

  const handleContinue = () => {
    onComplete(round, index, leg, score1, score2, winner)
  }

  const global1 = previousIda1 + score1
  const global2 = previousIda2 + score2

  const renderPenaltyCircles = (history, isActive) => {
    const isSuddenDeath = history.length > 5 || (history.length === 5 && isActive)
    
    const firstRound = history.slice(0, 5)
    const suddenDeath = history.slice(5)

    const buildCircles = (arr, maxLen, activeInThisLine) => {
      const circles = []
      const total = Math.max(maxLen, arr.length + (activeInThisLine ? 1 : 0))
      for (let i = 0; i < total; i++) {
        if (i < arr.length) {
          const isGoal = arr[i] === 'goal'
          circles.push(
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg transform transition-all scale-110 ${isGoal ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`}>
              {isGoal ? '✓' : '✕'}
            </div>
          )
        } else if (i === arr.length && activeInThisLine) {
          circles.push(
            <div key={i} className={`w-8 h-8 rounded-full border-4 shadow-lg transform transition-all
              ${activePenalty ? 'bg-indigo-500 border-indigo-200 scale-125' : 'bg-indigo-50 border-indigo-500 animate-pulse shadow-indigo-100'}
            `}></div>
          )
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

  const renderTeamBlock = (team, score, penHistory, isTurn, label) => {
    const isLocalLabel = label === 'Local'
    const teamBonus = team.id === team1.id ? t1Bonus : t2Bonus
    const teamUnderdogBonus = team.id === team1.id ? t1UnderdogBonus : t2UnderdogBonus
    const teamLocaliaBonus = team.id === team1.id ? t1LocaliaBonus : t2LocaliaBonus
    
    const reds1 = redCards[team1.id]?.length || 0
    const reds2 = redCards[team2.id]?.length || 0
    const myReds = team.id === team1.id ? reds1 : reds2
    const opponentReds = team.id === team1.id ? reds2 : reds1

    // Empuje Final Logic
    const diff = Math.abs(global1 - global2)
    const isLosingByOne = diff === 1
    const isLastMinutes = minute >= 80
    const amILosing = team.id === team1.id ? global1 < global2 : global2 < global1
    const hasEmpuje = isLastMinutes && isLosingByOne && amILosing
    const isUnderPressure = isLastMinutes && isLosingByOne && !amILosing
    const empujeLabel = minute > 90 ? "Empuje Épico" : "Empuje Final"

    return (
      <div className="flex-1 flex flex-col items-center">
        <div className="mb-3">
          <span className={`text-[7px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full ${isLocalLabel ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-400 border border-slate-200 bg-slate-50'}`}>
            {label}
          </span>
        </div>
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
          {realismEnabled && (
            <div className="flex flex-col items-center mt-2 gap-1">
              <div className="flex flex-wrap justify-center gap-1">
                <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase">
                  Fuerza: +{Math.round(teamBonus * 100)}%
                </span>
                {teamUnderdogBonus > 0 && (
                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                    Impulso: +{Math.round(teamUnderdogBonus * 100)}%
                  </span>
                )}
                {teamLocaliaBonus > 0 && (
                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                    Localía: +1%
                  </span>
                )}
                {myReds > 0 && (
                  <span className="text-[8px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase animate-pulse">
                    Expulsión: -{myReds * 20}%
                  </span>
                )}
                {opponentReds > 0 && (
                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase animate-pulse">
                    Superioridad: +{opponentReds * 20}%
                  </span>
                )}
                {hasEmpuje && (
                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase animate-pulse">
                    {empujeLabel}: +35%
                  </span>
                )}
                {isUnderPressure && (
                  <span className="text-[8px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase animate-pulse">
                    Bajo Presión: -35%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {(matchPhase === 'penalties' || (matchPhase === 'finished' && (penHistory1.length > 0 || penHistory2.length > 0))) && 
          renderPenaltyCircles(penHistory, matchPhase === 'penalties' && isTurn && !checkShootoutWinner())
        }
        
        {renderTeamSummary(team)}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in p-4 max-w-6xl mx-auto w-full relative">
      <button 
        onClick={() => { if(confirm("¿Seguro que deseas cancelar el partido? El progreso se perderá.")) onBack() }}
        className="absolute left-0 top-0 p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        Cancelar Partido
      </button>
      
      {/* Título del Partido */}
      <div className="mb-8 text-center relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-1">Competencia Oficial</p>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center justify-center gap-3">
          {round === 'qf' ? 'Cuartos de Final' : round === 'sf' ? 'Semifinales' : 'Gran Final'}
          <span className="h-4 w-px bg-slate-300"></span>
          <span className="text-blue-600">{leg === 'ida' ? 'Ida' : 'Vuelta'}</span>
        </h2>
        
        {user?.email === 'faunnyer@gmail.com' && matchPhase === 'regular' && (
          <button 
            onClick={forcePenalties}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-amber-500/30 transition-all border border-amber-400 flex items-center gap-2 mx-auto"
          >
            <AlertTriangle className="w-4 h-4" />
            Simular Empate (Penales)
          </button>
        )}
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_center,_#000_0%,_transparent_70%)] mix-blend-multiply rounded-full"></div>

      {giantMiss && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none bg-red-900/60 backdrop-blur-md">
           <h1 
            className="text-8xl font-black italic tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] animate-giantGoal uppercase leading-none text-white"
            style={{ WebkitTextStroke: `3px #000` }}
          >
            ¡LO BOTÓOOO!
          </h1>
          <div className="animate-pop-out mt-8 bg-white px-10 py-4 rounded-[2rem] shadow-2xl border-4 border-red-600 transform scale-110 flex flex-col items-center">
            <p className="text-sm font-black text-red-600 uppercase tracking-[0.3em] mb-1">Erró el penal</p>
            <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{giantMiss.player}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{giantMiss.team.name}</p>
          </div>
        </div>
      )}

      {giantStoppage && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none bg-slate-900/50 backdrop-blur-md">
          <div className="flex flex-col items-center animate-giantGoal">
            <div className="bg-amber-400 text-slate-900 px-8 py-2 rounded-t-2xl font-black uppercase tracking-[0.4em] text-xs shadow-xl">
              Tiempo Extra
            </div>
            <div className="bg-white px-12 py-8 rounded-b-[2.5rem] rounded-tr-[2.5rem] shadow-2xl flex flex-col items-center border-b-8 border-amber-500">
               <h1 className="text-9xl font-black italic tracking-tighter text-slate-900 leading-none">
                 +{giantStoppage}
               </h1>
               <p className="text-xl font-black uppercase tracking-widest text-amber-600 mt-2 italic">Minutos de Adición</p>
            </div>
          </div>
        </div>
      )}

      {giantGoal && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-6 animate-giantGoal">
            <h1 
              className="text-9xl font-black italic tracking-tighter drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)] uppercase leading-none text-white"
              style={{ WebkitTextStroke: `3px #000` }}
            >
              ¡GOOOOOL!
            </h1>
            <div className="w-28 h-28 rounded-full bg-white p-2 shadow-2xl border-4 border-white animate-pop-out overflow-hidden">
               {giantGoal.team.logoUrl ? (
                 <img src={giantGoal.team.logoUrl} alt="" className="w-full h-full object-cover" />
               ) : (
                 <Shield className="w-full h-full text-slate-200" />
               )}
            </div>
          </div>
          
          <div className="animate-pop-out mt-12 bg-white px-10 py-4 rounded-[2rem] shadow-2xl border-4 border-indigo-600 transform scale-110 flex flex-col items-center">
            <p className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Anotador</p>
            <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{giantGoal.player}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{giantGoal.team.name}</p>
            </div>
          </div>
        </div>
      )}

      {giantPenalty && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none bg-red-900/40 backdrop-blur-md">
          <div className="flex flex-col items-center animate-giantGoal">
            <h1 
              className="text-9xl font-black italic tracking-tighter drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)] uppercase leading-none text-white mb-8"
              style={{ WebkitTextStroke: `3px #000` }}
            >
              ¡PENAL!
            </h1>
            <div className="bg-white px-10 py-4 rounded-[2rem] shadow-2xl border-4 border-red-600 transform scale-110 flex flex-col items-center">
              <p className="text-sm font-black text-red-600 uppercase tracking-[0.3em] mb-1">Falta para</p>
              <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{giantPenalty.team.name}</p>
            </div>
          </div>
        </div>
      )}

      {giantVar && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none bg-slate-900/60 backdrop-blur-md">
          <div className="flex flex-col items-center animate-giantGoal">
            <div className="flex items-center gap-6 mb-8">
              <h1 
                className={`text-8xl font-black italic tracking-tighter drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)] uppercase leading-none text-white`}
                style={{ WebkitTextStroke: `3px #000` }}
              >
                {giantVar.type === 'calling' ? 'LLAMADO VAR' : giantVar.type === 'confirmed' ? 'GOL CONFIRMADO ¡GOOOOOL!' : 'GOL ANULADO'}
              </h1>
              {giantVar.type === 'calling' && (
                <div className="w-64 h-64 bg-white p-2 rounded-3xl shadow-2xl animate-pop-out overflow-hidden border-4 border-blue-600">
                   <img src={callingVarImg} alt="VAR" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            
            <div className={`bg-white px-10 py-4 rounded-[2rem] shadow-2xl border-4 transform scale-110 flex flex-col items-center
              ${giantVar.type === 'annulled' ? 'border-red-600' : 'border-blue-600'}
            `}>
              <p className={`text-sm font-black uppercase tracking-[0.3em] mb-1 ${giantVar.type === 'annulled' ? 'text-red-600' : 'text-blue-600'}`}>
                {giantVar.type === 'annulled' ? 'No hay Gol para' : 'Decisión para'}
              </p>
              <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{giantVar.team.name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 w-full max-w-[1400px] items-stretch animate-fade-in p-2 md:p-0">
        <div className="flex-1 glass-panel rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 relative border border-white/60 shadow-xl bg-gradient-to-br from-white to-slate-50 flex flex-col justify-center min-h-[450px] md:min-h-[500px]">
          {/* Mobile-optimized Header Badges */}
          <div className="flex md:block justify-between items-start w-full md:w-auto mb-10 md:mb-0">
            <div className="md:absolute top-6 left-8 flex flex-col gap-0.5">
               <div className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-yellow-400 rounded-full"></div>
                  Árbitro
               </div>
               <div className="text-xs md:text-sm font-black text-slate-800 italic uppercase tracking-tighter">{referee}</div>
            </div>

            <div className="md:absolute top-6 right-8 flex flex-col items-end gap-0.5">
               <div className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{getRoundName()}</div>
               <div className="text-[10px] md:text-xs font-black text-blue-600 italic uppercase tracking-tighter">{leg?.toUpperCase()}</div>
            </div>
          </div>

          <div className="absolute top-16 md:top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
            <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-slate-100 shadow-sm">
              <Timer className={`w-4 h-4 ${(matchPhase === 'regular' && !giantGoal && !activePenalty) ? 'text-indigo-600 animate-spin-slow' : 'text-slate-400'}`} />
              <span className="text-xl font-mono font-black text-slate-900 tracking-tighter">
                {matchPhase === 'regular' ? (minute > 90 ? `90+${minute - 90}'` : `${minute}'`) : matchPhase === 'penalties' ? 'P' : 'F'}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-8 mt-12 md:mt-8 w-full relative z-0">
            {/* Left Team: Always Local */}
            {renderTeamBlock(isT1Local ? team1 : team2, isT1Local ? score1 : score2, isT1Local ? penHistory1 : penHistory2, isT1Local ? isTeam1Turn : !isTeam1Turn, 'Local')}
            
            {/* Score Center */}
            <div className="flex flex-col items-center gap-4 px-2 md:px-6 md:mt-16 w-full md:w-[320px] flex-shrink-0 relative">
              <div className="flex items-center gap-4 md:gap-6">
                <span className="text-5xl md:text-7xl font-black font-mono tracking-tighter text-slate-900 leading-none">{isT1Local ? score1 : score2}</span>
                <span className="text-2xl md:text-4xl text-slate-200 font-black mb-2 md:mb-4">-</span>
                <span className="text-5xl md:text-7xl font-black font-mono tracking-tighter text-slate-900 leading-none">{isT1Local ? score2 : score1}</span>
              </div>
              
              {leg === 'vuelta' && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  <div className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black shadow-xl border border-slate-700 text-lg tracking-tighter">
                    GLOBAL: <span className="text-yellow-400">{isT1Local ? global1 : global2}</span> - <span className="text-yellow-400">{isT1Local ? global2 : global1}</span>
                  </div>
                  {(matchPhase === 'penalties' || (matchPhase === 'finished' && (penHistory1.length > 0 || penHistory2.length > 0))) && (
                    <div className="bg-white text-slate-900 px-6 py-1 rounded-full font-black shadow-sm border border-slate-200 text-sm tracking-tighter flex items-center gap-2">
                      PENALES: <span className="text-blue-600">{isT1Local ? penHistory1.filter(h=>h==='goal').length : penHistory2.filter(h=>h==='goal').length}</span> - <span className="text-red-600">{isT1Local ? penHistory2.filter(h=>h==='goal').length : penHistory1.filter(h=>h==='goal').length}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="min-h-[180px] md:min-h-[220px] w-full flex flex-col items-center justify-start">
                {activePenalty && (
                  <div className="mt-4 animate-bounce-in flex flex-col items-center">
                    <img src={penalImg} alt="Penal" className="w-24 md:w-32 h-auto rounded-xl shadow-lg border-2 border-white" />
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-2 animate-pulse">Definiendo el destino...</p>
                    <div className="mt-1 text-2xl font-black text-slate-900">{activePenalty.count}</div>
                  </div>
                )}

                {activeVar && (
                  <div className="mt-6 animate-bounce-in flex flex-col items-center">
                    <img src={varImg} alt="VAR" className="w-48 md:w-56 h-auto rounded-3xl shadow-2xl border-4 border-white" />
                    <p className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mt-4 animate-pulse text-center leading-relaxed">REVISIÓN GOL<br/>{activeVar.team.name}</p>
                    <div className="mt-2 text-3xl font-black text-slate-900 bg-slate-100 px-6 py-1 rounded-full">{activeVar.count}s</div>
                  </div>
                )}

                {matchPhase === 'finished' && winner && (
                  <div className="mt-4 animate-bounce-in flex flex-col items-center">
                    <div className="bg-emerald-500 text-white px-8 py-2 rounded-2xl font-black uppercase tracking-[0.4em] text-xs shadow-xl shadow-emerald-200 border-2 border-emerald-400">
                      GANADOR
                    </div>
                    <div className="bg-white px-8 py-3 rounded-b-3xl shadow-2xl border-x-2 border-b-2 border-emerald-500 flex items-center gap-3">
                       {winner.logoUrl && <img src={winner.logoUrl} className="w-8 h-8 rounded-lg object-cover" />}
                       <span className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{winner.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Team: Always Visitor */}
            {renderTeamBlock(isT1Local ? team2 : team1, isT1Local ? score2 : score1, isT1Local ? penHistory2 : penHistory1, isT1Local ? !isTeam1Turn : isTeam1Turn, 'Visitante')}
          </div>
        </div>

        {/* Events Feed (Right Side) */}
        <div className="xl:w-[450px] w-full bg-white rounded-[2rem] md:rounded-[2.5rem] flex flex-col overflow-hidden border border-white shadow-xl relative h-[400px] md:h-[450px] flex-shrink-0">
          <div className="bg-slate-50/80 backdrop-blur-md p-4 border-b border-slate-100 flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-black text-[10px] text-slate-400 uppercase tracking-[0.3em]">Transmisión en Vivo</span>
            </div>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Live Feed</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
            {events.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-30">
                 <div className="w-12 h-1 bg-slate-200 rounded-full mb-4 animate-pulse"></div>
                 <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Esperando inicio...</p>
              </div>
            )}
            {events.map((ev, i) => {
              const isLatest = i === 0;
              // Calculamos opacidad progresiva: 1 para i=0, 0.8 para i=1, 0.6 para i=2, etc. Mínimo 0.2
              const opacity = isLatest ? 1 : Math.max(0.2, 1 - (i * 0.2));
              const scale = isLatest ? 1.02 : Math.max(0.9, 1 - (i * 0.02));
              const grayscale = isLatest ? 0 : Math.min(1, i * 0.25);
              
              return (
                <div 
                  key={i} 
                  className={`flex items-center gap-4 p-3 rounded-2xl transition-all duration-700 group border
                    ${isLatest 
                      ? 'bg-white border-blue-200 shadow-xl shadow-blue-100/50 ring-4 ring-blue-50 z-10 animate-bounce-in' 
                      : 'bg-slate-50/50 border-slate-100'}`}
                  style={{ 
                    opacity: opacity,
                    transform: `scale(${scale})`,
                    filter: `grayscale(${grayscale})`
                  }}
                >
                  <div className={`font-mono font-black text-xs w-12 h-8 flex items-center justify-center rounded-xl shadow-sm border transition-colors
                    ${isLatest 
                      ? 'text-blue-600 bg-white border-blue-100' 
                      : 'text-slate-400 bg-slate-50 border-slate-200'}`}>
                    {ev.minute}'
                  </div>
                  <div className={`w-8 flex justify-center transform transition-transform ${isLatest ? 'scale-125 drop-shadow-md' : 'scale-100'}`}>
                    {ev.icon}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className={`text-xs font-bold tracking-tight leading-snug ${isLatest ? ev.color : 'text-slate-600'}`}>
                      {ev.message}
                    </span>
                    {ev.player && (
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isLatest ? 'text-slate-500' : 'text-slate-400'}`}>
                        {ev.player}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
        </div>
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
