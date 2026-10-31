/** Setup gates new work; closed projects retain their read-only history even after funding is released. */
export function projectWorkAvailable(status:string,ready:boolean):boolean{return status==='completed'||status==='archived'||ready;}
