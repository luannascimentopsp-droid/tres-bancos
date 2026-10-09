(function(root){
 'use strict';
 const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const copy=value=>JSON.parse(JSON.stringify(value));
 class CloudStore {
  constructor({storage,username,validate,request,onStatus=()=>{},onRemote=()=>{},canReceive=()=>true}){
   this.storage=storage;this.key='fac.cloud.v1.'+username;this.validate=validate;this.request=request;
   this.onStatus=onStatus;this.onRemote=onRemote;this.canReceive=canReceive;this.raw=undefined;this.data=null;this.flight=null;
  }
  readLocal(){
   const raw=this.storage.getItem(this.key);
   if(raw===null){this.raw=null;return null;}
   const data=JSON.parse(raw);
   if(data.version!==1||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.pending!=='boolean'||typeof data.conflict!=='boolean')throw Error('Cópia local de sincronização inválida. Os dados foram preservados.');
   this.validate(data.state);this.raw=raw;this.data=data;return copy(data.state);
  }
  write(data){
   if(this.storage.getItem(this.key)!==this.raw)throw Error('Os dados mudaram em outra aba. Aguarde a atualização antes de salvar.');
   const raw=JSON.stringify(data);this.storage.setItem(this.key,raw);this.raw=raw;this.data=data;
  }
  async remote(){
   const response=await this.request('/api/state');if(!response.ok)throw Error('Não foi possível consultar a sincronização.');
   const result=await response.json();
   if(result.configured!==true||!Number.isSafeInteger(result.revision)||result.revision<0||(result.revision===0)!==(result.state===null))throw Error('Sincronização indisponível. Seus dados locais foram preservados.');
   if(result.state)this.validate(result.state);return result;
  }
  async open(legacy,initial){
   const local=this.readLocal();
   try{
    const remote=await this.remote();
    if(local){await this.sync();return copy(this.data.state);}
    const state=remote.state||legacy||initial;this.validate(state);
    this.write({version:1,revision:remote.revision,state:copy(state),pending:remote.state===null&&!!legacy,conflict:false});
    if(remote.state&&legacy&&canonical(remote.state)!==canonical(legacy))this.onStatus('import-preserved');
    else this.onStatus(this.data.pending?'pending':'synced');
    if(this.data.pending)await this.sync();return copy(this.data.state);
   }catch(error){
    if(local){this.onStatus(this.data.conflict?'conflict':'offline');return copy(this.data.state);}
    throw error;
   }
  }
  load(){return this.readLocal();}
  save(state){
   this.validate(state);if(!this.data)throw Error('Aguarde o carregamento dos dados.');
   if(canonical(state)===canonical(this.data.state))return;
   this.write({...this.data,state:copy(state),pending:true});this.onStatus(this.data.conflict?'conflict':'pending');
   void this.sync();
  }
  sync(){
   if(this.flight)return this.flight;
   this.flight=this.exchange().catch(()=>this.onStatus(this.data?.conflict?'conflict':'offline')).finally(()=>{this.flight=null;});
   return this.flight;
  }
  async exchange(){
   this.readLocal();if(!this.data)return;
   if(this.data.conflict){this.onStatus('conflict');return;}
   // Serialize rapid edits. Each successful write advances the revision before sending the next state.
   for(let attempt=0;attempt<8;attempt++){
    if(!this.data.pending)break;
    const sent=copy(this.data);this.onStatus('sending');
    const response=await this.request('/api/state',{method:'POST',body:JSON.stringify({revision:sent.revision,state:sent.state})});
    if(response.status===409){
     const remote=await this.remote();this.readLocal();
     // A previous response may have been lost after the server committed the same data.
     if(canonical(remote.state)===canonical(sent.state)){
      if(this.data.revision<=remote.revision)this.write({...this.data,revision:remote.revision,pending:canonical(this.data.state)!==canonical(sent.state),conflict:false});
      continue;
     }
     if(this.data.revision!==sent.revision)continue;
     this.write({...this.data,conflict:true});this.onStatus('conflict');return;
    }
    if(!response.ok)throw Error('Não foi possível sincronizar.');
    const saved=await response.json();if(saved.revision!==sent.revision+1)throw Error('Versão inesperada do servidor.');
    this.readLocal();
    if(this.data.revision<=saved.revision)this.write({...this.data,revision:saved.revision,pending:canonical(this.data.state)!==canonical(sent.state),conflict:false});
   }
   if(this.data.pending){this.onStatus('pending');return;}
   if(!this.canReceive()){this.onStatus('synced');return;}
   const remote=await this.remote();this.readLocal();
   if(this.data.pending)return;
   if(remote.revision<this.data.revision){this.write({...this.data,conflict:true});this.onStatus('conflict');return;}
   if(!this.canReceive())return;
   if(remote.revision>this.data.revision){
    this.write({...this.data,revision:remote.revision,state:copy(remote.state),pending:false});this.onRemote(copy(remote.state));
   }
   this.onStatus('synced');
  }
  async resolve(choice){
   if(this.flight)await this.flight;
   const remote=await this.remote();this.readLocal();
   // Preserve both versions locally before an explicit conflict-resolution choice.
   const archive=this.key+'.backup.'+Date.now();this.storage.setItem(archive,JSON.stringify({local:this.data,remote}));
   if(choice==='remote'){
    if(!remote.state)throw Error('Ainda não há versão online para usar.');
    this.write({...this.data,state:copy(remote.state),revision:remote.revision,pending:false,conflict:false});this.onRemote(copy(remote.state));this.onStatus('synced');
   }else if(choice==='local'){
    this.write({...this.data,revision:remote.revision,pending:true,conflict:false});await this.sync();
   }else throw Error('Escolha inválida.');
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports=CloudStore;else root.CloudStore=CloudStore;
})(typeof window!=='undefined'?window:globalThis);
