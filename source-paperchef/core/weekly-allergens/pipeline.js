const {weeklyAllergenSheetViewModel}=require('./view-model');
const {renderWeeklyAllergenSheet}=require('./template');
async function generateWeeklyAllergenSheet(repository,selections,options){const viewModel=await weeklyAllergenSheetViewModel(repository,selections,options);return {viewModel,html:renderWeeklyAllergenSheet(viewModel)};}
module.exports={generateWeeklyAllergenSheet};
