class ReadCache{
 constructor({ttl=30000,limit=12,now=Date.now}={}){this.ttl=ttl;this.limit=limit;this.now=now;this.entries=new Map();}
 get(key){const item=this.entries.get(key);if(!item)return null;if(item.expires<=this.now()){this.entries.delete(key);return null;}return item;}
 set(key,value){if(this.entries.size>=this.limit&&!this.entries.has(key))this.entries.delete(this.entries.keys().next().value);this.entries.set(key,{...value,expires:this.now()+this.ttl});}
 clear(){this.entries.clear();}
}
module.exports={ReadCache};
