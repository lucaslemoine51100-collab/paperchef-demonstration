const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function discover(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?(['node_modules','public'].includes(entry.name)?[]:discover(file)):(entry.name==='tests.js'||entry.name.endsWith('.test.js')?[file]:[]);});}
const files=discover(__dirname).sort();
const result=spawnSync(process.execPath,[...process.execArgv,'--test','--test-concurrency=2',...files],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
