// Référentiel unique des catégories d’achat, ordre métier officiel.
const PURCHASE_CATEGORIES=Object.freeze([
 {category:'Dairy',label:'Crémerie'},
 {category:'Meat',label:'Viande'},
 {category:'Fish',label:'Poisson'},
 {category:'Frozen',label:'Surgelé'},
 {category:'FreshProduce',label:'Fruits et légumes frais'},
 {category:'Grocery',label:'Épicerie'}
].map(Object.freeze));
const categoryLabels=Object.freeze(Object.fromEntries(PURCHASE_CATEGORIES.map(c=>[c.category,c.label])));
module.exports={PURCHASE_CATEGORIES,categoryLabels};
