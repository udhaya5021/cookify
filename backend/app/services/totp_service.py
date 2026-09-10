"""Authenticator-app 2FA (TOTP, RFC 6238) — the Google Authenticator scheme.

Why this exists alongside the emailed OTP the wireframe specifies: an emailed
code travels the same channel as password reset, so a compromised inbox defeats
both factors. A TOTP secret never leaves the device after enrolment, so there is
nothing in transit to intercept.
"""
import io

import pyotp
import qrcode
import qrcode.image.svg

ISSUER = "Cookify"

# Authenticator clocks drift. One step either side (±30s) is the usual
# allowance — wider would meaningfully widen the window for a stolen code.
_VALID_WINDOW = 1


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, username: str) -> str:
    """The otpauth:// URI an authenticator app expects behind the QR code."""
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=ISSUER)


def qr_svg(uri: str) -> str:
    """QR as inline SVG. SVG specifically so this needs no Pillow — one less
    binary dependency for anyone installing the project."""
    buf = io.BytesIO()
    qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage).save(buf)
    return buf.getvalue().decode("utf-8")


def verify(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code.strip().replace(" ", ""), valid_window=_VALID_WINDOW)
