function allowsSlot(category,day,period){
 if(!Number.isInteger(day)||day<0||day>6||!['lunch','dinner'].includes(period))return false;
 const fridayDinner=day===4&&period==='dinner';
 if(fridayDinner)return category==='friday_dinner';
 if(category==='friday_dinner')return false;
 if(category==='all')return true;
 if(category==='lunch')return period==='lunch';
 if(category==='weekday_lunch')return day<5&&period==='lunch';
 if(category==='weekday')return day<5;
 return false;
}
module.exports={allowsSlot};
