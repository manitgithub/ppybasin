import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = (path) => ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const registry = {};
vm.runInNewContext(compile('src/lib/cctv-stations.ts'), {exports:registry});
const {cctvStations,publicCctvCamera,isPublicCctvCamera}=registry;
assert.equal(cctvStations.length,7);
assert.equal(isPublicCctvCamera('PLG01-02'),true);
assert.equal(publicCctvCamera('TX83-01').imageUrl,'https://telerid.rid.go.th/restapi/main/camera/1/SKA-TX83/image.jpg');
for(const input of ['TPN11-02','https://example.com','../TX83-01','TX83-02','PLG01-01?src=x'])assert.equal(publicCctvCamera(input),null);
const boundary=JSON.parse(readFileSync('public/boundaries/pa-phayom-basin.geojson','utf8'));
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
const within=(point)=>boundary.features.some(({geometry:g})=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).some(poly=>inRing(point,poly[0])&&!poly.slice(1).some(hole=>inRing(point,hole))));
const rid=cctvStations.filter(s=>s.provider==='rid');
assert.equal(rid.length,5);
for(const station of rid)assert.equal(within([station.lng,station.lat]),['TSL11','TX83'].includes(station.code),`${station.code} basin location`);
const added = [
 {code:'TPN11',id:682,lat:7.891563,lng:99.908885,path:'/1/SSE-U-TPN11/image.jpg'},
 {code:'TX276',id:754,lat:7.706969,lng:99.842081,path:'/1/SKA-TX276/image.jpg'},
 {code:'TSL12',id:720,lat:7.72914,lng:99.914,path:'/1/SKA-TSL12/image.jpg'},
];
for(const {code,id,lat,lng,path} of added){
 const source=publicCctvCamera(`${code}-01`);
 assert.equal(source.station.ridStationId,id);
 assert.equal(source.station.lat,lat);assert.equal(source.station.lng,lng);
 assert.equal(source.imageUrl,`https://telerid.rid.go.th/restapi/main/camera${path}`);
}
const envelope=(code='TX83',unixtime=1792224900,path=`/1/SKA-${code}/image.jpg`)=>JSON.stringify({message:JSON.stringify({code,values:{cctv:{'1':{path,unixtime}}}})});
let sockets=0,closes=0;
class FakeSocket {
 constructor(){sockets++;queueMicrotask(()=>this.onmessage?.({data:envelope()}));}
 close(){closes++;this.onclose?.();}
}
const ridModule={};
vm.runInNewContext(compile('src/lib/rid-cctv.ts'),{exports:ridModule,require:()=>registry,WebSocket:FakeSocket,setTimeout,clearTimeout,Date});
const now=Date.parse('2026-10-17T08:40:00Z');
assert.equal(ridModule.parseRidCameraTime(envelope(),'TX83',now),'2026-10-17T08:15:00.000Z');
assert.equal(ridModule.parseRidCameraTime(envelope('TSL11',1786645800),'TSL11',now),'2026-08-13T18:30:00.000Z');
for(const {code,path} of added)assert.equal(ridModule.parseRidCameraTime(envelope(code,1792224900,path),code,now),'2026-10-17T08:15:00.000Z');
assert.equal(ridModule.parseRidCameraTime(envelope('TPN11'),'TPN11',now),null);
assert.equal(ridModule.parseRidCameraTime(envelope(),'TSL11',now),null);
assert.equal(ridModule.parseRidCameraTime(envelope('TX83',1792224900,'https://example.com/image.jpg'),'TX83',now),null);
assert.equal(ridModule.parseRidCameraTime(envelope('TX83',now/1000+3600),'TX83',now),null);
assert.equal(ridModule.parseRidCameraTime(envelope('TX83',0),'TX83',now),null);
const [first,second]=await Promise.all([ridModule.getRidCameraStatus('TX83-01'),ridModule.getRidCameraStatus('TX83-01')]);
assert.equal(first,second);assert.equal(sockets,1);assert.equal(closes,1);
await ridModule.getRidCameraStatus('TX83-01');assert.equal(sockets,1);
await assert.rejects(()=>ridModule.getRidCameraStatus('PLG01-01'));
let requests=[];
const imageRoute={};
let response=()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'content-type':'image/jpg'}});
vm.runInNewContext(compile('src/app/api/cctv/[camera]/image/route.ts'),{exports:imageRoute,require:()=>registry,Response,AbortSignal,fetch:async(url)=>{requests.push(url);return response();}});
const get=(camera)=>imageRoute.GET(new Request('http://localhost'),{params:Promise.resolve({camera})});
assert.equal((await get('TX83-01')).status,200);
assert.match(requests[0],/^https:\/\/telerid\.rid\.go\.th\/restapi\/main\/camera\//);
assert.equal((await get('PLG01-01')).status,200);
assert.match(requests[1],/^https:\/\/cctv\.disaster\.go\.th\//);
for(const {code,path} of added){
 assert.equal((await get(`${code}-01`)).status,200);
 assert.equal(requests.at(-1),`https://telerid.rid.go.th/restapi/main/camera${path}`);
}
const before=requests.length;assert.equal((await get('../invalid')).status,404);assert.equal(requests.length,before);
response=()=>new Response('not a JPEG',{headers:{'content-type':'image/jpeg'}});
assert.equal((await get('TX83-01')).status,503);
response=()=>new Response('unavailable',{status:500});assert.equal((await get('TSL11-01')).status,503);
response=()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}});assert.equal((await get('TX83-01')).status,503);
console.log('PASS: RID basin and nearby stations, official camera paths, DDPM preservation, camera allowlist, JPEG/jpg support, invalid images, upstream failure, official timestamp validation, stale date preservation, metadata cache/coalescing, socket cleanup');
