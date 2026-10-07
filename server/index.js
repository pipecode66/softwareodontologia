import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, parseJson, patientWithRecords } from './db.js';
import { createClinicalPdf } from './pdf.js';

const app = express();
const port = Number(process.env.PORT || 4173);
const secretText = process.env.JWT_SECRET || 'desarrollo-local-cambiar-esta-clave-32';
const secret = new TextEncoder().encode(secretText);
const here = path.dirname(fileURLToPath(import.meta.url));
const clinic = {
  name: process.env.CLINIC_NAME || 'Consultorio Odontológico',
  dentist: process.env.DENTIST_NAME || 'Odontólogo/a responsable',
  license: process.env.DENTIST_LICENSE || 'Registro profesional'
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

async function issueToken(user) {
  return new SignJWT({ name: user.name }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id)).setIssuedAt().setExpirationTime('8h').sign(secret);
}

async function requireAuth(req, res, next) {
  try {
    const { payload } = await jwtVerify(req.cookies.dentadoc_session, secret);
    req.user = { id: Number(payload.sub), name: payload.name };
    next();
  } catch { res.status(401).json({ error: 'Sesión no válida o vencida.' }); }
}

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Verifica el correo y la contraseña.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(input.data.email.toLowerCase());
  if (!user || !bcrypt.compareSync(input.data.password, user.password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas.' });
  const token = await issueToken(user);
  res.cookie('dentadoc_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 });
  res.json({ user: { id: user.id, name: user.name, email: user.email }, clinic });
});

app.post('/api/auth/logout', (_req, res) => { res.clearCookie('dentadoc_session'); res.status(204).end(); });
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
  res.json({ user, clinic });
});

app.get('/api/dashboard', requireAuth, (_req, res) => {
  const patients = db.prepare('SELECT COUNT(*) total FROM patients').get().total;
  const records = db.prepare('SELECT COUNT(*) total FROM clinical_records').get().total;
  const month = db.prepare("SELECT COUNT(*) total FROM clinical_records WHERE consultation_date >= date('now','start of month')").get().total;
  const recent = db.prepare(`SELECT r.id, r.folio, r.consultation_date, r.diagnosis, r.status, p.first_name, p.last_name, p.document_number
    FROM clinical_records r JOIN patients p ON p.id=r.patient_id ORDER BY r.consultation_date DESC, r.id DESC LIMIT 6`).all();
  res.json({ stats: { patients, records, month }, recent });
});

app.get('/api/patients', requireAuth, (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = db.prepare(`SELECT p.*, COUNT(r.id) record_count, MAX(r.consultation_date) last_visit
    FROM patients p LEFT JOIN clinical_records r ON r.patient_id=p.id
    WHERE p.first_name LIKE ? OR p.last_name LIKE ? OR p.document_number LIKE ?
    GROUP BY p.id ORDER BY COALESCE(last_visit, p.created_at) DESC`).all(q, q, q);
  res.json(rows);
});
app.get('/api/patients/:id', requireAuth, (req, res) => {
  const patient = patientWithRecords(Number(req.params.id));
  patient ? res.json(patient) : res.status(404).json({ error: 'Paciente no encontrado.' });
});

const patientSchema = z.object({
  document_type: z.string().min(1).max(10).default('CC'), document_number: z.string().min(4).max(30),
  first_name: z.string().min(2).max(80), last_name: z.string().min(2).max(80), birth_date: z.string().optional().default(''),
  sex: z.string().max(30).optional().default(''), phone: z.string().max(30).optional().default(''), email: z.union([z.string().email(), z.literal('')]).optional().default(''),
  address: z.string().max(200).optional().default(''), emergency_contact: z.string().max(150).optional().default(''),
  allergies: z.string().max(1000).optional().default(''), medical_history: z.string().max(5000).optional().default('')
});

