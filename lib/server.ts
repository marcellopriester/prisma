import { getAdminUser } from '@/lib/auth';
import {getDb} from '@/db';
import {stores,audit} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {defaults} from './shared';
import {z} from 'zod';
export const url=z.string().max(2000).refine(v=>!v||/^https:\/\//i.test(v),'Use um endereço https:// válido.');
export const productSchema=z.object({id:z.string().optional(),kind:z.enum(['product','bump']),name:z.string().trim().min(2).max(100),description:z.string().trim().max(500),price:z.number().int().min(100).max(100000000),slug:z.string().min(2).max(70).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),active:z.boolean(),demo:z.boolean(),image:url,delivery:z.string().max(2000),button:z.string().max(40),productIds:z.array(z.string()).max(30),position:z.number().int().min(0).max(100)});
export const settingsSchema=z.object({brand:z.string().trim().min(2).max(60),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),logo:url,support:z.string().max(100),seller:z.string().max(150),terms:url,privacy:url,pixKey:z.string().trim().max(77),pixType:z.enum(['email','cpf','cnpj','phone','random']),recipient:z.string().trim().max(100),city:z.string().trim().max(80),enabled:z.boolean()}).transform(s=>({...s,pixKey:s.pixType==='cpf'||s.pixType==='cnpj'?s.pixKey.replace(/[.\/\s-]/g,''):s.pixKey}));
export function fail(m:string,status=400):never{throw Object.assign(new Error(m),{status});}
export async function owner(){const u=await getAdminUser();if(!u)fail('Entre com sua conta para acessar o painel.',401);const db=getDb();let s=await db.select().from(stores).where(eq(stores.owner,u!.userId)).then(rows=>rows[0]);if(!s){await db.insert(stores).values({id:crypto.randomUUID(),owner:u!.userId,settings:JSON.stringify(defaults),created:new Date().toISOString()}).onConflictDoNothing();s=await db.select().from(stores).where(eq(stores.owner,u!.userId)).then(rows=>rows[0]);}return{db,store:s!,user:u!};}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)fail('Origem da solicitação inválida.',403);}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>20000)fail('Solicitação muito grande.',413);const txt=await req.text();if(txt.length>20000)fail('Solicitação muito grande.',413);return JSON.parse(txt);}
export const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function error(e:any){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Dados inválidos.'},400);if(e?.status)return json({error:e.message},e.status);if(e?.code==='23505'||e?.cause?.code==='23505'||String(e?.message).includes('UNIQUE constraint'))return json({error:'Este endereço já está em uso. Escolha outro.'},409);console.error('Request failed',e?.name);return json({error:'Não foi possível concluir. Tente novamente.'},500);}
export async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function log(db:ReturnType<typeof getDb>,storeId:string,actor:string,action:string,subject:string){return db.insert(audit).values({id:crypto.randomUUID(),storeId,actor,action,subject,created:new Date().toISOString()});}
