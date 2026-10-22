import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Prisma · Seu checkout, sua marca',description:'Checkout Pix, ofertas complementares e gestão de pedidos em um só lugar.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
