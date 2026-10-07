import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClinicalPdf } from '../src/clinicalPdf.js';

test('genera una historia clínica PDF válida', () => {
  const pdf = buildClinicalPdf({
    folio:'HC-2026-ABC123', first_name:'Paciente', last_name:'Validación', document_type:'CC', document_number:'123456',
    consultation_date:'2026-10-07', allergies:'No refiere', medical_history:'No refiere', reason:'Dolor dental localizado',
    symptoms:'Dolor al frío', diagnosis:'Caries dental', diagnosis_code:'K02.9', treatment:'Restauración en resina',
    odontogram:{16:'caries'}, prescriptions:[], observations:'Control periódico'
  }, { name:'Consultorio odontológico', dentist:'Profesional tratante', license:'Registro profesional' });
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0,4)), '%PDF');
  assert.ok(bytes.length > 1000);
});
