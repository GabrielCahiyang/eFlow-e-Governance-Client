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

def project_member_email(item: dict, url: str) -> dict:
    title = item['project_title']
    explanation = 'Accept to join this project. Your account role and Office stay unchanged. Work assignments are made separately. PDS is optional and private.'
    if item.get('project_participation_role'):
        participation = 'Office representative / Head' if item['project_participation_role'] == 'representative' else 'Office employee'
        explanation = f'You are invited as {participation} for {item["office_name"]}, within this project only. No permanent Head appointment or Office membership is created. ' + explanation
    return {'subject': f'Join {title} on eFlow',
            'text': f"You are invited to {title} as a project member ({item['engagement']}).\n\n{explanation}\n\nAccept invitation: {url}\n\nLink expires: {item['expires_at']}",
            'html': f'<h1>Join {html.escape(title)}</h1><p>{html.escape(explanation)}</p><p>{html.escape(item["engagement"])}</p><a href="{html.escape(url, quote=True)}">Accept project invitation</a><p>Link expires: {html.escape(item["expires_at"])}</p>'}

def managed_account_activation_email(
    name: str | None,
    office: str,
    url: str,
    hours: int,
    organization_name: str | None = None,
    organization_subtitle: str | None = None,
    support_email: str | None = None,
) -> dict:
    cleaned_name = (name or '').strip()
    greeting = f'Hello {cleaned_name},' if cleaned_name else 'Hello,'
    brand = (organization_name or '').strip() or 'eFlow'
    subtitle = (organization_subtitle or '').strip()
    support = (support_email or '').strip()
    safe = {
        k: html.escape(v, quote=True)
        for k, v in {
            'greeting': greeting,
            'office': office,
            'url': url,
            'brand': brand,
            'subtitle': subtitle,
            'support': support,
        }.items()
    }
    subtitle_html = f'<div style="font-size:12px;color:#526161;margin-bottom:14px">{safe["subtitle"]}</div>' if subtitle else ''
    support_text = f'\n\nNeed help? Contact {support}.' if support else ''
    support_html = f'<p style="font-size:12px;color:#526161">Need help? Contact <a href="mailto:{safe["support"]}">{safe["support"]}</a>.</p>' if support else ''
    return {'subject': f'Activate your {brand} account',
        'text': f'{greeting}\n\nYou have been invited to {brand} in {office}. Choose your own password to activate your account.\n\nActivate account: {url}\n\nThis link expires in {hours} hours. It is for you only; do not forward it. If unexpected, ignore this email.{support_text}',
        'html': f'''<html><body style="margin:0;background:#f4f7fb;color:#182626;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:40px 16px"><div style="max-width:520px;background:white;border:1px solid #d7dfdf;border-radius:16px;padding:36px;text-align:left"><div style="font-size:28px;font-weight:bold;color:#01006b">{safe['brand']}</div>{subtitle_html}<h1 style="font-size:24px">Activate your account</h1><p>{safe['greeting']}</p><p>You have been invited to join <strong>{safe['office']}</strong> on eFlow. Set your own password to get started.</p><a href="{safe['url']}" style="display:inline-block;margin:20px 0;padding:14px 22px;border-radius:8px;background:#0c6f6b;color:white;text-decoration:none">Activate account</a><p style="color:#526161;font-size:13px">Expires in {hours} hours. This link is for you only; do not forward it.</p>{support_html}<p style="font-size:12px">If you were not expecting this email, you can ignore it.</p></div></td></tr></table></body></html>'''}


def send_email(recipient: str, content: dict, idempotency_key: str, reply_to: str | None = None) -> str:
    key = os.getenv('RESEND_API_KEY', '').strip()
    sender = os.getenv('EFLOW_EMAIL_FROM', '').strip()
    if not key or not sender:
        raise HTTPException(503, 'Email delivery is not configured. Your invitation remains available to retry.')
    payload = {'from': sender, 'to': [recipient], **content}
    configured_reply_to = (reply_to or '').strip() or os.getenv('EFLOW_EMAIL_REPLY_TO', '').strip()
    if configured_reply_to:
        payload['reply_to'] = configured_reply_to
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
