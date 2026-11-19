import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { z } from 'zod';
import { aquariumSchema, forViewer, revise, type Aquarium } from '../src/model';

const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean));
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const hash = (secret:string)=>createHash('sha256').update(secret).digest('hex');
const input = z.object({ aquarium:aquariumSchema });
const editInput=input.extend({ revision:z.number().int().min(1).max(2_147_483_646) });
const limit = 880_000;
let sqlClient: NeonQueryFunction<false,false>|undefined;
function db() { return sqlClient ??= neon(process.env.DATABASE_URL!); }

class ClientError extends Error {
  constructor(readonly status:number, readonly code:string) { super(code); }
}
async function body(request:Request) {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ClientError(415,'json');
  if(Number(request.headers.get('content-length'))>limit) throw new ClientError(413,'large');
  const stream=request.body?.getReader();
  if(!stream) throw new ClientError(400,'json');
  const decoder=new TextDecoder();
  let bytes=0, data='';
  while(true){
    const {done,value}=await stream.read();
    if(done) break;
    bytes+=value.byteLength;
    if(bytes>limit){await stream.cancel().catch(()=>{});throw new ClientError(413,'large');}
    data+=decoder.decode(value,{stream:true});
  }
  try { return JSON.parse(data+decoder.decode()) as unknown; }
  catch { throw new ClientError(400,'json'); }
}
function credential(request:Request) {
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token || !tokenPattern.test(token)) throw new ClientError(401,'access');
  return hash(token);
}
function payload(row:Record<string,unknown>,isOwner:boolean) {
  const aquarium=row.document as Aquarium;
  return {role:isOwner?'owner':'viewer',aquarium:isOwner?aquarium:forViewer(aquarium),revision:row.revision,id:row.id};
}
async function route(request:Request) {
  const path=new URL(request.url).pathname.replace(/\/$/,'') || '/';
  if(request.method==='GET' && path==='/health'){await db()`SELECT 1 FROM aquariums LIMIT 1`;return {ok:true};}
  if(!['/aquarium','/viewer'].includes(path)) throw new ClientError(404,'route');
  const auth=credential(request);
  const sql=db();

  if(path==='/aquarium' && request.method==='POST'){
    const existing=await sql`SELECT id, revision, document FROM aquariums WHERE owner_hash=${auth}`;
    if(existing[0]) return payload(existing[0],true);
    const {aquarium}=input.parse(await body(request));
    const address=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const client=hash(address);
    const [rate]=await sql`INSERT INTO creation_windows(window_start,client_hash,attempts)
      VALUES(date_trunc('hour',now()),${client},1)
      ON CONFLICT(window_start,client_hash) DO UPDATE SET attempts=creation_windows.attempts+1
      RETURNING attempts`;
    if(Number(rate.attempts)>24) throw new ClientError(429,'rate');
    // Only a fresh aquarium can introduce its initial data. Unlocks are issued here and on writes.
    const fresh=revise({...aquarium,unlocks:[]});
    const rows=await sql`INSERT INTO aquariums(id,owner_hash,document)
      VALUES(${randomUUID()},${auth},${JSON.stringify(fresh)}::jsonb)
      ON CONFLICT(owner_hash) DO NOTHING RETURNING id, revision, document`;
    if(rows[0]) return payload(rows[0],true);
    const [row]=await sql`SELECT id, revision, document FROM aquariums WHERE owner_hash=${auth}`;
    return payload(row,true);
  }

  // Resolve the role from the stored credential for every request.
  const [row]=await sql`SELECT id, owner_hash=${auth} AS is_owner, revision, document
    FROM aquariums WHERE owner_hash=${auth} OR viewer_hash=${auth}`;
  if(!row) throw new ClientError(401,'access');
  if(path==='/aquarium' && request.method==='GET') return payload(row,Boolean(row.is_owner));
  if(!row.is_owner) throw new ClientError(403,'readonly');

  if(path==='/aquarium' && request.method==='PUT'){
    const {aquarium,revision}=editInput.parse(await body(request));
    const prior=row.document as Aquarium;
    const merged=revise(aquarium,prior);
    const [saved]=await sql`UPDATE aquariums SET document=${JSON.stringify(merged)}::jsonb,
        revision=revision+1, updated_at=now()
      WHERE id=${row.id} AND owner_hash=${auth} AND revision=${revision}
      RETURNING id,revision,document`;
    if(!saved) throw new ClientError(409,'conflict');
    return payload(saved,true);
  }
  if(path==='/viewer' && ['POST','DELETE'].includes(request.method)){
    const token=request.method==='POST'?randomBytes(32).toString('base64url'):null;
    await sql`UPDATE aquariums SET viewer_hash=${token?hash(token):null}, updated_at=now()
      WHERE id=${row.id} AND owner_hash=${auth}`;
    return {token};
  }
  throw new ClientError(405,'method');
}
export default {
  async fetch(request:Request) {
    const origin=request.headers.get('origin');
    const headers: Record<string,string>={
      'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff',
    };
    if(origin && !allowedOrigins.has(origin)) return Response.json({error:'origin'},{status:403,headers});
    if(origin) headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,
      'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type'}});
    try { return Response.json(await route(request),{headers}); }
    catch(error) {
      if(error instanceof ClientError) return Response.json({error:error.code},{status:error.status,headers});
      if(error instanceof z.ZodError) return Response.json({error:'invalid'},{status:422,headers});
      console.error('Aquarium API request failed',error instanceof Error ? error.name : 'unknown');
      return Response.json({error:'server'},{status:503,headers});
    }
  },
};
