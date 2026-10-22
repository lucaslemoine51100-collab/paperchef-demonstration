const fs=require('node:fs'),path=require('node:path');
const data=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'ingredient-nutrition.json'),'utf8'));
function normalized(value){return String(value).toLowerCase().replaceAll('œ','oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function profile(name,catalog=data()){
 const key=normalized(name),exact=catalog.ingredients.find(p=>normalized(p.ingredient)===key);
 if(exact)return structuredClone(exact.nutrition);
 const stop=new Set(['de','du','des','en','au','a','et','frais','fraiche','surgele','surgeles','surgelees']),tokens=s=>new Set(normalized(s).split(' ').filter(w=>!stop.has(w)).map(w=>w.replace(/s$/,''))),wanted=tokens(name);
 let candidate=null,score=0;
 for(const item of catalog.ingredients){const words=tokens(item.ingredient),overlap=[...wanted].filter(w=>words.has(w)).length,current=overlap/Math.max(wanted.size,words.size,1);if(current>score){score=current;candidate=item;}}
 if(candidate&&score>=.6){const result=structuredClone(candidate.nutrition);result.quality='estimated';result.note='Correspondance approximative avec '+candidate.ingredient+' ; valeurs moyennes.';return result;}
 return {basis_g:100,state:'unspecified',quality:'unknown',energy_kcal:null,energy_kj:null,protein_g:null,carbohydrate_g:null,sugars_g:null,fat_g:null,saturated_fat_g:null,fibre_g:null,salt_g:null,source:null,note:'Correspondance nutritionnelle non identifiée ; aucune valeur remplacée par zéro.'};
}
async function initialize(db){
 const sql=fs.readFileSync(path.join(__dirname,'core/persistence/022_ingredient_nutrition.sql'),'utf8');if(db.exec)await db.exec(sql);else await db.query(sql);
 const rows=(await db.query('SELECT id,normalized_name FROM catering.ingredients WHERE nutrition_per_100g IS NULL ORDER BY id')).rows;if(!rows.length)return {filled:0,estimated:0,unknown:0};const catalog=data();let estimated=0,unknown=0;
 await db.query('BEGIN');try{for(const row of rows){const value=profile(row.normalized_name,catalog);estimated+=value.quality==='estimated';unknown+=value.quality==='unknown';await db.query('UPDATE catering.ingredients SET nutrition_per_100g=$2::jsonb WHERE id=$1 AND nutrition_per_100g IS NULL',[row.id,JSON.stringify(value)]);}await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}
 return {filled:rows.length,estimated,unknown};
}
module.exports={initialize,profile};
