"""Email sending — subscription notifications, comment/rating alerts, and ban warnings.

Login codes are not sent by email: the second factor is an authenticator app
(see services/totp_service.py), so nothing here is on the login path.

Free/zero-config by default: if no SMTP credentials are set in the environment,
emails are printed to the console instead of actually sent, so the app runs
with zero external setup. Set SMTP_* env vars to send real emails.
"""
import os
import smtplib
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)


def send_email(to: str, subject: str, body: str) -> bool:
    """Sends one email. Returns whether it went out.

    Notification mail is sent inline in the request that triggered it, so an
    SMTP failure (provider down, daily quota hit, recipient rejected) would
    otherwise turn a perfectly good comment/rating/subscribe into a 500. All
    of these are notifications, so they are best-effort: log and carry on.
    """
    if not SMTP_HOST or not SMTP_USER:
        # Dev-mode fallback — no SMTP configured, just log it.
        print(f"[email:dev-mode] to={to} subject={subject!r}\n{body}\n")
        return True

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as err:
        print(f"[email:failed] to={to} subject={subject!r} error={err}")
        return False


def send_new_recipe_notification(to: str, creator_username: str, recipe_title: str) -> None:
    send_email(
        to,
        f"{creator_username} just posted a new recipe on Cookify",
        f'"{recipe_title}" was just uploaded by {creator_username} — check it out!',
    )


def send_warning_email(to: str, reason: str, warning_count: int) -> None:
    send_email(
        to,
        "Cookify account warning",
        f"You've received a warning: {reason}\nWarning {warning_count}/3. "
        f"Your account will be banned after 3 warnings.",
    )


# The Commenting/Rating/Subscription Method pseudocode each end with an
# unconditional "NOTIFY Recipe Owner via Email" step — these three cover
# that for the three respective actions.

def send_new_comment_notification(to: str, commenter_username: str, recipe_title: str) -> None:
    send_email(
        to,
        f"New comment on \"{recipe_title}\"",
        f"{commenter_username} just commented on your recipe \"{recipe_title}\".",
    )


def send_new_rating_notification(to: str, rater_username: str, recipe_title: str, score: int) -> None:
    send_email(
        to,
        f"New rating on \"{recipe_title}\"",
        f"{rater_username} rated your recipe \"{recipe_title}\" {score}/5.",
    )


def send_password_reset_email(to: str, reset_link: str) -> None:
    send_email(
        to,
        "Reset your Cookify password",
        f"Someone (hopefully you) asked to reset the password on this account.\n\n"
        f"Reset it here: {reset_link}\n\n"
        f"This link works once and expires in 30 minutes. If you didn't request "
        f"this, you can ignore it — your password won't change.",
    )


def send_new_subscriber_notification(to: str, subscriber_username: str) -> None:
    send_email(
        to,
        "You have a new subscriber on Cookify",
        f"{subscriber_username} just subscribed to you.",
    )
