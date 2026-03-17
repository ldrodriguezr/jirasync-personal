mport { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// LLAVES DE SUPABASE
const supabaseUrl = 'https://nuelqtmndhyjvvheymux.supabase.co'
const supabaseKey = 'sb_publishable_MROXcMj0csEMYlA8bpdV0Q_JYhcb-16'
const supabase = createClient(supabaseUrl, supabaseKey)

function App() {
  const [currentUser, setCurrentUser] = useState('Luis')
  const [isLoading, setIsLoading] = useState(true)
 
  const [ticketCounter, setTicketCounter] = useState(4)
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    const fetchCloudData = async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', 'main_board').single()
     
      if (data && data.task_data) {
        setTasks(data.task_data.tasks || [])
        setTicketCounter(data.task_data.ticketCounter || 4)
      } else {
        setTasks([
          {
            id: 1, ticketId: 'EFX-1', title: 'Review UATZ Chargeback', description: 'Review environment allocation as opposed to being 100% USIS',
            dueDate: '2026-03-20', assignee: 'Daniel', requestor: 'siddharth.shekhar@equifax.com', project: 'df-key-kls-uat-prd', status: 'To Do', priority: 'High', storyPoints: '5', tag: 'Finance',
            checklists: [{ id: 101, text: 'Meet with Vishy', isCompleted: false }], links: [],
            history: [{ id: 300, author: 'Luis', text: 'Created ticket from Excel notes', timestamp: new Date().toLocaleString(), isSystem: true }], isArchived: false
          }
        ])
      }
      setIsLoading(false)
    }
    fetchCloudData()
  }, [])

  useEffect(() => {
    if (isLoading) return;
    const syncToCloud = async () => {
      await supabase.from('tasks').upsert({ id: 'main_board', task_data: { tasks, ticketCounter } })
    }
    syncToCloud()
  }, [tasks, ticketCounter, isLoading])

  const [modalTask, setModalTask] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  const [newChecklist, setNewChecklist] = useState('')
  const [newLink, setNewLink] = useState('')
  const [newComment, setNewComment] = useState('')

  const columns = ['Backlog', 'To Do', 'In Progress', 'Done']

  const handleDragStart = (e: any, id: number) => e.dataTransfer.setData('taskId', id.toString())
  const handleDrop = (e: any, newStatus: string) => {
    const taskId = parseInt(e.dataTransfer.getData('taskId'))
    setTasks(tasks.map(t => {
      if (t.id === taskId && t.status !== newStatus) {
        const systemLog = { id: Date.now(), author: currentUser, text: `Moved from ${t.status} to ${newStatus}`, timestamp: new Date().toLocaleString(), isSystem: true }
        return { ...t, status: newStatus, history: [...t.history, systemLog] }
      }
      return t
    }))
  }
  const handleDragOver = (e: any) => e.preventDefault()

  const openCreateModal = () => {
    setIsCreating(true)
    setModalTask({
      id: Date.now(), title: '', description: '', dueDate: '',
      assignee: currentUser, requestor: '', project: '', status: 'Backlog', priority: 'Medium', storyPoints: '3', tag: 'Project',
      checklists: [], links: [], history: [], isArchived: false
    })
  }

  const openEditModal = (task: any) => { setIsCreating(false); setModalTask({ ...task }) }
  const openFromArchive = (task: any) => { setShowArchive(false); openEditModal(task) }

  const handleSaveModal = (e: any) => {
    e.preventDefault()
    if (!modalTask.title.trim()) { alert("Please enter a Task Title"); return }
   
    if (isCreating) {
      const newTicketId = `EFX-${ticketCounter}`
      const systemLog = { id: Date.now(), author: currentUser, text: `Created ticket in ${modalTask.status}`, timestamp: new Date().toLocaleString(), isSystem: true }
      setTasks([...tasks, { ...modalTask, ticketId: newTicketId, history: [systemLog] }])
      setTicketCounter(prev => prev + 1)
    } else {
      setTasks(tasks.map(t => t.id === modalTask.id ? modalTask : t))
    }
    setModalTask(null)
  }

  const deleteTask = (id: number) => {
    if(confirm('Are you sure you want to delete this task?')) {
      setTasks(tasks.filter(t => t.id !== id))
      setModalTask(null)
    }
  }

  const toggleArchive = (e: any, id: number, archiveStatus: boolean) => {
    e.stopPropagation()
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const action = archiveStatus ? 'Archived ticket' : 'Restored ticket to board'
        const systemLog = { id: Date.now(), author: currentUser, text: action, timestamp: new Date().toLocaleString(), isSystem: true }
        return { ...t, isArchived: archiveStatus, history: [...t.history, systemLog] }
      }
      return t
    }))
  }

  const addChecklist = () => { if(!newChecklist) return; setModalTask({...modalTask, checklists: [...modalTask.checklists, { id: Date.now(), text: newChecklist, isCompleted: false }]}); setNewChecklist('') }
  const toggleChecklist = (id: number) => { setModalTask({...modalTask, checklists: modalTask.checklists.map((c: any) => c.id === id ? { ...c, isCompleted: !c.isCompleted } : c)}) }
  const addLink = () => { if(!newLink) return; setModalTask({...modalTask, links: [...modalTask.links, { id: Date.now(), url: newLink }]}); setNewLink('') }
  const addComment = () => { if(!newComment) return; setModalTask({...modalTask, history: [...modalTask.history, { id: Date.now(), author: currentUser, text: newComment, timestamp: new Date().toLocaleString(), isSystem: false }]}); setNewComment('') }

  const getTagColor = (tag: string) => ({ 'Finance': '#1e8e3e', 'Project': '#6a1b9a', 'Meeting': '#d93025', 'Cloud': '#1967d2' }[tag] || '#7f8c8d')
  const getPriorityColor = (priority: string) => ({ 'High': '#EF3A47', 'Medium': '#f29900', 'Low': '#5f6368' }[priority] || '#bdc3c7')

  const resetCloudDatabase = async () => {
    if(confirm('⚠ DANGER: Are you sure you want to wipe all data from the cloud?')) {
      await supabase.from('tasks').delete().eq('id', 'main_board')
      window.location.reload()
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#00205B', color: 'white', fontFamily: '"Segoe UI", sans-serif' }}><h2>☁️ Connecting to EFX Cloud...</h2></div>
  }

  const activeTasks = tasks.filter(t => !t.isArchived)
  const archivedTasks = tasks.filter(t => t.isArchived)
  const filteredActiveTasks = activeTasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) || t.assignee.toLowerCase().includes(searchTerm.toLowerCase()) || (t.project && t.project.toLowerCase().includes(searchTerm.toLowerCase())))

  return (
    <div style={{ fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#F0F2F5', minHeight: '100vh', position: 'relative' }}>
     
      <style>{`
        .btn-efx { background: #EF3A47; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-efx:hover { background: #D22630; }
        .btn-secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-secondary:hover { background: rgba(255,255,255,0.2); }
        .kanban-card { background: white; border-radius: 6px; padding: 15px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); cursor: grab; transition: all 0.2s; border: 1px solid #e1e4e8; position: relative; }
        .kanban-card:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-color: #cdd1d5; }
        .archive-row { background: white; padding: 15px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e1e4e8; cursor: pointer; transition: 0.2s; }
        .archive-row:hover { border-color: #00205B; box-shadow: 0 2px 6px rgba(0,32,91,0.15); }
        .avatar { width: 28px; height: 28px; border-radius: 50%; background: #00205B; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white; }
        .story-point { width: 24px; height: 24px; border-radius: 50%; background: #e1e4e8; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #1D252C; }
        .form-input { padding: 8px 12px; border: 1px solid #cdd1d5; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; background: #fafbfc; color: #1D252C; }
        .form-input:focus { border-color: #00205B; background: white; box-shadow: 0 0 0 2px rgba(0,32,91,0.1); }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,20,40,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(2px); }
        .modal-content { background: #f4f5f7; padding: 0; border-radius: 8px; width: 750px; max-width: 95%; max-height: 90vh; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
        .section-box { background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #e1e4e8; }
        .progress-bar { height: 6px; background: #e1e4e8; border-radius: 3px; margin-top: 5px; overflow: hidden; }
        .progress-fill { height: 100%; background: #1e8e3e; transition: width 0.3s ease; }
        .archive-btn { font-size: 11px; background: #f0f2f5; color: #5f6368; border: 1px solid #cdd1d5; padding: 4px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: bold; }
        .archive-btn:hover { background: #e1e4e8; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
      `}</style>

      {/* Cabecera */}
      <div style={{ backgroundColor: '#00205B', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '30px', height: '30px', backgroundColor: '#EF3A47', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>E</div>
          <h2 style={{ color: 'white', margin: 0, fontSize: '20px', letterSpacing: '0.5px' }}>JiraSync | EFX</h2>
        </div>
        <div style={{ display: 'flex', gap: '15px', flexGrow: 1, maxWidth: '350px', marginLeft: '30px' }}>
          <input type="text" placeholder="🔍 Search ID, Task or Project..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', width: '100%', outline: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '4px' }}>
            <span style={{ fontSize: '12px', color: '#a1a5ab' }}>👤 Logged in as:</span>
            <select value={currentUser} onChange={e => setCurrentUser(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
              <option value="Luis" style={{ color: 'black' }}>Luis</option>
              <option value="Daniel" style={{ color: 'black' }}>Daniel</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setShowArchive(true)}>📥 Archive ({archivedTasks.length})</button>
          <button className="btn-efx" onClick={openCreateModal}>+ Create Ticket</button>
        </div>
      </div>

      {/* Tablero */}
      <div style={{ padding: '30px', display: 'flex', gap: '20px', overflowX: 'auto', alignItems: 'flex-start' }}>
        {columns.map(status => (
          <div key={status} onDrop={(e) => handleDrop(e, status)} onDragOver={handleDragOver} style={{ width: '320px', minWidth: '320px', backgroundColor: '#e3e6e9', padding: '15px', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '0 5px' }}>
              <h3 style={{ color: '#00205B', fontSize: '14px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>{status}</h3>
              <span style={{ fontSize: '12px', color: '#5f6368', fontWeight: 'bold', backgroundColor: '#cdd1d5', padding: '2px 8px', borderRadius: '10px' }}>{filteredActiveTasks.filter(t => t.status === status).length}</span>
            </div>
           
            <div style={{ minHeight: '50px' }}>
              {filteredActiveTasks.filter(t => t.status === status).map(task => {
                const totalChecks = task.checklists?.length || 0;
                const completedChecks = task.checklists?.filter((c:any) => c.isCompleted).length || 0;
                const progress = totalChecks === 0 ? 0 : (completedChecks / totalChecks) * 100;

                return (
                  <div key={task.id} className="kanban-card" draggable onDragStart={(e) => handleDragStart(e, task.id)} onClick={() => openEditModal(task)}>
                    <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#5f6368' }}>{task.ticketId}</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'white', backgroundColor: getTagColor(task.tag), padding: '2px 6px', borderRadius: '3px' }}>{task.tag}</span>
                      </div>
                     
                      {status === 'Done' ? (
                        <button className="archive-btn" onClick={(e) => toggleArchive(e, task.id, true)}>📥</button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#5f6368', display: 'flex', gap: '8px' }}>
                          {task.history?.filter((h:any) => !h.isSystem).length > 0 && `💬 ${task.history.filter((h:any) => !h.isSystem).length}`}
                        </span>
                      )}
                    </div>
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#1D252C', fontSize: '14px', lineHeight: '1.4' }}>{task.title}</strong>
                   
                    {/* Nuevo: Muestra el proyecto en la tarjeta */}
                    {task.project && <div style={{ fontSize: '11px', color: '#5f6368', marginBottom: '8px', fontWeight: '500' }}>📦 {task.project}</div>}
                   
                    {totalChecks > 0 && (
                      <div style={{ marginBottom: '12px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#5f6368', fontWeight: '500' }}><span>Checklist</span><span>{completedChecks}/{totalChecks}</span></div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#1e8e3e' : '#1967d2' }}></div></div>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f0f2f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="avatar" title={`Assignee: ${task.assignee}`}>{task.assignee.charAt(0)}</div>
                        <div className="story-point" title="Story Points">{task.storyPoints}</div>
                      </div>
                      {task.dueDate && <span style={{ fontSize: '11px', color: '#d93025', fontWeight: 'bold' }}>📅 {task.dueDate}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Ventana del Baúl */}
      {showArchive && (
        <div className="modal-overlay" onClick={() => setShowArchive(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '650px' }}>
            <div style={{ backgroundColor: '#00205B', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '20px' }}>📥 Archived Tasks</h2>
              <button onClick={() => setShowArchive(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'white' }}>✖</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '60vh', backgroundColor: '#f4f5f7' }}>
              {archivedTasks.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#5f6368', margin: '40px 0' }}>The archive is empty.</p>
              ) : (
                archivedTasks.map(task => (
                  <div key={task.id} className="archive-row" onClick={() => openFromArchive(task)}>
                    <div style={{ flexGrow: 1 }}>
                      <strong style={{ display: 'block', color: '#1D252C', fontSize: '14px', marginBottom: '5px' }}>
                        <span style={{ color: '#5f6368', marginRight: '8px' }}>{task.ticketId}</span>
                        {task.title}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#5f6368' }}>Requestor: {task.requestor || 'None'} • Assignee: {task.assignee}</span>
                    </div>
                    <button className="btn-secondary" style={{ color: '#00205B', borderColor: '#cdd1d5', backgroundColor: '#f0f2f5' }} onClick={(e) => toggleArchive(e, task.id, false)}>
                      ⤴️ Restore
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '10px 20px', textAlign: 'right', borderTop: '1px solid #e1e4e8', backgroundColor: 'white' }}>
              <button onClick={resetCloudDatabase} style={{ background: 'none', border: 'none', color: '#EF3A47', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>⚠ Delete Cloud Database</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar Tickets */}
      {modalTask && (
        <div className="modal-overlay" onClick={() => setModalTask(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ backgroundColor: '#00205B', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '100%' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  {isCreating ? '✨ Create Ticket' : `✏️ Edit Ticket ${modalTask.ticketId}`}
                  {modalTask.isArchived && ' (ARCHIVED)'}
                </span>
                <input value={modalTask.title} onChange={e => setModalTask({...modalTask, title: e.target.value})} placeholder="Ticket Summary..." style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '22px', fontWeight: 'bold', marginTop: '5px', outline: 'none' }} />
              </div>
              <button onClick={() => setModalTask(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'white', opacity: 0.8 }}>✖</button>
            </div>
           
            <div style={{ padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
             
              {/* FILA 1: Status, Assignee, Due Date */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>STATUS</label><select className="form-input" value={modalTask.status} onChange={e => setModalTask({...modalTask, status: e.target.value})}>{columns.map(col => <option key={col} value={col}>{col}</option>)}</select></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>ASSIGNEE</label><select className="form-input" value={modalTask.assignee} onChange={e => setModalTask({...modalTask, assignee: e.target.value})}><option value="Luis">Luis</option><option value="Daniel">Daniel</option></select></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>DUE DATE</label><input className="form-input" type="date" value={modalTask.dueDate} onChange={e => setModalTask({...modalTask, dueDate: e.target.value})} /></div>
              </div>

              {/* FILA 2: Requestor y Project */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>REQUESTOR (Email/Name)</label><input className="form-input" placeholder="e.g. siddharth.shekhar@..." value={modalTask.requestor || ''} onChange={e => setModalTask({...modalTask, requestor: e.target.value})} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>PROJECT(S)</label><input className="form-input" placeholder="e.g. df-key-kls-uat-prd..." value={modalTask.project || ''} onChange={e => setModalTask({...modalTask, project: e.target.value})} /></div>
              </div>

              {/* FILA 3: Tag, Priority, Story Points */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>TAG</label><select className="form-input" value={modalTask.tag} onChange={e => setModalTask({...modalTask, tag: e.target.value})}><option value="Project">📂 Project</option><option value="Finance">💰 Finance</option><option value="Cloud">☁️ Cloud</option><option value="Meeting">📅 Meeting</option></select></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>PRIORITY</label><select className="form-input" value={modalTask.priority} onChange={e => setModalTask({...modalTask, priority: e.target.value})}><option value="High">🔴 High</option><option value="Medium">🟡 Medium</option><option value="Low">⚪ Low</option></select></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>STORY PTS</label><select className="form-input" value={modalTask.storyPoints} onChange={e => setModalTask({...modalTask, storyPoints: e.target.value})}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option><option value="8">8</option><option value="13">13</option></select></div>
              </div>

              <div className="section-box">
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>DESCRIPTION</label>
                <textarea className="form-input" rows={3} placeholder="Add detailed notes here..." value={modalTask.description} onChange={e => setModalTask({...modalTask, description: e.target.value})} style={{ marginTop: '5px' }} />
              </div>

              <div className="section-box">
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>☑ CHECKLIST</label>
                {modalTask.checklists.map((chk: any) => (
                  <div key={chk.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <input type="checkbox" checked={chk.isCompleted} onChange={() => toggleChecklist(chk.id)} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                    <span style={{ textDecoration: chk.isCompleted ? 'line-through' : 'none', color: chk.isCompleted ? '#a1a5ab' : '#1D252C', fontSize: '14px' }}>{chk.text}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <input className="form-input" placeholder="Add an item..." value={newChecklist} onChange={e => setNewChecklist(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChecklist()} />
                  <button onClick={addChecklist} style={{ padding: '8px 15px', background: '#f0f2f5', border: '1px solid #cdd1d5', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#5f6368' }}>Add</button>
                </div>
              </div>

              <div className="section-box">
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>🔗 ATTACHMENTS & LINKS</label>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  {modalTask.links.map((link: any) => (<li key={link.id} style={{ marginBottom: '5px' }}><a href={link.url} target="_blank" rel="noreferrer" style={{ color: '#1967d2', textDecoration: 'none', fontSize: '14px' }}>{link.url}</a></li>))}
                </ul>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input className="form-input" placeholder="Paste a link here..." value={newLink} onChange={e => setNewLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                  <button onClick={addLink} style={{ padding: '8px 15px', background: '#f0f2f5', border: '1px solid #cdd1d5', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: '#5f6368' }}>Add</button>
                </div>
              </div>

              <div className="section-box">
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368' }}>💬 ACTIVITY & HISTORY (Daily Notes)</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '10px', paddingRight: '10px' }}>
                  {modalTask.history.map((log: any) => (
                    <div key={log.id} style={{ marginBottom: '12px', background: log.isSystem ? 'transparent' : '#f8f9fa', padding: log.isSystem ? '5px 0' : '10px', borderRadius: '6px', borderBottom: log.isSystem ? '1px solid #e1e4e8' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12px', color: log.isSystem ? '#5f6368' : '#00205B' }}>{log.isSystem ? '🤖 ' : ''}{log.author}</strong>
                        <span style={{ fontSize: '11px', color: '#a1a5ab' }}>{log.timestamp}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: log.isSystem ? '#5f6368' : '#1D252C', margin: '5px 0 0 0', fontStyle: log.isSystem ? 'italic' : 'normal', whiteSpace: 'pre-wrap' }}>{log.text}</p>
                    </div>
                  ))}
                </div>
                {!isCreating && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <textarea className="form-input" placeholder="Type a note here (it will save with today's date and your name)..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} />
                    <button onClick={addComment} style={{ padding: '8px 15px', background: '#00205B', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e1e4e8' }}>
              {!isCreating ? <button type="button" onClick={() => deleteTask(modalTask.id)} style={{ padding: '10px 15px', background: 'white', color: '#EF3A47', border: '1px solid #EF3A47', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Delete Ticket</button> : <div></div>}
              <button type="button" onClick={handleSaveModal} className="btn-efx" style={{ padding: '10px 25px', fontSize: '14px' }}>{isCreating ? 'Create Ticket' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
