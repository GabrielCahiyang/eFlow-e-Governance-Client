import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { requestNavigation } from '../../../shared/navigationGuard';
import ProposalImport from './ProposalImport';

export function ProposalImportDialog({ onClose }: { onClose: () => void }) {
  const [processing, setProcessing] = useState(false);

  return (
    <Modal
      isOpen
      title="Import AI PDF"
      description="Turn a proposal PDF into an editable work plan for review."
      width="max-w-5xl"
      preventClose={processing}
      onClose={() => void requestNavigation(onClose)}
    >
      <ProposalImport embedded inDialog onClose={onClose} onProcessingChange={setProcessing} />
    </Modal>
  );
}
