import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export type AdminUser={userId:string;displayName:string;email:string;fullName:string|null};
export function authConfig(){
 const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_PUBLISHABLE_KEY;const admin=process.env.ADMIN_USER_ID;
 if(!url||!key||!admin)throw Object.assign(new Error('Configuração inicial pendente. Configure Supabase e ADMIN_USER_ID na Vercel.'),{status:503});
 return{url,key,admin};
}
// Called only by route handlers, which may refresh session cookies.
export async function authClient(){
 const{url,key}=authConfig();const jar=await cookies();
 return createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>jar.getAll(),setAll:values=>{for(const{name,value,options}of values)jar.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});}}});
}
export async function getAdminUser():Promise<AdminUser|null>{
 const{admin}=authConfig();const supabase=await authClient();
 const{data:{user},error}=await supabase.auth.getUser();
 if(error||!user||user.id!==admin||!user.email_confirmed_at)return null;
 return{userId:user.id,displayName:user.user_metadata?.full_name||user.email||'Administrador',email:user.email||'',fullName:user.user_metadata?.full_name||null};
}
