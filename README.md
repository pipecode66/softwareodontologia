# DentaDoc

Aplicación local para registrar pacientes e historias clínicas odontológicas y descargar cada historia en PDF.

## Puesta en marcha

1. Copia `.env.example` como `.env` y cambia, como mínimo, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. Instala dependencias con `npm install`.
3. Durante desarrollo usa `npm run dev`.
4. Para producción local ejecuta `npm run build` y luego `npm start`.
5. Abre `http://localhost:4173`.

La base SQLite se crea automáticamente en `data/dentadoc.db`. Incluye ese archivo en tu estrategia de copias de seguridad cifradas y nunca lo publiques en Git.

## Alcance

- Inicio de sesión protegido con cookie HTTP-only.
- Directorio de pacientes e historial por paciente.
- Registro clínico, antecedentes, signos vitales, diagnóstico y tratamiento.
- Odontograma permanente con nomenclatura FDI.
- Prescripciones, observaciones y próximo control.
- Borrador automático en el navegador.
- PDF clínico generado en el servidor y bitácora básica de creación/descarga.

Antes de usar datos reales, revisa las obligaciones de privacidad, consentimiento, retención, copias de seguridad y firma clínica aplicables en tu país. El PDF generado no incorpora una firma digital certificada.
