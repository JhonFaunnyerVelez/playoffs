import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { Trophy, Calendar, Trash2, ArrowLeft } from 'lucide-react'
import Bracket from './Bracket'

export default function TournamentHistory({ user, onBack }) {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setTournaments(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (confirm("¿Seguro que quieres borrar este torneo del historial?")) {
      await deleteDoc(doc(db, 'tournaments', id))
      if (selectedTournament?.id === id) {
        setSelectedTournament(null)
      }
    }
  }

  const lastTournament = tournaments.length > 0 ? tournaments[0] : null;

  const championsStats = tournaments.reduce((acc, t) => {
    if (t.champion) {
      const existing = acc.find(item => item.id === t.champion.id);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ ...t.champion, count: 1 });
      }
    }
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center font-bold text-slate-400">Cargando historial...</div>
  }

  if (selectedTournament) {
    return (
      <div className="flex flex-col w-full animate-fade-in">
        <button 
          onClick={() => setSelectedTournament(null)}
          className="self-start mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al historial
        </button>
        <div className="bg-white/50 backdrop-blur-md p-4 rounded-2xl mb-4 border border-slate-200 text-center">
          <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Torneo del {new Date(selectedTournament.date).toLocaleDateString()}</h2>
        </div>
        <Bracket bracketState={selectedTournament.bracket} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center animate-fade-in p-4 w-full max-w-7xl mx-auto gap-10 pb-16 relative">
      <button 
        onClick={onBack}
        className="absolute left-0 top-0 p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al Inicio
      </button>

      {/* Header Section */}
      <div className="text-center relative">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-400/10 blur-[80px] rounded-full"></div>
        <h2 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 mb-2 flex items-center justify-center gap-3 relative z-10">
          <Trophy className="w-10 h-10 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
          Salón de la Fama
        </h2>
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-slate-200"></div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[9px]">Estadísticas Oficiales FPC</p>
          <div className="h-px w-10 bg-slate-200"></div>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-slate-400 font-medium py-16">Aún no hay torneos guardados.</div>
      ) : (
        <>
          {/* Hero Section: Last Champion & Podium */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
            
            {/* LAST CHAMPION HIGHLIGHT */}
            <div className="xl:col-span-4 flex flex-col gap-4">
              <div className="flex items-center gap-2 ml-2">
                 <div className="w-1.5 h-5 bg-yellow-400 rounded-full"></div>
                 <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter italic">Rey Actual</h3>
              </div>
              
              <div className="bg-slate-900 rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col items-center text-center shadow-xl shadow-slate-200 group">
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                   <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-blue-600 blur-[100px] rounded-full"></div>
                   <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-red-600 blur-[100px] rounded-full"></div>
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600"></div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-yellow-400/10 blur-2xl rounded-full animate-pulse"></div>
                  <div className="w-32 h-32 bg-white rounded-3xl shadow-xl border-4 border-slate-800 flex items-center justify-center p-5 relative z-10 group-hover:scale-105 transition-transform duration-500">
                     {lastTournament.champion?.logoUrl ? (
                       <img src={lastTournament.champion.logoUrl} alt="" className="w-full h-full object-contain drop-shadow-xl" />
                     ) : (
                       <Trophy className="w-16 h-16 text-yellow-400" />
                     )}
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 font-black text-[8px] px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg border border-slate-900 z-20 whitespace-nowrap">
                    Vigente Campeón
                  </div>
                </div>
                
                <h4 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-1 relative z-10">{lastTournament.champion?.name}</h4>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest relative z-10 mb-6">
                   <Calendar className="w-3 h-3 text-blue-500" />
                   {new Date(lastTournament.date).toLocaleDateString()}
                </div>

                <div className="mt-auto w-full grid grid-cols-2 gap-3 relative z-10">
                   <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Títulos</div>
                      <div className="text-xl font-black text-yellow-400 italic">
                        {championsStats.find(s => s.id === lastTournament.champion?.id)?.count || 1}
                      </div>
                   </div>
                   <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
                      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Simulado por</div>
                      <div className="text-xs font-black text-white italic truncate">{lastTournament.authorName?.split(' ')[0]}</div>
                   </div>
                </div>
              </div>
            </div>

            {/* LEADERBOARD TABLE */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex items-center justify-between ml-2 mr-4">
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-5 bg-blue-600 rounded-full"></div>
                   <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter italic">Tabla Histórica</h3>
                 </div>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{championsStats.length} Clubes</span>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-x-auto overflow-y-auto max-h-[440px] custom-scrollbar">
                <table className="min-w-[600px] w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-left w-16">Pos</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-left">Club</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center w-24">Títulos</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Vitrina</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {championsStats.map((team, i) => (
                      <tr key={team.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="px-4 py-2.5">
                          <span className={`text-base font-black italic ${
                            i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-200'
                          }`}>
                            #{i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center p-1.5 flex-shrink-0 group-hover:scale-105 transition-transform">
                               {team.logoUrl ? (
                                 <img src={team.logoUrl} alt="" className="w-full h-full object-contain" />
                               ) : (
                                 <Trophy className="w-4 h-4 text-slate-200" />
                               )}
                            </div>
                            <span className="text-sm font-black text-slate-800 uppercase tracking-tighter italic">{team.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-sm border-2 ${
                            i === 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            {team.count}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-0.5">
                            {Array.from({ length: team.count }).map((_, j) => (
                              <Trophy key={j} className={`w-3 h-3 ${j < 5 ? 'text-yellow-400' : 'text-yellow-200'} drop-shadow-sm`} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CHRONOLOGICAL FEED */}
          <div className="w-full flex flex-col gap-6">
            <div className="flex items-center gap-2 ml-2">
               <div className="w-1.5 h-5 bg-red-600 rounded-full"></div>
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter italic">Bitácora de Torneos</h3>
               <span className="ml-auto bg-slate-100 text-slate-500 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
                 {tournaments.length} Sesiones
               </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {tournaments.map((t) => (
                <div 
                  key={t.id}
                  onClick={() => setSelectedTournament(t)}
                  className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-slate-50 group-hover:bg-blue-600 transition-colors"></div>
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-50 group-hover:border-blue-100 transition-colors">
                       {t.champion?.logoUrl ? (
                         <img src={t.champion.logoUrl} alt="" className="w-full h-full object-contain" />
                       ) : (
                         <Trophy className="w-6 h-6 text-slate-200" />
                       )}
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha</span>
                       <span className="text-[9px] font-bold text-slate-700">{new Date(t.date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight italic mb-3 truncate">{t.champion?.name}</h4>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                     <div className="flex items-center gap-1.5">
                        {t.authorPhoto ? (
                          <img src={t.authorPhoto} alt="" className="w-5 h-5 rounded-full border border-slate-100" />
                        ) : (
                          <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[7px] font-black text-slate-400">
                            {t.authorName?.[0]}
                          </div>
                        )}
                        <span className="text-[9px] font-bold text-slate-500">{t.authorName?.split(' ')[0]}</span>
                     </div>
                     {user?.email === 'faunnyer@gmail.com' && (
                        <button 
                          onClick={(e) => handleDelete(e, t.id)}
                          className="p-1.5 text-slate-200 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
