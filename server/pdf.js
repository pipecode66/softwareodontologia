import PDFDocument from 'pdfkit';

const teal = '#08786d';
const ink = '#102238';
const muted = '#607084';
const line = '#dce5ef';

function field(doc, label, value, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(muted).text(label.toUpperCase(), x, y, { width });
  doc.font('Helvetica').fontSize(10).fillColor(ink).text(value || 'No registra', x, y + 12, { width });
}

function section(doc, title, body) {
  if (doc.y > 680) doc.addPage();
  const y = doc.y;
  doc.roundedRect(45, y, 505, 25, 5).fill('#e8f5f3');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(teal).text(title, 57, y + 8);
  doc.moveDown(1.7).font('Helvetica').fontSize(10).fillColor(ink).text(body || 'No registra', 48, doc.y, { width: 499, lineGap: 3 });
  doc.moveDown(1.1);
}

export function createClinicalPdf(record, patient, clinic) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 42, left: 45, right: 45 }, info: { Title: `Historia clínica ${record.folio}`, Author: clinic.dentist } });
  doc.rect(0, 0, 595, 12).fill(teal);
  doc.roundedRect(45, 35, 42, 42, 8).fill(teal);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('white').text('D', 58, 46);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(ink).text(clinic.name, 98, 38);
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(`${clinic.dentist} · ${clinic.license}`, 98, 62);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(teal).text('DOCUMENTO CLÍNICO', 430, 42, { width: 120, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(record.folio, 430, 59, { width: 120, align: 'right' });
  doc.moveTo(45, 91).lineTo(550, 91).strokeColor(line).stroke();
  doc.font('Helvetica-Bold').fontSize(15).fillColor(ink).text('HISTORIA CLÍNICA ODONTOLÓGICA', 45, 108, { align: 'center', width: 505 });

  const fullName = `${patient.first_name} ${patient.last_name}`;
  field(doc, 'Paciente', fullName, 45, 145, 230);
  field(doc, 'Documento', `${patient.document_type} ${patient.document_number}`, 295, 145, 120);
  field(doc, 'Fecha de atención', new Date(`${record.consultation_date}T12:00:00`).toLocaleDateString('es-CO'), 430, 145, 120);
  field(doc, 'Fecha de nacimiento', patient.birth_date ? new Date(`${patient.birth_date}T12:00:00`).toLocaleDateString('es-CO') : '', 45, 180, 150);
  field(doc, 'Teléfono', patient.phone, 210, 180, 150);
  field(doc, 'Alergias', patient.allergies, 375, 180, 175);
  doc.y = 225;

  section(doc, '1. Motivo de consulta', `${record.reason}${record.symptoms ? `\n\nSíntomas y evolución: ${record.symptoms}` : ''}`);
  section(doc, '2. Antecedentes médicos relevantes', patient.medical_history || 'El paciente no refiere antecedentes relevantes.');
  section(doc, '3. Evaluación y diagnóstico', `${record.diagnosis_code ? `Código diagnóstico: ${record.diagnosis_code}\n` : ''}${record.diagnosis}${record.blood_pressure || record.heart_rate ? `\n\nSignos vitales: P.A. ${record.blood_pressure || '—'} · F.C. ${record.heart_rate || '—'}` : ''}`);
  section(doc, '4. Tratamiento / procedimiento realizado', record.treatment);

  const odontogram = Object.entries(record.odontogram || {}).filter(([, value]) => value && value !== 'sano');
  if (odontogram.length) section(doc, '5. Odontograma registrado', odontogram.map(([tooth, status]) => `Pieza ${tooth}: ${status}`).join('  ·  '));

  if (record.prescriptions?.length) {
    section(doc, '6. Prescripción', record.prescriptions.map((item, index) => `${index + 1}. ${item.name}${item.dose ? ` — ${item.dose}` : ''}${item.instructions ? `\n   ${item.instructions}` : ''}`).join('\n'));
  }
  if (record.observations) section(doc, 'Observaciones y recomendaciones', record.observations);
  if (record.next_appointment) section(doc, 'Próximo control sugerido', new Date(record.next_appointment).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }));

  if (doc.y > 690) doc.addPage();
  const signatureY = Math.max(doc.y + 30, 690);
  doc.moveTo(335, signatureY).lineTo(535, signatureY).strokeColor(muted).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(ink).text(clinic.dentist, 335, signatureY + 8, { width: 200, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(clinic.license, 335, signatureY + 21, { width: 200, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(muted).text('Documento generado por DentaDoc. La firma y custodia legal son responsabilidad del profesional tratante.', 45, 790, { width: 505, align: 'center' });
  return doc;
}
