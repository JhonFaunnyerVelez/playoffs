import { useState, useEffect } from 'react'
import { Dices, Play, Shield, ArrowRight, CheckCircle2, Trophy, ChevronRight } from 'lucide-react'

export default function DrawSimulator({ teams, seededPositions, onComplete }) {
  const [positions, setPositions] = useState([...seededPositions])
  const [unseededTeams, setUnseededTeams] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDraw, setCurrentDraw] = useState(null)
  
  // Define the order of draw spots: M1 (0,1), M2 (2,3), M3 (4,5), M4 (6,7)
  const drawOrder = [0, 1, 2, 3, 4, 5, 6, 7]
  const [nextDrawIndex, setNextDrawIndex] = useState(0)

  useEffect(() => {
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
    
    // Step 1: Picking Animation
    setCurrentDraw({ team: drawnTeam, spot: spotIndex, state: 'picking', opponent: null })
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 2: Reveal & Suspense
    setCurrentDraw({ team: drawnTeam, spot: spotIndex, state: 'revealed', opponent })
    await new Promise(resolve => setTimeout(resolve, opponent ? 3000 : 2000))
    
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
    <div className="flex flex-col gap-6 h-full animate-fade-in pt-2 pb-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-1 rounded-full border border-blue-100 mb-1">
          <Dices className="w-4 h-4 text-blue-600" />
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sorteo de Cuadrangulares</span>
        </div>
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-blue-600 to-red-500 tracking-tighter uppercase drop-shadow-sm">Sorteo Oficial</h2>
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
                  className={`w-14 h-14 rounded-xl bg-white shadow-lg border-2 border-slate-200 flex flex-col items-center justify-center transition-all duration-500 transform overflow-hidden relative
                    ${isDrawing ? 'animate-jiggle blur-[1px] scale-90 opacity-40' : 'hover:scale-110'}`}
                  style={{ 
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.4 + Math.random() * 0.2}s`
                  }}
                >
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Shield className="w-4 h-4 text-slate-300 mb-0.5" />
                  )}
                  {!team.logoUrl && (
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 text-center leading-tight">
                      {team.short || team.name.substring(0,3)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {/* The Revealed Ball & Suspense */}
            {currentDraw && currentDraw.state === 'revealed' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/40 backdrop-blur-md animate-fade-in rounded-3xl">
                <div className="flex flex-col items-center justify-center w-full p-4 animate-pop-out">
                  {currentDraw.opponent ? (
                    <div className="flex flex-col items-center w-full bg-white p-6 rounded-2xl shadow-xl border border-white relative overflow-hidden">
                       <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-blue-500 to-red-500"></div>
                       <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">¡Nuevo Enfrentamiento!</span>
                       
                       <div className="flex items-center justify-between w-full gap-4">
                          {/* Opponent */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                             <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-md border border-slate-200 overflow-hidden">
                                {currentDraw.opponent.logoUrl ? (
                                  <img src={currentDraw.opponent.logoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Shield className="w-6 h-6 text-slate-300" />
                                )}
                             </div>
                             <span className="font-black text-slate-800 text-[10px] truncate uppercase tracking-tight text-center">{currentDraw.opponent.name}</span>
                          </div>

                          <div className="text-xl font-black text-slate-200 italic tracking-tighter">VS</div>

                          {/* Drawn Team */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                             <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-xl border-2 border-slate-200 transform scale-110 overflow-hidden">
                                {currentDraw.team.logoUrl ? (
                                  <img src={currentDraw.team.logoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Shield className="w-7 h-7 text-slate-300" />
                                )}
                             </div>
                             <span className="font-black text-slate-900 text-xs truncate uppercase tracking-tighter text-center">{currentDraw.team.name}</span>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center w-full bg-white p-6 rounded-2xl shadow-xl border border-white">
                      <div 
                        className="w-24 h-24 rounded-2xl bg-white shadow-xl border-2 border-slate-200 flex flex-col items-center justify-center mb-4 animate-bounce-in overflow-hidden"
                      >
                        {currentDraw.team.logoUrl ? (
                          <img src={currentDraw.team.logoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Shield className="w-10 h-10 text-slate-300 mb-1" />
                            <span className="text-slate-400 font-black text-[9px] tracking-widest">{currentDraw.team.short || currentDraw.team.name.substring(0,3)}</span>
                          </>
                        )}
                      </div>
                      <div className="font-black text-slate-900 text-xl text-center mb-3 uppercase tracking-tighter">
                        {currentDraw.team.name}
                      </div>
                      <div className="text-[9px] font-black text-blue-500 animate-pulse bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
                        Buscando Rival...
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
            <button
              onClick={drawNext}
              disabled={isDrawing}
              className={`group relative py-4 px-12 font-black text-base rounded-2xl transition-all flex items-center gap-3 shadow-lg w-full max-w-xs justify-center overflow-hidden
                ${isDrawing 
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 text-white hover:shadow-blue-500/30 hover:-translate-y-1'
                }`}
            >
              {!isDrawing && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
              <span className="relative flex items-center gap-2 uppercase tracking-widest text-sm drop-shadow-sm">
                {isDrawing ? 'Mezclando...' : 'Sortear'}
                {!isDrawing && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onComplete(positions)}
              className="py-4 px-12 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black text-base rounded-2xl transition-all transform hover:-translate-y-1 shadow-lg shadow-green-500/20 flex items-center gap-2 uppercase tracking-widest"
            >
              Continuar
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Right Side: Visual Bracket */}
        <div className="xl:w-3/5 glass-panel p-6 rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 w-full max-w-4xl">
          <div className="flex justify-between items-stretch w-full relative h-[400px]">
            
            {/* Left Column (Matches 1 & 2) */}
            <div className="flex flex-col justify-between gap-8 relative z-10 py-4">
              {/* Match 1 */}
              <div className="flex flex-col gap-2 relative">
                <div className="absolute -right-8 top-1/2 w-8 h-[3px] bg-slate-300"></div>
                <div className="absolute -right-8 top-1/2 w-[3px] h-[calc(100%+2rem)] bg-slate-300"></div>
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Duelo 1</div>
                {renderSlot(0)}
                {renderSlot(1)}
              </div>
              {/* Match 2 */}
              <div className="flex flex-col gap-2 relative">
                <div className="absolute -right-8 top-1/2 w-8 h-[3px] bg-slate-300"></div>
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Duelo 2</div>
                {renderSlot(2)}
                {renderSlot(3)}
              </div>
            </div>

            {/* Center Trophy Area */}
            <div className="flex flex-col justify-center items-center px-6 relative z-0">
               <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-100 flex flex-col items-center justify-center opacity-30">
                 <Trophy className="w-8 h-8 text-slate-300" />
               </div>
               <div className="mt-4 text-[8px] font-black text-slate-200 uppercase tracking-[0.2em]">Final</div>
            </div>

            {/* Right Column (Matches 3 & 4) */}
            <div className="flex flex-col justify-between gap-8 relative z-10 py-4">
              {/* Match 3 */}
              <div className="flex flex-col gap-2 relative">
                <div className="absolute -left-8 top-1/2 w-8 h-[3px] bg-slate-300"></div>
                <div className="absolute -left-8 top-1/2 w-[3px] h-[calc(100%+2rem)] bg-slate-300"></div>
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 text-right">Duelo 3</div>
                {renderSlot(4, true)}
                {renderSlot(5, true)}
              </div>
              {/* Match 4 */}
              <div className="flex flex-col gap-2 relative">
                <div className="absolute -left-8 top-1/2 w-8 h-[3px] bg-slate-300"></div>
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 text-right">Duelo 4</div>
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
