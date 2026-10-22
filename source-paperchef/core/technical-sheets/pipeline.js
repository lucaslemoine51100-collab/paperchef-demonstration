const {calculateService}=require('../persistence/service-calculation');
const {technicalSheetViewModel}=require('./view-model');
const {renderTechnicalSheet}=require('./template');
async function generateTechnicalSheet(repository,serviceId,headcount){
 const {snapshot,metadata,result}=await calculateService(repository,serviceId,headcount);
 const viewModel=technicalSheetViewModel(result,snapshot,metadata);
 return {result,viewModel,html:renderTechnicalSheet(viewModel)};
}
module.exports={generateTechnicalSheet};
