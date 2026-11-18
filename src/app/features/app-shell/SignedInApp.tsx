import { SessionSecurityProvider } from "../session-security";
import { EflowAppShell } from "./EflowAppShell";
import {useLayoutEffect,useState} from 'react';
import {claimNavigationIdentity} from '../../shared/navigationIdentity';
import {LoadingScreen} from './LoadingScreen';
import {useAuth} from '../../contexts/AuthContext';
import {replaceNavigationHistory} from '../../shared/navigationHistory';
import {isAdminLoginPath} from '../../shared/loginPortal';
import {getNavigationSectionFromPath,isAdministrativeNavigationSection,canOpenNavigationSection} from '../navigation';

/** Keep the authenticated workspace out of the signed-out startup imports. */
export function SignedInApp({ role,actorId }: { role: string;actorId:string }) {
  const {can,permissionsLoading}=useAuth();
  const [ready,setReady]=useState(false);
  // Reset foreign workspace parameters before workspace hooks read the URL.
  useLayoutEffect(()=>{
    const section=getNavigationSectionFromPath(window.location.pathname);
    if(role!=='admin'&&(isAdminLoginPath(window.location.pathname)||(!permissionsLoading&&section&&(isAdministrativeNavigationSection(section)||section==='permissions')&&!canOpenNavigationSection(role,section,can)))) replaceNavigationHistory('/');
    claimNavigationIdentity(actorId,role);setReady(true);
  },[actorId,role,can,permissionsLoading]);
  if(!ready)return <LoadingScreen/>;
  return (
    <SessionSecurityProvider>
      <EflowAppShell role={role} />
    </SessionSecurityProvider>
  );
}
