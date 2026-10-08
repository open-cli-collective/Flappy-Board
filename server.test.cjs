const {test}=require('node:test');const assert=require('node:assert/strict');const {createServer}=require('./server.cjs');
test('HTTP adapter: authorization, SSE delivery, validation and config state',async()=>{
const server=createServer({token:'test-token'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;const headers={Authorization:'Bearer test-token','Content-Type':'application/json'};let reader;
try{
assert.equal((await fetch(url+'/api/state')).status,401);
const events=await fetch(url+'/api/events',{headers});reader=events.body.getReader();const decoder=new TextDecoder();assert.match(decoder.decode((await reader.read()).value),/event: snapshot/);
let response=await fetch(url+'/api/config',{method:'PATCH',headers,body:JSON.stringify({columns:3,rows:1})});assert.equal(response.status,200);assert.match(decoder.decode((await reader.read()).value),/event: config/);
response=await fetch(url+'/api/message',{method:'POST',headers,body:JSON.stringify({id:'test',lines:['👩‍💻界AB'],effects:[{at:{x:1,y:0},frames:['A','B'],intervalMs:100}]})});const receipt=await response.json();assert.equal(receipt.accepted,true);assert.equal(receipt.warnings[0].code,'ROW_TRUNCATED');assert.equal(receipt.connectedDisplays,1);assert.match(decoder.decode((await reader.read()).value),/event: message/);
response=await fetch(url+'/api/message',{method:'POST',headers,body:'{"lines":[12]}'});assert.equal(response.status,422);assert.equal((await (await fetch(url+'/api/state',{headers})).json()).message.id,'test');
await fetch(url+'/api/config',{method:'PATCH',headers,body:'{"characterScale":1.5}'});let state=await (await fetch(url+'/api/state',{headers})).json();assert.equal(state.message.effects,undefined);assert.equal(state.message.cells[0].value,'👩‍💻');
await fetch(url+'/api/clear',{method:'POST',headers});state=await (await fetch(url+'/api/state',{headers})).json();assert.deepEqual(state.message.lines,[]);
assert.equal((await fetch(url+'/board.js')).status,200);assert.equal((await fetch(url+'/server.cjs')).status,404);
}finally{if(reader)await reader.cancel();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
