// Projection de présentation ; les recettes et commandes du moteur restent intactes.
const {format}=require('../engine');
const clean=name=>name.replace(/\s*[·—-]?\s*(fabrication commune|commune|commun)\b/gi,'').trim();
const rational=x=>({n:BigInt(x.numerator),d:BigInt(x.denominator)});
const add=(a,b)=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d});
function presentationBlocks(vm){
 const components=structuredClone(vm.components),preparations=structuredClone(vm.sharedPreparations),extras=[];
 for(const prep of preparations){
  const targets=prep.allocations.map(a=>({allocation:a,component:components.find(c=>c.id===a.targetId||c.name===a.to)})).filter(t=>t.component);
  const embedded=/marinade|béchamel|sauce tomate persillée|sauce paprika intégrée/i.test(prep.name);
  if(embedded){
   const weights=targets.map(({allocation:a,component:c})=>a.exact?rational(a.exact):c.ingredients.find(i=>i.fromPreparation===prep.id&&i.exact)?.exact?rational(c.ingredients.find(i=>i.fromPreparation===prep.id&&i.exact).exact):{n:BigInt(c.calculatedPortions),d:1n});
   const total=weights.reduce(add,{n:0n,d:1n});if(!total.n)throw Error('Répartition de recette intégrée nulle : '+prep.name);
   targets.forEach(({component:c},index)=>{
    const weight=weights[index],ingredients=prep.ingredients.map(i=>{
     if(!i.exact)return {...i};const q=rational(i.exact),f={n:q.n*weight.n*total.d,d:q.d*weight.d*total.n};
     return {...i,exact:{numerator:String(f.n),denominator:String(f.d)},displayQuantity:format(f,i.displayUnit)};
    });
    c.ingredients=c.ingredients.filter(i=>i.fromPreparation!==prep.id);
    (c.recipeSections??=[]).push({name:clean(prep.name),ingredients,preparationSteps:prep.preparationSteps,notes:prep.notes});
    c.allergens=[...new Set([...c.allergens,...prep.allergens])];
    c.reviewNames=[...new Set([...c.reviewNames,...prep.reviewNames])];
   });
   continue;
  }
  const puree=/purée/i.test(prep.name),reserve=targets.find(t=>t.component.ingredients.length&&t.component.ingredients.every(i=>i.internalTransfer));
  const block={...prep,shared:false,name:clean(prep.name),categories:[[puree?'Féculent':'Sauce']],colorProfile:puree?'starch':'sauce',calculatedPortions:null};
  block.allocations=prep.allocations.map(a=>({...a,to:reserve&&a.to===reserve.component.name?'Service':a.to}));
  if(reserve){const c=reserve.component;block.id=c.id;block.name=clean(c.name).replace(/\s*[·—-]?\s*réserv[ée]+.*service/i,'').trim();Object.assign(c,block);}
  else extras.push(block);
  for(const {component:c}of targets){if(reserve?.component===c)continue;for(const i of c.ingredients)if(i.fromPreparation===prep.id)i.name=block.name+' — voir la case '+(puree?'Féculent':'Sauce');}
 }
 return [...components,...extras];
}
module.exports={presentationBlocks};
