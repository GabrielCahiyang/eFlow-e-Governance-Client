"""Transactional emails via Resend (primary) with Gmail STARTTLS SMTP fallback.

No provider credentials or tokens are returned or logged.
"""
import base64
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import html
import logging
import os
from pathlib import Path
import smtplib
import ssl
from urllib.parse import urlparse
from dotenv import load_dotenv
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)
_ROOT_DIR = Path(__file__).resolve().parents[2]
_ASSETS_DIR = Path(__file__).resolve().parents[1] / 'assets'
_INLINE_IMAGES = (
    ('eflow-logo', 'eflow-logo.png'),
    ('eflow-user-badge', 'eflow-user-badge.png'),
    ('eflow-workspace-badge', 'eflow-workspace-badge.png'),
)
_ENV_FILES = (_ROOT_DIR / '.env', _ROOT_DIR / '.env.local')
_ENV_MTIMES: dict[Path, float] = {}


def _refresh_env_if_changed() -> None:
    changed = False
    for env_path in _ENV_FILES:
        try:
            mtime = env_path.stat().st_mtime
        except OSError:
            continue
        if _ENV_MTIMES.get(env_path) != mtime:
            _ENV_MTIMES[env_path] = mtime
            changed = True
    if changed:
        for env_path in _ENV_FILES:
            if env_path.exists():
                load_dotenv(env_path, override=True)


_refresh_env_if_changed()


