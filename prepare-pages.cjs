const fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'docs');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(output),assets=files.map(p=>'/'+path.relative(output,p).replaceAll('\\','/')).sort((a,b)=>b.length-a.length);
for(const file of files){if(!/\.(js|css|html|webmanifest)$/.test(file)||path.basename(file)==='worker.js')continue;let text=fs.readFileSync(file,'utf8');for(const asset of assets)text=text.replaceAll(asset,'.'+asset);for(const prefix of ['/pdf-runtime/','/help-images/'])text=text.replaceAll("'"+prefix,"'"+'.'+prefix).replaceAll('"'+prefix,'"'+'.'+prefix);if(path.basename(file)==='manifest.webmanifest'){const manifest=JSON.parse(text);manifest.start_url='./';manifest.scope='./';text=JSON.stringify(manifest);}fs.writeFileSync(file,text);}
const worker=path.join(output,'worker.js');fs.writeFileSync(worker,"const pagesFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,options)=>pagesFetch(typeof input==='string'&&input.startsWith('/')?new URL('.'+input,import.meta.url):input,options);\n"+fs.readFileSync(worker,'utf8'));
fs.writeFileSync(path.join(output,'.nojekyll'),'');
console.log('GitHub Pages : '+files.length+' fichiers préparés.');
