/** Exclusive end of the chosen local date, including DST rather than a fixed UTC offset. */
export function accessEnd(date:string,timezone:string):string|null{
 if(!date)return null;
 const [year,month,day]=date.split('-').map(Number);const target=Date.UTC(year,month-1,day+1);let instant=target;
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){const parts=Object.fromEntries(formatter.formatToParts(instant).map(p=>[p.type,p.value]));const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);instant+=target-local;}
 return new Date(instant).toISOString();
}
export function accessEndDate(instant:string|null,timezone:string):string{
 if(!instant)return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant).getTime()-1).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
