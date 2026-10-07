import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error:'Método no permitido.' });
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return response.status(503).json({ error:'Supabase no está configurado.' });
  const { email, password } = request.body || {};
  if (email !== 'odonto@prueba.com' || typeof password !== 'string' || password.length < 16) return response.status(400).json({ error:'Solicitud inválida.' });

  const admin = createClient(url, secretKey, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:list, error:listError } = await admin.auth.admin.listUsers({ page:1, perPage:1000 });
  if (listError) return response.status(500).json({ error:'No fue posible consultar usuarios.' });
  const existing = list.users.find(user => user.email?.toLowerCase() === email);
  const attributes = { password, email_confirm:true, user_metadata:{ full_name:'Odontólogo', clinic_name:'Consultorio Odontológico' } };
  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, attributes)
    : await admin.auth.admin.createUser({ email, ...attributes });
  if (result.error) return response.status(500).json({ error:'No fue posible aprovisionar el usuario.' });
  return response.status(200).json({ ready:true });
}
