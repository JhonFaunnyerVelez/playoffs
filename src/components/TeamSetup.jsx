import { useState, useEffect } from 'react'
import { Shield, Users, Save, X, ChevronRight, Trophy, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Loader2, ArrowLeft } from 'lucide-react'
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'

export default function TeamSetup({ teams, onStartDraw, user }) {
  const [seeded, setSeeded] = useState(Array(8).fill(null))
  const [selectedTeam, setSelectedTeam] = useState(null)
  
  // Local state for smooth typing without cursor jumps
  const [localTeams, setLocalTeams] = useState([])
  const [search, setSearch] = useState('')
  const [workspaceIds, setWorkspaceIds] = useState(() => {
    const saved = localStorage.getItem(`workspace_${user?.uid}`)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem(`workspace_${user?.uid}`, JSON.stringify(workspaceIds))
  }, [workspaceIds, user])

  useEffect(() => {
    setLocalTeams(teams)
  }, [teams])

  const workspaceTeams = localTeams.filter(t => workspaceIds.includes(t.id))
  const filteredTeams = localTeams.filter(t => 
    !workspaceIds.includes(t.id) && (
      t.name.toLowerCase().includes(search.toLowerCase()) || 
      t.short.toLowerCase().includes(search.toLowerCase())
    )
  )

  const toggleWorkspace = (id) => {
    setWorkspaceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Roster editing state
  const [editingRoster, setEditingRoster] = useState(null) // ID of the team
  const [rosterDraft, setRosterDraft] = useState([])
  const [uploading, setUploading] = useState(null)
  const [setupMode, setSetupMode] = useState('selection') // 'selection' | 'seeding'

  const handleImageUpload = async (teamId, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(teamId)
    try {
      const storageRef = ref(storage, `logos/${teamId}_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on(
        'state_changed',
        () => {},
        (error) => {
          console.error("Upload error:", error)
          setUploading(null)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          await updateDoc(doc(db, 'teams', teamId), { logoUrl: downloadURL })
          setUploading(null)
        }
      )
    } catch (err) {
      console.error(err)
      setUploading(null)
    }
  }

  const handleColorChange = async (teamId, newColor) => {
    setLocalTeams(localTeams.map(t => t.id === teamId ? { ...t, bg: newColor } : t))
    try {
      await updateDoc(doc(db, 'teams', teamId), { bg: newColor })
    } catch (error) {
      console.error("Error updating color:", error)
    }
  }

  const handleStartWithAutofill = () => {
    const manualSeededTeams = seeded.filter(s => s !== null)
    const selectedForDraw = [...manualSeededTeams]
    const assignedIds = new Set(selectedForDraw.map(t => t.id))

    let teamIndex = 0
    while (selectedForDraw.length < 8 && teamIndex < localTeams.length) {
      const t = localTeams[teamIndex]
      if (!assignedIds.has(t.id)) {
        selectedForDraw.push(t)
        assignedIds.add(t.id)
      }
      teamIndex++
    }

    if (selectedForDraw.length < 8) {
      alert("No tienes suficientes equipos. Necesitas al menos 8 equipos en total.")
      return
    }

    // Pasamos el array 'seeded' intacto (con nulls en donde no se sembró manualmente)
    // y el array de 8 equipos que van a participar (selectedForDraw)
    onStartDraw(seeded, selectedForDraw)
  }

  const handleNameChange = (id, newName) => {
    setLocalTeams(localTeams.map(t => t.id === id ? { ...t, name: newName } : t))
  }

  const handleNameBlur = async (id, newName) => {
    const originalTeam = teams.find(t => t.id === id)
    if (originalTeam && originalTeam.name !== newName) {
      try {
        await updateDoc(doc(db, 'teams', id), { name: newName })
      } catch (error) {
        console.error("Error updating name:", error)
      }
    }
  }

  const handleCreateTeam = async () => {
    const newTeam = {
      name: 'Nuevo Equipo',
      short: 'NVO',
      color: '#ffffff',
      bg: '#94a3b8',
      players: Array(11).fill('Jugador'),
      order: teams.length > 0 ? Math.max(...teams.map(t => t.order)) + 1 : 1,
      userId: user.uid,
      stars: 0
    }
    const docRef = await addDoc(collection(db, 'teams'), newTeam)
    setWorkspaceIds(prev => [...prev, docRef.id])
  }

  const handleDeleteTeam = async (id, teamUserId) => {
    const isAdmin = user?.email === 'faunnyer@gmail.com'
    const isOwner = teamUserId === user?.uid

    if (!isAdmin && !isOwner) {
      alert("Solo el creador del equipo o el administrador pueden eliminar este equipo.")
      return
    }

    if (teams.length <= 8) {
      alert("Debes tener al menos 8 equipos para el torneo.")
      return
    }
    const isSeededIndex = seeded.findIndex(s => s?.id === id)
    if (isSeededIndex !== -1) {
      const newSeeded = [...seeded]
      newSeeded[isSeededIndex] = null
      setSeeded(newSeeded)
    }
    if (selectedTeam?.id === id) setSelectedTeam(null)
    
    await deleteDoc(doc(db, 'teams', id))
  }

  const moveTeam = async (index, direction) => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === localTeams.length - 1) return

    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const teamA = localTeams[index]
    const teamB = localTeams[swapIndex]

    const refA = doc(db, 'teams', teamA.id)
    const refB = doc(db, 'teams', teamB.id)

    const orderA = teamA.order
    let orderB = teamB.order
    
    if (orderA === orderB) {
      orderB = orderA + (direction === 'up' ? -1 : 1)
    }

    // Optimistic local update to prevent jumpiness
    const newLocal = [...localTeams]
    newLocal[index] = { ...teamA, order: orderB }
    newLocal[swapIndex] = { ...teamB, order: orderA }
    
    // Sort local teams immediately
    newLocal.sort((a, b) => a.order - b.order)
    setLocalTeams(newLocal)

    // Fire and forget Firestore update to not block UI
    Promise.all([
      updateDoc(refA, { order: orderB }),
      updateDoc(refB, { order: orderA })
    ]).catch(err => console.error("Error moving team:", err))
  }

  const handleSeed = (index, forcedTeam = null) => {
    const teamToSeed = forcedTeam || selectedTeam
    if (!teamToSeed) {
      if (seeded[index]) {
        const newSeeded = [...seeded]
        newSeeded[index] = null
        setSeeded(newSeeded)
      }
      return
    }

    const existingIndex = seeded.findIndex(t => t?.id === teamToSeed.id)
    const newSeeded = [...seeded]
    
    if (existingIndex !== -1) {
      newSeeded[existingIndex] = null
    }
    
    newSeeded[index] = teamToSeed
    setSeeded(newSeeded)
    if (!forcedTeam) setSelectedTeam(null)
  }

  const openRoster = (team) => {
    setEditingRoster(team.id)
    setRosterDraft([...team.players])
  }

  const saveRoster = async () => {
    if (!editingRoster) return
    await updateDoc(doc(db, 'teams', editingRoster), { players: rosterDraft })
    setEditingRoster(null)
  }

  const renderSlot = (index) => {
    const team = seeded[index]
    return (
      <div 
        onClick={() => !team && selectedTeam && handleSeed(index)}
        className={`group h-16 rounded-2xl flex items-center px-4 transition-all duration-300 border relative overflow-hidden
          ${team 
            ? 'border-blue-200 bg-white shadow-md hover:shadow-lg' 
            : 'border-slate-200 border-dashed bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-300 cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-4 w-full">
          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400 flex-shrink-0 border border-slate-200">
            {index + 1}
          </div>

          {team ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden border border-slate-100">
                 {team.logoUrl ? (
                   <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                 ) : (
                   <Shield className="w-5 h-5 text-slate-300" />
                 )}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-black text-sm text-slate-800 truncate tracking-tight uppercase">{team.name}</span>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{team.short}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  handleSeed(index, null)
                }}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Quitar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col flex-1">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                {selectedTeam ? 'Click para asignar ' + selectedTeam.name : 'Espacio Vacío'}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full animate-fade-in pt-2 pb-8 max-w-7xl mx-auto w-full">
      <div className="text-center space-y-1 mb-2">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-blue-600 to-red-500 tracking-tighter uppercase drop-shadow-sm">Fútbol Profesional Colombiano</h2>
        <p className="text-slate-500 text-sm font-medium">Administra tu base de datos de equipos y elige 8 para los Cuadrangulares/Playoffs.</p>
      </div>

      {setupMode === 'selection' ? (
        <div className="flex flex-col xl:flex-row gap-8 items-stretch h-[600px] animate-slide-in">
          {/* Global Library (Left) */}
          <div className="xl:w-1/2 flex flex-col gap-4">
             <div className="glass-panel p-1 rounded-[2rem] border border-white/80 shadow-2xl bg-white/80 h-full flex flex-col relative overflow-hidden backdrop-blur-xl">
               <div className="flex flex-col p-5 border-b border-yellow-50 bg-gradient-to-r from-yellow-50/50 via-blue-50/30 to-red-50/20 rounded-t-[2rem] gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Biblioteca Global ({filteredTeams.length})
                    </h3>
                    <button onClick={handleCreateTeam} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-1.5">
                      <Plus className="w-3 h-3" /> Nuevo Equipo
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    placeholder="Buscar equipo global..." 
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/50"
                  />
               </div>
               <div className="flex flex-col overflow-y-auto flex-1 custom-scrollbar p-4 gap-2">
                  {filteredTeams.map(team => (
                    <div key={team.id} className="group flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 transition-all shadow-sm">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                           {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-slate-300" />}
                         </div>
                         <div className="flex flex-col">
                           <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{team.name}</span>
                           <span className="text-[10px] font-bold text-slate-400">{team.short}</span>
                         </div>
                      </div>
                      <button 
                        onClick={() => toggleWorkspace(team.id)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Añadir a mi grupo
                      </button>
                    </div>
                  ))}
               </div>
             </div>
          </div>

          {/* My Workspace (Right) */}
          <div className="xl:w-1/2 flex flex-col gap-4">
             <div className="glass-panel p-6 rounded-[2rem] border border-blue-100 bg-blue-50/30 backdrop-blur-xl shadow-2xl flex flex-col h-full relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Mi Grupo Personal</h3>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Equipos que vas a usar ({workspaceTeams.length})</p>
                  </div>
                  <div className="p-4 bg-white rounded-3xl shadow-sm border border-blue-100">
                    <Shield className="w-8 h-8 text-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {workspaceTeams.map(team => (
                    <div key={team.id} className="group flex items-center justify-between p-3 rounded-2xl bg-white border border-blue-100 shadow-sm relative overflow-hidden">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                            {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-slate-300" />}
                          </div>
                          <span className="text-xs font-black text-slate-800 uppercase truncate max-w-[100px]">{team.name}</span>
                       </div>
                       <button 
                         onClick={() => toggleWorkspace(team.id)}
                         className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ))}
                </div>

                <button
                  disabled={workspaceTeams.length < 8}
                  onClick={() => setSetupMode('seeding')}
                  className="mt-8 w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-4"
                >
                  Configurar Torneo
                  <ChevronRight className="w-6 h-6" />
                </button>
             </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-8 items-stretch h-[600px] animate-fade-in">
          {/* Seeding Area (The 1-8 List) */}
          <div className="xl:w-[60%] flex flex-col gap-4">
            <div className="glass-panel p-8 rounded-[2rem] border border-white/80 bg-gradient-to-br from-white/90 to-blue-50/20 backdrop-blur-xl shadow-2xl flex flex-col h-full relative overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setSetupMode('selection')} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Volver a Selección
                </button>
                <div className="text-center">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Siembra del Torneo</h3>
                  <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Asigna los 8 participantes ({seeded.filter(s => s !== null).length}/8)</p>
                </div>
                <div className="w-16 h-1 w-12"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-2 mb-4">
                {Array(8).fill(null).map((_, i) => (
                  <div key={i}>
                    {renderSlot(i)}
                  </div>
                ))}
              </div>

              {/* Workspace Mini (My Group) */}
              <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Elegir de mi grupo:</h4>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                  {workspaceTeams.map(team => {
                    const isSeeded = seeded.find(s => s?.id === team.id)
                    const isSelected = selectedTeam?.id === team.id
                    return (
                      <div 
                        key={team.id}
                        onClick={() => {
                          const nextEmpty = seeded.findIndex(s => s === null)
                          if (nextEmpty !== -1) handleSeed(nextEmpty, team)
                          else setSelectedTeam(isSelected ? null : team)
                        }}
                        className={`flex-shrink-0 flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer
                          ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-100 hover:border-blue-200'}
                          ${isSeeded ? 'opacity-30 grayscale pointer-events-none' : ''}
                        `}
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                          {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : <Shield className="w-4 h-4 text-slate-300" />}
                        </div>
                        <span className="text-[10px] font-black uppercase pr-2">{team.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleStartWithAutofill}
              className="group relative w-full py-4 bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 bg-[length:200%_auto] animate-gradient-x rounded-[1.5rem] font-black text-base text-white overflow-hidden transition-all transform hover:-translate-y-1 shadow-lg flex-shrink-0"
            >
              <span className="relative flex items-center justify-center gap-3 uppercase tracking-widest">
                Comenzar Torneo
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>

          {/* Tips / Info Sidebar */}
          <div className="xl:w-[40%] flex flex-col gap-4">
             <div className="glass-panel p-10 rounded-[2.5rem] bg-indigo-900 text-white shadow-2xl h-full flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <Trophy className="w-16 h-16 text-yellow-400 mb-8" />
                <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-4 italic">El camino a la Gloria</h3>
                <p className="text-indigo-200 text-sm font-medium mb-10 leading-relaxed">
                  Has seleccionado a tus guerreros. Ahora, asígnalos en la lista de siembra. El orden que elijas determinará los cruces iniciales en los PlayOffs. 
                </p>
                <div className="flex flex-col gap-3">
                   <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/10">
                      <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-indigo-900 font-black">1</div>
                      <span className="text-xs font-bold uppercase tracking-widest">Siembra tus 8 equipos</span>
                   </div>
                   <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/10">
                      <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center text-white font-black">2</div>
                      <span className="text-xs font-bold uppercase tracking-widest">Inicia el sorteo</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Roster Editor Modal */}
      {editingRoster && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-pop-out border border-white">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-200 overflow-hidden">
                  {teams.find(t => t.id === editingRoster)?.logoUrl ? (
                    <img src={teams.find(t => t.id === editingRoster)?.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Shield className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Plantilla de 11</h3>
                  <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest">{teams.find(t => t.id === editingRoster)?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingRoster(null)}
                className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm border border-slate-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar bg-white">
              {rosterDraft.map((player, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:bg-white transition-all group">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jugador {idx + 1}</span>
                  <input 
                    type="text"
                    value={player}
                    onChange={(e) => {
                      const newDraft = [...rosterDraft]
                      newDraft[idx] = e.target.value
                      setRosterDraft(newDraft)
                    }}
                    className="bg-transparent font-bold text-slate-800 outline-none w-full text-base focus:text-indigo-600 transition-colors"
                    placeholder={`Nombre del jugador ${idx + 1}`}
                  />
                </div>
              ))}
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={saveRoster}
                className="w-full py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
              >
                <Save className="w-5 h-5" />
                Guardar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
