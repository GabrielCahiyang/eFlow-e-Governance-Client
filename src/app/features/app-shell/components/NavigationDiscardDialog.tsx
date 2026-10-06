import { useEffect } from 'react';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { installNavigationConfirmation } from '../../../shared/navigationGuard';

export function NavigationDiscardDialog() {
  const { confirm, dialog } = useConfirmation();
  useEffect(() => installNavigationConfirmation(labels => confirm({
    title: 'Discard unsaved changes?',
    description: `Your changes in ${labels.join(', ')} have not been saved. Keep editing or discard them to continue.`,
    actionLabel: 'Discard', cancelLabel: 'Keep editing', danger: true,
  })), [confirm]);
  return dialog;
}
