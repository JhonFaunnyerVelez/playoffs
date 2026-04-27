import { useState, useEffect } from 'react'
import { Dices, Play, Shield, ArrowRight, CheckCircle2, Trophy, ChevronRight, ArrowLeft } from 'lucide-react'

export default function DrawSimulator({ teams, seededPositions, onComplete, onBack }) {
  const [positions, setPositions] = useState([...seededPositions])
  const [unseededTeams, setUnseededTeams] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDraw, setCurrentDraw] = useState(null)
  
  // Define the order of draw spots: M1 (0,1), M2 (2,3), M3 (4,5), M4 (6,7)
  const drawOrder = [0, 1, 2, 3, 4, 5, 6, 7]
  const [nextDrawIndex, setNextDrawIndex] = useState(0)

  useEffect(() => {
    setPositions([...seededPositions])
    const seededIds = seededPositions.filter(p => p !== null).map(p => p.id)
    setUnseededTeams(teams.filter(t => !seededIds.includes(t.id)))
    
    // Find first empty spot in drawOrder
    let firstEmpty = 0
    while (firstEmpty < drawOrder.length && seededPositions[drawOrder[firstEmpty]] !== null) {
      firstEmpty++
    }
    setNextDrawIndex(firstEmpty)
  }, [teams, seededPositions])

  const getOpponent = (spotIndex, currentPosArray) => {
    const oppIndex = spotIndex % 2 === 0 ? spotIndex + 1 : spotIndex - 1;
    return currentPosArray[oppIndex];
  }

  const drawNext = async () => {
    if (nextDrawIndex >= drawOrder.length || unseededTeams.length === 0 || isDrawing) return;
    
    setIsDrawing(true)
    let currentPositions = [...positions]
    let remainingTeams = [...unseededTeams]
    
    // The spot is fixed by order
    const spotIndex = drawOrder[nextDrawIndex]
    
    // Pick a random team from those left
    const randomTeamIndex = Math.floor(Math.random() * remainingTeams.length)
    const drawnTeam = remainingTeams[randomTeamIndex]
    
    const opponent = getOpponent(spotIndex, currentPositions)
    
    // Step 1: Suspense / Picking Animation
    setCurrentDraw({ team: drawnTeam, spot: spotIndex, state: 'picking', opponent: null })
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Step 2: Reveal & Suspense
    setCurrentDraw({ team: drawnTeam, spot: spotIndex, state: 'revealed', opponent })
    await new Promise(resolve => setTimeout(resolve, opponent ? 1500 : 1000))
    
    // Step 3: Slot into bracket
    currentPositions[spotIndex] = drawnTeam
    setPositions([...currentPositions])
    
    const updatedUnseeded = remainingTeams.filter(t => t.id !== drawnTeam.id)
    setUnseededTeams(updatedUnseeded)
    setCurrentDraw(null)
    setIsDrawing(false)
    
    // Advance nextDrawIndex to next empty spot
    let nextEmpty = nextDrawIndex + 1
    while (nextEmpty < drawOrder.length && currentPositions[drawOrder[nextEmpty]] !== null) {
      nextEmpty++
    }
    setNextDrawIndex(nextEmpty)

    if (updatedUnseeded.length === 0) {
      // Small delay before finishing
    }
  }
  
  const drawAll = () => {
    if (unseededTeams.length === 0 || isDrawing) return;
    
    let currentPositions = [...positions]
    let remainingTeams = [...unseededTeams]
    
    // Pick empty spots from drawOrder in order
    const emptySpots = []
    let tempIndex = nextDrawIndex
    while (tempIndex < drawOrder.length) {
      const spotIndex = drawOrder[tempIndex]
      if (currentPositions[spotIndex] === null) {
        emptySpots.push(spotIndex)
      }
      tempIndex++
    }

    // Shuffle remaining teams
    const shuffled = [...remainingTeams].sort(() => Math.random() - 0.5)
    
    // Fill the spots
    shuffled.forEach((team, i) => {
      if (i < emptySpots.length) {
        currentPositions[emptySpots[i]] = team
      }
    })
    
    setPositions(currentPositions)
    setUnseededTeams([])
    setNextDrawIndex(drawOrder.length)
    onComplete(currentPositions)
  }

  const resetDraw = () => {
    setPositions([...seededPositions])
    const seededIds = seededPositions.filter(p => p !== null).map(p => p.id)
    setUnseededTeams(teams.filter(t => !seededIds.includes(t.id)))
    
    // Find first empty spot in drawOrder
    let firstEmpty = 0
    while (firstEmpty < drawOrder.length && seededPositions[drawOrder[firstEmpty]] !== null) {
      firstEmpty++
    }
    setNextDrawIndex(firstEmpty)
    setCurrentDraw(null)
    setIsDrawing(false)
  }

  const renderSlot = (index, alignRight = false) => {
    const team = positions[index]
    const isJustDrawn = currentDraw && currentDraw.spot === index && currentDraw.state === 'revealed'
    const isTarget = nextDrawIndex < drawOrder.length && drawOrder[nextDrawIndex] === index
    
    return (
      <div 
        className={`h-14 w-52 rounded-[1.25rem] flex items-center px-4 transition-all duration-500 border-2 relative z-10 shadow-sm
          ${team 
            ? 'border-yellow-200 bg-white' 
            : isJustDrawn 
              ? 'border-blue-500 bg-blue-50 ring-8 ring-blue-50 animate-pulse' 
              : isTarget && !isDrawing
                ? 'border-yellow-400 border-dashed bg-yellow-50/30'
                : 'border-slate-100 bg-slate-50/50'}
          ${alignRight ? 'flex-row-reverse text-right' : ''}
        `}
      >
        {team ? (
          <div className={`flex items-center gap-3 w-full animate-fade-in ${alignRight ? 'justify-end' : 'justify-start'}`}>
            <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
               {team.logoUrl ? (
                 <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
               ) : (
                 <Shield className="w-3.5 h-3.5 text-slate-300" />
               )}
            </div>
            <span className="font-black text-sm text-slate-800 truncate tracking-tight">{team.name}</span>
          </div>
        ) : (
          <span className={`text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] w-full ${alignRight ? 'text-right' : 'text-left'}`}>
            {isJustDrawn ? 'Sorteando...' : isTarget ? 'Siguiente' : '???'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full animate-fade-in pt-2 pb-8 relative">
      <button 
        onClick={onBack}
        className="absolute left-0 top-0 p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-1 rounded-full border border-blue-100 mb-1">
          <Dices className="w-4 h-4 text-blue-600" />
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sorteo de Cuadrangulares</span>
        </div>
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-blue-600 to-red-500 tracking-tighter uppercase italic drop-shadow-sm">Sorteo Oficial</h2>
        <p className="text-slate-500 text-sm font-medium">Controla el sorteo balota por balota para definir las llaves.</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-8 items-center xl:items-start justify-center mt-4">
        
        {/* Left Side: Bombo */}
        <div className="xl:w-2/5 flex flex-col items-center gap-6 w-full">
          
          <div className="glass-panel p-6 rounded-3xl w-full max-w-sm aspect-square border-2 border-white/80 shadow-2xl shadow-blue-200/60 bg-gradient-to-br from-white to-yellow-50/30 relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent opacity-50"></div>
            
            {/* The Balls inside the bowl */}
            <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-3 p-8 opacity-90">
              {unseededTeams.map((team, i) => (
                <div 
                  key={team.id}
                  className={`w-14 h-14 rounded-full bg-white shadow-lg border-2 border-slate-200 flex items-center justify-center transition-all duration-500 transform overflow-hidden relative
                    ${isDrawing ? 'animate-jiggle blur-[1px] scale-90 opacity-40' : 'hover:scale-110'}`}
                  style={{ 
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.4 + Math.random() * 0.2}s`
                  }}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center">
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Shield className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* The Revealed Ball & Suspense */}
            {currentDraw && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/60 backdrop-blur-md animate-fade-in rounded-3xl">
                <div className="flex flex-col items-center justify-center w-full p-4 animate-pop-out">
                  
                  {currentDraw.opponent ? (
                    /* Duelo Completo (Ya hay un oponente esperando) */
                    <div className="flex flex-col items-center w-full bg-white p-6 rounded-2xl shadow-xl border border-white relative overflow-hidden">
                       <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-blue-500 to-red-500"></div>
                       <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">
                         {currentDraw.state === 'picking' ? 'Definiendo Rival...' : '¡Nuevo Enfrentamiento!'}
                       </span>
                       
                       <div className="flex items-center justify-between w-full gap-4">
                          {/* Oponente Existente */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                             <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md border border-slate-200 overflow-hidden">
                                {currentDraw.opponent.logoUrl ? (
                                  <img src={currentDraw.opponent.logoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Shield className="w-6 h-6 text-slate-300" />
                                )}
                             </div>
                             <span className="font-black text-slate-800 text-[10px] truncate uppercase tracking-tight text-center">{currentDraw.opponent.name}</span>
                          </div>

                          <div className="text-xl font-black text-slate-200 italic tracking-tighter">VS</div>

                          {/* Equipo que se está sorteando */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                             <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl border-4 transform scale-110 overflow-hidden transition-all duration-500
                               ${currentDraw.state === 'picking' ? 'border-blue-400 animate-spin-slow' : 'border-slate-200 animate-pop-out'}
                             `}>
                                {currentDraw.state === 'picking' ? (
                                  <Shield className="w-7 h-7 text-blue-100" />
                                ) : currentDraw.team.logoUrl ? (
                                  <img src={currentDraw.team.logoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Shield className="w-7 h-7 text-slate-300" />
                                )}
                             </div>
                             <span className={`font-black text-xs truncate uppercase tracking-tighter text-center transition-all
                               ${currentDraw.state === 'picking' ? 'text-blue-400 animate-pulse' : 'text-slate-900'}
                             `}>
                               {currentDraw.state === 'picking' ? '???' : currentDraw.team.name}
                             </span>
                          </div>
                       </div>
                    </div>
                  ) : (
                    /* Sorteo de cabeza de serie o slot vacío */
                    <div className="flex flex-col items-center w-full bg-white p-6 rounded-2xl shadow-xl border border-white">
                      <div className={`w-24 h-24 rounded-full bg-white shadow-2xl border-4 flex items-center justify-center mb-4 overflow-hidden relative transition-all duration-500
                        ${currentDraw.state === 'picking' ? 'border-blue-400 animate-spin-slow' : 'border-slate-100 animate-bounce-in'}
                      `}>
                         <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 to-white"></div>
                         <div className="w-16 h-16 relative z-10 flex items-center justify-center">
                          {currentDraw.state === 'picking' ? (
                            <Shield className="w-10 h-10 text-blue-100" />
                          ) : currentDraw.team.logoUrl ? (
                            <img src={currentDraw.team.logoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <Shield className="w-10 h-10 text-slate-200" />
                          )}
                         </div>
                      </div>
                      <div className={`font-black text-xl text-center mb-3 uppercase tracking-tighter transition-all
                        ${currentDraw.state === 'picking' ? 'text-blue-400 animate-pulse' : 'text-slate-900'}
                      `}>
                        {currentDraw.state === 'picking' ? 'Sorteando...' : currentDraw.team.name}
                      </div>
                      <div className="text-[9px] font-black text-blue-500 animate-pulse bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
                        {currentDraw.state === 'picking' ? 'Buscando equipo...' : 'Buscando Rival...'}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {unseededTeams.length === 0 && !currentDraw && (
              <div className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in bg-white/90 backdrop-blur-md rounded-3xl">
                 <div className="flex flex-col items-center gap-3">
                   <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center shadow-inner border border-green-100">
                     <CheckCircle2 className="w-8 h-8" />
                   </div>
                   <div className="text-xl font-black text-slate-900 text-center uppercase tracking-tighter">
                      Sorteo<br/><span className="text-green-500 text-base">Completado</span>
                   </div>
                 </div>
              </div>
            )}
          </div>

          {unseededTeams.length > 0 ? (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={drawNext}
                disabled={isDrawing}
                className={`group relative py-4 px-6 font-black text-base rounded-2xl transition-all flex items-center gap-3 shadow-lg w-full justify-center overflow-hidden
                  ${isDrawing 
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 text-white hover:shadow-blue-500/30 hover:-translate-y-1'
                  }`}
              >
                {!isDrawing && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                <span className="relative flex items-center gap-2 uppercase tracking-widest text-xs drop-shadow-sm">
                  {isDrawing ? 'Mezclando...' : 'Sorteo uno por uno'}
                  {!isDrawing && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={drawAll}
                  disabled={isDrawing}
                  className={`py-3 px-6 font-black text-[10px] rounded-xl transition-all border-2 uppercase tracking-[0.2em] w-full
                    ${isDrawing 
                      ? 'border-slate-100 text-slate-200 cursor-not-allowed' 
                      : 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white shadow-md shadow-blue-100'
                    }`}
                >
                  Sortear todos
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button
                onClick={() => onComplete(positions)}
                className="py-4 px-12 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black text-base rounded-2xl transition-all transform hover:-translate-y-1 shadow-lg shadow-green-500/20 flex items-center gap-2 uppercase tracking-widest justify-center"
              >
                Continuar
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={resetDraw}
                className="py-3 px-12 bg-white border-2 border-blue-600 text-blue-600 font-black text-[10px] rounded-2xl transition-all hover:bg-blue-600 hover:text-white uppercase tracking-widest shadow-sm"
              >
                Sortear nuevamente
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Visual Bracket */}
        <div className="xl:w-3/5 bg-slate-100/40 p-8 rounded-[3rem] border border-white/60 backdrop-blur-xl shadow-2xl w-full max-w-5xl relative overflow-hidden">
          {/* Background decoration for the bracket */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5 pointer-events-none">
             <Trophy className="w-full h-full text-slate-900" />
          </div>

          <div className="flex justify-between items-stretch w-full relative h-[500px] z-10">
            
            {/* Left Column (Matches 1 & 2) */}
            <div className="flex flex-col justify-around relative z-10 py-4 h-full">
              {/* Match 1 */}
              <div className="flex flex-col gap-3 relative">
                <div className="absolute -right-12 top-[64px] w-12 h-[2px] bg-slate-300"></div>
                <div className="absolute -right-12 top-[64px] w-[2px] h-[calc(50%+60px)] bg-slate-300"></div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter italic mb-1 flex items-center gap-2">
                   <div className="w-4 h-1 bg-blue-600 rounded-full"></div>
                   Duelo 1
                </div>
                {renderSlot(0)}
                {renderSlot(1)}
              </div>
              {/* Match 2 */}
              <div className="flex flex-col gap-3 relative">
                <div className="absolute -right-12 top-[64px] w-12 h-[2px] bg-slate-300"></div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter italic mb-1 flex items-center gap-2">
                   <div className="w-4 h-1 bg-yellow-500 rounded-full"></div>
                   Duelo 2
                </div>
                {renderSlot(2)}
                {renderSlot(3)}
              </div>
            </div>

            {/* Center Trophy Area */}
            <div className="flex flex-col justify-center items-center px-4 relative z-0">
               <div className="relative">
                 <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full animate-pulse"></div>
                 <div className="w-24 h-24 rounded-[2rem] bg-white border-2 border-yellow-200 flex flex-col items-center justify-center shadow-2xl relative z-10">
                   <Trophy className="w-10 h-10 text-yellow-500 drop-shadow-md" />
                 </div>
               </div>
               <div className="mt-4 text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] italic">Gran Final</div>
               <div className="mt-1 w-12 h-1.5 bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 rounded-full"></div>
            </div>

            {/* Right Column (Matches 3 & 4) */}
            <div className="flex flex-col justify-around relative z-10 py-4 h-full">
              {/* Match 3 */}
              <div className="flex flex-col gap-3 relative">
                <div className="absolute -left-12 top-[64px] w-12 h-[2px] bg-slate-300"></div>
                <div className="absolute -left-12 top-[64px] w-[2px] h-[calc(50%+60px)] bg-slate-300"></div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter italic mb-1 flex items-center justify-end gap-2 text-right">
                   Duelo 3
                   <div className="w-4 h-1 bg-blue-600 rounded-full"></div>
                </div>
                {renderSlot(4, true)}
                {renderSlot(5, true)}
              </div>
              {/* Match 4 */}
              <div className="flex flex-col gap-3 relative">
                <div className="absolute -left-12 top-[64px] w-12 h-[2px] bg-slate-300"></div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter italic mb-1 flex items-center justify-end gap-2 text-right">
                   Duelo 4
                   <div className="w-4 h-1 bg-yellow-500 rounded-full"></div>
                </div>
                {renderSlot(6, true)}
                {renderSlot(7, true)}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
