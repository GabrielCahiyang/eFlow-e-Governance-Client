import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { HelpCircle } from 'lucide-react';
import '../onboarding.css';

export function OnboardingHelpButton() {
  return <WorkspaceTooltip content="Help and Getting Started"><button type="button" className="eflow-onboarding-help" aria-label="Help and Getting Started"  onClick={() => window.dispatchEvent(new Event('eflow-open-getting-started'))}><HelpCircle size={19} /></button></WorkspaceTooltip>;
}
