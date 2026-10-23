// Real Next.js HTTP handlers + Supabase SDK, with a local fake Auth service.
// Requires npm run build. No production credentials or database are used.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const user={id:'11111111-1111-4111-8111-111111111111',email:'admin@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const token=(id=user.id,expired=false)=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+(expired?-3600:3600),iat:Math.floor(Date.now()/1000)-7200})).toString('base64url'),'local-test-signature'].join('.');
let revoked=false,unavailable=false,refreshes=0;
const upstream=http.createServer(async(req,res)=>{
 let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):{};
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data))};
 if(req.url.startsWith('/auth/v1/token')){
  if(req.url.includes('refresh_token'))refreshes++;
  if(body.password==='wrong')return send(400,{code:'invalid_credentials',msg:'Invalid login credentials'});
  const current={...user,id:body.email==='other@example.test'?'22222222-2222-4222-8222-222222222222':user.id};
  const expired=body.password==='expired';revoked=false;
  return send(200,{access_token:token(current.id,expired),refresh_token:'local-refresh-token',token_type:'bearer',expires_in:expired?-3600:3600,user:current});
 }
 if(req.url==='/auth/v1/user'){
  if(unavailable)return send(500,{msg:'Local test outage'});
  if(revoked)return send(401,{code:'bad_jwt',msg:'Revoked token'});
  const jwt=req.headers.authorization?.replace('Bearer ','');
  if(!jwt)return send(401,{msg:'Missing token'});
  const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());
  return send(200,{...user,id:claims.sub});
 }
 if(req.url.startsWith('/auth/v1/logout'))return send(200,{});
 return send(404,{});
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const portProbe=http.createServer().listen(0,'127.0.0.1');await once(portProbe,'listening');const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));
const origin=`http://localhost:${port}`;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',SUPABASE_URL:`http://127.0.0.1:${upstream.address().port}`,SUPABASE_PUBLISHABLE_KEY:'local-publishable-key',ADMIN_USER_ID:user.id,DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
const jar=new Map();let cookieHeaders=[];
async function call(path,body){
 const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},...(body?{body:JSON.stringify(body)}:{})});
 cookieHeaders=response.headers.getSetCookie();
 for(const value of cookieHeaders){const first=value.split(';')[0];const at=first.indexOf('=');const name=first.slice(0,at),content=first.slice(at+1);if(!content||/Max-Age=0/i.test(value))jar.delete(name);else jar.set(name,content)}
 return {status:response.status,data:await response.json()};
}
let checks=0;const check=(condition,message)=>{assert(condition,message);checks++;console.log('PASS',message)};
try{
 for(let i=0;i<80;i++){try{const r=await fetch(origin+'/login');if(r.ok)break}catch{}await new Promise(r=>setTimeout(r,200));if(i===79)throw Error('Next did not start')}
 check((await call('/api/auth/session')).status===401,'Anonymous session is rejected');
 check((await call('/api/admin',{action:'product',product:{}})).status===401,'Anonymous product write is rejected before database access');
 check((await call('/api/auth/login',{email:user.email,password:'wrong'})).status===401,'Wrong password is rejected');
 check((await call('/api/auth/login',{email:user.email,password:'test-password'})).status===200,'Administrator login succeeds');
 check(cookieHeaders.some(x=>/HttpOnly/i.test(x)&&/Secure/i.test(x)&&/SameSite=lax/i.test(x)&&/Path=\//i.test(x)),'Login emits protected session cookies through Next HTTP response');
 check((await call('/api/auth/session')).status===200,'Next request recognizes persisted session');
 check((await call('/api/admin')).data.error==='Configure o banco de dados na Vercel antes de usar o painel.','Authenticated request reaches database boundary');
 unavailable=true;check((await call('/api/auth/session')).status===503,'Auth service outage is not reported as signed out');unavailable=false;
 revoked=true;check((await call('/api/auth/session')).status===401,'Revoked session is denied');revoked=false;
 check((await call('/api/auth/login',{email:user.email,password:'expired'})).status===200,'Expired-token fixture signs in');
 check((await call('/api/auth/session')).status===200&&refreshes>0,'Expired token refreshes on the server');
 check(cookieHeaders.some(x=>/HttpOnly/i.test(x)),'Refreshed cookie is returned to browser');
 check((await call('/api/auth/session')).status===200,'Refreshed session survives next request');
 check((await call('/api/auth/logout',{})).status===200,'Logout succeeds');
 check((await call('/api/auth/session')).status===401,'Logout removes session');
 check((await call('/api/auth/login',{email:'other@example.test',password:'test-password'})).status===403,'Different account cannot enter administration');
 check((await call('/api/auth/session')).status===401,'Denied account does not retain a session');
 console.log(JSON.stringify({passed:checks,auth:'local fake provider; real SDK, cookies and Next HTTP routes',productionAccess:false}));
}catch(error){console.error(output);throw error}finally{child.kill('SIGTERM');upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve))}
