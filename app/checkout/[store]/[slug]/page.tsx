import Checkout from '../../checkout';
export default async function Page({params}:{params:Promise<{store:string;slug:string}>}){const p=await params;return <Checkout store={p.store} slug={p.slug}/>}
