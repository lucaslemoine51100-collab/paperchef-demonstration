(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.ReferenceFormat=value;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
// Dosages de référence : précision lisible, fractions exactes conservées dans le ViewModel.
function formatReferenceQuantity(line){
 if(!line.exact)return line.displayQuantity;
 const n=BigInt(line.exact.numerator),d=BigInt(line.exact.denominator),tenths=['kg','L'].includes(line.unit),tens=['g','ml'].includes(line.unit);
 if(tens){const hundredths=(2n*n*100n+d)/(2n*d),whole=hundredths/100n,tail=String(hundredths%100n).padStart(2,'0').replace(/0+$/,'');return String(whole)+(tail?','+tail:'')+' '+line.unit;}
 const numerator=tenths?n*10n:n,denominator=tens?d*10n:d,rounded=(2n*numerator+denominator)/(2n*denominator);
 const value=tenths?String(rounded/10n)+','+String(rounded%10n):String(tens?rounded*10n:rounded);
 const unit=rounded===1n&&!tens?({plaques:'plaque',bacs:'bac',portions:'portion',unités:'unité',pièces:'pièce'}[line.unit]||line.unit):line.unit;
 return value+' '+unit;
}
return {formatReferenceQuantity};

});
