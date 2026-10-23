'use client';
import {useState} from 'react';
import {ArrowRight, LockKeyhole, AlertCircle, LoaderCircle} from 'lucide-react';
import {Mark, api} from './ui';

export function LoginForm({onSuccess}: {onSuccess: () => void | Promise<void>}) {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 return <form className="login-fields" onSubmit={async event => {
  event.preventDefault(); setBusy(true); setError('');
  try {
   await api('/api/auth/login', {email, password});
   // Confirm in a second request that the browser retained the session cookie.
   await api('/api/auth/session');
   setPassword('');
   await onSuccess();
  } catch (error: any) { setError(error.message); }
  finally { setBusy(false); }
 }}>
  <label>E-mail do administrador<input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)}/></label>
  <label>Senha<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/></label>
  {error && <div className="checkout-error" role="alert"><AlertCircle size={18}/>{error}</div>}
  <button className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <LockKeyhole size={17}/>} {busy ? 'Entrando…' : 'Entrar no painel'}<ArrowRight size={17}/></button>
 </form>;
}

export function LoginScreen({onSuccess}: {onSuccess: () => void | Promise<void>}) {
 return <main className="login-page"><a href="/" className="wordmark"><Mark/><span>prisma.</span></a><section className="panel login-card"><span className="eyebrow">SEU NEGÓCIO, EM MOVIMENTO</span><h1>Bem-vindo de volta.</h1><p>Entre para gerenciar suas ofertas e pagamentos.</p><LoginForm onSuccess={onSuccess}/><small>Acesso exclusivo à conta administrativa configurada para esta operação.</small></section></main>;
}
