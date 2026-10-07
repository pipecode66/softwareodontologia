# DentaDoc

Aplicación web para registrar pacientes e historias clínicas odontológicas y descargar cada historia en PDF. Utiliza Supabase Auth, PostgreSQL y políticas Row Level Security.

## Configuración

1. Conecta un proyecto Supabase al proyecto de Vercel.
2. Confirma que Vercel tenga `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `POSTGRES_URL` (o `POSTGRES_URL_NON_POOLING`).
3. En Supabase abre **Authentication → Users → Add user** y crea el acceso del odontólogo con correo y contraseña. Marca el correo como confirmado.
4. Desactiva el registro público en Supabase Auth; los usuarios deben ser creados por un administrador.
5. Despliega `main`. Durante el build se aplicará la migración de `supabase/migrations` automáticamente.

Para desarrollo local, copia `.env.example` como `.env.local`, completa únicamente la URL y la clave publicable, ejecuta `npm install` y luego `npm run dev`.

## Alcance

- Inicio de sesión administrado por Supabase Auth.
- Directorio de pacientes e historial por paciente.
- Registro clínico, antecedentes, signos vitales, diagnóstico y tratamiento.
- Odontograma permanente con nomenclatura FDI.
- Prescripciones, observaciones y próximo control.
- Borrador automático en el navegador.
- PDF clínico generado en el navegador y bitácora clínica en PostgreSQL.

Antes de usar datos reales, revisa las obligaciones de privacidad, consentimiento, retención, copias de seguridad y firma clínica aplicables en tu país. El PDF generado no incorpora una firma digital certificada.
