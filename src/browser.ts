import { chromium } from "playwright";
let b:any=null,p:any=null,lo:Promise<any>=Promise.resolve();
export async function getPage(){if(!p||p.isClosed()){const bx=b||await(async()=>{b=await chromium.launch({headless:true,args:["--no-sandbox"]});return b})();p=await(await bx.newContext()).newPage()}return p}
export async function serialized<T>(fn:()=>Promise<T>):Promise<T>{const r=lo.then(fn,fn);lo=r.catch(()=>{});return r}
export async function closeBrowser(){try{if(p&&!p.isClosed())await p.close();if(b&&b.isConnected())await b.close()}catch{}}