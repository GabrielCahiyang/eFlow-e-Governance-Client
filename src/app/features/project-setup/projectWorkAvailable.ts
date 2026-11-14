/** Only a Planning workspace needs a completed setup before showing its work. */
export function projectWorkAvailable(status:string,ready:boolean):boolean {
 return ['active','on_hold','completed','archived'].includes(status)||ready;
}
