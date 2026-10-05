"""Resend transactional emails. No provider credentials or tokens are returned/logged."""
import html
import os
import httpx
from fastapi import HTTPException

def invitation_email(inviter: str, office: str, role: str, url: str, hours: int, project: dict | None = None) -> dict:
    label = 'Accounting Staff' if role == 'accounting_staff' else 'Member'
    expiry = f'{hours // 24} days' if hours % 24 == 0 else f'{hours} hours'
    safe = {k: html.escape(v, quote=True) for k, v in {'inviter': inviter, 'office': office, 'role': label, 'url': url, 'expiry': expiry}.items()}
    message = {
        'subject': f'{inviter} invited you to {office} on eFlow',
        'text': f"You're invited to eFlow\n\n{inviter} invited you to join {office} as {label}.\n\neFlow helps your Office coordinate projects, tasks, evidence, and reviews.\n\nAccept invitation: {url}\n\nExpires in {expiry}. If you were not expecting this invitation, you can ignore it.",
        'html': f'''<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Figtree,Arial,sans-serif;color:#212b36">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px">
<div style="font-size:30px;font-weight:750;color:#087f8c;margin-bottom:28px">eFlow<span style="color:#172b3a">.</span></div>
<table role="presentation" width="100%" style="max-width:600px;background:white;border:1px solid #e7e9ee;border-radius:10px" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:44px 28px">
<div style="font-size:42px;color:#087f8c">&#9673;</div><h1 style="font-size:26px;line-height:1.35">{safe['inviter']} invited you to eFlow</h1>
<p style="font-size:18px;font-weight:600">Join {safe['office']}</p><p>{safe['role']} · Office workspace</p>
<p style="color:#606a78;line-height:1.6;margin:26px 0">Coordinate projects, tasks, evidence, and reviews with your Office team.</p>
<a href="{safe['url']}" style="display:inline-block;background:#087f8c;color:white;padding:16px 30px;border-radius:8px;text-decoration:none;font-size:17px;font-weight:600">Accept Invitation</a>
<p style="color:#606a78;font-size:13px;margin-top:28px">This invitation expires in {safe['expiry']}.</p>
</td></tr></table><p style="max-width:560px;font-size:12px;color:#606a78;line-height:1.6">If you were not expecting this invitation, you can safely ignore this email.</p>
</td></tr></table></body></html>''',
    }
    if project:
        access = 'Collaborating Office' if project['relationship_type'] == 'collaborating' else 'Observer'
        title = project['project_title']
        explanation = 'Your account role stays the same. The appointed Office Head confirms collaboration and selects the Office’s own personnel.'
        message['subject'] = f'{inviter} invited {office} to {title} on eFlow'
        message['text'] = f'{inviter} invited {office} to {title} as {access}.\n\n{explanation}\n\nAccept invitation: {url}\n\nExpires in {expiry}.'
        message['html'] = message['html'].replace(f'<p>{safe["role"]} · Office workspace</p>', f'<p>{html.escape(title)} · {access}</p>').replace('Coordinate projects, tasks, evidence, and reviews with your Office team.', html.escape(explanation))
    return message

def send_email(recipient: str, content: dict, idempotency_key: str) -> str:
    key = os.getenv('RESEND_API_KEY', '').strip()
    sender = os.getenv('EFLOW_EMAIL_FROM', '').strip()
    if not key or not sender:
        raise HTTPException(503, 'Email delivery is not configured. Your invitation remains available to retry.')
    if '@resend.dev' in sender.lower() and recipient.lower() != os.getenv('EFLOW_EMAIL_TEST_RECIPIENT', '').lower():
        raise HTTPException(503, 'The rehearsal sender can only send to the configured test recipient. Configure a verified domain for other recipients.')
    payload = {'from': sender, 'to': [recipient], **content}
    if os.getenv('EFLOW_EMAIL_REPLY_TO'):
        payload['reply_to'] = os.environ['EFLOW_EMAIL_REPLY_TO']
    try:
        response = httpx.post('https://api.resend.com/emails', headers={'Authorization': f'Bearer {key}', 'Idempotency-Key': idempotency_key}, json=payload, timeout=15)
        if response.status_code not in (200, 201):
            raise HTTPException(502, "We couldn't send the invitation. Try again or ask Admin to check the email configuration.")
        message_id = response.json().get('id')
        if not message_id:
            raise HTTPException(502, 'The email provider did not confirm sending.')
        return message_id
    except httpx.HTTPError as exc:
        raise HTTPException(502, "We couldn't reach the email provider. Please retry.") from exc
