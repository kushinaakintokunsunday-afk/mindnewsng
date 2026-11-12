#!/usr/bin/env python3
"""Mindnewsng Facebook auto-poster.

Reads data/articles.json, picks articles not yet posted to the page,
downloads the article's real image, stamps the MINDNEWSNG.COM badge on it,
uploads + posts with a Style A message, then adds a first comment with the link.
State (posted article ids) is kept in data/fb_state.json (committed by the workflow).

Usage: python scripts/post_fb.py [--dry-run] [--max-posts N]
Env: FB_PAGE_ID, FB_PAGE_TOKEN
"""
import base64
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta

REPO = "kushinaakintokunsunday-afk/mindnewsng"
BRANCH = "main"
PAGE_ID = os.environ.get("FB_PAGE_ID", "")
TOKEN = os.environ.get("FB_PAGE_TOKEN", "")
API = "https://graph.facebook.com/v23.0"
MAX_PER_DAY = 20
MIN_SPACING_MIN = 40
MAX_AGE_H = 72  # never post articles older than this many hours
CTA = ("\n\n\u2764\ufe0f LIKE | \U0001F4AC COMMENT your thoughts | "
       "\U0001F501 SHARE to help someone\n"
       "\u2795 FOLLOW MINDNEWSNG for daily updates \U0001F4C8")
TAGS_BY_CAT = {
    "Jobs": "#JobsAbroad #Opportunity #Japa",
    "Money": "#Money #Finance #NaijaMoney",
    "Sports": "#Sports #Football #NaijaSports",
    "Politics": "#Politics #News #WorldNews",
    "Immigration": "#Immigration #Visa #Japa",
}


def http_json(url, data=None, method="GET"):
    req = urllib.request.Request(url, method=method)
    req.add_header("User-Agent", "Mozilla/5.0")
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


import urllib.parse  # noqa: E402


def graph(path, data=None, method="GET"):
    if data is None:
        data = {}
    data["access_token"] = TOKEN
    return http_json(f"{API}/{path}", data=data, method=method)


def fetch_articles():
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/contents/data/articles.json?ref={BRANCH}"],
        capture_output=True, text=True)
    o = json.loads(out.stdout)
    return json.loads(base64.b64decode(o["content"]).decode("utf-8"))


def fetch_state():
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/contents/data/fb_state.json?ref={BRANCH}"],
        capture_output=True, text=True)
    try:
        o = json.loads(out.stdout)
        return json.loads(base64.b64decode(o["content"]).decode("utf-8")), o["sha"]
    except Exception:
        return {"posted": {}, "days": {}}, None


def save_state(state, sha):
    body = json.dumps(state, indent=1)
    payload = {"message": "fb: update post state",
               "content": base64.b64encode(body.encode()).decode(),
               "branch": BRANCH}
    if sha:
        payload["sha"] = sha
    subprocess.run(
        ["gh", "api", "--method", "PUT",
         f"repos/{REPO}/contents/data/fb_state.json",
         "--input", "-"], input=json.dumps(payload), text=True, capture_output=True)


def recent_messages():
    """Titles already on the page (first 100 posts) - duplicate guard."""
    try:
        d = graph(f"{PAGE_ID}/posts", data={"fields": "message", "limit": 100})
        return {normalize((p.get("message") or "")) for p in d.get("data", [])}
    except Exception:
        return set()


def normalize(s):
    return "".join(c for c in s.lower() if c.isalnum())


