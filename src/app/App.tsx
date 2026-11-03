import {
  AppProviders,
  AuthenticatedApp,
  QuickLoginListener,
} from "./features/app-shell";
import {PublicProjectRecord} from './features/project-publication';

export default function App() {
  const certificatePath=window.location.pathname.match(/^\/(?:public\/)?project-record\/([0-9a-f-]+)\/?$/i);
  if(certificatePath)return <PublicProjectRecord certificateId={certificatePath[1]}/>;
  return (
    <AppProviders>
      <QuickLoginListener />
      <AuthenticatedApp />
    </AppProviders>
  );
}
