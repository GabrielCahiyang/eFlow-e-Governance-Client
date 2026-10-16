import { HelpCircle } from 'lucide-react';
import '../onboarding.css';

export function OnboardingHelpButton() {
  return <button type="button" className="eflow-onboarding-help" aria-label="Help and Getting Started" title="Help and Getting Started" onClick={() => window.dispatchEvent(new Event('eflow-open-getting-started'))}><HelpCircle size={19} /></button>;
}
