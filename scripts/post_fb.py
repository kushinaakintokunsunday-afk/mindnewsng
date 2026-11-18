#!/usr/bin/env python3
"""Mindnewsng Facebook auto-poster (queue edition).

Order of posting:
1. Curated queue items from data/fb_queue.json (user-approved stories, exact
   pre-built message, pre-stamped card in repo images/) - these post first.
2. Auto-fetched articles from data/articles.json (skips manual:true and
   anything older than MAX_AGE_H hours).

State (posted ids, daily quota, last post time) lives in data/fb_state.json.
The queue item is removed from data/fb_queue.json right after it posts, and
both files are saved with a fresh sha each time to avoid races with the
agent pushing new items.

Usage: python scripts/post_fb.py [--dry-run] [--max-posts N]
Env: FB_PAGE_ID, FB_PAGE_TOKEN
"""
import base64
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta

REPO = "kushinaakintokunsunday-afk/mindnewsng"
BRANCH = "main"
PAGE_ID = os.environ.get("FB_PAGE_ID", "")
TOKEN = os.environ.get("FB_PAGE_TOKEN", "")
API = "https://graph.facebook.com/v23.0"
MAX_PER_DAY = 20
MIN_SPACING_MIN = 40
MAX_AGE_H = 72  # never post articles older than this many hours
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


def graph(path, data=None, method="GET"):
    if data is None:
        data = {}
    data["access_token"] = TOKEN
    return http_json(f"{API}/{path}", data=data, method=method)


def gh_get_raw(path):
    """Return decoded text content of a repo file (works for files >1MB), or None."""
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/contents/{path}?ref={BRANCH}",
         "-H", "Accept: application/vnd.github.raw"],
        capture_output=True, text=True)
    if out.returncode != 0 or not out.stdout:
        return None
    return out.stdout


def gh_meta_sha(path):
    """Return the file's sha via Contents API metadata (content may be null)."""
    out = subprocess.run(
        ["gh", "api", f"repos/{REPO}/contents/{path}?ref={BRANCH}"],
        capture_output=True, text=True)
    try:
        return json.loads(out.stdout)["sha"]
    except Exception:
        return None


def gh_put_raw(path, content_bytes, message):
    sha = gh_meta_sha(path)
    payload = {"message": message,
               "content": base64.b64encode(content_bytes).decode(),
               "branch": BRANCH}
    if sha:
        payload["sha"] = sha
    r = subprocess.run(
        ["gh", "api", "--method", "PUT", f"repos/{REPO}/contents/{path}",
         "--input", "-"], input=json.dumps(payload), text=True, capture_output=True)
    return r.returncode == 0


def fetch_articles():
    raw = gh_get_raw("data/articles.json")
    return json.loads(raw) if raw else []


def fetch_state():
    raw = gh_get_raw("data/fb_state.json")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return {"posted": {}, "days": {}, "last_ts": None}


def save_state(state):
    gh_put_raw("data/fb_state.json", json.dumps(state, indent=1).encode(),
               "fb: update post state")


def fetch_tuning():
    """Optional data/fb_tuning.json: {"min_spacing_min": N, "until": "YYYY-MM-DD"}"""
    raw = gh_get_raw("data/fb_tuning.json")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def fetch_queue():
    raw = gh_get_raw("data/fb_queue.json")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return []


def save_queue(items):
    """Re-fetch, drop nothing, then write the exact given list (fresh sha)."""
    return gh_put_raw("data/fb_queue.json", json.dumps(items, indent=1, ensure_ascii=False).encode(),
                      "fb: update curated post queue")


def queue_remove(aid):
    """Remove one id from the queue without losing concurrent additions."""
    items = fetch_queue()
    remaining = [i for i in items if i.get("id") != aid]
    if len(remaining) != len(items):
        save_queue(remaining)


def recent_messages():
    """Titles already on the page (first 100 posts) - duplicate guard."""
    try:
        d = graph(f"{PAGE_ID}/posts", data={"fields": "message", "limit": 100})
        return {normalize((p.get("message") or "")) for p in d.get("data", [])}
    except Exception:
        return set()


def normalize(s):
    return "".join(c for c in s.lower() if c.isalnum())


# --- first-comment link strategy -----------------------------------------
# Caption stays clean (no link). The story link is posted as the FIRST
# COMMENT, because Facebook gives link posts far less reach than photo posts.
def extract_url(text):
    m = re.search(r"https?://[^\s]+", text or "")
    return m.group(0) if m else ""


def strip_link(text):
    lines = [ln for ln in (text or "").splitlines()
             if not re.search(r"https?://", ln)]
    out = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


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
    # Link is NOT in the caption - it goes in the first comment (more reach).
    msg = (f"\U0001f6a8 {title}\n\n"
           "\u2764\uFE0F LIKE | \U0001F4AC COMMENT | \U0001F501 SHARE\n"
           "\u2795 FOLLOW for daily updates\n" + tags + " #Mindnewsng")
    return msg


