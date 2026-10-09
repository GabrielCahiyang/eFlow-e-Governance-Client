import {useEffect,useState} from 'react';
import {openShare} from '../services/accessService';
import '../projectAccess.css';
export function ShareRedemptionPage(){
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const grant=new URLSearchParams(window.location.search).get('grant');if(!grant){setError('This share link is incomplete. Request a fresh link from the authorized Head.');return;}void openShare(grant).then(result=>{if(!active)return;const url=new URL('/projects',window.location.origin);url.searchParams.set('page','Projects');url.searchParams.set('project',result.project);url.searchParams.set('workspace',result.workspace);url.searchParams.set('view','tasks');window.location.replace(url.href);}).catch(reason=>{if(active)setError((reason as Error).message);});return()=>{active=false;};},[]);
 return <main className="r9-share-page"><h1>{error?'This project share is unavailable.':'Checking your project access…'}</h1><p>{error||'The link requires its designated recipient’s active verified account and a current grant.'}</p>{error&&<a href="/">Return to eFlow</a>}</main>;
}
