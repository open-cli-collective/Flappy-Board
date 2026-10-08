/* Optional in-memory HTTP/SSE adapter. Node 20+; no npm install. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('./core.js');
function createServer({token=process.env.API_TOKEN||''}={}){
  let config=C.config(),message={lines:[]};const clients=new Set();
  const respond=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const snapshot=()=>({config,message,connectedDisplays:clients.size});
  const send=(res,type,data)=>res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  const broadcast=(type,data)=>{for(const res of clients)send(res,type,data);};
  const authorized=req=>{if(!token)return true;const received=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);return received.length===expected.length&&crypto.timingSafeEqual(received,expected);};
  const read=req=>new Promise((resolve,reject)=>{const chunks=[];let size=0,failed=false;req.on('data',chunk=>{size+=chunk.length;if(size>262144){if(!failed){failed=true;reject(Object.assign(Error('Body exceeds 256 KiB'),{status:413}));}return;}chunks.push(chunk);});req.on('end',()=>{if(failed)return;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Object.assign(Error('Invalid JSON'),{status:400}));}});req.on('error',reject);});
  const files=new Set(['index.html','live.html','API.html','README.txt','catalog-study.html','visuals.js','core.js','board.js','browser-tests.html']);
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');const route=url.pathname;
      if(route.startsWith('/api/')){
        if(!authorized(req))return respond(res,401,{accepted:false,errors:[{code:'UNAUTHORIZED',message:'Bearer token required'}]});
        if(req.method==='GET'&&route==='/api/state')return respond(res,200,snapshot());
        if(req.method==='GET'&&route==='/api/events'){
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});clients.add(res);send(res,'snapshot',snapshot());
          const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
          res.on('close',()=>{clearInterval(heartbeat);clients.delete(res);});return;
        }
        if(req.method==='POST'&&route==='/api/message'){
          const input=await read(req);const normalized=C.message(input,config);message=input;broadcast('message',message);
          return respond(res,200,{accepted:true,id:normalized.id,warnings:normalized.warnings,connectedDisplays:clients.size});
        }
        if(req.method==='PATCH'&&route==='/api/config'){
          const patch=await read(req),next=C.config(patch,config),resized=next.columns!==config.columns||next.rows!==config.rows;
          const base=C.message(message,config).base;config=next;
          // Reconnect reflects configure semantics: effects stop, and resize clears.
          message=resized?{lines:[]}:{id:message.id??undefined,cells:base.map((face,i)=>({at:{x:i%config.columns,y:Math.floor(i/config.columns)},value:face.color?{color:face.color}:face.text})),transition:{type:'instant'}};
          broadcast('config',config);return respond(res,200,{accepted:true,cleared:resized,config});
        }
        if(req.method==='POST'&&route==='/api/clear'){message={lines:[]};broadcast('message',message);return respond(res,200,{accepted:true});}
        return respond(res,404,{accepted:false,errors:[{code:'NOT_FOUND',message:'Unknown API route or method'}]});
      }
      if(req.method!=='GET')return respond(res,405,{error:'GET required'});
      const file=route==='/'?'index.html':route.slice(1);if(!files.has(file))return respond(res,404,{error:'Not found'});
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(path.join(__dirname,file)).pipe(res);
    }catch(error){respond(res,error.status||422,{accepted:false,errors:[{code:error.status===400?'INVALID_JSON':'INVALID_REQUEST',message:error.message}]});}
  });
  server.on('close',()=>{for(const res of clients)res.end();});return server;
}
if(require.main===module){const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8787);createServer().listen(port,host,()=>console.log(`Split-flap: http://${host}:${port}/live.html (display), / (playground)`));}
module.exports={createServer};
