export type PettyAction='replenish'|'request'|'approve'|'reject'|'cancel'|'release'|'receipts'|'endorse'|'return_receipts'|'settle';
export interface OfficeReceipt {vendor:string;number:string;date:string;amount:number;path:string}
export interface OfficeCashRequest {id:string;requester:string;requesterName:string;purpose:string;amount:number;spent:number;status:string;receipts:OfficeReceipt[];created_at:string}
export interface OfficeCashSnapshot {ceiling:number;receiptLimit:number;cash:number;reserved:number;available:number;outstanding:number;replenishable:number;requests:OfficeCashRequest[];events:{id:number;action:string;amount:number;reference:string;actorName:string;created_at:string}[]}
export interface OfficeCashCommand {key:string;action:PettyAction;data:Record<string,unknown>}
