import {getAdminUser} from '@/lib/auth';
import {json, error, fail} from '@/lib/server';

export async function GET() {
 try {
  const user = await getAdminUser();
  if (!user) fail('Sua sessão não está ativa. Entre novamente neste endereço para continuar.', 401);
  return json({ok: true});
 } catch (e) { return error(e); }
}
