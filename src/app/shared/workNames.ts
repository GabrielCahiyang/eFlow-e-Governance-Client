export const normalizedWorkName=(name:string)=>name.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
export function duplicateWorkNameError(title:string,siblings:readonly {id?:string;title:string}[],kind='Item',currentId?:string){
 const key=normalizedWorkName(title);if(!key)return `${kind} name is required.`;
 return siblings.some(item=>(!currentId||item.id!==currentId)&&normalizedWorkName(item.title)===key)?`A ${kind.toLowerCase()} with this name already exists here. Use a different name.`:'';
}
