"""Existing authorized QA account only; no email, business writes, or saved credentials."""
import argparse
import base64
import io
import json
from pathlib import Path
import time
import uuid
import wave
import datetime
from array import array
import httpx
from dotenv import dotenv_values

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--qa-email', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--fresh-question', default='How do I settle petty cash for a task?')
    parser.add_argument('--audio-seconds', type=float)
    parser.add_argument('--asr-only', action='store_true')
    parser.add_argument('--knowledge-only', action='store_true')
    parser.add_argument('--live-mode', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    config = dotenv_values(root / '.env')
    url = (config.get('VITE_SUPABASE_URL') or config.get('SUPABASE_URL') or '').rstrip('/')
    if url != 'https://ixnfphgjyelhckjwjkdv.supabase.co':
        raise RuntimeError('Unapproved acceptance target')
    service = config.get('SUPABASE_SERVICE_ROLE_KEY')
    if not service:
        service = dotenv_values(root.parent / 'Ollama reactjs LLM DeepSeek Integration' / '.env').get('SUPABASE_SERVICE_ROLE_KEY')
    anon = config['VITE_SUPABASE_ANON_KEY']
    receipts = []
    def save():
        args.output.parent.mkdir(parents=True, exist_ok=True)
        scope = 'Workflow text only; no speech' if args.knowledge_only else 'Synthetic speech'
        args.output.write_text(json.dumps({'date': '2026-10-23', 'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': 'ixnfphgjyelhckjwjkdv', 'scope': scope + '; actual authenticated local gateway and models, existing authorized test account, no email or business writes', 'checks': receipts}, indent=2))
    with httpx.Client(timeout=210) as client:
        admin = {'apikey': service, 'Authorization': 'Bearer ' + service}
        response = client.get(url + '/rest/v1/profiles', headers=admin, params={'select': 'id,role,is_active', 'email': 'eq.' + args.qa_email})
        response.raise_for_status()
        rows = response.json()
        if len(rows) != 1 or rows[0]['role'] != 'head' or rows[0]['is_active'] is not True:
            raise RuntimeError('Use an existing active, authorized Head test account')
        generated = client.post(url + '/auth/v1/admin/generate_link', headers=admin, json={'type': 'magiclink', 'email': args.qa_email})
        generated.raise_for_status()
        if generated.json()['id'] != rows[0]['id']:
            raise RuntimeError('The test identity changed')
        signed = client.post(url + '/auth/v1/verify', headers={'apikey': anon}, json={'type': 'magiclink', 'token_hash': generated.json()['hashed_token']})
        signed.raise_for_status()
        token = signed.json()['access_token']
        headers = {'Authorization': 'Bearer ' + token}
        origin = 'http://127.0.0.1:8322/controlpanelEflow/api/help-assistant/'
        def call(label, operation, payload=None):
            start = time.monotonic()
            response = client.get(origin + operation, headers=headers) if payload is None else client.post(origin + operation, headers=headers, json=payload)
            receipt = {'operation': label, 'status': response.status_code, 'seconds': round(time.monotonic() - start, 3)}
            receipts.append(receipt); save(); print(json.dumps(receipt), flush=True)
            if response.status_code != 200:
                raise RuntimeError(f'{operation} returned HTTP {response.status_code}')
            result = response.json()
            if 'audio' in result:
                data = base64.b64decode(result['audio'], validate=True)
                with wave.open(io.BytesIO(data)) as audio:
                    receipt['audio_seconds'] = round(audio.getnframes() / audio.getframerate(), 3)
                receipt['parts'] = result.get('parts', 1)
                receipt['cached'] = result.get('cached', 'unknown')
                (args.output.parent / (label + '.wav')).write_bytes(data)
                save()
            return result
        def chat(label, question):
            result = call(label, 'chat', {'question': question, 'requestId': str(uuid.uuid4()), 'mode': 'live' if args.live_mode else 'chat'})
            receipts[-1].update({'grounded': result['grounded'], 'model': result['model'], 'answer': result['answer'], 'sources': [item['id'] for item in result['sources']]}); save()
            if result['model'] != ('lfm2.5:350m' if args.live_mode else 'qwen3.5:2b'):
                raise RuntimeError('Unexpected Help model routing')
            return result
        try:
            call('status', 'status')
            if args.knowledge_only:
                cases = [
                    ('task-funding', 'Does setting a task budget reserve Office Budget?', 'budget'),
                    ('planning-is-not-funding', 'Does typing a planning estimate alone approve money?', 'budget'),
                    ('live-pause', 'Does Pause stop speech synthesis in eFlow Live?', 'live_voice'),
                    ('independent-review', 'Can an independent Head review and then post the journal?', 'independent_review'),
                    ('rejected-request', 'How do I correct and resubmit a rejected petty cash request?', 'cash_rejection'),
                    ('settlement', 'How do I settle petty cash for a task?', 'settlement'),
                ]
                for label, question, topic in cases:
                    result = chat(label, question)
                    receipts[-1].update({'sources': [source['id'] for source in result['sources']], 'knowledgeVersion': result['knowledgeVersion'], 'answer': result['answer']})
                    save()
                    topic_found = any(source['id'].startswith('guide:' + topic + ':') for source in result['sources'])
                    if label == 'independent-review':
                        topic_found = 'not permission to settle or post' in result['answer'] or 'does not grant general Accounting' in result['answer']
                    if result['knowledgeVersion'] != '2026-10-23' or not result['grounded'] or not topic_found:
                        raise RuntimeError('The real model did not select the required checked workflow for ' + label)
                unrelated = call('off-topic', 'chat', {'question': 'Tell me the distance between planets.', 'requestId': str(uuid.uuid4())})
                if unrelated['sources'] or unrelated['grounded']: raise RuntimeError('Off-topic guidance leaked project sources')
                return
            source = root / 'tests/e2e/fixtures/help-microphone.wav'
            with wave.open(str(source)) as audio:
                rate = audio.getframerate(); samples = array('h', audio.readframes(audio.getnframes()))
            pcm = array('h', (samples[min(len(samples)-1, int(i * rate/16000))] for i in range(int(len(samples)*16000/rate))))
            if args.audio_seconds:
                pcm = pcm[:int(args.audio_seconds * 16000)]
            output = io.BytesIO()
            with wave.open(output, 'wb') as audio:
                audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000); audio.writeframes(pcm.tobytes())
            for i in range(2):
                result = call('transcribe-' + str(i), 'transcribe', {'audio': base64.b64encode(output.getvalue()).decode()})
                receipts[-1]['recognized'] = bool(result['text'].strip()); save()
                receipts[-1]['clip_seconds'] = round(len(pcm) / 16000, 3); save()
            if args.asr_only:
                return
            primer = chat('chat-first', 'How do I request petty cash?')
            call('speech-primer', 'speech', {'replyId': primer['replyId']})
            reply = chat('chat-followup', args.fresh_question)
            call('speech-full-warm', 'speech', {'replyId': reply['replyId']})
            part = call('speech-first-chunk-warm', 'speech', {'replyId': reply['replyId'], 'part': 0})
            for i in range(1, part['parts']):
                call('speech-chunk-' + str(i), 'speech', {'replyId': reply['replyId'], 'part': i})
            call('speech-first-chunk-cached', 'speech', {'replyId': reply['replyId'], 'part': 0})
            anonymous = client.get(origin + 'status')
            receipts.append({'operation': 'anonymous-status', 'status': anonymous.status_code}); save()
        finally:
            # Revoke only the session created above, never other user sessions.
            client.post(url + '/auth/v1/logout', params={'scope': 'local'}, headers={'apikey': anon, **headers})

if __name__ == '__main__':
    main()
