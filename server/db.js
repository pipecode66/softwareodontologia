import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'dentadoc.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL DEFAULT 'CC',
    document_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT,
    sex TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    emergency_contact TEXT,
    allergies TEXT NOT NULL DEFAULT '',
    medical_history TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS clinical_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    consultation_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    symptoms TEXT NOT NULL DEFAULT '',
    blood_pressure TEXT NOT NULL DEFAULT '',
    heart_rate TEXT NOT NULL DEFAULT '',
    diagnosis TEXT NOT NULL,
    diagnosis_code TEXT NOT NULL DEFAULT '',
    treatment TEXT NOT NULL,
    observations TEXT NOT NULL DEFAULT '',
    odontogram TEXT NOT NULL DEFAULT '{}',
    prescriptions TEXT NOT NULL DEFAULT '[]',
    next_appointment TEXT,
    status TEXT NOT NULL DEFAULT 'final',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_records_patient ON clinical_records(patient_id);
  CREATE INDEX IF NOT EXISTS idx_records_date ON clinical_records(consultation_date DESC);
`);

const adminEmail = process.env.ADMIN_EMAIL || 'admin@dentadoc.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'Cambiar123!';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
  db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(
    adminEmail,
    bcrypt.hashSync(adminPassword, 12),
    process.env.DENTIST_NAME || 'Odontólogo/a responsable'
  );
}

export const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

export function patientWithRecords(id) {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!patient) return null;
  patient.records = db.prepare('SELECT * FROM clinical_records WHERE patient_id = ? ORDER BY consultation_date DESC, id DESC').all(id)
    .map(record => ({ ...record, odontogram: parseJson(record.odontogram, {}), prescriptions: parseJson(record.prescriptions, []) }));
  return patient;
}
