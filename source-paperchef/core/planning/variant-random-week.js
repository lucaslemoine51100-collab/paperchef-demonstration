const variants=require('../../service-variants.cjs'),{features}=require('./random-week');
// Keep the template identity: two variants of one service cannot repeat in a week.
async function candidates(repo,services){
 if(!variants.enabled())return services;
 return require('../../variant-performance.cjs').memo(repo,'random-candidates:'+require('../../coherent-variants.cjs').revision()+':'+JSON.stringify(services),async()=>{
  const result=[];
  for(const base of services){
   result.push(base);const seen=new Set([JSON.stringify(base.components.map(c=>c.name))]);
   for(const spec of (await variants.options(repo,{templateId:base.id})).items){
    if(!spec.components.length)continue;
    const components=spec.components,signature=JSON.stringify(components.map(c=>c.name));if(seen.has(signature))continue;seen.add(signature);
    const flags=spec.features;result.push({...base,...flags,name:components.map(c=>c.name).join(' · '),components,variantChoice:spec.id,variantPreview:{id:spec.id,components,features:flags}});
   }
  }
  return result;
 });
}
module.exports={candidates};
