// Normalisation de comparaison ; aucun retrait des accents ou qualificatifs produit.
function ingredientKey(name) {
  if(typeof name!=='string'||!name.trim())throw new TypeError('Nom d’ingrédient requis');
  return name.normalize('NFC').replace(/[’‘]/g,"'").replace(/\s+/gu,' ').trim().toLocaleLowerCase('fr');
}
module.exports={ingredientKey};
