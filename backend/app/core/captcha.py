import random
import string
import uuid
import time
from typing import Optional


_captcha_store: dict[str, dict] = {}
CAPTCHA_TTL = 300
CAPTCHA_LENGTH = 4


def _generate_code(length: int = CAPTCHA_LENGTH) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


def _generate_svg(code: str) -> str:
    chars = list(code)
    width = 28 * len(code) + 20
    height = 50
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">']
    for i, ch in enumerate(chars):
        x = 14 + i * 28
        y = random.randint(32, 40)
        angle = random.randint(-25, 25)
        r = random.randint(0, 255)
        g = random.randint(0, 255)
        b = random.randint(0, 255)
        lines.append(
            f'<text x="{x}" y="{y}" transform="rotate({angle},{x},{y})" '
            f'fill="rgb({r},{g},{b})" font-size="{random.randint(22, 28)}px" '
            f'font-family="Arial" font-weight="bold">{ch}</text>'
        )
    for _ in range(random.randint(3, 6)):
        x1 = random.randint(0, width)
        y1 = random.randint(0, height)
        x2 = random.randint(0, width)
        y2 = random.randint(0, height)
        r = random.randint(0, 255)
        g = random.randint(0, 255)
        b = random.randint(0, 255)
        lines.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="rgb({r},{g},{b})" stroke-width="{random.randint(1, 2)}" '
            f'stroke-linecap="round"/>'
        )
    lines.append('</svg>')
    return '\n'.join(lines)


def create_captcha() -> tuple[str, str]:
    code = _generate_code()
    key = uuid.uuid4().hex
    _captcha_store[key] = {"code": code, "expires_at": time.monotonic() + CAPTCHA_TTL}
    svg = _generate_svg(code)
    _cleanup()
    return key, svg


def validate_captcha(key: str, code: str) -> bool:
    entry = _captcha_store.pop(key, None)
    if entry is None:
        return False
    if time.monotonic() > entry["expires_at"]:
        return False
    return code.upper().strip() == entry["code"].upper().strip()


def _cleanup():
    now = time.monotonic()
    expired = [k for k, v in _captcha_store.items() if now > v["expires_at"]]
    for k in expired:
        del _captcha_store[k]
