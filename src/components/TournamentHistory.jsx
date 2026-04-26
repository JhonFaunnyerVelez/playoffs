import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { Trophy, Calendar, Trash2, ArrowLeft } from 'lucide-react'
import Bracket from './Bracket'

export default function TournamentHistory({ user }) {
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
          <h2 className="text-xl font-black text-slate-800">Torneo del {new Date(selectedTournament.date).toLocaleDateString()}</h2>
        </div>
        {/* Render Bracket in read-only mode (matches are complete so no buttons will appear) */}
        <Bracket bracketState={selectedTournament.bracket} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center animate-fade-in p-8 w-full max-w-4xl mx-auto">
      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-8 flex items-center gap-3">
        <Trophy className="w-8 h-8 text-yellow-500" />
        Salón de la Fama
      </h2>

      {tournaments.length === 0 ? (
        <div className="text-slate-400 font-medium">Aún no hay torneos guardados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {tournaments.map((t) => (
            <div 
              key={t.id}
              onClick={() => setSelectedTournament(t)}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center gap-6"
            >
              <div className="w-20 h-20 flex-shrink-0 bg-slate-50 rounded-2xl flex items-center justify-center p-2 border border-slate-100 group-hover:border-yellow-200 transition-colors">
                 {t.champion?.logoUrl ? (
                   <img src={t.champion.logoUrl} alt="Campeón" className="w-full h-full object-contain drop-shadow-md" />
                 ) : (
                   <Trophy className="w-10 h-10 text-yellow-400" />
                 )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(t.date).toLocaleDateString()}
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                  {t.champion?.name || 'Desconocido'}
                </h3>
                <p className="text-sm font-medium text-yellow-600">¡Campeón!</p>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                 {t.authorPhoto ? (
                   <img src={t.authorPhoto} alt={t.authorName} className="w-8 h-8 rounded-full border border-slate-200" title={`Simulado por ${t.authorName}`} />
                 ) : (
                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs" title={`Simulado por ${t.authorName}`}>
                     {t.authorName?.[0]?.toUpperCase() || '?'}
                   </div>
                 )}
                 <div className="flex flex-col">
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Jugador</span>
                   <span className="text-xs font-bold text-slate-700 truncate max-w-[80px]">{t.authorName?.split(' ')[0]}</span>
                 </div>
              </div>

              {user?.email === 'faunnyer@gmail.com' && (
                <button 
                  onClick={(e) => handleDelete(e, t.id)}
                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="Eliminar del historial global"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
