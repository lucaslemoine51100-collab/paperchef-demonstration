const {randomUUID}=require('node:crypto');
const problem=require('./accounts.cjs').problem;
async function initialize(db){await db.query(`CREATE TABLE IF NOT EXISTS paperchef.label_sheets(id text PRIMARY KEY,name text NOT NULL,labels jsonb NOT NULL,cuts boolean NOT NULL,version integer NOT NULL DEFAULT 1,updated_by text REFERENCES paperchef.users(id),updated_at timestamptz NOT NULL DEFAULT now())`);}
async function handle(db,user,method,input){
 if(method==='GET')return (await db.query('SELECT id,name,labels,cuts,version FROM paperchef.label_sheets ORDER BY lower(name),id')).rows;
 if(!['POST','PATCH','DELETE'].includes(method))throw problem('Action indisponible.',405);
 const allowed=method==='DELETE'?['id','version']:method==='PATCH'?['id','version','name']:['id','version','name','labels','cuts'];
 if(!input||Object.keys(input).some(k=>!allowed.includes(k)))throw problem('Fiche invalide.');
 if(input.id!==null&&input.id!==undefined&&(typeof input.id!=='string'||input.id.length>100))throw problem('Fiche invalide.');
 if(input.id&&!Number.isInteger(input.version))throw problem('Version de fiche invalide.');
 if(method==='DELETE'){const result=await db.query('DELETE FROM paperchef.label_sheets WHERE id=$1 AND version=$2 RETURNING id',[input.id,input.version]);if(!result.rows.length)throw problem('Cette fiche a changé ou a été supprimée. Ferme et rouvre l’éditeur.',409);return {deleted:true};}
 if(method==='PATCH'){
  if(!input.id||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>100)throw problem('Nom de fiche invalide.');
  const result=await db.query('UPDATE paperchef.label_sheets SET name=$1,version=version+1,updated_by=$2,updated_at=now() WHERE id=$3 AND version=$4 RETURNING id,version',[input.name.trim(),user.id,input.id,input.version]);
  if(!result.rows.length)throw problem('Cette fiche a changé ou a été supprimée. Ferme et rouvre l’éditeur.',409);
  return result.rows[0];
 }
 const catalog=require('./core/labels/catalog');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>100||typeof input.cuts!=='boolean'||!Array.isArray(input.labels)||input.labels.length!==12)throw problem('Nom ou contenu de fiche invalide.');
 const labels=input.labels.map(l=>{
  if(!l||typeof l.title!=='string'||l.title.length>250||typeof l.subtitle!=='string'||l.subtitle.length>200||!/^#[a-f0-9]{6}$/i.test(l.color)||!['large','medium','small'].includes(l.size)||!Array.isArray(l.allergens)||!Array.isArray(l.marks)||l.allergens.some(id=>!catalog.allergens.some(a=>a.allergenId===id))||l.marks.some(id=>!catalog.marks.some(m=>m.id===id)))throw problem('Un écriteau contient des données invalides.');
  return {title:l.title,subtitle:l.subtitle,color:l.color,size:l.size,allergens:[...new Set(l.allergens)],marks:[...new Set(l.marks)],preset:!!l.preset};
 });
 if(input.id){const result=await db.query('UPDATE paperchef.label_sheets SET name=$1,labels=$2,cuts=$3,version=version+1,updated_by=$4,updated_at=now() WHERE id=$5 AND version=$6 RETURNING id,version',[input.name.trim(),JSON.stringify(labels),input.cuts,user.id,input.id,input.version]);if(!result.rows.length)throw problem('Cette fiche a changé ou a été supprimée. Ferme et rouvre l’éditeur.',409);return result.rows[0];}
 const id=randomUUID();await db.query('INSERT INTO paperchef.label_sheets(id,name,labels,cuts,updated_by) VALUES($1,$2,$3,$4,$5)',[id,input.name.trim(),JSON.stringify(labels),input.cuts,user.id]);return {id,version:1};
}
module.exports={initialize,handle};
