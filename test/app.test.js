import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'clave-de-pruebas-dentadoc-1234567890';
const { default: app } = await import('../server/index.js');

test('flujo autenticado: crear historia, consultarla y descargar PDF', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dentadoc.local', password: 'Cambiar123!' })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const unique = String(Date.now());
  const create = await fetch(`${base}/api/records`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      patient: { document_type:'CC', document_number:unique, first_name:'Paciente', last_name:'Prueba', birth_date:'1990-01-01', sex:'', phone:'', email:'', address:'', emergency_contact:'', allergies:'No refiere', medical_history:'No refiere' },
      consultation_date:'2026-10-07', reason:'Dolor dental de prueba', symptoms:'Dolor localizado', blood_pressure:'120/80', heart_rate:'72', diagnosis:'Caries dental', diagnosis_code:'K02.9', treatment:'Restauración en resina', observations:'Control en seis meses', odontogram:{'16':'caries'}, prescriptions:[], next_appointment:null, status:'final'
    })
  });
  const createdBody = await create.json();
  assert.equal(create.status, 201, JSON.stringify(createdBody));
  const { id } = createdBody;
  const detail = await fetch(`${base}/api/records/${id}`, { headers:{ cookie } });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).diagnosis, 'Caries dental');
  const pdf = await fetch(`${base}/api/records/${id}/pdf`, { headers:{ cookie } });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0,4)), '%PDF');
});
