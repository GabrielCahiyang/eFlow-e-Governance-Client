import {WorkRequestFailure,type WorkRequestFailureKind} from '../types/editor';

export function workRpcFailure(error:{code?:string;message:string}):WorkRequestFailure {
 const code=error.code||'';
 let kind:WorkRequestFailureKind='unknown_result';
 if(code==='40001')kind='stale_revision';
 else if(code==='42501')kind='revoked_authority';
 // Only explicit transaction rejection/rollback or missing RPC is a known
 // non-commit. Connection/server failures and untyped errors remain uncertain.
 else if(/^(22|23)/.test(code)||['P0001','40P01','55P03','57014','PGRST202'].includes(code))kind='confirmed_failure';
 return new WorkRequestFailure(kind,error.message);
}
export function workRequestFailure(reason:unknown):WorkRequestFailure {
 return reason instanceof WorkRequestFailure?reason:new WorkRequestFailure('unknown_result',reason instanceof Error?reason.message:'Could not verify the work receipt. Retry the same request.');
}
