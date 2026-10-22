// POST is also used to calculate an unsaved recipe preview. It must stay fresh,
// but must not invalidate saved catalogue data or schedule catalogue warming.
const previewPaths=new Set(['/api/library/preview','/api/assembly/preview']);
function isReadOnlyPreview(method,path){return method==='POST'&&previewPaths.has(path);}
module.exports={isReadOnlyPreview};
