import type {WorkCommand,WorkNode,WorkRequest,WorkTreeSnapshot} from '../types';

export interface WorkEdit {command:WorkCommand;node?:WorkNode;itemId?:string;recoveryRevision?:number;parent?:string|null;root?:boolean}
export interface WorkEditorFields {
 title:string;due:string;lead:string;people:string[];parent:string;standalone:boolean;note:string;progress:number;order:string[];
}
export interface WorkEditorBaseline {
 actorId:string|null;rootId:string;projectId:string;officeId:string|null;kind:'office'|'personal';revision:number;
 command:WorkCommand;nodeId:string|null;createdId:string;fields:WorkEditorFields;
}
export type WorkRequestFailureKind='confirmed_failure'|'stale_revision'|'unknown_result'|'revoked_authority';
export type WorkEditorOutcome={kind:'idle'|'saving'}|{kind:WorkRequestFailureKind;message:string}
 |{kind:'committed';receipt:WorkTreeSnapshot}|{kind:'committed_refresh_failed';receipt:WorkTreeSnapshot;message:string};
/** A transport-confirmed RPC failure remains an Error with its original message. */
export class WorkRequestFailure extends Error {
 constructor(public readonly kind:WorkRequestFailureKind,message:string){super(message);this.name='WorkRequestFailure';}
}
export interface WorkEditorSaveOptions {
 save:(request:WorkRequest)=>Promise<WorkTreeSnapshot>;
 onDone:(receipt:WorkTreeSnapshot)=>void|Promise<void>;
 /** UI confirmation is supplied by the mode composition, never by draft logic. */
 confirm?:()=>Promise<boolean>;
 /** Prepare confirmation against these frozen terms; null cancels without sending. */
 prepare?:(request:WorkRequest)=>Promise<string|null|undefined>;
 impactFingerprint?:string;
}
