import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
let database:ReturnType<typeof createDatabase>|undefined;
function createDatabase(){
 const url=process.env.DATABASE_URL;
 if(!url)throw Object.assign(new Error('Configure o banco de dados na Vercel antes de usar o painel.'),{status:503});
 const client=postgres(url,{prepare:false,max:3,idle_timeout:20,connect_timeout:10,ssl:'require'});
 return drizzle(client,{schema});
}
export function getDb(){return database??=createDatabase();}
