import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/basin-boundaries.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: createRequire(import.meta.url) });
const { combineBasinBoundaries, basinOutsideMask } = exports;
const boundary = coordinates => ({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates}}]});
const square = (x,y,size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function within(point,collection){return !!collection?.features.some(({geometry:g})=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).some(poly=>inRing(point,poly[0])&&!poly.slice(1).some(hole=>inRing(point,hole))));}
assert.equal(combineBasinBoundaries([]),null);
assert.equal(basinOutsideMask(null),null);
const a=boundary([square(0,0,4)]),b=boundary([square(2,2,4)]);
const both=combineBasinBoundaries([a,b]);
assert.equal(both.features.length,2);
const mask=basinOutsideMask(both);
for(const point of [[1,1],[3,3],[5,5]])assert.equal(within(point,mask),false,'Each basin and their overlap stay clear');
assert.equal(within([7,7],mask),true);
assert.equal(within([5,5],basinOutsideMask(a)),true,'Unselected basin is shaded');
const holed=boundary([square(0,0,6),square(2,2,2)]);
assert.equal(within([3,3],basinOutsideMask(holed)),true,'Interior holes stay shaded');
assert.equal(within([3,3],basinOutsideMask(combineBasinBoundaries([holed,b]))),false,'Other selected basin can cover a hole');
const pa=JSON.parse(readFileSync('public/boundaries/pa-phayom-basin.geojson','utf8'));
const tha=JSON.parse(readFileSync('public/gis/thanae_basin.geojson','utf8'));
for(const selection of [[pa],[tha],[pa,tha]]){
 const combined=combineBasinBoundaries(selection),outside=basinOutsideMask(combined);
 let clear=0;
 for(let lat=7.57;lat<8;lat+=.0073)for(let lng=99.71;lng<100.3;lng+=.0077){
  const point=[lng,lat];const inside=selection.some(item=>within(point,item));
  assert.equal(within(point,outside),!inside,`Mask mismatch at ${point}`);
  if(inside)clear++;
 }
 assert.ok(clear>0);
}
console.log('PASS: single and combined basins, overlaps, holes, disabled boundaries, and actual basin coverage');
