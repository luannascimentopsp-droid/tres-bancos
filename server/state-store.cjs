'use strict';
const Core=require('../core.js');
const SCHEMA=`CREATE TABLE IF NOT EXISTS facilitator_state (
 username TEXT PRIMARY KEY,
 revision INTEGER NOT NULL CHECK (revision > 0),
 state JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
class StateStore {
 constructor(database){this.database=database;this.ready=null;}
 async init(){if(!this.ready)this.ready=this.database.query(SCHEMA).catch(error=>{this.ready=null;throw error;});await this.ready;}
 async read(username){
  await this.init();const result=await this.database.query('SELECT revision, state FROM facilitator_state WHERE username=$1',[username]);
  return result.rows[0]||{revision:0,state:null};
 }
 async write(username,revision,state){
  if(!Number.isSafeInteger(revision)||revision<0||revision>=2147483647)throw Object.assign(Error('Versão inválida.'),{status:400});
  try{Core.validate(state);}catch{throw Object.assign(Error('Dados financeiros inválidos. Confira os valores e as datas.'),{status:400});}
  await this.init();
  // Compare-and-swap in one SQL statement: concurrent devices never silently overwrite each other.
  const result=revision===0?
   await this.database.query('INSERT INTO facilitator_state (username,revision,state) VALUES ($1,1,$2::jsonb) ON CONFLICT (username) DO NOTHING RETURNING revision',[username,JSON.stringify(state)]):
   await this.database.query('UPDATE facilitator_state SET state=$3::jsonb,revision=revision+1,updated_at=NOW() WHERE username=$1 AND revision=$2 RETURNING revision',[username,revision,JSON.stringify(state)]);
  if(!result.rows.length)throw Object.assign(Error('Os dados foram alterados em outro aparelho. Confira as versões antes de continuar.'),{status:409});
  return result.rows[0];
 }
}
function connect(connectionString){
 const url=new URL(connectionString);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('DATABASE_URL precisa ser uma conexão PostgreSQL.');
 // Always verify TLS; connection-string SSL options must not disable certificate checks.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 const {Pool}=require('pg');const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:15000});
 pool.on('error',()=>console.error('Conexão de sincronização indisponível.'));
 return new StateStore(pool);
}
module.exports={StateStore,connect};
