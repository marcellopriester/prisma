'use client';
import {LoginScreen} from '../login-form';
export default function Login() {
 return <LoginScreen onSuccess={() => { location.href = '/'; }}/>;
}