def _portal_host(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc or 'eFlow'


def _render_invitation_card_html(
    *,
    heading: str,
    badge_title: str,
    badge_meta: str,
    description: str,
    cta_label: str,
    url: str,
    expiry_note: str,
    greeting: str = '',
    brand_subtitle: str = '',
    support_email: str = '',
    footer_note: str = 'If you were not expecting this invitation, you can safely ignore this email.',
) -> str:
    safe_heading = html.escape(heading, quote=True)
    safe_badge_title = html.escape(badge_title, quote=True)
    safe_badge_meta = html.escape(badge_meta, quote=True)
    safe_description = html.escape(description, quote=True)
    safe_cta = html.escape(cta_label, quote=True)
    safe_url = html.escape(url, quote=True)
    safe_expiry = html.escape(expiry_note, quote=True)
    safe_host = html.escape(_portal_host(url), quote=True)
    safe_footer = html.escape(footer_note, quote=True)

    greeting_prefix = f'{html.escape(greeting, quote=True)} ' if greeting else ''
    badge_meta_html = (
        f'<span style="font-weight:600;color:#475569;"> &middot; {safe_badge_meta}</span>'
        if safe_badge_meta
        else ''
    )
    support_safe = html.escape(support_email, quote=True)
    support_html = (
        f'<p style="margin:8px 0 0 0;font-size:12px;color:#64748b;">Need help? Contact <a href="mailto:{support_safe}" style="color:#0073ea;text-decoration:none;font-weight:600;">{support_safe}</a></p>'
        if support_email
        else ''
    )

    return f'''<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:36px 16px 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 26px 0;">
              <img src="cid:eflow-logo" alt="eFlow" width="148" height="42" style="display:block;border:0;margin:0 auto;height:auto;font-family:Figtree,Arial,sans-serif;font-size:26px;font-weight:800;color:#01006b;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#f6f7f9;border:1px solid #eceef2;border-radius:8px;padding:44px 36px 38px 36px;">
              <img src="cid:eflow-user-badge" alt="" width="48" height="48" style="display:block;border:0;margin:0 auto 18px auto;" />
              <h1 style="margin:0 0 16px 0;font-size:23px;line-height:1.3;font-weight:700;color:#1f2937;letter-spacing:-0.01em;">{safe_heading}</h1>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 16px auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <img src="cid:eflow-workspace-badge" alt="" width="22" height="22" style="display:block;border:0;border-radius:6px;" />
                  </td>
                  <td style="vertical-align:middle;font-size:15px;font-weight:700;color:#1f2937;">
                    {safe_badge_title}{badge_meta_html}
                  </td>
                </tr>
              </table>
              <p style="margin:0 auto 28px auto;max-width:460px;font-size:14px;line-height:1.6;color:#374151;">{greeting_prefix}{safe_description}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:6px;background:#0073ea;">
                    <a href="{safe_url}" style="display:inline-block;padding:15px 38px;border:1px solid #01006b;border-radius:6px;background:#0073ea;color:#ffffff;font-size:15px;font-weight:600;line-height:1;text-decoration:none;">{safe_cta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:30px 0 4px 0;font-size:14px;font-weight:700;color:#1f2937;">Your Account&rsquo;s URL:</p>
              <p style="margin:0;font-size:14px;font-weight:700;">
                <a href="{safe_url}" style="color:#0073ea;text-decoration:none;">{safe_host}</a>
              </p>
              <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">{safe_expiry}</p>
              {support_html}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 12px 0 12px;">
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#6b7280;">{safe_footer}</p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;word-break:break-all;">If the button doesn&rsquo;t work, copy and open this link: <a href="{safe_url}" style="color:#0073ea;text-decoration:none;">{safe_url}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'''


def invitation_email(inviter: str, office: str, role: str, url: str, hours: int, project: dict | None = None) -> dict:
    label = 'Accounting Staff' if role == 'accounting_staff' else 'Member'
    expiry = f'{hours // 24} days' if hours % 24 == 0 else f'{hours} hours'
    if project:
        access = 'Collaborating Office' if project['relationship_type'] == 'collaborating' else 'Observer'
        title = project['project_title']
        explanation = 'Your account role stays the same. The appointed Office Head confirms collaboration and selects the Office’s own personnel.'
        return {
            'subject': f'{inviter} invited {office} to {title} on eFlow',
            'text': f'{inviter} invited {office} to {title} as {access}.\n\n{explanation}\n\nAccept invitation: {url}\n\nExpires in {expiry}.',
            'html': _render_invitation_card_html(
                heading=f'{inviter} invited {office} to {title}',
                badge_title=title,
                badge_meta=access,
                description=explanation,
                cta_label='Accept Invitation',
                url=url,
                expiry_note=f'This invitation expires in {expiry}.',
            ),
        }

    return {
        'subject': f'{inviter} invited you to {office} on eFlow',
        'text': f"You're invited to eFlow\n\n{inviter} invited you to join {office} as {label}.\n\neFlow helps your Office coordinate projects, tasks, evidence, and reviews.\n\nAccept invitation: {url}\n\nExpires in {expiry}. If you were not expecting this invitation, you can ignore it.",
        'html': _render_invitation_card_html(
            heading=f'{inviter} invited you to eFlow',
            badge_title=office,
            badge_meta=f'{label} · Office workspace',
            description='eFlow is the workspace that powers LGU teams to coordinate projects, tasks, evidence, and reviews with clarity.',
            cta_label='Accept Invitation',
            url=url,
            expiry_note=f'This invitation expires in {expiry}.',
        ),
    }


def project_member_email(item: dict, url: str) -> dict:
    title = item['project_title']
    explanation = 'Accept to join this project. Your account role and Office stay unchanged. Work assignments are made separately. PDS is optional and private.'
    if item.get('project_participation_role'):
        participation = 'Office representative / Head' if item['project_participation_role'] == 'representative' else 'Office employee'
        explanation = f'You are invited as {participation} for {item["office_name"]}, within this project only. No permanent Head appointment or Office membership is created. ' + explanation
    return {
        'subject': f'Join {title} on eFlow',
        'text': f"You are invited to {title} as a project member ({item['engagement']}).\n\n{explanation}\n\nAccept invitation: {url}\n\nLink expires: {item['expires_at']}",
        'html': _render_invitation_card_html(
            heading=f'Join {title} on eFlow',
            badge_title=title,
            badge_meta=str(item['engagement']),
            description=explanation,
            cta_label='Accept Project Invitation',
            url=url,
            expiry_note=f'Link expires: {item["expires_at"]}',
        ),
    }


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
    support_text = f'\n\nNeed help? Contact {support}.' if support else ''
    return {
        'subject': f'Activate your {brand} account',
        'text': f'{greeting}\n\nYou have been invited to {brand} in {office}. Choose your own password to activate your account.\n\nActivate account: {url}\n\nThis link expires in {hours} hours. It is for you only; do not forward it. If unexpected, ignore this email.{support_text}',
        'html': _render_invitation_card_html(
            heading=f'{office} invited you to eFlow',
            badge_title=office,
            badge_meta='Work Management',
            greeting=greeting,
            description=f'eFlow is the workspace that powers {office} to run projects and workflows with confidence. Set your own password to activate your account.',
            cta_label='Accept Invitation',
            url=url,
            expiry_note=f'Expires in {hours} hours. This link is for you only; do not forward it.',
            brand_subtitle=subtitle,
            support_email=support,
        ),
    }


def password_reset_email(
    name: str | None,
    url: str,
    *,
    initiated_by: str | None = None,
    organization_name: str | None = None,
    support_email: str | None = None,
) -> dict:
    cleaned_name = (name or '').strip()
    greeting = f'Hello {cleaned_name},' if cleaned_name else 'Hello,'
    brand = (organization_name or '').strip() or 'eFlow'
    support = (support_email or '').strip()
    support_text = f'\n\nNeed help? Contact {support}.' if support else ''
    actor_note = (
        f'Your administrator ({initiated_by.strip()}) sent you a password reset link for your {brand} account.'
        if initiated_by and initiated_by.strip()
        else f'We received a request to reset the password for your {brand} account.'
    )
    return {
        'subject': f'Reset your {brand} password',
        'text': (
            f'{greeting}\n\n{actor_note}\n\n'
            f'Reset password: {url}\n\n'
            f'If you did not request a password reset, you can safely ignore this email.{support_text}'
        ),
        'html': _render_invitation_card_html(
            heading=f'Reset your {brand} password',
            badge_title=f'{brand} Account Security',
            badge_meta='Password recovery',
            greeting=greeting,
            description=f'{actor_note} Click the button below to choose a new password.',
            cta_label='Reset Password',
            url=url,
            expiry_note='This reset link can only be used once.',
            support_email=support,
            footer_note='If you did not request a password reset, you can safely ignore this email.',
        ),
    }


def _resend_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get('message'), str):
            return payload['message'].strip()
    except ValueError:
        pass
    return ''