def load_image(url):
    if os.name == "nt":
        r = subprocess.run(["curl.exe", "-s", "-L", "--max-time", "90",
                            "-A", "Mozilla/5.0", "--", url],
                           capture_output=True)
        if r.returncode == 0 and r.stdout and len(r.stdout) > 5000:
            return r.stdout
        raise RuntimeError("curl image load failed")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def stamp_badge(img_bytes):
    """Stamp the MINDNEWSNG.COM badge onto the real image."""
    from PIL import Image, ImageDraw, ImageFont
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    if im.width > 1600:
        im = im.resize((1600, int(im.height * 1600 / im.width)))
    txt = "MINDNEWSNG.COM"
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", max(22, im.width // 36))
    except Exception:
        for p in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"):
            try:
                font = ImageFont.truetype(p, max(22, im.width // 36))
                break
            except Exception:
                font = ImageFont.load_default()
    d = ImageDraw.Draw(im)
    tb = d.textbbox((0, 0), txt, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    pad = max(10, im.width // 90)
    x, y = pad, pad
    d.rounded_rectangle([x, y, x + tw + pad * 2, y + th + pad * 1.6],
                        radius=8, fill=(21, 32, 43))
    d.text((x + pad, y + pad // 2), txt, font=font, fill=(255, 255, 255))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def fallback_card(title):
    """Green text card if the real image cannot be fetched."""
    from PIL import Image, ImageDraw, ImageFont
    W = 1080
    im = Image.new("RGB", (W, W), (23, 107, 85))
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype("DejaVuSans-Bold.ttf", 64)
        fb = ImageFont.truetype("DejaVuSans-Bold.ttf", 54)
    except Exception:
        f = fb = ImageFont.load_default()
    words, lines, cur = title.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textbbox((0, 0), t, font=f)[2] > W - 120:
            lines.append(cur)
            cur = w
        else:
            cur = t
    lines.append(cur)
    y = 200
    for ln in lines:
        d.text((60, y), ln, font=f, fill="white")
        y += 80
    d.text((60, W - 160), "Full Details Below", font=fb, fill=(255, 214, 10))
    d.rounded_rectangle([60, W - 90, 60 + 360, W - 40], radius=8, fill=(21, 32, 43))
    d.text((80, W - 80), "MINDNEWSNG.COM", font=fb, fill="white")
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def build_message(a):
    # Legit.ng-style hook: short teaser + link. Never post the full story on FB -
    # the goal is clicks to the site.
    title = a.get("title", "").strip()
    if title.endswith(" - Check Below For Full Details"):
        title = title[: -len(" - Check Below For Full Details")]
    url = a.get("url", "")
    cat = a.get("category", "")
    tags = TAGS_BY_CAT.get(cat, "#NaijaNews #BreakingNews")
    msg = (f"\U0001f6a8 {title}\n\n"
           "\U0001F449 Full story here: " + url + "\n"
           "\u2764\uFE0f LIKE | \U0001F4AC COMMENT | \U0001F501 SHARE\n"
           "\u2795 FOLLOW for daily updates\n" + tags + " #Mindnewsng")
    return msg


def main():
    dry = "--dry-run" in sys.argv
    max_posts = 1
    if "--max-posts" in sys.argv:
        max_posts = int(sys.argv[sys.argv.index("--max-posts") + 1])
    if not dry and (not PAGE_ID or not TOKEN):
        print("FB_PAGE_ID / FB_PAGE_TOKEN missing"); sys.exit(1)

    arts = fetch_articles()
    state, sha = fetch_state()
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    posted_today = state["days"].get(today, 0)
    last_ts = state.get("last_ts")
    if last_ts:
        delta = (now - datetime.fromisoformat(last_ts)).total_seconds() / 60
        if delta < MIN_SPACING_MIN:
            print(f"spacing guard: {delta:.0f} min since last post"); return
    if posted_today >= MAX_PER_DAY:
        print(f"quota reached: {posted_today} posts today"); return

    seen = recent_messages()
    n = 0
    for a in arts:
        if n >= max_posts or posted_today + n >= MAX_PER_DAY:
            break
        aid = a.get("id") or a.get("slug")
        if not aid or aid in state["posted"]:
            continue
        # skip articles flagged manual (posted manually after user approval)
        if a.get("manual"):
            continue
        # freshness: skip articles older than MAX_AGE_H hours
        try:
            adate = datetime.fromisoformat(a.get("date", "").replace("Z", "+00:00"))
            age_h = (now - adate).total_seconds() / 3600
            if age_h > MAX_AGE_H:
                print(f"skip (too old, {age_h:.0f}h): {aid}")
                continue
        except Exception:
            pass
        title = a.get("title", "")
        if normalize(title)[:60] and any(m.startswith(normalize(title)[:60]) for m in seen):
            state["posted"][aid] = [now.isoformat()]
            print(f"skip (already on page): {aid}")
            continue
        msg = build_message(a)
        url = a.get("url", "")
        # image: real photo stamped, fallback card
        img_bytes = None
        src = a.get("image") or ""
        if src.startswith("http"):
            for attempt in range(2):
                try:
                    img_bytes = stamp_badge(load_image(src))
                    break
                except Exception as e:
                    print(f"image load fail ({e}), retrying...")
                    time.sleep(3)
        if img_bytes is None:
            img_bytes = fallback_card(title)
        if dry:
            print(f"--- DRY RUN: {aid}\nIMAGE: {'real+badge' if a.get('image') else 'card fallback'} ({len(img_bytes)//1024}KB)\n{msg}\nFIRST COMMENT: More details here: {url}\n")
            n += 1
            continue
        try:
            # single multipart call: image + text together -> exactly one post
            import uuid
            boundary = "----mindnewsng" + uuid.uuid4().hex
            fields = {"access_token": TOKEN, "published": "true", "message": msg}
            parts = []
            for k, v in fields.items():
                parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"source\"; filename=\"post.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode())
            parts.append(img_bytes)
            parts.append(f"\r\n--{boundary}--\r\n".encode())
            body = b"".join(parts)
            req = urllib.request.Request(
                f"{API}/{PAGE_ID}/photos", data=body, method="POST")
            req.add_header("Content-Type",
                           f"multipart/form-data; boundary={boundary}")
            with urllib.request.urlopen(req, timeout=120) as r:
                photo = json.loads(r.read().decode("utf-8"))
            post_id = photo.get("post_id") or photo.get("id")
            if url:
                try:
                    graph(f"{post_id}/comments",
                          data={"message": f"More details here: {url}"})
                except Exception:
                    pass  # link already in post text
            state["posted"][aid] = [now.isoformat()]
            state["days"][today] = posted_today + n + 1
            state["last_ts"] = now.isoformat()
            print(f"POSTED {aid} -> {post_id}")
            n += 1
            time.sleep(5)
        except Exception as e:
            print(f"FAILED {aid}: {e}")
    if not dry and n and "last_ts" in state:
        save_state(state, sha)
        print("state saved")
    print(f"done: {n} post(s)")


if __name__ == "__main__":
    main()
