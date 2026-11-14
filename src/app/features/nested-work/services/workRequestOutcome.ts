import {WorkRequestFailure,type WorkRequestFailureKind} from '../types/editor';

export function workRpcFailure(error:{code?:string;message:string}):WorkRequestFailure {
 if(error.code==='23505'&&error.message.includes('eflow_unique_'))return new WorkRequestFailure('confirmed_failure','A subtask with this name already exists here. Use a different name.');
 const code=error.code||'';
 if(code==='57014'||/canceling statement due to statement timeout/i.test(error.message))return new WorkRequestFailure('confirmed_failure','The database stopped this change because it took too long. The transaction was rolled back. Reload the latest work, then try again.');
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
