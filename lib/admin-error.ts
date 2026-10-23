import {error, json} from './server';

// Only used by admin routes. Never return raw database errors, SQL or credentials.
export function databaseDiagnostic(value: unknown): {code: string; message: string} | null {
 const chain: any[] = [];
 let current: any = value;
 while (current && typeof current === 'object' && chain.length < 6 && !chain.includes(current)) {
  chain.push(current); current = current.cause;
 }
 const codes = chain.map(item => String(item.code || ''));
 const messages = chain.map(item => String(item.message || '')).join(' ');
 const has = (...values: string[]) => codes.some(code => values.includes(code));
 if (has('23505')) return null; // Preserve the existing duplicate-slug response.
 if (has('28P01', '28000', 'SASL_SIGNATURE_MISMATCH') || /password authentication failed|SASL_SIGNATURE_MISMATCH/i.test(messages))
  return {code:'DB_AUTH',message:'O banco recusou a autenticação. Confira o usuário e a senha do banco na DATABASE_URL da Vercel.'};
 if (/tenant or user not found/i.test(messages))
  return {code:'DB_POOLER',message:'O endereço do pooler e o usuário do banco não correspondem. Copie novamente a conexão do projeto Supabase para DATABASE_URL.'};
 if (has('ENOTFOUND','EAI_AGAIN'))
  return {code:'DB_HOST',message:'Não foi possível localizar o endereço do banco. Confira o host da DATABASE_URL na Vercel.'};
 if (has('CONNECT_TIMEOUT','ETIMEDOUT','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','CONNECTION_CLOSED','CONNECTION_ENDED'))
  return {code:'DB_CONNECTION',message:'Não foi possível conectar ao banco. Confira se o Supabase está ativo e se DATABASE_URL usa o endereço correto do pooler.'};
 if (has('42P01','3F000','42703'))
  return {code:'DB_SCHEMA',message:'Faltam tabelas ou colunas do checkout no banco conectado. Confira se DATABASE_URL aponta para o projeto em que as tabelas foram criadas.'};
 if (has('42501'))
  return {code:'DB_PERMISSION',message:'A conexão do banco não tem permissão para acessar os dados do checkout. É necessário revisar o usuário da conexão e suas permissões.'};
 if (has('SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED'))
  return {code:'DB_TLS',message:'Não foi possível validar o certificado da conexão com o banco. A configuração TLS precisa ser revisada.'};
 if (has('ERR_INVALID_URL') || chain.some(item=>item instanceof URIError))
  return {code:'SERVER_URL',message:'Um endereço de conexão do servidor está em formato inválido. Confira SUPABASE_URL e DATABASE_URL, incluindo a codificação da senha do banco.'};
 if (chain.some(item=>item.name==='DrizzleQueryError'||item.name==='PostgresError'))
  return {code:'DB_QUERY',message:'O banco não conseguiu carregar os dados do checkout. É necessário conferir o registro desta solicitação na Vercel.'};
 return null;
}

export function adminError(value: unknown) {
 const diagnostic=databaseDiagnostic(value);
 if (!diagnostic) return error(value);
 // Log a fixed code only, never error.message/cause/query/parameters.
 console.error('Admin database failure', diagnostic.code);
 return json({error:`${diagnostic.message} Código: ${diagnostic.code}.`},503);
}
