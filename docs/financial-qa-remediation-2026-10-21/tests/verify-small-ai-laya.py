"""Synthetic local inference receipt, not hosted membership/browser acceptance.

Uses the running AI API's normal FIFO worker and actual Qwen/LAYA models.
The local API key stays in memory and is never included in output or receipts.
"""
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen
from uuid import uuid4

BASE = 'http://127.0.0.1:8321/controlpanelEflow/api'
OUTPUT = Path(__file__).with_name('small-ai-laya-inference.json')

def request(path, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    with urlopen(Request(BASE + path, data=data, headers={'Content-Type': 'application/json', **(headers or {})}), timeout=30) as response:
        return json.load(response)

headers = {'Authorization': 'Bearer ' + request('/authkey')['api_key'], 'X-eFlow-User-Id': 'qa-synthetic-laya-review'}
candidate = lambda uid, name, hours: {'id': uid, 'name': name, 'skills': ['Surveying', 'Site documentation'],
    'training': ['Field safety'], 'education': [], 'experience': [], 'specializations': [], 'certifications': [],
    'experience_summary': 'Field survey planning and accurate site measurement documentation.',
    'activeTasks': 1 if hours < 10 else 4, 'remainingHours': hours, 'unknownEffortTasks': 0}
body = {'model': 'qwen3.5:4b', 'stream': False, 'request_id': str(uuid4()),
    'messages': [{'role': 'user', 'content': 'Choose the lead needed to survey this site.'}],
    'workspace_staffing': {'schemaVersion': 1, 'autoAssign': True, 'context': {
        'task': {'id': 'qa-synthetic-survey', 'title': 'Survey a site and document the findings',
            'description': 'One surveyor will visit the site and document measurements.', 'skills': ['Surveying']},
        'candidates': [candidate('qa-surveyor-one', 'QA Surveyor One', 32), candidate('qa-surveyor-two', 'QA Surveyor Two', 2)]}}}
job = request('/jobs', body, headers)
job_id = job['job_id']
print('Queued synthetic Qwen + LAYA model verification: ' + job_id, flush=True)
last_stage = None
deadline = time.monotonic() + 900
while job['status'] not in ('completed', 'failed', 'cancelled') and time.monotonic() < deadline:
    stage = (job.get('progress') or {}).get('stage')
    if stage != last_stage:
        print('Stage: ' + str(stage), flush=True)
        last_stage = stage
    time.sleep(2)
    job = request('/jobs/' + job_id, headers=headers)
operations = request('/operations', headers=headers)
receipt = {'boundary': 'Synthetic local API inference; no hosted assignments or project writes.',
    'context': body['workspace_staffing']['context'],
    'job_id': job_id, 'status': job['status'], 'error': job.get('error'),
    'progress': job.get('progress'), 'result': job.get('result'), 'laya': operations.get('services', {}).get('laya')}
OUTPUT.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print('Result: ' + job['status'], flush=True)
if job['status'] != 'completed':
    raise SystemExit('Actual model verification did not complete; inspect the non-secret receipt.')
content = json.loads(job['result']['message']['content'])
assert content['pipeline']['layaEngine'] == 'laya'
assert content['pipeline']['laya'] == 'completed'
assert content['pipeline']['validation'] == 'completed'
assert content['recommendations'] and all(row['userId'] in {'qa-surveyor-one', 'qa-surveyor-two'} for row in content['recommendations'])
print(json.dumps({'pipeline': content['pipeline'], 'selected': [row['userId'] for row in content['recommendations']],
    'timings_ms': job['result'].get('timings_ms')}), flush=True)
