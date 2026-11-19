"""Authenticated email-notification delivery."""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
import os
import smtplib
import ssl

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from gateway_dependencies import AuthenticatedUser, require_user, supabase_admin


router = APIRouter(prefix="/controlpanelEflow/api/notifications", tags=["notifications"])


class EmailNotificationPayload(BaseModel):
    userId: str = Field(min_length=1, max_length=128)
    title: str = Field(default="eFlow Notification", max_length=200)
    body: str = Field(default="", max_length=10000)
    taskId: str | None = Field(default=None, max_length=128)


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    smtp_email = os.getenv("SMTP_EMAIL", "").strip()
    smtp_password = os.getenv("SMTP_APP_PASSWORD", "").replace(" ", "").strip()
    if not smtp_email or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"eFlow Notifications <{smtp_email}>"
    message["To"] = to_email
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, to_email, message.as_string())


@router.post("/email")
async def send_email_notification(
    payload: EmailNotificationPayload,
    _user: AuthenticatedUser = Depends(require_user),
):
    try:
        profile = (
            supabase_admin.table("profiles")
            .select("email,email_notifications_enabled,full_name")
            .eq("id", payload.userId)
            .single()
            .execute()
        )
        data = profile.data or {}
        if not data.get("email"):
            return {"sent": False, "reason": "no_email"}
        if data.get("email_notifications_enabled") is False:
            return {"sent": False, "reason": "disabled"}

        safe_title = escape(payload.title)
        safe_name = escape(data.get("full_name", ""))
        safe_body = escape(payload.body).replace("\n", "<br>")
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#171717;">{safe_title}</h2>
          <p style="color:#404040;">Hi {safe_name},</p>
          <p style="color:#404040;">{safe_body}</p>
          <p style="color:#a3a3a3; font-size:12px; margin-top:24px;">
            This is an automated notification from eFlow.
          </p>
        </div>
        """
        _send_email(data["email"], payload.title, html)
        return {"sent": True}
    except HTTPException:
        raise
    except Exception as exc:
        # Email is a secondary channel; the in-app notification already exists.
        return {"sent": False, "reason": str(exc)}
