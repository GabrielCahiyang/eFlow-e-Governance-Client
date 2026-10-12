export interface NavigationRestore {workspaceId?:string;parameters:Record<string,string>}
const keys=['workspace','project','view','plans','date','q','workScope','recent'] as const;
/** Display-route preferences only; never restore an evidence or mutation identity. */
export function navigationParameters(value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(keys.flatMap(key=>typeof (value as Record<string,unknown>)[key]==='string'?[[key,(value as Record<string,string>)[key]]]:[]));
}
