"""SFW/NSFW content validation for comments — matches the assignment's
`validateComment` / `validateCommentSafe` pseudocode.

This is a simple keyword-based filter. It's honest about being a baseline,
not a production-grade moderation system — good to say this out loud in the
interview rather than overclaim it.
"""

_BLOCKED_TERMS = {
    # deliberately small, illustrative set — production would use a real
    # moderation API (e.g. a hosted content-safety model) instead of a word list
    "spam",
    "scam",
    "hate",
    "abuse",
}


def validate_comment(text: str) -> tuple[bool, str]:
    """Returns (is_safe, reason_if_blocked)."""
    if not text or not text.strip():
        return False, "Comment cannot be empty"
    lowered = text.lower()
    for term in _BLOCKED_TERMS:
        if term in lowered:
            return False, "Comment contains disallowed content"
    return True, ""
