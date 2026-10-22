// Frontière d’affichage uniquement : ne modifie ni la fraction ni l’unité canonique.
function formatOrderQuantity(exact,canonicalUnit,{hasQS=false,roundUp=false}={}){
 if(exact===null)return {value:'QS',unit:null,label:'QS'};
 let n=BigInt(exact.numerator),d=BigInt(exact.denominator);
 if(n<0n||d<=0n)throw new RangeError('Fraction exacte positive attendue');
 let unit=canonicalUnit;
 if(unit==='g'||unit==='ml'){d*=1000n;unit=unit==='g'?'kg':'L';}
 if((unit==='kg'||unit==='L')&&n<d){n*=1000n;unit=unit==='kg'?'g':'ml';}
 const tenth=unit==='kg'||unit==='L',ten=unit==='g'||unit==='ml';
 const rn=tenth?n*10n:n,rd=ten?d*10n:d;
 const rounded=roundUp&&unit==='pièces'?(rn+rd-1n)/rd:(2n*rn+rd)/(2n*rd);
 const value=tenth?`${rounded/10n},${rounded%10n}`:String(ten?rounded*10n:rounded);
 return {value,unit,label:`${value} ${unit}${hasQS?' + QS':''}`};
}
module.exports={formatOrderQuantity};
