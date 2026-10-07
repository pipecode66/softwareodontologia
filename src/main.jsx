import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, ClipboardPlus,
  Download, FileText, HeartPulse, LayoutDashboard, LogOut, Menu, Plus, Save, Search,
  ShieldCheck, Stethoscope, UserRound, Users, X
} from 'lucide-react';
import './styles.css';

function Tooth(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M12 5.1C9.9 2.8 6.2 2.6 4.4 5.2c-2.2 3.2.1 7.3 1.2 10.7.6 2 1.1 4.1 2.5 4.1 1.7 0 1.4-5.8 3.9-5.8s2.2 5.8 3.9 5.8c1.4 0 1.9-2.1 2.5-4.1 1.1-3.4 3.4-7.5 1.2-10.7C17.8 2.6 14.1 2.8 12 5.1Z"/><path d="M12 5.1c1.2 1.1 2.4 1.2 3.7.6"/></svg>;
}

const today = new Date().toISOString().slice(0, 10);
const emptyPatient = { document_type:'CC', document_number:'', first_name:'', last_name:'', birth_date:'', sex:'', phone:'', email:'', address:'', emergency_contact:'', allergies:'', medical_history:'' };
const emptyRecord = { consultation_date:today, reason:'', symptoms:'', blood_pressure:'', heart_rate:'', diagnosis:'', diagnosis_code:'', treatment:'', observations:'', odontogram:{}, prescriptions:[], next_appointment:'', status:'final' };

async function api(url, options = {}) {
  const response = await fetch(url, { credentials:'same-origin', headers:{ 'Content-Type':'application/json', ...(options.headers || {}) }, ...options });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
  return data;
}

function Brand({ compact=false }) {
  return <div className="brand"><div className="brand-mark"><Tooth size={25}/></div>{!compact && <div><strong>DentaDoc</strong><span>Historia clínica</span></div>}</div>;
}

