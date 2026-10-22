import{authClient}from'@/lib/auth';import{json,error,sameOrigin}from'@/lib/server';
export async function POST(req:Request){try{sameOrigin(req);const client=await authClient();const{error:e}=await client.auth.signOut();if(e)throw e;return json({ok:true});}catch(e){return error(e);}}
