"""Durable DB queue with atomic claims and recovery of interrupted processing."""
from datetime import datetime, timezone
import hashlib
import os
from threading import Event, Thread
from gateway_dependencies import supabase_admin
from invitations.service import audit
from pds.parser import extract_professional_profile

def process_document(document: dict):
    actor, office, subject = document['uploaded_by'], document['office_id'], document['id']
    try:
        audit(actor, office, subject, 'pds_processing_started')
        payload = supabase_admin.storage.from_('pds-documents').download(document['storage_path'])
        if hashlib.sha256(payload).hexdigest() != document['content_sha256']:
            raise ValueError('Stored PDF integrity check failed. Upload the document again.')
        draft = extract_professional_profile(payload)
        now = datetime.now(timezone.utc).isoformat()
        supabase_admin.table('user_pds_documents').update({'processing_status': 'completed', 'professional_draft': draft, 'processed_at': now, 'processing_error': None}).eq('id', subject).execute()
        # Acceptance can happen while processing; read its current mapping afterward.
        current = supabase_admin.table('user_pds_documents').select('user_id').eq('id', subject).single().execute().data
        if current.get('user_id'):
            user_id = current['user_id']
            existing = supabase_admin.table('user_professional_profiles').select('confirmed_by_user').eq('user_id', user_id).limit(1).execute().data or []
            if not existing:
                supabase_admin.table('user_professional_profiles').upsert({'user_id': user_id, **draft, 'source': 'pds', 'source_document_id': subject, 'last_extracted_at': now}, on_conflict='user_id', ignore_duplicates=True).execute()
            elif not existing[0]['confirmed_by_user']:
                supabase_admin.table('user_professional_profiles').update({**draft, 'source': 'pds', 'source_document_id': subject, 'last_extracted_at': now, 'updated_at': now}).eq('user_id', user_id).eq('confirmed_by_user', False).execute()
        audit(actor, office, subject, 'pds_processing_completed')
    except Exception as exc:
        # Parser messages are controlled; provider/library exceptions may contain PII.
        reason = str(exc) if isinstance(exc, ValueError) else 'Processing could not finish. Retry or enter your professional profile manually.'
        supabase_admin.table('user_pds_documents').update({'processing_status': 'failed', 'processing_error': reason[:500], 'processed_at': datetime.now(timezone.utc).isoformat()}).eq('id', subject).execute()
        audit(actor, office, subject, 'pds_processing_failed')

def start_worker():
    stopped = Event()
    def run():
        while not stopped.is_set():
            try:
                rows = supabase_admin.rpc('phase2_claim_pds_job', {}).execute().data or []
                if rows:
                    process_document(rows[0])
                    continue
            except Exception:
                # Existing installations without Phase 2 retain their current behavior.
                pass
            stopped.wait(5)
    thread = Thread(target=run, name='eflow-pds-worker', daemon=True)
    if os.getenv('EFLOW_PDS_WORKER_ENABLED', 'true').lower() == 'true':
        thread.start()
    return stopped
