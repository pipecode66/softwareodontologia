import { jsPDF } from 'jspdf';

const ink = [16, 34, 56];
const teal = [8, 120, 109];
const muted = [99, 113, 134];

export function buildClinicalPdf(record, clinic = {}) {
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const left = 18; const width = 174;
  doc.setFillColor(...teal); doc.rect(0, 0, 210, 4, 'F');
  doc.roundedRect(left, 13, 14, 14, 2, 2, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text('D', 25, 22, { align:'center' });
  doc.setTextColor(...ink); doc.setFontSize(15); doc.text(clinic.name || 'Consultorio odontológico', 37, 18);
  doc.setFont('helvetica','normal'); doc.setTextColor(...muted); doc.setFontSize(8); doc.text(`${clinic.dentist || 'Profesional tratante'} · ${clinic.license || 'Registro profesional'}`, 37, 24);
  doc.setFont('helvetica','bold'); doc.setTextColor(...teal); doc.text('HISTORIA CLÍNICA', 192, 17, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setTextColor(...muted); doc.text(record.folio || '', 192, 23, {align:'right'});
  doc.setDrawColor(220,229,239); doc.line(left, 33, 192, 33);
  doc.setTextColor(...ink); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('HISTORIA CLÍNICA ODONTOLÓGICA', 105, 45, {align:'center'});

  const patient = `${record.first_name || ''} ${record.last_name || ''}`.trim();
  const fields = [
    ['Paciente', patient], ['Documento', `${record.document_type || ''} ${record.document_number || ''}`.trim()],
    ['Fecha de atención', formatDate(record.consultation_date)], ['Alergias', record.allergies || 'No refiere']
  ];
  doc.setFillColor(245,248,252); doc.roundedRect(left, 52, width, 21, 2, 2, 'F');
  fields.forEach(([label,value],index)=>{ const x=left+5+(index*43); doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...muted);doc.text(label.toUpperCase(),x,59);doc.setFontSize(8);doc.setTextColor(...ink);doc.text(doc.splitTextToSize(value,39),x,65); });
  let y = 82;
  const section = (title, content) => {
    const lines = doc.splitTextToSize(content || 'No registra', width - 8);
    if (y + 13 + lines.length * 4.5 > 280) { doc.addPage(); y = 18; }
    doc.setFillColor(231,244,242); doc.roundedRect(left,y,width,8,1.5,1.5,'F');
    doc.setTextColor(...teal); doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.text(title,left+4,y+5.4);
    y += 13; doc.setTextColor(...ink); doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.text(lines,left+2,y); y += lines.length*4.5+6;
  };
  section('1. Motivo de consulta', `${record.reason || ''}${record.symptoms ? `\n\nSíntomas y evolución: ${record.symptoms}` : ''}`);
  section('2. Antecedentes médicos', record.medical_history || 'El paciente no refiere antecedentes relevantes.');
  section('3. Diagnóstico', `${record.diagnosis_code ? `${record.diagnosis_code} · ` : ''}${record.diagnosis || ''}${record.blood_pressure || record.heart_rate ? `\n\nSignos vitales: P.A. ${record.blood_pressure || '—'} · F.C. ${record.heart_rate || '—'}` : ''}`);
  section('4. Tratamiento realizado', record.treatment);
  const teeth = Object.entries(record.odontogram || {}).filter(([,status])=>status && status!=='sano');
  if (teeth.length) section('5. Odontograma', teeth.map(([tooth,status])=>`Pieza ${tooth}: ${status}`).join(' · '));
  if (record.prescriptions?.length) section('6. Prescripción', record.prescriptions.map((item,index)=>`${index+1}. ${item.name}${item.dose ? ` — ${item.dose}` : ''}${item.instructions ? `\n${item.instructions}` : ''}`).join('\n\n'));
  if (record.observations) section('Observaciones y recomendaciones', record.observations);
  if (record.next_appointment) section('Próximo control sugerido', new Date(record.next_appointment).toLocaleString('es-CO',{dateStyle:'long',timeStyle:'short'}));
  if (y > 255) { doc.addPage(); y=35; }
  doc.setDrawColor(...muted); doc.line(125,y+12,188,y+12); doc.setFont('helvetica','bold');doc.setTextColor(...ink);doc.setFontSize(8);doc.text(clinic.dentist || 'Profesional tratante',156.5,y+17,{align:'center'});doc.setFont('helvetica','normal');doc.setTextColor(...muted);doc.text(clinic.license || 'Registro profesional',156.5,y+21,{align:'center'});
  return doc;
}

function formatDate(value) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO') : '';
}

export function downloadClinicalPdf(record, clinic) {
  const safeName = `${record.folio || 'historia-clinica'}-${record.first_name || ''}-${record.last_name || ''}`.replace(/[^a-zA-Z0-9-_]/g,'-');
  buildClinicalPdf(record, clinic).save(`${safeName}.pdf`);
}