app.post('/api/patients', requireAuth, (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Los datos del paciente están incompletos.', details: parsed.error.flatten() });
  try {
    const p = parsed.data;
    const result = db.prepare(`INSERT INTO patients (document_type,document_number,first_name,last_name,birth_date,sex,phone,email,address,emergency_contact,allergies,medical_history)
      VALUES (@document_type,@document_number,@first_name,@last_name,@birth_date,@sex,@phone,@email,@address,@emergency_contact,@allergies,@medical_history)`).run(p);
    res.status(201).json(patientWithRecords(result.lastInsertRowid));
  } catch (error) { res.status(409).json({ error: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Ya existe un paciente con ese documento.' : 'No se pudo registrar el paciente.' }); }
});

const recordSchema = z.object({
  patient_id: z.number().int().positive().optional(), patient: patientSchema.optional(), consultation_date: z.string().min(10),
  reason: z.string().min(3).max(3000), symptoms: z.string().max(5000).optional().default(''), blood_pressure: z.string().max(20).optional().default(''),
  heart_rate: z.string().max(20).optional().default(''), diagnosis: z.string().min(3).max(5000), diagnosis_code: z.string().max(30).optional().default(''),
  treatment: z.string().min(3).max(8000), observations: z.string().max(8000).optional().default(''), odontogram: z.record(z.string(), z.string()).optional().default({}),
  prescriptions: z.array(z.object({ name: z.string().min(1).max(150), dose: z.string().max(100).optional().default(''), instructions: z.string().max(500).optional().default('') })).max(20).optional().default([]),
  next_appointment: z.string().optional().nullable(), status: z.enum(['draft','final']).default('final')
}).refine(value => value.patient_id || value.patient, { message: 'Selecciona o registra un paciente.' });

app.post('/api/records', requireAuth, (req, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Completa los campos clínicos obligatorios.', details: parsed.error.flatten() });
  try {
    const result = db.transaction(data => {
      let patientId = data.patient_id;
      if (!patientId) {
        const existing = db.prepare('SELECT id FROM patients WHERE document_number=?').get(data.patient.document_number);
        if (existing) {
          patientId = existing.id;
          db.prepare(`UPDATE patients SET document_type=@document_type,first_name=@first_name,last_name=@last_name,birth_date=@birth_date,sex=@sex,phone=@phone,email=@email,address=@address,emergency_contact=@emergency_contact,allergies=@allergies,medical_history=@medical_history,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...data.patient, id: patientId });
        } else {
          patientId = db.prepare(`INSERT INTO patients (document_type,document_number,first_name,last_name,birth_date,sex,phone,email,address,emergency_contact,allergies,medical_history) VALUES (@document_type,@document_number,@first_name,@last_name,@birth_date,@sex,@phone,@email,@address,@emergency_contact,@allergies,@medical_history)`).run(data.patient).lastInsertRowid;
        }
      }
      const insert = db.prepare(`INSERT INTO clinical_records (patient_id,consultation_date,reason,symptoms,blood_pressure,heart_rate,diagnosis,diagnosis_code,treatment,observations,odontogram,prescriptions,next_appointment,status,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(patientId,data.consultation_date,data.reason,data.symptoms,data.blood_pressure,data.heart_rate,data.diagnosis,data.diagnosis_code,data.treatment,data.observations,JSON.stringify(data.odontogram),JSON.stringify(data.prescriptions),data.next_appointment || null,data.status,req.user.id);
      const folio = `HC-${new Date().getFullYear()}-${String(insert.lastInsertRowid).padStart(5,'0')}`;
      db.prepare('UPDATE clinical_records SET folio=? WHERE id=?').run(folio, insert.lastInsertRowid);
      db.prepare('INSERT INTO audit_log (user_id,action,entity_type,entity_id) VALUES (?,?,?,?)').run(req.user.id,'create','clinical_record',insert.lastInsertRowid);
      return insert.lastInsertRowid;
    })(parsed.data);
    res.status(201).json({ id: Number(result) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'No se pudo guardar la historia clínica.' }); }
});

function getRecord(id) {
  const row = db.prepare(`SELECT r.*, p.document_type,p.document_number,p.first_name,p.last_name,p.birth_date,p.sex,p.phone,p.email,p.address,p.emergency_contact,p.allergies,p.medical_history
    FROM clinical_records r JOIN patients p ON p.id=r.patient_id WHERE r.id=?`).get(id);
  return row ? { ...row, odontogram: parseJson(row.odontogram, {}), prescriptions: parseJson(row.prescriptions, []) } : null;
}
app.get('/api/records/:id', requireAuth, (req, res) => { const record=getRecord(Number(req.params.id)); record ? res.json(record) : res.status(404).json({error:'Historia no encontrada.'}); });
app.get('/api/records/:id/pdf', requireAuth, (req, res) => {
  const record = getRecord(Number(req.params.id));
  if (!record) return res.status(404).json({ error: 'Historia no encontrada.' });
  const patient = Object.fromEntries(['document_type','document_number','first_name','last_name','birth_date','sex','phone','email','address','emergency_contact','allergies','medical_history'].map(key => [key, record[key]]));
  const doc = createClinicalPdf(record, patient, clinic);
  const safeName = `${record.folio}-${patient.first_name}-${patient.last_name}`.replace(/[^a-zA-Z0-9-_]/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  doc.pipe(res); doc.end();
  db.prepare('INSERT INTO audit_log (user_id,action,entity_type,entity_id) VALUES (?,?,?,?)').run(req.user.id,'download_pdf','clinical_record',record.id);
});

app.use(express.static(path.resolve(here, '../dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.resolve(here, '../dist/index.html'));
  next();
});

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`DentaDoc disponible en http://localhost:${port}`));
export default app;
