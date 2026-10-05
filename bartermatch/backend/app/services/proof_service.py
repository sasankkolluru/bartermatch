from urllib.parse import urlparse
ALLOWED={'instagram.com','www.instagram.com','youtube.com','www.youtube.com','youtu.be','tiktok.com','www.tiktok.com'}
def validate_proof_url(url):
    p=urlparse(url.strip())
    if p.scheme not in ('http','https') or p.hostname not in ALLOWED: raise ValueError('Submit a public Instagram, YouTube, or TikTok URL.')
    return True
def check_duplicate(conn,url):
    return conn.execute('SELECT id FROM proofs WHERE url=?',(url.strip(),)).fetchone() is not None
def anti_ghosting_days(submitted_at, now=None):
    """Returns days late after the usual 7-day proof window."""
    from datetime import datetime, timezone
    start=datetime.fromisoformat(submitted_at.replace('Z','+00:00'))
    end=now or datetime.now(timezone.utc)
    return max(0,(end-start).days-7)