def _is_resend_sandbox_or_domain_error(status_code: int, message: str, sender: str) -> bool:
    if status_code != 403:
        return False
    lowered = message.lower()
    return (
        'onboarding@resend.dev' in sender.lower()
        or 'only send testing emails to your own email address' in lowered
        or 'verify a domain' in lowered
    )


def _smtp_configured() -> bool:
    return bool(os.getenv('SMTP_EMAIL', '').strip() and os.getenv('SMTP_APP_PASSWORD', '').replace(' ', '').strip())


def _referenced_inline_images(html_body: str) -> list[tuple[str, str, bytes]]:
    if not html_body:
        return []
    assets: list[tuple[str, str, bytes]] = []
    for cid, filename in _INLINE_IMAGES:
        if f'cid:{cid}' not in html_body:
            continue
        asset_path = _ASSETS_DIR / filename
        try:
            assets.append((cid, filename, asset_path.read_bytes()))
        except OSError:
            continue
    return assets


def _send_via_smtp(recipient: str, content: dict, idempotency_key: str, reply_to: str | None = None) -> str | None:
    smtp_email = os.getenv('SMTP_EMAIL', '').strip()
    smtp_password = os.getenv('SMTP_APP_PASSWORD', '').replace(' ', '').strip()
    if not smtp_email or not smtp_password:
        return None

    inline_assets = _referenced_inline_images(content.get('html', ''))
    alt = MIMEMultipart('alternative')
    if content.get('text'):
        alt.attach(MIMEText(content['text'], 'plain', 'utf-8'))
    if content.get('html'):
        alt.attach(MIMEText(content['html'], 'html', 'utf-8'))

    if inline_assets:
        msg = MIMEMultipart('related')
        msg.attach(alt)
        for cid, filename, data in inline_assets:
            image = MIMEImage(data, _subtype='png')
            image.add_header('Content-ID', f'<{cid}>')
            image.add_header('Content-Disposition', 'inline', filename=filename)
            msg.attach(image)
    else:
        msg = alt

    msg['Subject'] = content['subject']
    msg['From'] = f'eFlow <{smtp_email}>'
    msg['To'] = recipient
    configured_reply_to = (reply_to or '').strip() or os.getenv('EFLOW_EMAIL_REPLY_TO', '').strip()
    if configured_reply_to:
        msg['Reply-To'] = configured_reply_to

    logger.info('[EMAIL] Attempting Gmail SMTP delivery to %s via %s', recipient, smtp_email)
    print(f'[EMAIL] Attempting Gmail SMTP delivery to {recipient} via {smtp_email}', flush=True)
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=15) as server:
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, [recipient], msg.as_string())
    receipt = f'smtp:{idempotency_key}'
    logger.info('[EMAIL] Delivered to %s via Gmail SMTP (receipt=%s)', recipient, receipt)
    print(f'[EMAIL] Delivered to {recipient} via Gmail SMTP (receipt={receipt})', flush=True)
    return receipt


