"""Read-only configuration facts. Never return env values, provider tokens or URLs."""
import os
from email.utils import parseaddr
from urllib.parse import urlparse
from services.phase2_config import app_url, invitation_ttl


def configuration_health() -> dict:
    sender = parseaddr(os.getenv('EFLOW_EMAIL_FROM', ''))[1]
    domain = sender.rsplit('@', 1)[-1].lower() if '@' in sender else None
    valid_sender = bool(domain and '.' in domain and not any(c.isspace() for c in sender))
    try:
        parsed = urlparse(app_url())
        redirect = {'state': 'configured', 'origin': f'{parsed.scheme}://{parsed.netloc}',
                    'hint': 'App link is syntactically valid. Confirm the deployed path and Supabase Auth redirect allowlist with the operator.'}
    except Exception:
        redirect = {'state': 'unavailable', 'origin': None, 'hint': 'Operator: configure EFLOW_APP_URL as an HTTPS application URL (HTTP is allowed only on localhost).'}
    invitation_ready = bool(os.getenv('RESEND_API_KEY', '').strip()) and valid_sender
    return {
        'invitations': {'state': 'configured' if invitation_ready else 'unavailable',
                        'senderDomain': domain if valid_sender else None,
                        'restrictedTestSender': domain == 'resend.dev',
                        'providerVerification': 'unknown', 'ttlHours': invitation_ttl(),
                        'hint': 'Operator: verify the sender domain in Resend and check provider delivery logs. Configuration presence does not prove domain verification or mailbox delivery.'},
        'notificationSmtp': {'state': 'configured' if os.getenv('SMTP_EMAIL', '').strip() and os.getenv('SMTP_APP_PASSWORD', '').strip() else 'unavailable',
                             'providerVerification': 'unknown',
                             'hint': 'Operator: configure SMTP_EMAIL and SMTP_APP_PASSWORD for the existing Gmail STARTTLS notification sender. User notification preferences still apply.'},
        'authSmtp': {'state': 'operator-managed', 'providerVerification': 'unknown',
                     'hint': 'Supabase Auth SMTP and redirect allowlist are configured in the Supabase project, independently of Resend invitations and notification SMTP.'},
        'redirect': redirect,
        'scope': 'Gateway configuration presence only; no email is sent and no provider verification is performed.',
    }
