(function(root){
 'use strict';
 class WebStore {
  static KEY='tres-bancos.web.v1';
  constructor(storage,validate){this.storage=storage;this.validate=validate;this.lastRaw=undefined;}
  backend(){return typeof this.storage==='function'?this.storage():this.storage;}
  load(){
   const raw=this.backend().getItem(WebStore.KEY);
   const state=raw===null?null:this.validate(JSON.parse(raw));
   this.lastRaw=raw;return state;
  }
  save(state){
   this.validate(state);
   const storage=this.backend();
   if(this.lastRaw===undefined)throw Error('Reabra a página antes de salvar.');
   if(storage.getItem(WebStore.KEY)!==this.lastRaw)throw Error('Os dados mudaram em outra aba. Recarregue a página antes de salvar.');
   const raw=JSON.stringify(state);
   try{storage.setItem(WebStore.KEY,raw);}catch(e){throw Error('Não foi possível salvar. Verifique o espaço e a permissão de armazenamento do navegador.');}
   this.lastRaw=raw;
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports=WebStore;else root.WebStore=WebStore;
})(typeof window!=='undefined'?window:globalThis);
