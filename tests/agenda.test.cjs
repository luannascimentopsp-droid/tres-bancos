'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../core.js'),Agenda=require('../agenda.js');
function item(at,extra={}){return {id:'agenda_1',title:'Reunião',notes:'Sala 2',at,advance:15,repeat:'once',completed:[],...extra};}
test('existing financial data remains valid and new accounts start with an empty agenda',()=>{
 const old=Core.initial();delete old.agenda;old.setup=true;old.transactions=[{id:'income_1',kind:'income',account:'c6',cents:1000,date:Core.today(),note:'Salário'}];
 assert.equal(Core.validate(old),old);const fresh=Core.initial();assert.deepEqual(fresh.agenda,[]);fresh.setup=true;fresh.agenda=[item(`${Core.today()}T15:00`)];assert.equal(Core.validate(fresh),fresh);assert.equal(Core.balances(fresh).c6,0);
});
test('agenda records reject malformed or oversized content before sync or restore',()=>{
 const base=Core.initial();base.setup=true;
 for(const bad of [item('2026-02-30T15:00'),item('2026-10-10T25:00'),item(`${Core.today()}T15:00`,{title:' '}),item(`${Core.today()}T15:00`,{advance:7}),item(`${Core.today()}T15:00`,{repeat:'daily'}),item(`${Core.today()}T15:00`,{notes:'x'.repeat(501)}),item(`${Core.today()}T15:00`,{completed:['2026-02-30']})])assert.throws(()=>Core.validate({...base,agenda:[bad]}),/Compromisso inválido/);
 assert.throws(()=>Core.validate({...base,agenda:Array(501).fill(item(`${Core.today()}T15:00`)).map((x,i)=>({...x,id:`a${i}`}))}),/Agenda inválida/);
});
test('yearly events roll forward and completed occurrences advance to next year',()=>{
 const today=Core.today(),[year,month,day]=today.split('-').map(Number),past=`${year-1}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const birthday=item(`${past}T09:30`,{repeat:'yearly'});
 assert.equal(Agenda.dateFor(birthday,today),today);
 birthday.completed=[today];assert.equal(Agenda.dateFor(birthday,today),`${year+1}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
 const leap=item(`${year-1}-02-29T09:30`,{repeat:'yearly'});const feb=`${year}-02-01`;const expected=Core.validDate(`${year}-02-29`)?`${year}-02-29`:`${year}-02-28`;
 assert.equal(Agenda.dateFor(leap,feb),expected);
});
test('reminders respect the configured lead time and stop after the event starts',()=>{
 const at=`${Core.today()}T16:00`,meeting=item(at,{advance:15}),before=new Date(`${Core.today()}T15:44:00`),alert=new Date(`${Core.today()}T15:45:00`),during=new Date(`${Core.today()}T15:59:00`),after=new Date(`${Core.today()}T16:00:00`);
 assert.deepEqual(Agenda.due([meeting],before),[]);assert.equal(Agenda.due([meeting],alert)[0].item.id,meeting.id);assert.equal(Agenda.due([meeting],during).length,1);assert.deepEqual(Agenda.due([meeting],after),[]);
 assert.equal(Agenda.due([item(at,{advance:0})],after).length,1);assert.deepEqual(Agenda.due([item(at,{advance:0})],new Date(`${Core.today()}T16:01:00`)),[]);
 meeting.repeat='yearly';meeting.completed=[Core.today()];assert.deepEqual(Agenda.due([meeting],during),[]);
});
