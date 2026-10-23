"""Authenticated local Help acceptance. Credentials stay in memory; no business writes."""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import time
import uuid
import wave
import httpx
from dotenv import dotenv_values

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--speech', action='store_true')
    parser.add_argument('--speech-runs', type=int, choices=(1, 2), default=2)
    parser.add_argument('--speech-followup', action='store_true')
    parser.add_argument('--audio', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    config = dotenv_values(Path(__file__).resolve().parents[1] / '.env')
    url = config.get('VITE_SUPABASE_URL') or config.get('SUPABASE_URL')
    if 'ixnfphgjyelhckjwjkdv.supabase.co' not in (url or ''):
        raise RuntimeError('This receipt is restricted to the approved hosted target')
    email = os.environ['EFLOW_HELP_QA_EMAIL']
    password = os.environ['EFLOW_HELP_QA_PASSWORD']
    key = config['VITE_SUPABASE_ANON_KEY']
    origin = 'http://127.0.0.1:8322/controlpanelEflow/api/help-assistant'
    receipts = []
    def save():
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({'target': 'ixnfphgjyelhckjwjkdv', 'scope': 'actual local gateway and models; synthetic audio, existing labeled QA reads; no business writes', 'checks': receipts}, indent=2), encoding='utf-8')
    with httpx.Client(timeout=210, http2=False) as client:
        login = client.post(url + '/auth/v1/token?grant_type=password', headers={'apikey': key}, json={'email': email, 'password': password})
        if login.status_code != 200:
            raise RuntimeError('The authorized QA account could not sign in')
        token = login.json()['access_token']
        headers = {'Authorization': 'Bearer ' + token}
        def call(operation, payload=None):
            started = time.monotonic()
            response = client.get(origin + '/' + operation, headers=headers) if payload is None else client.post(origin + '/' + operation, headers=headers, json=payload)
            receipts.append({'operation': operation, 'status': response.status_code, 'seconds': round(time.monotonic() - started, 2)})
            save()
            print(json.dumps(receipts[-1]), flush=True)
            if response.status_code != 200:
                detail = response.json().get('detail', 'Unavailable')
                raise RuntimeError(f'{operation}: HTTP {response.status_code}: {detail}')
            return response.json()
        status = call('status')
        projects = call('projects')['projects']
        # Read an existing labeled QA project through the actual caller's RLS.
        qa = next((project for project in projects if project['title'].startswith('QA ')), None)
        if qa:
            answer = call('chat', {'question': 'Which tasks need a follow-up in this project?', 'projectId': qa['id'], 'requestId': str(uuid.uuid4())})
            receipts[-1]['grounded'] = answer['grounded']
            receipts[-1]['source_kinds'] = sorted({source['kind'] for source in answer['sources']})
        question = 'How do I request petty cash?'
        if args.audio:
            from array import array
            with wave.open(str(args.audio)) as audio:
                rate = audio.getframerate()
                if audio.getsampwidth() != 2 or audio.getnchannels() != 1:
                    raise RuntimeError('Use a synthetic mono PCM16 QA audio file')
                samples = array('h', audio.readframes(audio.getnframes()))
            converted = array('h')
            for frame in range(int(len(samples) * 16000 / rate)):
                position = frame * rate / 16000
                index = int(position)
                converted.append(round(samples[index] + (samples[min(index + 1, len(samples) - 1)] - samples[index]) * (position - index)))
            data = io.BytesIO()
            with wave.open(data, 'wb') as output:
                output.setnchannels(1); output.setsampwidth(2); output.setframerate(16000); output.writeframes(converted.tobytes())
            transcript = call('transcribe', {'audio': base64.b64encode(data.getvalue()).decode()})
            if 'task' not in transcript['text'].lower() and 'project' not in transcript['text'].lower():
                raise RuntimeError('The synthetic eFlow voice question was not recognized')
            question = transcript['text']
        answer = call('chat', {'question': question, 'requestId': str(uuid.uuid4())})
        if not answer['grounded'] or not answer['sources']:
            raise RuntimeError('The live model did not return checked guide sources')
        receipts[-1]['grounded'] = answer['grounded']
        receipts[-1]['model'] = answer['model']
        if args.speech:
            if not status['speechInstalled']:
                raise RuntimeError('Local voice runtime has not passed its readiness check')
            for index in range(args.speech_runs):
                result = call('speech', {'replyId': answer['replyId']})
                data = base64.b64decode(result['audio'], validate=True)
                with wave.open(io.BytesIO(data)) as audio:
                    receipts[-1]['audio_seconds'] = audio.getnframes() / audio.getframerate()
                args.output.parent.mkdir(parents=True, exist_ok=True)
                (args.output.parent / f'local-spoken-help-{index}.wav').write_bytes(data)
            if args.speech_followup:
                followup = call('chat', {'question': 'How do I request petty cash for a task?', 'requestId': str(uuid.uuid4())})
                result = call('speech', {'replyId': followup['replyId']})
                data = base64.b64decode(result['audio'], validate=True)
                with wave.open(io.BytesIO(data)) as audio:
                    receipts[-1]['audio_seconds'] = audio.getnframes() / audio.getframerate()
                (args.output.parent / 'local-spoken-followup.wav').write_bytes(data)
        unrelated = call('chat', {'question': 'Tell me the distance between planets.', 'requestId': str(uuid.uuid4())})
        if unrelated['grounded'] or unrelated['sources']:
            raise RuntimeError('Off-topic help must not deliver project facts')
        anonymous = client.get(origin + '/projects')
        if anonymous.status_code not in (401, 403):
            raise RuntimeError('Anonymous help access was not rejected')
        receipts.append({'operation': 'anonymous-projects', 'status': anonymous.status_code})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'target': 'ixnfphgjyelhckjwjkdv', 'scope': 'actual local gateway and models; synthetic audio, existing labeled QA reads; no business writes', 'checks': receipts}, indent=2), encoding='utf-8')
    print(json.dumps(receipts), flush=True)

if __name__ == '__main__':
    run()
