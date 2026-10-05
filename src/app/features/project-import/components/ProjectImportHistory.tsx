import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { ProjectImportDraft, ProjectImportResult } from '../types';

interface ImportReceipt { id: string; created_at: string; review: ProjectImportDraft & { sourceName?: string }; result: ProjectImportResult }
export function ProjectImportHistory({ projectId, revision }: { projectId: string; revision: number }) {
  const [receipts, setReceipts] = useState<ImportReceipt[]>([]), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void supabase.from('project_import_batches').select('id,created_at,review,result').eq('project_id', projectId).order('created_at', { ascending: false }).limit(10).then(({ data, error }) => {
      if (!active) return;
      if (error) { setReceipts([]); setError('Import history is unavailable.'); }
      else { setReceipts((data || []) as ImportReceipt[]); setError(''); }
    });
    return () => { active = false; };
  }, [projectId, revision]);
  if (!receipts.length) return error ? <p className="pi-history-note">{error}</p> : null;
  return <details className="pi-history"><summary>Imported project documents ({receipts.length}{receipts.length === 10 ? ' recent' : ''})</summary>{receipts.map(receipt => <article key={receipt.id}><strong>{receipt.review.sourceName || 'Project brief'}</strong><span>{receipt.result.taskCount} tasks · {receipt.result.subitemCount} subitems · {new Date(receipt.created_at).toLocaleDateString()}</span><p>Reviewed Office responsibility proposals; access and ownership follow the existing workflow.</p>{receipt.review.offices.map(o => <details key={o.key}><summary>{o.name} · {o.officeId ? 'matched to directory' : 'proposed name'}</summary><blockquote>{o.evidence}</blockquote><ul>{receipt.review.groups.flatMap(g => g.tasks).filter(t => t.officeKey === o.key).map(t => <li key={t.key}>{t.title}</li>)}</ul></details>)}</article>)}</details>;
}