def _send_via_resend(recipient: str, content: dict, idempotency_key: str, reply_to: str | None = None) -> str:
    key = os.getenv('RESEND_API_KEY', '').strip()
    sender = os.getenv('EFLOW_EMAIL_FROM', '').strip()
    payload = {'from': sender, 'to': [recipient], **content}
    inline_assets = _referenced_inline_images(content.get('html', ''))
    if inline_assets:
        payload['attachments'] = [
            {
                'filename': filename,
                'content': base64.b64encode(data).decode('ascii'),
                'content_id': cid,
            }
            for cid, filename, data in inline_assets
        ]
    configured_reply_to = (reply_to or '').strip() or os.getenv('EFLOW_EMAIL_REPLY_TO', '').strip()
    if configured_reply_to:
        payload['reply_to'] = configured_reply_to
    logger.info('[EMAIL] Attempting Resend delivery to %s from %s', recipient, sender)
    print(f'[EMAIL] Attempting Resend delivery to {recipient} from {sender}', flush=True)
    try:
        response = httpx.post('https://api.resend.com/emails', headers={'Authorization': f'Bearer {key}', 'Idempotency-Key': idempotency_key}, json=payload, timeout=15)
        if response.status_code not in (200, 201):
            provider_msg = _resend_error_message(response)
            logger.warning('Resend email delivery failed (%s): %s', response.status_code, provider_msg or 'no detail')
            print(f'[EMAIL] Resend email delivery failed ({response.status_code}): {provider_msg or "no detail"}', flush=True)
            if _is_resend_sandbox_or_domain_error(response.status_code, provider_msg, sender):
                raise HTTPException(
                    502,
                    "Resend's test sender (onboarding@resend.dev) can only send to the Resend account owner's email until a custom domain is verified in Resend and set in EFLOW_EMAIL_FROM. You can use Copy fresh link in Invitations to share the invite manually.",
                )
            raise HTTPException(502, "We couldn't send the invitation. Try again or ask Admin to check the email configuration.")
        message_id = response.json().get('id')
        if not message_id:
            raise HTTPException(502, 'The email provider did not confirm sending.')
        logger.info('[EMAIL] Delivered to %s via Resend (id=%s)', recipient, message_id)
        print(f'[EMAIL] Delivered to {recipient} via Resend (id={message_id})', flush=True)
        return message_id
    except httpx.HTTPError as exc:
        logger.warning('Resend network error for %s: %s', recipient, type(exc).__name__)
        print(f'[EMAIL] Resend network error for {recipient}: {type(exc).__name__}', flush=True)
        raise HTTPException(502, "We couldn't reach the email provider. Please retry.") from exc


def send_email(recipient: str, content: dict, idempotency_key: str, reply_to: str | None = None) -> str:
    _refresh_env_if_changed()
    resend_ready = bool(os.getenv('RESEND_API_KEY', '').strip() and os.getenv('EFLOW_EMAIL_FROM', '').strip())
    smtp_ready = _smtp_configured()

    if resend_ready:
        try:
            return _send_via_resend(recipient, content, idempotency_key, reply_to)
        except HTTPException as resend_exc:
            if smtp_ready:
                try:
                    smtp_receipt = _send_via_smtp(recipient, content, idempotency_key, reply_to)
                    if smtp_receipt:
                        return smtp_receipt
                except (smtplib.SMTPException, OSError) as exc:
                    logger.warning('Fallback Gmail SMTP delivery also failed for %s: %s', recipient, type(exc).__name__)
                    print(f'[EMAIL] Fallback Gmail SMTP delivery also failed for {recipient}: {type(exc).__name__}', flush=True)
            raise resend_exc

    if smtp_ready:
        try:
            smtp_receipt = _send_via_smtp(recipient, content, idempotency_key, reply_to)
            if smtp_receipt:
                return smtp_receipt
        except (smtplib.SMTPException, OSError) as exc:
            logger.warning('Gmail SMTP delivery failed without Resend configured for %s: %s', recipient, type(exc).__name__)
            print(f'[EMAIL] Gmail SMTP delivery failed without Resend configured for {recipient}: {type(exc).__name__}', flush=True)
            raise HTTPException(502, "We couldn't send the invitation via SMTP. Ask Admin to check the email configuration.") from exc

    raise HTTPException(503, 'Email delivery is not configured. Your invitation remains available to retry.')
