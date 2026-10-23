// Isolated integration checks: actual route handlers + Drizzle, with local PostgreSQL (PGlite) and mock request identity.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const dir=path.resolve('.test-runtime');await fs.mkdir(dir,{recursive:true});
const modules={'lib/admin-error.ts':'admin-error.mjs','lib/shared.ts':'shared.mjs','lib/pix.ts':'pix.mjs','lib/server.ts':'server.mjs','db/schema.ts':'schema.mjs','app/api/admin/route.ts':'admin.mjs','app/api/catalog/route.ts':'catalog.mjs','app/api/orders/route.ts':'orders.mjs'};
const aliases={'@/lib/admin-error':'./admin-error.mjs','./server':'./server.mjs','@/lib/auth':'./identity.mjs','@/db/schema':'./schema.mjs','@/db':'./database.mjs','@/lib/server':'./server.mjs','@/lib/pix':'./pix.mjs','./shared':'./shared.mjs'};
for(const [src,dest]of Object.entries(modules)){let code=(await fs.readFile(src,'utf8'));for(const[a,b]of Object.entries(aliases))code=code.replaceAll(`'${a}'`,`'${b}'`);await fs.writeFile(path.join(dir,dest),ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
await fs.writeFile(path.join(dir,'identity.mjs'),`let current=null;export const setUser=u=>current=u;export const getAdminUser=async()=>current;`);
await fs.writeFile(path.join(dir,'database.mjs'),`import{PGlite}from'@electric-sql/pglite';import{drizzle}from'drizzle-orm/pglite';import fs from'node:fs';import*as schema from'./schema.mjs';const client=new PGlite();for(const f of fs.readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await client.exec(fs.readFileSync('migrations/'+f,'utf8'));const db=drizzle(client,{schema});export const getDb=()=>db;export const close=()=>client.close();`);
const admin=await import(path.join(dir,'admin.mjs'));const catalog=await import(path.join(dir,'catalog.mjs'));const orders=await import(path.join(dir,'orders.mjs'));const{setUser}=await import(path.join(dir,'identity.mjs'));const{defaults,sample}=await import(path.join(dir,'shared.mjs'));const{crc16}=await import(path.join(dir,'pix.mjs'));
const userA={userId:'owner-A',displayName:'Test A',email:'a@example.test'},userB={userId:'owner-B',displayName:'Test B',email:'b@example.test'};
const call=async(mod,method,b,query='')=>{const req=new Request('https://checkout.example.test/api/test'+query,{method,headers:{origin:'https://checkout.example.test','content-type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});const r=await mod[method](req);return{status:r.status,data:await r.json()}};
let checks=0;function check(value,msg){assert(value,msg);checks++;}
check((await call(admin,'GET')).status===401,'Anonymous cannot read administration');
setUser(userA);let a=(await call(admin,'GET')).data;const storeId=a.storeId;
let product={...sample,id:undefined,demo:false,name:'Oferta de teste',slug:'oferta-teste',delivery:'ENTREGA PRIVADA'};
let r=await call(admin,'POST',{action:'product',product});check(r.status===200,'Product saved');const productId=r.data.id;
let bump={...product,kind:'bump',name:'Extra',price:1970,slug:'extra-teste',productIds:[productId]};r=await call(admin,'POST',{action:'product',product:bump});check(r.status===200,'Bump saved');const bumpId=r.data.id;
const settings={...defaults,pixKey:'test@example.test',recipient:'RECEBEDOR TESTE',city:'SAO PAULO',seller:'Loja Teste',support:'support@example.test',enabled:true};
let bad=await call(admin,'POST',{action:'settings',settings:{...settings,pixKey:''}});check(bad.status===400,'Incomplete Pix cannot be activated');
check((await call(admin,'POST',{action:'settings',settings})).status===200,'Complete Pix configuration saved');
const formattedPix={...settings,pixType:'cnpj',pixKey:'12.345.678/0001-90'};
check((await call(admin,'POST',{action:'settings',settings:formattedPix})).status===200,'Formatted CNPJ can be saved');
check((await call(admin,'GET')).data.settings.pixKey==='12345678000190','CNPJ punctuation is removed without changing digits');
check((await call(admin,'POST',{action:'settings',settings:{...formattedPix,pixKey:'12A345678000190'}})).status===400,'Invalid CNPJ characters are not silently removed');
await call(admin,'POST',{action:'settings',settings});
setUser(null);r=await call(catalog,'GET',null,`?store=${storeId}&slug=oferta-teste`);check(r.status===200&&r.data.bumps.length===1,'Public catalog loads eligible bump');check(!JSON.stringify(r.data).includes('ENTREGA PRIVADA'),'Delivery hidden in public catalog');
const request={storeId,productId,bumpIds:[bumpId,bumpId],token:crypto.randomUUID()+crypto.randomUUID(),customer:{name:'Teste Cliente',email:'client@example.test',phone:'11999990000'},total:1};
r=await call(orders,'POST',request);check(r.status===200,'Order created');const order=r.data;
check(order.total===11670&&order.items.length===2,'Server ignores tampered total and deduplicates bumps');check(order.status==='pending','Order starts pending');check(!JSON.stringify(order).includes('ENTREGA PRIVADA'),'Private delivery hidden before payment');
check(order.payload.includes('5406116.70'),'Pix includes exact amount');check(crc16('123456789')==='29B1','CRC matches published CCITT-FALSE reference vector');check(crc16(order.payload.slice(0,-4))===order.payload.slice(-4),'Pix CRC is valid');
let repeat=await call(orders,'POST',request);check(repeat.data.id===order.id,'Duplicate submission is idempotent');
check((await call(orders,'POST',{...request,bumpIds:[]})).status===409,'Cannot mutate an existing order');
check((await call(orders,'POST',{...request,token:crypto.randomUUID()+crypto.randomUUID(),bumpIds:[crypto.randomUUID()]})).status===409,'Reject unrelated bump');
check((await call(orders,'GET',null,'?token='+crypto.randomUUID()+crypto.randomUUID())).status===404,'Unrelated token cannot view order');
check((await call(admin,'POST',{action:'approve',id:order.id,confirmed:true})).status===401,'Buyer cannot approve order');
await call(orders,'POST',{action:'reported',token:request.token});r=await call(orders,'GET',null,'?token='+request.token);check(r.data.status==='review','Buyer reporting does not mark paid');
setUser(userB);r=await call(admin,'GET');check(r.data.orders.length===0&&r.data.products.length===0,'Other identity sees no seller records');check((await call(admin,'POST',{action:'approve',id:order.id,confirmed:true})).status===404,'Other identity cannot approve');check((await call(admin,'POST',{action:'product',product:{...product,id:productId}})).status===404,'Other identity cannot edit offer');
setUser(userA);check((await call(admin,'POST',{action:'approve',id:order.id,confirmed:false})).status===400,'Approval requires acknowledgement');check((await call(admin,'POST',{action:'approve',id:order.id,confirmed:true})).status===200,'Owner can approve');
r=await call(orders,'GET',null,'?token='+request.token);check(r.data.status==='paid'&&r.data.items[0].delivery==='ENTREGA PRIVADA','Delivery available only after approval');
await call(orders,'POST',{action:'reported',token:request.token});r=await call(orders,'GET',null,'?token='+request.token);check(r.data.status==='paid','Late report cannot downgrade paid order');
r=await admin.POST(new Request('https://checkout.example.test/api/admin',{method:'POST',headers:{origin:'https://evil.example.test','content-type':'application/json'},body:JSON.stringify({action:'settings',settings})}));check(r.status===403,'Cross-origin write rejected');
const{databaseDiagnostic,adminError}=await import(path.join(dir,'admin-error.mjs'));
for(const[code,expected]of [['28P01','DB_AUTH'],['ENOTFOUND','DB_HOST'],['CONNECT_TIMEOUT','DB_CONNECTION'],['42P01','DB_SCHEMA'],['42501','DB_PERMISSION'],['SELF_SIGNED_CERT_IN_CHAIN','DB_TLS'],['ERR_INVALID_URL','SERVER_URL']]){
 const source={name:'DrizzleQueryError',message:'SQL with PRIVATE_VALUE',cause:{code,message:'postgres://PRIVATE_VALUE'}};
 const diagnosed=databaseDiagnostic(source);check(diagnosed?.code===expected,'Database diagnostic '+expected);
 check(!JSON.stringify(diagnosed).includes('PRIVATE_VALUE'),'Diagnostic hides secrets '+expected);
}
check(databaseDiagnostic({cause:{message:'Tenant or user not found'}})?.code==='DB_POOLER','Pooler routing error is identified');
check(adminError({name:'DrizzleQueryError',cause:{code:'23505'}}).status===409,'Duplicate slug retains conflict response');
check(databaseDiagnostic(new Error('Unknown PRIVATE_VALUE'))===null,'Unknown error is not guessed');
const diagnosticResponse=await adminError({cause:{code:'28P01',message:'PRIVATE_VALUE'}}).json();
check(diagnosticResponse.error.includes('DB_AUTH')&&!diagnosticResponse.error.includes('PRIVATE_VALUE'),'Admin response contains safe diagnosis');
await (await import(path.join(dir,'database.mjs'))).close();console.log(JSON.stringify({passed:checks,storage:'isolated PostgreSQL (PGlite)',bankTransactions:0}));
