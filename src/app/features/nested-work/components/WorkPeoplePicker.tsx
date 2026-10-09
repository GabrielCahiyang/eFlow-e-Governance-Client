import {useState} from 'react';
import {ProjectInvitations} from '../../project-invitations';
import type {WorkPerson} from '../types';
export function WorkPeoplePicker({people,selected,lead,onSelected,onLead,canAppoint,disabled=false,invite}:{invite?:{project:string;office:string|null;root:string;node?:string};people:WorkPerson[];selected:string[];lead:string;onSelected:(ids:string[])=>void;onLead:(id:string)=>void;canAppoint:boolean;disabled?:boolean}){
 const [query,setQuery]=useState('');const eligible=people.filter(p=>p.eligible!==false);const names=(id:string)=>people.find(p=>p.id===id)?.name||'Previously assigned person';
 return <fieldset disabled={disabled} className="r7-people"><legend>Lead and contributors</legend>
  <div className="r7-chips">{selected.map(id=><span key={id}>{names(id)}{id===lead?' · Lead':<button type="button" aria-label={'Remove contributor '+names(id)} onClick={()=>onSelected(selected.filter(person=>person!==id))}>Remove</button>}</span>)}</div>
  {canAppoint?<label>Appointed lead<select value={lead} onChange={e=>{onLead(e.target.value);if(e.target.value&&!selected.includes(e.target.value))onSelected([...selected,e.target.value]);}}><option value="">Choose project person</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>:<p>Lead: {names(lead)} · Lead transfer requires an authorized ancestor.</p>}
  <label>Find project people<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="r7-people-list">{eligible.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={p.id===lead} onChange={e=>onSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>{p.name}{p.id===lead?' · Lead':' · Contributor'}</label>)}</div>
  {!eligible.length&&<p>No eligible selected people. Ask the responsible Office Head to add onboarded members in project Members.</p>}
  {invite&&<ProjectInvitations {...invite} canRequest={!disabled}/> }
 </fieldset>;
}