def post_photo(msg, img_bytes, url=None):
    """Single multipart call: image + text -> one post. Returns post_id."""
    import uuid
    boundary = "----mindnewsng" + uuid.uuid4().hex
    fields = {"access_token": TOKEN, "published": "true", "message": msg}
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"source\"; filename=\"post.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode())
    parts.append(img_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    req = urllib.request.Request(
        f"{API}/{PAGE_ID}/photos", data=b"".join(parts), method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    with urllib.request.urlopen(req, timeout=120) as r:
        photo = json.loads(r.read().decode("utf-8"))
    post_id = photo.get("post_id") or photo.get("id")
    if url:
        try:
            graph(f"{post_id}/comments",
                  data={"message": f"\U0001F449 Full story here: {url}"})
            print(f"  first comment posted on {post_id}")
        except Exception as e:
            print(f"  first comment failed on {post_id}: {e}")
    return post_id


def maybe_dispatch(state, today, dry, posted_this_run):
    """Chain-fire the next run so posting continues until the daily quota is met.

    This replaces reliance on GitHub's drifting cron: each run starts the next
    one when it finishes. Stops when: quota reached, outside the posting
    window (05-21 UTC = 6am-10pm WAT), or 3 consecutive runs posted nothing.
    """
    if dry:
        return
    posted_today = state["days"].get(today, 0)
    if posted_today >= MAX_PER_DAY:
        print("chain stop: daily quota reached"); return
    h = datetime.now(timezone.utc).hour
    if not (5 <= h < 21):
        print("chain stop: outside posting window (05-21 UTC)"); return
    fails = int(state.get("nogood") or 0)
    if posted_this_run == 0:
        fails += 1
        if fails >= 3:
            print("chain stop: 3 consecutive runs with no posts - check token/queue/state")
            return
    else:
        fails = 0
    state["nogood"] = fails
    save_state(state)
    r = subprocess.run(["gh", "workflow", "run", "FB Auto Post", "-R", REPO],
                       capture_output=True, text=True)
    print("chain: next run dispatched" if r.returncode == 0
          else f"chain dispatch failed: {(r.stderr or '')[:200]}")


def main():
    dry = "--dry-run" in sys.argv
    max_posts = 1
    if "--max-posts" in sys.argv:
        max_posts = int(sys.argv[sys.argv.index("--max-posts") + 1])
    if not dry and (not PAGE_ID or not TOKEN):
        print("FB_PAGE_ID / FB_PAGE_TOKEN missing"); sys.exit(1)

    # spacing: default 40 min, temporarily overridable via data/fb_tuning.json
    spacing = MIN_SPACING_MIN
    tune = fetch_tuning()
    try:
        n = int(tune.get("min_spacing_min") or 0)
        until = str(tune.get("until") or "")
        today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if n > 0 and (not until or today_utc <= until):
            spacing = n
            print(f"spacing override active: {spacing} min (until {until or 'unset'})")
    except Exception:
        spacing = MIN_SPACING_MIN

    state = fetch_state()
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    posted_today = state["days"].get(today, 0)
    last_ts = state.get("last_ts")
    if last_ts:
        delta = (now - datetime.fromisoformat(last_ts)).total_seconds() / 60
        if delta < spacing:
            wait = spacing - delta
            print(f"spacing guard: waiting {wait:.0f} min to honor the last post")
            time.sleep(wait * 60)
            now = datetime.now(timezone.utc)
            today = now.strftime("%Y-%m-%d")
            posted_today = state["days"].get(today, 0) or posted_today
    if posted_today >= MAX_PER_DAY:
        print(f"quota reached: {posted_today} posts today"); return

    seen = recent_messages()
    n = 0

    def quota_left():
        return max_posts - n, MAX_PER_DAY - (posted_today + n)

    # ---------- 1. curated queue (priority) ----------
    queue = fetch_queue()
    for item in queue:
        left, quota = quota_left()
        if left <= 0 or quota <= 0:
            break
        aid = item.get("id")
        if not aid:
            continue
        if aid in state["posted"]:
            queue_remove(aid)
            continue
        msg = item.get("message", "")
        title = item.get("title", aid)
        url = item.get("url") or extract_url(msg)
        msg = strip_link(msg)
        card = item.get("card", "")
        img_bytes = None
        if card.startswith("http"):
            try:
                img_bytes = load_image(card)  # pre-stamped, no re-badge
            except Exception as e:
                print(f"queue card load fail ({e}), using fallback")
        if img_bytes is None:
            img_bytes = fallback_card(title)
        if dry:
            print(f"--- DRY RUN (queue): {aid}\nIMAGE: {card or 'fallback'} ({len(img_bytes)//1024}KB)\n{msg}\n")
            n += 1
            continue
        try:
            pid = post_photo(msg, img_bytes, url=url)
            state["posted"][aid] = [now.isoformat()]
            state["days"][today] = posted_today + n + 1
            state["last_ts"] = now.isoformat()
            print(f"POSTED (queue) {aid} -> {pid}")
            n += 1
            save_state(state)
            queue_remove(aid)
            left, _ = quota_left()
            if left > 0:
                print(f"pacing: sleeping {spacing} min before next post in this run")
                time.sleep(spacing * 60)
        except Exception as e:
            print(f"FAILED (queue) {aid}: {e}")

    # ---------- 2. auto-fetched articles ----------
    arts = fetch_articles()
    for a in arts:
        left, quota = quota_left()
        if left <= 0 or quota <= 0:
            break
        aid = a.get("id") or a.get("slug")
        if not aid or aid in state["posted"]:
            continue
        # skip articles flagged manual (they go through the curated queue)
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
            post_id = post_photo(msg, img_bytes, url=url)
            state["posted"][aid] = [now.isoformat()]
            state["days"][today] = posted_today + n + 1
            state["last_ts"] = now.isoformat()
            print(f"POSTED {aid} -> {post_id}")
            n += 1
            save_state(state)
            left, _ = quota_left()
            if left > 0:
                print(f"pacing: sleeping {spacing} min before next post in this run")
                time.sleep(spacing * 60)
        except Exception as e:
            print(f"FAILED {aid}: {e}")
    print(f"done: {n} post(s)")
    maybe_dispatch(state, today, dry, n)


if __name__ == "__main__":
    main()
