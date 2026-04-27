import { useState, useEffect } from 'react'
import { Shield, Users, Save, X, ChevronRight, Trophy, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Loader2, ArrowLeft } from 'lucide-react'
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'

export default function TeamSetup({ teams, onStartDraw, user, initialRealism }) {
  const [seeded, setSeeded] = useState(Array(8).fill(null))
  const [selectedTeam, setSelectedTeam] = useState(null)
  
  // Local state for smooth typing without cursor jumps
  const [localTeams, setLocalTeams] = useState([])
  const [search, setSearch] = useState('')
  const [workspaceIds, setWorkspaceIds] = useState(() => {
    const saved = localStorage.getItem(`workspace_${user?.uid}`)
    return saved ? JSON.parse(saved) : []
  })
  const [draggedItemIndex, setDraggedItemIndex] = useState(null)

  useEffect(() => {
    localStorage.setItem(`workspace_${user?.uid}`, JSON.stringify(workspaceIds))
  }, [workspaceIds, user])

  useEffect(() => {
    setLocalTeams(teams)
  }, [teams])

  const workspaceTeams = workspaceIds.map(id => localTeams.find(t => t.id === id)).filter(Boolean)
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
  const [nameDraft, setNameDraft] = useState('')
  const [shortDraft, setShortDraft] = useState('')
  const [uploading, setUploading] = useState(null)
  const [setupMode, setSetupMode] = useState('selection') // 'selection' | 'seeding'
  const [realismEnabled, setRealismEnabled] = useState(initialRealism || false)
  const hasSeeds = seeded.some(s => s !== null)

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
    // We only take the teams from the personal workspace (Mi Grupo)
    const manualSeededTeams = seeded.filter(s => s !== null)
    const selectedForDraw = [...manualSeededTeams]
    const assignedIds = new Set(selectedForDraw.map(t => t.id))

    // Fill remaining spots from workspaceTeams (Mi Grupo)
    let teamIndex = 0
    while (selectedForDraw.length < 8 && teamIndex < workspaceTeams.length) {
      const t = workspaceTeams[teamIndex]
      if (!assignedIds.has(t.id)) {
        selectedForDraw.push(t)
        assignedIds.add(t.id)
      }
      teamIndex++
    }

    if (selectedForDraw.length < 8) {
      alert("No tienes suficientes equipos en 'Mi Grupo'. Necesitas al menos 8 equipos para el sorteo.")
      return
    }

    // Pasamos el array 'seeded' intacto (con nulls en donde no se sembró manualmente)
    // y el array de 8 equipos que van a participar (selectedForDraw)
    onStartDraw(seeded, selectedForDraw, realismEnabled)
  }

  const handleStartRandom = () => {
    if (workspaceTeams.length < 8) {
      alert("Necesitas al menos 8 equipos en 'Mi Grupo Personal' para comenzar.")
      return
    }
    
    // Pick 8 random teams from workspaceTeams
    const shuffled = [...workspaceTeams].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 8)
    
    // Start without manual seeds
    onStartDraw(Array(8).fill(null), selected, realismEnabled)
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

  const handleCreateTeam = () => {
    // Open editor immediately with default values, but don't save to DB yet
    setEditingRoster('new')
    setRosterDraft(Array(11).fill('Jugador'))
    setNameDraft('Nuevo Equipo')
    setShortDraft('NVO')
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
    const listToMove = setupMode === 'selection' ? filteredTeams : workspaceTeams
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === listToMove.length - 1) return

    const teamA = listToMove[index]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const teamB = listToMove[swapIndex]

    if (setupMode === 'seeding') {
      // Reorder workspace IDs
      const newIds = [...workspaceIds]
      const idA = teamA.id
      const idB = teamB.id
      const idxA = newIds.indexOf(idA)
      const idxB = newIds.indexOf(idB)
      newIds[idxA] = idB
      newIds[idxB] = idA
      setWorkspaceIds(newIds)
      return
    }

    const refA = doc(db, 'teams', teamA.id)
    const refB = doc(db, 'teams', teamB.id)

    const orderA = teamA.order
    let orderB = teamB.order
    
    if (orderA === orderB) {
      orderB = orderA + (direction === 'up' ? -1 : 1)
    }

    // Optimistic local update to prevent jumpiness
    const newLocal = [...localTeams]
    const localIdxA = newLocal.findIndex(t => t.id === teamA.id)
    const localIdxB = newLocal.findIndex(t => t.id === teamB.id)
    newLocal[localIdxA] = { ...teamA, order: orderB }
    newLocal[localIdxB] = { ...teamB, order: orderA }
    
    newLocal.sort((a, b) => a.order - b.order)
    setLocalTeams(newLocal)

    Promise.all([
      updateDoc(refA, { order: orderB }),
      updateDoc(refB, { order: orderA })
    ]).catch(err => console.error("Error moving team:", err))
  }

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // For transparent image during drag (optional)
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.opacity = '0.5'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null)
      return
    }

    const newIds = [...workspaceIds]
    const itemToMove = newIds[draggedItemIndex]
    newIds.splice(draggedItemIndex, 1)
    newIds.splice(targetIndex, 0, itemToMove)
    
    setWorkspaceIds(newIds)
    setDraggedItemIndex(null)
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
    setNameDraft(team.name)
    setShortDraft(team.short)
  }

  const saveRoster = async () => {
    if (!editingRoster) return
    
    const data = { 
      players: rosterDraft,
      name: nameDraft,
      short: shortDraft.toUpperCase()
    }

    if (editingRoster === 'new') {
      const newTeamData = {
        ...data,
        color: '#ffffff',
        bg: '#94a3b8',
        order: teams.length > 0 ? Math.max(...teams.map(t => t.order)) + 1 : 1,
        userId: user.uid,
        stars: 0
      }
      try {
        const docRef = await addDoc(collection(db, 'teams'), newTeamData)
        setWorkspaceIds(prev => [...prev, docRef.id])
      } catch (error) {
        console.error("Error creating team:", error)
      }
    } else {
      try {
        await updateDoc(doc(db, 'teams', editingRoster), data)
      } catch (error) {
        console.error("Error updating roster:", error)
      }
    }
    
    setEditingRoster(null)
  }

  const renderSlot = (index, alignRight = false) => {
    const team = seeded[index]
    return (
      <div 
        onClick={() => handleSeed(index)}
        className={`h-11 w-44 rounded-xl flex items-center px-3 cursor-pointer transition-all duration-300 border relative z-10
          ${team 
            ? 'border-yellow-200 bg-white shadow-sm hover:shadow-md' 
            : selectedTeam 
              ? 'border-blue-500 border-dashed bg-blue-50 scale-105 shadow-lg ring-2 ring-blue-100' 
              : 'border-slate-200 border-dashed hover:border-yellow-300 hover:bg-slate-50 bg-white/40'}
          ${alignRight ? 'flex-row-reverse text-right' : ''}
        `}
      >
        {team ? (
          <div className={`flex items-center gap-2 w-full ${alignRight ? 'justify-end' : 'justify-start'}`}>
            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden border border-slate-200">
               {team.logoUrl ? (
                 <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
               ) : (
                 <Shield className="w-3 h-3 text-slate-300" />
               )}
            </div>
            <span className="font-bold text-[11px] text-slate-800 truncate tracking-tight">{team.name}</span>
          </div>
        ) : (
          <span className={`text-slate-400 text-[8px] font-black uppercase tracking-widest w-full ${alignRight ? 'text-right' : 'text-left'} ${selectedTeam ? 'text-blue-600' : ''}`}>
            {selectedTeam ? 'Click Aquí' : `Slot ${index + 1}`}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full animate-fade-in pt-2 pb-8 max-w-7xl mx-auto w-full">
      <div className="text-center space-y-1 mb-2">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-blue-600 to-red-500 tracking-tighter uppercase italic drop-shadow-sm">Fútbol Profesional Colombiano</h2>
        <p className="text-slate-500 text-sm font-medium">Administra tu base de datos de equipos y elige 8 para los Cuadrangulares/Playoffs.</p>
      </div>

      {setupMode === 'selection' ? (
        <div className="flex flex-col xl:flex-row gap-8 items-stretch h-[600px] animate-slide-in">
          {/* Global Library (Left) */}
          <div className="xl:w-1/2 flex flex-col gap-4">
             <div className="glass-panel p-1 rounded-[2rem] border border-white/80 shadow-2xl bg-white/80 h-full flex flex-col relative overflow-hidden backdrop-blur-xl">
               <div className="flex flex-col p-5 border-b border-yellow-50 bg-gradient-to-r from-yellow-50/50 via-blue-50/30 to-red-50/20 rounded-t-[2rem] gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-2">
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
                  {filteredTeams.map((team, index) => (
                    <div key={team.id} className="group flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 transition-all shadow-sm">
                      <div className="flex items-center gap-3 flex-1">
                         <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveTeam(index, 'up')} disabled={index === 0} className="text-slate-500 hover:text-blue-600 p-0.5 leading-none transition-colors">
                               <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => moveTeam(index, 'down')} disabled={index === filteredTeams.length - 1} className="text-slate-500 hover:text-blue-600 p-0.5 leading-none transition-colors">
                               <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                         </div>

                         {/* Logo and Upload */}
                         <label className="relative w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-slate-200 flex-shrink-0 cursor-pointer group/logo overflow-hidden">
                           {uploading === team.id ? (
                             <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                           ) : team.logoUrl ? (
                             <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                           ) : (
                             <Shield className="w-5 h-5 text-slate-300" />
                           )}
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                             <ImageIcon className="w-4 h-4 text-white" />
                           </div>
                           <input 
                             type="file" 
                             accept="image/*" 
                             className="hidden" 
                             onChange={(e) => handleImageUpload(team.id, e)}
                           />
                         </label>

                         <div className="flex flex-col min-w-0">
                           <input 
                             type="text" 
                             value={team.name}
                             onChange={(e) => handleNameChange(team.id, e.target.value)}
                             onBlur={(e) => handleNameBlur(team.id, e.target.value)}
                             className="bg-transparent border-b border-transparent focus:border-blue-200 outline-none font-bold text-slate-800 focus:text-blue-600 px-1 py-0 text-sm transition-all truncate"
                             placeholder="Nombre"
                           />
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400">{team.short}</span>
                              {team.stars > 0 && (
                                <span className="text-[9px] text-yellow-600 font-black">⭐ {team.stars}</span>
                              )}
                           </div>
                         </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => openRoster(team)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar Plantilla">
                          <Users className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTeam(team.id, team.userId)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleWorkspace(team.id)}
                          className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
                        >
                          Añadir
                        </button>
                      </div>
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
                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
          {/* Left Panel: Workspace List with Movement */}
          <div className="xl:w-[40%] flex flex-col gap-4">
            <div className="glass-panel p-1 rounded-[2rem] border border-white/80 shadow-2xl bg-white/80 h-full flex flex-col relative overflow-hidden backdrop-blur-xl">
               <div className="flex flex-col p-5 border-b border-yellow-50 bg-gradient-to-r from-yellow-50/50 via-blue-50/30 to-red-50/20 rounded-t-[2rem]">
                  <button onClick={() => setSetupMode('selection')} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors mb-2">
                    <ArrowLeft className="w-3 h-3" /> Añadir más equipos
                  </button>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight italic">Mi Grupo Seleccionado</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">El torneo se iniciará con los primeros 8 equipos según su posición en la tabla.</p>
                  
                  <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 w-fit">
                    <input 
                      type="checkbox" 
                      id="realism" 
                      checked={realismEnabled}
                      onChange={(e) => setRealismEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="realism" className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer">Asignar Realismo (+ Probabilidad por posición)</label>
                  </div>
               </div>
               <div className="flex flex-col overflow-y-auto flex-1 custom-scrollbar p-3 gap-1">
                  {workspaceTeams.map((team, index) => {
                    const isSeeded = seeded.find(s => s?.id === team.id)
                    const isSelected = selectedTeam?.id === team.id
                    const isDragging = draggedItemIndex === index

                    return (
                      <div 
                        key={team.id} 
                        draggable={!isSeeded}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`group flex items-center justify-between p-2 rounded-xl transition-all border cursor-move
                          ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-yellow-100'}
                          ${isSeeded ? 'opacity-40 grayscale pointer-events-none cursor-not-allowed' : ''}
                          ${isDragging ? 'opacity-20 scale-95 border-dashed border-blue-400' : ''}
                        `}
                      >
                         <div className="flex items-center gap-3">
                           <div className="flex flex-col items-center">
                             <button onClick={() => moveTeam(index, 'up')} disabled={index === 0} className="text-slate-500 hover:text-blue-600 p-0.5 disabled:opacity-20 transition-colors"><ArrowUp className="w-3 h-3" /></button>
                             <button onClick={() => moveTeam(index, 'down')} disabled={index === workspaceTeams.length - 1} className="text-slate-500 hover:text-blue-600 p-0.5 disabled:opacity-20 transition-colors"><ArrowDown className="w-3 h-3" /></button>
                           </div>
                           <span className="text-[10px] font-black text-blue-500 w-4">{index + 1}</span>
                           <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                             {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : <Shield className="w-4 h-4 text-slate-300" />}
                           </div>
                           <span className="text-[11px] font-black uppercase text-slate-800">{team.name}</span>
                         </div>
                         <div className="flex items-center gap-1.5 ml-2">
                           {realismEnabled && index < 8 && (
                              <div className="flex flex-col items-end justify-center px-3 border-r border-slate-100 mr-1 animate-fade-in">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Realismo</span>
                                <span className="text-[10px] font-black text-blue-600">+{8 - index}%</span>
                              </div>
                           )}
                           <button onClick={() => openRoster(team)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Ver Plantilla">
                             <Users className="w-4 h-4" />
                           </button>
                           <button
                             onClick={() => setSelectedTeam(isSelected ? null : team)}
                             className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border-2
                               ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-blue-600 text-blue-600'}`}
                           >
                             {isSelected ? 'Listo' : 'Sembrar'}
                           </button>
                         </div>
                      </div>
                    )
                  })}
               </div>
               <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                  <button
                    onClick={handleStartWithAutofill}
                    className="w-full py-4 bg-gradient-to-r from-yellow-400 via-blue-600 to-red-600 rounded-[1.5rem] font-black text-white shadow-lg text-sm uppercase tracking-widest hover:-translate-y-1 transition-all"
                  >
                    Comenzar Torneo
                  </button>
                  {!hasSeeds && (
                    <button
                      onClick={handleStartRandom}
                      disabled={workspaceTeams.length < 8}
                      className="w-full py-3 bg-white border-2 border-blue-600 rounded-[1.5rem] font-black text-blue-600 text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Sortear 8 Aleatorios
                    </button>
                  )}
               </div>
            </div>
          </div>

          {/* Right Panel: Bracket Map (Visual) */}
          <div className="xl:w-[60%] flex flex-col gap-4">
            <div className="glass-panel p-8 rounded-[2rem] border border-white/80 bg-gradient-to-br from-white/90 to-blue-50/20 backdrop-blur-xl shadow-2xl flex flex-col justify-center h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex justify-between items-stretch max-w-2xl mx-auto w-full relative z-10">
                {/* Left Side (Matches 1 & 2) */}
                <div className="flex flex-col justify-between gap-10 relative">
                  <div className="flex flex-col gap-2 relative">
                    <div className="absolute -right-6 top-1/2 w-6 h-[2px] bg-slate-300"></div>
                    <div className="absolute -right-6 top-1/2 w-[2px] h-[calc(100%+3rem)] bg-slate-300"></div>
                    <div className="text-[8px] font-black text-slate-400 uppercase pl-2">Llave 1</div>
                    {renderSlot(0)}
                    {renderSlot(1)}
                  </div>
                  <div className="flex flex-col gap-2 relative">
                    <div className="absolute -right-6 top-1/2 w-6 h-[2px] bg-slate-300"></div>
                    <div className="text-[8px] font-black text-slate-400 uppercase pl-2">Llave 2</div>
                    {renderSlot(2)}
                    {renderSlot(3)}
                  </div>
                </div>

                {/* Center Area */}
                <div className="flex flex-col justify-center items-center px-6">
                   <div className="w-20 h-20 rounded-full bg-white border-4 border-yellow-100 flex flex-col items-center justify-center shadow-xl">
                     <Trophy className="w-10 h-10 text-yellow-500" />
                   </div>
                   <div className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">PlayOffs</div>
                </div>

                {/* Right Side (Matches 3 & 4) */}
                <div className="flex flex-col justify-between gap-10 relative">
                  <div className="flex flex-col gap-2 relative">
                    <div className="absolute -left-6 top-1/2 w-6 h-[2px] bg-slate-300"></div>
                    <div className="absolute -left-6 top-1/2 w-[2px] h-[calc(100%+3rem)] bg-slate-300"></div>
                    <div className="text-[8px] font-black text-slate-400 uppercase text-right pr-2">Llave 3</div>
                    {renderSlot(4, true)}
                    {renderSlot(5, true)}
                  </div>
                  <div className="flex flex-col gap-2 relative">
                    <div className="absolute -left-6 top-1/2 w-6 h-[2px] bg-slate-300"></div>
                    <div className="text-[8px] font-black text-slate-400 uppercase text-right pr-2">Llave 4</div>
                    {renderSlot(6, true)}
                    {renderSlot(7, true)}
                  </div>
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
            
            <div className="p-8 overflow-y-auto flex flex-col gap-8 custom-scrollbar bg-white">
              {/* Name and Short Name section */}
              <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Equipo</label>
                  <input 
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/50 transition-all"
                    placeholder="Ej: Atlético Nacional"
                  />
                </div>
                <div className="col-span-1 flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sigla</label>
                  <input 
                    type="text"
                    maxLength={3}
                    value={shortDraft}
                    onChange={(e) => setShortDraft(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/50 transition-all uppercase text-center"
                    placeholder="ABC"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Listado de Jugadores</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
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
