"""Email sending — used for 2FA OTPs, subscription notifications, and ban warnings.

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


def send_email(to: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not SMTP_USER:
        # Dev-mode fallback — no SMTP configured, just log it.
        print(f"[email:dev-mode] to={to} subject={subject!r}\n{body}\n")
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


def send_otp_email(to: str, otp: str) -> None:
    send_email(to, "Your Cookify login code", f"Your 6-digit login code is: {otp}\nIt expires in 10 minutes.")


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


def send_new_subscriber_notification(to: str, subscriber_username: str) -> None:
    send_email(
        to,
        "You have a new subscriber on Cookify",
        f"{subscriber_username} just subscribed to you.",
    )
