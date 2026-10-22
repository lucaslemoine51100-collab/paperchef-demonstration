const {calculateOrderServices}=require('../orders/input-adapter');
const {aggregateOrders}=require('../orders/aggregation');
const {orderSheetViewModel}=require('./view-model');
const {renderOrderSheet}=require('./template');
async function generateOrderSheet(repository,selections,options={}){
 const results=await calculateOrderServices(repository,selections);
 const services=[];
 for(let i=0;i<selections.length;i++){
  const s=selections[i],stored=await repository.getService(s.serviceId);
  const raw=s.serviceDate??stored.service_date;
  services.push({...(results[i].plannedServiceId?{plannedServiceId:results[i].plannedServiceId,serviceTemplateId:results[i].serviceTemplateId}:{}),serviceId:s.serviceId,serviceName:require('../pwa/public/service-title').display(await repository.loadService(s.serviceId)),headcount:results[i].covers,serviceDate:raw?(raw instanceof Date?raw.toISOString().slice(0,10):String(raw).slice(0,10)):null,mealType:s.mealType??stored.meal_type,planningSource:s.serviceDate||s.mealType?'selection':'database'});
 }
 const order=aggregateOrders(results),viewModel=orderSheetViewModel(order,services,options);
 return {order,viewModel,html:renderOrderSheet(viewModel)};
}
module.exports={generateOrderSheet};

