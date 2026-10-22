const {toDomain,createCalculator}=require('./adapter');
// Source calculée commune aux projections cuisine et achat, rechargée à chaque appel.
async function calculateService(repository,serviceId,headcount){
 if(typeof serviceId!=='string'||!serviceId.trim())throw new Error('service_id existant requis');
 const snapshot=await repository.loadService(serviceId),mapped=toDomain(snapshot);
 const result=createCalculator({[serviceId]:mapped.service})(headcount??mapped.metadata.headcount,serviceId);
 if(snapshot.service.planned_service_id)Object.assign(result,{plannedServiceId:snapshot.service.planned_service_id,serviceTemplateId:snapshot.service.service_template_id});
 return {snapshot,metadata:mapped.metadata,result};
}
module.exports={calculateService};
