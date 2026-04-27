import { Trophy, Play, Shield, Save, ArrowLeft } from 'lucide-react'

export default function Bracket({ bracketState, onSimulateMatch, onResetTournament, onBack }) {
  
  const renderMatch = (match, round, index) => {
    const isReady = match.team1 && match.team2
    const idaPlayed = match.ida1 !== null
    const vueltaPlayed = match.vuelta1 !== null
    const isComplete = match.winner !== null

    let global1 = null
    let global2 = null
    if (idaPlayed) {
      global1 = match.ida1 + (vueltaPlayed ? match.vuelta1 : 0)
      global2 = match.ida2 + (vueltaPlayed ? match.vuelta2 : 0)
    }

    return (
      <div className={`relative flex flex-col w-52 bg-white rounded-xl border overflow-hidden transition-all duration-300 shadow-sm
        ${isReady && !isComplete ? 'border-primary hover:border-primary shadow-md shadow-primary/20 scale-105 z-10' : 'border-gray-200'}
        ${isComplete ? 'border-gray-200 bg-slate-50 opacity-90' : ''}
      `}>
        {/* Teams Area */}
        <div className="flex flex-col">
          {/* Team 1 */}
          <div className={`flex justify-between items-center p-2 border-b border-gray-100 
            ${isComplete && match.winner?.id === match.team1?.id ? 'bg-green-50' : ''}
          `}>
            <div className="flex items-center gap-2 overflow-hidden">
              {match.team1 ? (
                <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-slate-200">
                   {match.team1.logoUrl ? <img src={match.team1.logoUrl} alt="" className="w-full h-full object-cover" /> : <Shield className="w-3 h-3 text-slate-300" />}
                </div>
              ) : <div className="w-5 h-5 rounded-full bg-gray-200"></div>}
              <span className="font-semibold text-sm truncate text-slate-800">
                {match.team1?.name || '???'}
              </span>
            </div>
            {idaPlayed && <span className="font-mono text-sm font-bold text-slate-900">{global1}</span>}
          </div>
          
          {/* Team 2 */}
          <div className={`flex justify-between items-center p-2 
            ${isComplete && match.winner?.id === match.team2?.id ? 'bg-green-50' : ''}
          `}>
            <div className="flex items-center gap-2 overflow-hidden">
               {match.team2 ? (
                <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-slate-200">
                   {match.team2.logoUrl ? <img src={match.team2.logoUrl} alt="" className="w-full h-full object-cover" /> : <Shield className="w-3 h-3 text-slate-300" />}
                </div>
              ) : <div className="w-5 h-5 rounded-full bg-gray-200"></div>}
              <span className="font-semibold text-sm truncate text-slate-800">
                {match.team2?.name || '???'}
              </span>
            </div>
            {idaPlayed && <span className="font-mono text-sm font-bold text-slate-900">{global2}</span>}
          </div>
        </div>

        {/* Scores details (Ida / Vuelta) */}
        {idaPlayed && (
           <div className="bg-slate-100 text-xs text-slate-600 font-bold px-3 py-1.5 flex justify-between items-center border-t border-gray-200">
             <span>Ida: {match.ida1}-{match.ida2}</span>
             {vueltaPlayed && <span>Vta: {match.vuelta1}-{match.vuelta2}</span>}
           </div>
        )}

        {/* Action Buttons */}
        {isReady && !isComplete && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity">
            {!idaPlayed && (
              <button
                onClick={() => onSimulateMatch(round, index, match.team1, match.team2, 'ida')}
                className="bg-gradient-to-r from-yellow-400 to-blue-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold shadow-lg hover:scale-105 transition-transform"
              >
                <Play className="w-3 h-3 fill-current" />
                Jugar Ida
              </button>
            )}
            {idaPlayed && !vueltaPlayed && (
              <button
                onClick={() => onSimulateMatch(round, index, match.team1, match.team2, 'vuelta')}
                className="bg-gradient-to-r from-blue-500 to-red-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold shadow-lg hover:scale-105 transition-transform"
              >
                <Play className="w-3 h-3 fill-current" />
                Jugar Vuelta
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleResetTournament = () => {
    if (confirm("¿Deseas iniciar un nuevo torneo? Los datos actuales se limpiarán.")) {
      onResetTournament()
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in py-8 relative">
      <button 
        onClick={onBack}
        className="absolute left-0 top-0 p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <div className="mb-8 text-center">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
          Fase de <span className="text-blue-600">Playoffs</span>
        </h2>
        <div className="flex items-center gap-3 mt-2 justify-center">
          <div className="h-px w-8 bg-slate-300"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Enfrentamientos Directos</p>
          <div className="h-px w-8 bg-slate-300"></div>
        </div>
      </div>
      
      {bracketState.champion && (
        <div className="mb-10 flex flex-col items-center">
          <div className="text-center animate-bounce-in bg-white/90 backdrop-blur-md p-8 rounded-3xl border border-yellow-200/50 shadow-[0_20px_50px_-15px_rgba(250,204,21,0.2)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-400 via-transparent to-transparent"></div>
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-white flex items-center justify-center shadow-2xl border-4 border-slate-100 overflow-hidden transform rotate-3 hover:rotate-0 transition-transform">
               {bracketState.champion.logoUrl ? <img src={bracketState.champion.logoUrl} alt="" className="w-full h-full object-cover" /> : <Shield className="w-12 h-12 text-slate-300" />}
            </div>
            <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight relative z-10">
              {bracketState.champion.name}
            </h2>
            <p className="text-lg text-yellow-600 mt-1 font-black uppercase tracking-widest relative z-10">¡Campeón!</p>
            <div className="mt-4 bg-emerald-100 text-emerald-700 text-[10px] font-black py-1 px-3 rounded-full uppercase tracking-widest animate-pulse">
              🏆 Torneo guardado en el historial
            </div>
          </div>
          
          <button 
            onClick={handleResetTournament}
            className="mt-6 flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-xl hover:bg-red-600 hover:-translate-y-1 transition-all"
          >
            <Play className="w-5 h-5 rotate-180" />
            Iniciar Nuevo Torneo
          </button>
        </div>
      )}

      <div className="flex justify-center items-center w-full max-w-6xl gap-10 relative glass-panel p-8 rounded-3xl border border-white/60 bg-gradient-to-br from-white/90 to-slate-50/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
        {/* Quarter Finals */}
        <div className="flex flex-col gap-6 justify-between h-full">
          <div className="text-center text-xs font-bold text-slate-400 uppercase mb-4 bg-slate-100 py-1 rounded-full tracking-widest">Cuartos</div>
          {bracketState.qf.map((match, i) => (
            <div key={`qf-${i}`} className="relative">
              {renderMatch(match, 'qf', i)}
              <div className="absolute top-1/2 -right-6 w-6 h-[3px] bg-slate-300"></div>
              {i % 2 === 0 && <div className="absolute top-1/2 -right-6 w-[3px] h-[calc(100%+1.5rem)] bg-slate-300"></div>}
            </div>
          ))}
        </div>

        {/* Semi Finals */}
        <div className="flex flex-col gap-20 justify-center h-full">
          <div className="text-center text-xs font-bold text-slate-400 uppercase mb-4 bg-slate-100 py-1 rounded-full tracking-widest">Semifinales</div>
          {bracketState.sf.map((match, i) => (
            <div key={`sf-${i}`} className="relative">
              <div className="absolute top-1/2 -left-6 w-6 h-[3px] bg-slate-300"></div>
              {renderMatch(match, 'sf', i)}
              <div className="absolute top-1/2 -right-6 w-6 h-[3px] bg-slate-300"></div>
              {i % 2 === 0 && <div className="absolute top-1/2 -right-6 w-[3px] h-[calc(100%+5rem)] bg-slate-300"></div>}
            </div>
          ))}
        </div>

        {/* Final */}
        <div className="flex flex-col justify-center h-full">
          <div className="text-center text-xs font-bold text-yellow-600 uppercase mb-4 bg-yellow-50 py-1 rounded-full border border-yellow-100 tracking-widest">La Gran Final</div>
          <div className="relative">
            <div className="absolute top-1/2 -left-6 w-6 h-[3px] bg-slate-300"></div>
            {renderMatch(bracketState.final, 'final', 0)}
          </div>
        </div>
      </div>
    </div>
  )
}