function Toast({ toast, close }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type || ''}`}><CheckCircle2 size={19}/><span>{toast.message}</span><button onClick={close}><X size={16}/></button></div>;
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email:'', password:'' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e){ e.preventDefault(); setBusy(true); setError(''); try { onLogin(await api('/api/auth/login',{method:'POST',body:JSON.stringify(form)})); } catch(err){setError(err.message)} finally{setBusy(false)} }
  return <main className="login-page">
    <section className="login-card">
      <div className="login-form">
        <Brand/><div className="login-copy"><span className="eyebrow">Acceso privado</span><h1>Consultorio digital</h1><p>Historias clínicas odontológicas claras, seguras y listas para entregar.</p></div>
        <form onSubmit={submit}>
          <label>Correo profesional<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required autoComplete="username" placeholder="nombre@consultorio.com" autoFocus/></label>
          <label>Contraseña<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required autoComplete="current-password" placeholder="Ingresa tu contraseña"/></label>
          {error && <div className="form-error"><AlertCircle size={17}/>{error}</div>}
          <button className="button primary wide" disabled={busy}><ShieldCheck size={19}/>{busy?'Validando…':'Ingresar al consultorio'}</button>
        </form>
      </div>
    </section>
  </main>;
}

const navItems = [
  ['dashboard','Resumen',LayoutDashboard], ['patients','Pacientes',Users], ['new','Nueva historia',ClipboardPlus]
];
function Shell({ session, page, setPage, onLogout, children }) {
  const [mobile, setMobile] = useState(false);
  return <div className="app-shell">
    <aside className={`sidebar ${mobile?'open':''}`}><div><div className="side-brand"><Brand/><button className="icon-button mobile-only" onClick={()=>setMobile(false)}><X/></button></div><span className="nav-label">Gestión clínica</span><nav>{navItems.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={20}/>{label}</button>)}</nav></div><div className="sidebar-foot"><div className="sync"><span/><div><b>Base local activa</b><small>Datos guardados en este equipo</small></div></div><button onClick={onLogout}><LogOut size={18}/>Cerrar sesión</button></div></aside>
    <div className="workspace"><header className="topbar"><button className="icon-button mobile-only" onClick={()=>setMobile(true)}><Menu/></button><div className="clinic-title"><b>{session.clinic.name}</b><span>{session.clinic.license}</span></div><div className="profile"><div><b>{session.user.name}</b><span>Profesional tratante</span></div><span className="avatar"><UserRound size={19}/></span></div></header><div className="page-content">{children}</div></div>
  </div>;
}

function Stat({ icon:Icon, label, value, tone }) { return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon/></span><div><span>{label}</span><strong>{value}</strong></div></div> }

function Dashboard({ go, openRecord }) {
  const [data,setData]=useState(null); useEffect(()=>{api('/api/dashboard').then(setData)},[]);
  if(!data) return <Loading/>;
  return <><div className="hero"><div><span className="eyebrow">Panel clínico</span><h1>Historias clínicas</h1><p>Una vista rápida de los pacientes y documentos registrados.</p></div><button className="button primary" onClick={()=>go('new')}><Plus size={19}/>Nueva historia</button></div>
    <div className="stats"><Stat icon={Users} label="Pacientes" value={data.stats.patients} tone="teal"/><Stat icon={FileText} label="Historias" value={data.stats.records} tone="blue"/><Stat icon={Activity} label="Consultas este mes" value={data.stats.month} tone="purple"/></div>
    <section className="panel"><div className="panel-head"><div><h2>Actividad reciente</h2><p>Últimos registros clínicos guardados</p></div><button className="button subtle" onClick={()=>go('patients')}>Ver pacientes <ChevronRight size={17}/></button></div>{data.recent.length?<div className="record-list">{data.recent.map(r=><button className="record-row" key={r.id} onClick={()=>openRecord(r.id)}><span className="patient-initial">{r.first_name[0]}{r.last_name[0]}</span><span className="record-person"><b>{r.first_name} {r.last_name}</b><small>{r.document_number} · {r.folio}</small></span><span className="record-diagnosis"><b>{r.diagnosis}</b><small>{new Date(r.consultation_date+'T12:00:00').toLocaleDateString('es-CO',{dateStyle:'medium'})}</small></span><span className={`status ${r.status}`}>{r.status==='draft'?'Borrador':'Finalizada'}</span><ChevronRight size={18}/></button>)}</div>:<Empty icon={FileText} title="Aún no hay historias" text="Crea el primer registro clínico para comenzar." action={()=>go('new')}/>}</section></>;
}

function Patients({ startForPatient, openRecord }) {
  const [rows,setRows]=useState([]),[q,setQ]=useState(''),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{const timer=setTimeout(()=>{setLoading(true);api('/api/patients?q='+encodeURIComponent(q)).then(setRows).finally(()=>setLoading(false))},180);return()=>clearTimeout(timer)},[q]);
  async function select(id){setSelected(await api('/api/patients/'+id))}
  return <><div className="hero compact"><div><span className="eyebrow">Directorio</span><h1>Pacientes</h1><p>Busca una persona y consulta su historial completo.</p></div><button className="button primary" onClick={()=>startForPatient(null)}><Plus size={19}/>Registrar historia</button></div>
    <div className="searchbox"><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre o documento…"/></div>
    <section className="panel">{loading?<Loading/>:rows.length?<div className="patient-grid">{rows.map(p=><button key={p.id} className="patient-card" onClick={()=>select(p.id)}><span className="patient-initial large">{p.first_name[0]}{p.last_name[0]}</span><span><b>{p.first_name} {p.last_name}</b><small>{p.document_type} {p.document_number}</small></span><span className="patient-meta"><b>{p.record_count}</b><small>historias</small></span><ChevronRight/></button>)}</div>:<Empty icon={Users} title="No encontramos pacientes" text="Intenta otra búsqueda o registra una nueva historia." action={()=>startForPatient(null)}/>}</section>
    {selected&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><section className="drawer"><div className="drawer-head"><div><span className="eyebrow">Expediente</span><h2>{selected.first_name} {selected.last_name}</h2><p>{selected.document_type} {selected.document_number} · {selected.phone||'Sin teléfono'}</p></div><button className="icon-button" onClick={()=>setSelected(null)}><X/></button></div><div className="clinical-alerts"><span><b>Alergias</b>{selected.allergies||'No refiere'}</span><span><b>Antecedentes</b>{selected.medical_history||'No refiere'}</span></div><button className="button primary wide" onClick={()=>startForPatient(selected)}><Plus size={18}/>Nueva historia para este paciente</button><h3>Historial clínico</h3>{selected.records.length?<div className="timeline">{selected.records.map(r=><button key={r.id} onClick={()=>openRecord(r.id)}><i/><span><b>{r.diagnosis}</b><small>{new Date(r.consultation_date+'T12:00:00').toLocaleDateString('es-CO',{dateStyle:'long'})} · {r.folio}</small></span><ChevronRight/></button>)}</div>:<p className="muted">No hay consultas registradas.</p>}</section></div>}
  </>;
}

const teeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const toothStatuses = { sano:'Sano', caries:'Caries', obturacion:'Obturación', endodoncia:'Endodoncia', corona:'Corona', ausente:'Ausente', implante:'Implante' };
function Odontogram({ value, onChange }) {
  const [tool,setTool]=useState('caries');
  return <div className="odontogram"><div className="tooth-tools">{Object.entries(toothStatuses).map(([id,label])=><button type="button" key={id} onClick={()=>setTool(id)} className={`${id} ${tool===id?'selected':''}`}><i/>{label}</button>)}</div><div className="arch"><span>Arcada superior</span><div className="teeth">{teeth.slice(0,16).map(n=><button type="button" key={n} title={`Pieza ${n}: ${toothStatuses[value[n]||'sano']}`} className={value[n]||'sano'} onClick={()=>onChange({...value,[n]:tool})}><Tooth/><small>{n}</small></button>)}</div><div className="midline">Plano oclusal · Nomenclatura FDI</div><div className="teeth">{teeth.slice(16).map(n=><button type="button" key={n} title={`Pieza ${n}: ${toothStatuses[value[n]||'sano']}`} className={value[n]||'sano'} onClick={()=>onChange({...value,[n]:tool})}><Tooth/><small>{n}</small></button>)}</div><span>Arcada inferior</span></div></div>;
}

function Field({ label, children, className='' }) { return <label className={`field ${className}`}><span>{label}</span>{children}</label> }
function Input({ value, onChange, ...props }) { return <input value={value??''} onChange={e=>onChange(e.target.value)} {...props}/> }
function TextArea({ value, onChange, ...props }) { return <textarea value={value??''} onChange={e=>onChange(e.target.value)} {...props}/> }

function RecordForm({ initialPatient, onSaved, notify }) {
  const draft = useMemo(()=>{try{return JSON.parse(localStorage.getItem('dentadoc_draft'))}catch{return null}},[]);
  const [patient,setPatient]=useState(initialPatient?Object.fromEntries(Object.keys(emptyPatient).map(k=>[k,initialPatient[k]||''])):(draft?.patient||emptyPatient));
  const [record,setRecord]=useState(draft?.record||emptyRecord); const [busy,setBusy]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>localStorage.setItem('dentadoc_draft',JSON.stringify({patient,record})),400);return()=>clearTimeout(t)},[patient,record]);
  const pf=(key,val)=>setPatient(p=>({...p,[key]:val})); const rf=(key,val)=>setRecord(r=>({...r,[key]:val}));
  function addPrescription(){rf('prescriptions',[...record.prescriptions,{name:'',dose:'',instructions:''}])}
  function updatePrescription(index,key,value){rf('prescriptions',record.prescriptions.map((p,i)=>i===index?{...p,[key]:value}:p))}
  async function save(e, status='final'){e.preventDefault();setBusy(true);try{const payload={...record,status,patient_id:initialPatient?.id,patient};const result=await api('/api/records',{method:'POST',body:JSON.stringify(payload)});localStorage.removeItem('dentadoc_draft');notify(status==='draft'?'Borrador guardado.':'Historia clínica guardada.');onSaved(result.id)}catch(err){notify(err.message,'error')}finally{setBusy(false)}}
  return <form className="clinical-form" onSubmit={save}><div className="form-hero"><div><span className="eyebrow">Ficha operatoria</span><h1>Registro de evolución clínica</h1><p>Completa la información relevante de la consulta.</p></div><div className="vitals"><HeartPulse/><Field label="P.A."><Input placeholder="120/80" value={record.blood_pressure} onChange={v=>rf('blood_pressure',v)}/></Field><Field label="F.C."><Input placeholder="72 lpm" value={record.heart_rate} onChange={v=>rf('heart_rate',v)}/></Field></div></div>
    <section className="form-section"><div className="section-title"><span><UserRound/></span><div><h2>Datos del paciente</h2><p>Identificación y antecedentes generales</p></div></div><div className="form-grid cols-4"><Field label="Tipo de documento"><select value={patient.document_type} onChange={e=>pf('document_type',e.target.value)}><option>CC</option><option>CE</option><option>TI</option><option>Pasaporte</option></select></Field><Field label="Número de documento"><Input required value={patient.document_number} onChange={v=>pf('document_number',v)}/></Field><Field label="Nombres"><Input required value={patient.first_name} onChange={v=>pf('first_name',v)}/></Field><Field label="Apellidos"><Input required value={patient.last_name} onChange={v=>pf('last_name',v)}/></Field><Field label="Fecha de nacimiento"><Input type="date" value={patient.birth_date} onChange={v=>pf('birth_date',v)}/></Field><Field label="Sexo"><select value={patient.sex} onChange={e=>pf('sex',e.target.value)}><option value="">Seleccionar</option><option>Femenino</option><option>Masculino</option><option>Otro</option><option>Prefiere no indicar</option></select></Field><Field label="Teléfono"><Input value={patient.phone} onChange={v=>pf('phone',v)}/></Field><Field label="Correo"><Input type="email" value={patient.email} onChange={v=>pf('email',v)}/></Field><Field label="Alergias" className="span-2"><Input placeholder="No refiere" value={patient.allergies} onChange={v=>pf('allergies',v)}/></Field><Field label="Antecedentes médicos" className="span-2"><Input placeholder="Patologías, medicación, cirugías…" value={patient.medical_history} onChange={v=>pf('medical_history',v)}/></Field></div></section>
    <section className="form-section"><div className="section-title"><span><Stethoscope/></span><div><h2>Consulta y diagnóstico</h2><p>Hallazgos que sustentan la atención</p></div></div><div className="form-grid cols-3"><Field label="Fecha de atención"><Input type="date" required value={record.consultation_date} onChange={v=>rf('consultation_date',v)}/></Field><Field label="Código diagnóstico"><Input placeholder="Ej. K02.9" value={record.diagnosis_code} onChange={v=>rf('diagnosis_code',v)}/></Field><Field label="Diagnóstico principal"><Input required placeholder="Diagnóstico odontológico" value={record.diagnosis} onChange={v=>rf('diagnosis',v)}/></Field><Field label="Motivo de consulta" className="span-3"><TextArea required rows="3" value={record.reason} onChange={v=>rf('reason',v)}/></Field><Field label="Síntomas y evolución" className="span-3"><TextArea rows="3" value={record.symptoms} onChange={v=>rf('symptoms',v)}/></Field></div></section>
    <section className="form-section"><div className="section-title"><span><Tooth/></span><div><h2>Odontograma digital</h2><p>Elige una condición y luego marca las piezas</p></div></div><Odontogram value={record.odontogram} onChange={v=>rf('odontogram',v)}/></section>
    <section className="form-section"><div className="section-title"><span><ClipboardPlus/></span><div><h2>Tratamiento y plan</h2><p>Procedimientos, indicaciones y seguimiento</p></div></div><div className="form-grid cols-2"><Field label="Procedimiento / tratamiento realizado" className="span-2"><TextArea required rows="5" value={record.treatment} onChange={v=>rf('treatment',v)}/></Field><Field label="Observaciones y recomendaciones" className="span-2"><TextArea rows="4" value={record.observations} onChange={v=>rf('observations',v)}/></Field><Field label="Próximo control"><Input type="datetime-local" value={record.next_appointment} onChange={v=>rf('next_appointment',v)}/></Field></div><div className="prescriptions"><div className="subhead"><div><h3>Prescripción</h3><p>Opcional. Añade medicamentos e indicaciones.</p></div><button className="button subtle" type="button" onClick={addPrescription}><Plus size={17}/>Añadir medicamento</button></div>{record.prescriptions.map((p,i)=><div className="prescription-row" key={i}><Input placeholder="Medicamento" value={p.name} onChange={v=>updatePrescription(i,'name',v)}/><Input placeholder="Dosis / presentación" value={p.dose} onChange={v=>updatePrescription(i,'dose',v)}/><Input placeholder="Indicaciones" value={p.instructions} onChange={v=>updatePrescription(i,'instructions',v)}/><button type="button" className="icon-button danger" onClick={()=>rf('prescriptions',record.prescriptions.filter((_,x)=>x!==i))}><X/></button></div>)}</div></section>
    <div className="sticky-actions"><span><Save size={17}/>Borrador automático en este navegador</span><div><button type="button" className="button secondary" disabled={busy} onClick={e=>save(e,'draft')}>Guardar borrador</button><button className="button primary" disabled={busy}><FileText size={18}/>{busy?'Guardando…':'Guardar historia'}</button></div></div>
  </form>;
}

function RecordDetail({ id, back }) {
  const [r,setR]=useState(null); useEffect(()=>{api('/api/records/'+id).then(setR)},[id]); if(!r)return <Loading/>;
  const marked=Object.entries(r.odontogram).filter(([,v])=>v!=='sano');
  return <><div className="detail-toolbar"><button className="button subtle" onClick={back}><ArrowLeft size={18}/>Volver</button><a className="button primary" href={`/api/records/${id}/pdf`}><Download size={18}/>Descargar PDF</a></div><article className="document-preview"><header><Brand/><div><span>Historia clínica</span><b>{r.folio}</b></div></header><h1>Historia clínica odontológica</h1><div className="document-patient"><div><span>Paciente</span><b>{r.first_name} {r.last_name}</b></div><div><span>Documento</span><b>{r.document_type} {r.document_number}</b></div><div><span>Fecha</span><b>{new Date(r.consultation_date+'T12:00:00').toLocaleDateString('es-CO',{dateStyle:'long'})}</b></div><div><span>Alergias</span><b>{r.allergies||'No refiere'}</b></div></div><DocumentSection n="1" title="Motivo de consulta"><p>{r.reason}</p>{r.symptoms&&<p><b>Síntomas:</b> {r.symptoms}</p>}</DocumentSection><DocumentSection n="2" title="Diagnóstico"><p>{r.diagnosis_code&&<span className="code">{r.diagnosis_code}</span>} {r.diagnosis}</p></DocumentSection><DocumentSection n="3" title="Tratamiento realizado"><p>{r.treatment}</p></DocumentSection>{marked.length>0&&<DocumentSection n="4" title="Odontograma"><div className="tooth-summary">{marked.map(([t,s])=><span key={t}><b>{t}</b>{toothStatuses[s]}</span>)}</div></DocumentSection>}{r.prescriptions.length>0&&<DocumentSection n="5" title="Prescripción"><ol>{r.prescriptions.map((p,i)=><li key={i}><b>{p.name} {p.dose}</b><br/>{p.instructions}</li>)}</ol></DocumentSection>}{r.observations&&<DocumentSection n="6" title="Observaciones"><p>{r.observations}</p></DocumentSection>}<footer><div/><p><b>Profesional tratante</b><br/>Documento generado en DentaDoc</p></footer></article></>;
}
function DocumentSection({n,title,children}){return <section className="document-section"><h2><span>{n}</span>{title}</h2>{children}</section>}
function Empty({icon:Icon,title,text,action}){return <div className="empty"><span><Icon/></span><h3>{title}</h3><p>{text}</p><button className="button primary" onClick={action}><Plus size={17}/>Crear registro</button></div>}
function Loading(){return <div className="loading"><span/><p>Cargando información clínica…</p></div>}

function App(){
  const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[page,setPage]=useState('dashboard'),[patient,setPatient]=useState(null),[recordId,setRecordId]=useState(null),[toast,setToast]=useState(null);
  useEffect(()=>{api('/api/auth/me').then(setSession).catch(()=>{}).finally(()=>setChecking(false))},[]);
  function notify(message,type=''){setToast({message,type});setTimeout(()=>setToast(null),3500)}
  function go(next){setRecordId(null);setPatient(null);setPage(next)}
  function newFor(p){setPatient(p);setRecordId(null);setPage('new')}
  function openRecord(id){setRecordId(id);setPage('detail')}
  async function logout(){await api('/api/auth/logout',{method:'POST'});setSession(null)}
  if(checking)return <Loading/>; if(!session)return <Login onLogin={setSession}/>;
  return <Shell session={session} page={page} setPage={go} onLogout={logout}><Toast toast={toast} close={()=>setToast(null)}/>{page==='dashboard'&&<Dashboard go={go} openRecord={openRecord}/>} {page==='patients'&&<Patients startForPatient={newFor} openRecord={openRecord}/>} {page==='new'&&<RecordForm key={patient?.id||'new'} initialPatient={patient} notify={notify} onSaved={openRecord}/>} {page==='detail'&&<RecordDetail id={recordId} back={()=>go('dashboard')}/>}</Shell>
}

createRoot(document.getElementById('root')).render(<App/>);
