import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

let clinicId = null;

function ensureClient() {
  if (!supabase) throw new Error('El servicio clínico aún no está configurado.');
}

function normalizeError(error) {
  if (!error) return new Error('No fue posible completar la operación.');
  if (error.message === 'Invalid login credentials') return new Error('Correo o contraseña incorrectos.');
  if (error.message?.includes('Email not confirmed')) return new Error('El correo profesional aún no ha sido confirmado.');
  return new Error(error.message || 'No fue posible completar la operación.');
}

async function context() {
  ensureClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sesión no válida o vencida.');
  const { data: bootstrappedClinic, error: bootstrapError } = await supabase.rpc('bootstrap_current_user');
  if (bootstrapError) throw normalizeError(bootstrapError);
  clinicId = bootstrappedClinic;
  const [{ data: profile, error: profileError }, { data: clinic, error: clinicError }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', authData.user.id).single(),
    supabase.from('clinics').select('id,name,dentist_name,professional_license').eq('id', clinicId).single()
  ]);
  if (profileError || clinicError) throw normalizeError(profileError || clinicError);
  return {
    user: { id: authData.user.id, email: authData.user.email, name: profile.full_name || clinic.dentist_name },
    clinic: { id: clinic.id, name: clinic.name, dentist: clinic.dentist_name, license: clinic.professional_license }
  };
}

async function ensureClinic() {
  if (!clinicId) await context();
  return clinicId;
}

export async function dataApi(url, options = {}) {
  ensureClient();
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;

  if (url === '/api/auth/login' && method === 'POST') {
    const { error } = await supabase.auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
    if (error) throw normalizeError(error);
    return context();
  }
  if (url === '/api/auth/logout' && method === 'POST') {
    const { error } = await supabase.auth.signOut();
    clinicId = null;
    if (error) throw normalizeError(error);
    return null;
  }
  if (url === '/api/auth/me') return context();

  const activeClinic = await ensureClinic();
  if (url === '/api/dashboard') {
    const start = new Date(); start.setDate(1); const monthStart = start.toISOString().slice(0, 10);
    const [patientsResult, recordsResult, monthResult, recentResult] = await Promise.all([
      supabase.from('patients').select('*', { count:'exact', head:true }).eq('clinic_id', activeClinic),
      supabase.from('clinical_records').select('*', { count:'exact', head:true }).eq('clinic_id', activeClinic),
      supabase.from('clinical_records').select('*', { count:'exact', head:true }).eq('clinic_id', activeClinic).gte('consultation_date', monthStart),
      supabase.from('clinical_records').select('id,folio,consultation_date,diagnosis,status,patients(first_name,last_name,document_number)').eq('clinic_id', activeClinic).order('consultation_date',{ascending:false}).limit(6)
    ]);
    const error = patientsResult.error || recordsResult.error || monthResult.error || recentResult.error;
    if (error) throw normalizeError(error);
    return { stats:{ patients:patientsResult.count||0, records:recordsResult.count||0, month:monthResult.count||0 }, recent:(recentResult.data||[]).map(row=>({...row,...row.patients,patients:undefined})) };
  }

  if (url.startsWith('/api/patients?')) {
    const q = new URLSearchParams(url.split('?')[1]).get('q')?.trim() || '';
    let query = supabase.from('patients').select('*,clinical_records(id,consultation_date)').eq('clinic_id', activeClinic).order('updated_at',{ascending:false});
    if (q) query = query.or(`first_name.ilike.%${q.replace(/[,%()]/g,'')}%,last_name.ilike.%${q.replace(/[,%()]/g,'')}%,document_number.ilike.%${q.replace(/[,%()]/g,'')}%`);
    const { data, error } = await query;
    if (error) throw normalizeError(error);
    return data.map(patient => ({ ...patient, record_count:patient.clinical_records.length, last_visit:patient.clinical_records.map(r=>r.consultation_date).sort().at(-1), clinical_records:undefined }));
  }

  const patientMatch = url.match(/^\/api\/patients\/([\w-]+)$/);
  if (patientMatch) {
    const { data, error } = await supabase.from('patients').select('*,clinical_records(*)').eq('clinic_id',activeClinic).eq('id',patientMatch[1]).single();
    if (error) throw normalizeError(error);
    return { ...data, records:(data.clinical_records||[]).sort((a,b)=>b.consultation_date.localeCompare(a.consultation_date)), clinical_records:undefined };
  }

  if (url === '/api/records' && method === 'POST') {
    let patientId = body.patient_id;
    if (!patientId) {
      const patientPayload = { ...body.patient, clinic_id:activeClinic, birth_date:body.patient.birth_date || null };
      const { data:existing } = await supabase.from('patients').select('id').eq('clinic_id',activeClinic).eq('document_number',body.patient.document_number).maybeSingle();
      if (existing) {
        patientId = existing.id;
        const { error } = await supabase.from('patients').update(patientPayload).eq('id',patientId);
        if (error) throw normalizeError(error);
      } else {
        const { data, error } = await supabase.from('patients').insert(patientPayload).select('id').single();
        if (error) throw normalizeError(error); patientId = data.id;
      }
    }
    const { data:authData } = await supabase.auth.getUser();
    const recordPayload = { ...body, patient_id:patientId, clinic_id:activeClinic, created_by:authData.user.id, next_appointment:body.next_appointment || null };
    delete recordPayload.patient;
    const { data, error } = await supabase.from('clinical_records').insert(recordPayload).select('id').single();
    if (error) throw normalizeError(error);
    await supabase.from('audit_log').insert({ clinic_id:activeClinic, action:'create', entity_type:'clinical_record', entity_id:data.id });
    return data;
  }

  const recordMatch = url.match(/^\/api\/records\/([\w-]+)$/);
  if (recordMatch) {
    const { data, error } = await supabase.from('clinical_records').select('*,patients(*)').eq('clinic_id',activeClinic).eq('id',recordMatch[1]).single();
    if (error) throw normalizeError(error);
    return { ...data, ...data.patients, patients:undefined };
  }
  throw new Error('Operación no disponible.');
}
