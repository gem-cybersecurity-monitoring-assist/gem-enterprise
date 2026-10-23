"""ComfyUI-API-compatible render service backed by the free GEM renderer.

The trusted video worker (`pnpm run video:worker`) was built to submit the
orchestrator's video recipe to a self-hosted ComfyUI instance. This service
implements the subset of the ComfyUI HTTP API that the worker uses, so the
worker, the server-side render jobs, upload verification, finalization and
exact-version approval all run unchanged:

  GET  /system_stats          readiness probe
  GET  /queue                 running + pending prompts
  POST /queue                 {"delete": [prompt_id, ...]} cancels pending prompts
  POST /prompt                {"prompt": workflow, "client_id", "extra_data"} -> {"prompt_id"}
  GET  /history[?max_items=]  all finished prompts
  GET  /history/{prompt_id}   one finished prompt
  GET  /view?filename=&subfolder=&type=output   the rendered file

The prompt text the worker writes into the workflow's prompt node is the
recipe produced by `rendererPrompt()` in src/lib/video/content-rendering.ts:
header lines, an optional "Approved script context: …" line, then one
"Scene N: Visual: … Narration intent: … On-screen text concept: …" line per
scene. This service parses that text back into scenes and renders a 1080x1920
MP4 with Pexels footage (PEXELS_API_KEY) and Piper narration (PIPER_MODEL).

Binds to 127.0.0.1 only. Standard library HTTP server; one render at a time.
"""
import json
import os
import queue
import re
import sys
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gem_reels  # noqa: E402
from media import MediaKit  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("COMFY_COMPAT_PORT", "8188"))
OUTPUT_DIR = os.path.abspath(os.environ.get("COMFY_COMPAT_OUTPUT_DIR", "comfy-output"))
BRAND = os.environ.get("COMFY_COMPAT_BRAND", "GEM Enterprise")

SCENE_RE = re.compile(r"^Scene\s+\d+:\s*(?P<body>.*)$")
FIELD_RE = re.compile(r"(Visual|Narration intent|On-screen text concept):\s*")

STOPWORDS = set("""a an the and or of to in on with for from into by at as is are be this that these those
its it no any show return clear next step canonical gem destination restrained non sensitive visualization
current market signal approved service visuals customer infrastructure data direct eye contact closes
setting camera professional""".split())


# ---------- recipe parsing ----------
def parse_scene_line(body):
    """Splits 'Visual: v Narration intent: n On-screen text concept: t' into a dict."""
    parts = FIELD_RE.split(body)
    fields = {}
    # parts = ["", "Visual", "v ", "Narration intent", "n ", ...]
    for index in range(1, len(parts) - 1, 2):
        fields[parts[index]] = parts[index + 1].strip()
    return {
        "visual": fields.get("Visual", ""),
        "narration": fields.get("Narration intent", ""),
        "text": fields.get("On-screen text concept", ""),
    }


def footage_query(visual):
    """Short Pexels search from a long visual direction; always people-forward."""
    words = [w for w in re.findall(r"[a-zA-Z]+", visual.lower()) if w not in STOPWORDS and len(w) > 2]
    people = {"presenter", "person", "people", "woman", "man", "team", "human", "operator"}
    query = words[:4]
    if not people.intersection(query):
        query = ["person"] + query[:3]
    return " ".join(query) or "person working laptop office"


def recipe_text(workflow):
    """Finds the prompt text the worker wrote into the workflow."""
    candidates = []
    for node in workflow.values():
        if not isinstance(node, dict):
            continue
        text = (node.get("inputs") or {}).get("text")
        if isinstance(text, str) and text.strip():
            candidates.append((node.get("class_type") == "GemReelsPrompt", "Scene " in text, text))
    if not candidates:
        raise ValueError("The workflow has no prompt text.")
    candidates.sort(reverse=True)
    return candidates[0][2]


def post_from_recipe(prompt_id, text):
    scenes = []
    for line in text.splitlines():
        match = SCENE_RE.match(line.strip())
        if match:
            scenes.append(parse_scene_line(match.group("body")))
    if not scenes:
        raise ValueError("The recipe contains no scenes.")
    rendered = []
    total = len(scenes)
    for index, scene in enumerate(scenes):
        title = scene["text"] or scene["narration"][:72]
        say = scene["narration"] or scene["text"]
        footage = footage_query(scene["visual"]) if scene["visual"] else None
        if index == 0:
            rendered.append({"type": "hook", "dur": 2.5, "text": title, "say": say, "footage": footage})
        else:
            rendered.append({"type": "point", "dur": 3.5, "chip": f"{index} / {total - 1}", "title": title,
                             "say": say, "footage": footage})
    rendered.append({"type": "end", "dur": 2.0, "lines": ["Stay alert.", "Stay secure."],
                     "cta": f"Follow {BRAND} for daily tips."})
    return {"id": prompt_id, "format": "video", "brand": BRAND, "scenes": rendered}


# ---------- render queue ----------
class RenderService:
    def __init__(self):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        self.lock = threading.Lock()
        self.pending = []           # [(number, prompt_id, workflow, extra_data)]
        self.running = None         # same tuple, or None
        self.history = {}           # prompt_id -> ComfyUI history entry
        self.counter = 0
        self.completed = 0
        self.failed = 0
        self.work = queue.Queue()
        self.credits = []
        self.kit = MediaKit(OUTPUT_DIR, self.credits)
        threading.Thread(target=self._loop, daemon=True).start()

    def submit(self, workflow, client_id, extra_data):
        prompt_id = str(uuid.uuid4())
        with self.lock:
            self.counter += 1
            item = (self.counter, prompt_id, workflow, {**(extra_data or {}), "client_id": client_id})
            self.pending.append(item)
        self.work.put(prompt_id)
        return prompt_id, self.counter

    def cancel(self, prompt_ids):
        with self.lock:
            self.pending = [item for item in self.pending if item[1] not in set(prompt_ids)]

    def queue_state(self):
        with self.lock:
            return {
                "queue_running": [list(self.running)] if self.running else [],
                "queue_pending": [list(item) for item in self.pending],
            }

    def _loop(self):
        while True:
            prompt_id = self.work.get()
            with self.lock:
                item = next((entry for entry in self.pending if entry[1] == prompt_id), None)
                if item is None:
                    continue  # cancelled
                self.pending.remove(item)
                self.running = item
            started = time.time()
            try:
                post = post_from_recipe(prompt_id, recipe_text(item[2]))
                path = gem_reels.render_video(post, OUTPUT_DIR, self.kit)
                entry = {
                    "prompt": list(item),
                    "outputs": {"gem_reels": {"videos": [
                        {"filename": os.path.basename(path), "subfolder": "", "type": "output"}]}},
                    "status": {"status_str": "success", "completed": True, "messages": [
                        ["execution_success", {"prompt_id": prompt_id, "seconds": round(time.time() - started, 1)}]]},
                }
                print(f"[render] {prompt_id} ok in {time.time() - started:.0f}s", flush=True)
                with self.lock:
                    self.completed += 1
            except Exception as error:  # report as a ComfyUI execution error
                traceback.print_exc()
                with self.lock:
                    self.failed += 1
                entry = {
                    "prompt": list(item),
                    "outputs": {},
                    "status": {"status_str": "error", "completed": False, "messages": [
                        ["execution_error", {"exception_type": type(error).__name__,
                                             "exception_message": str(error)[:500], "node_id": "gem_reels"}]]},
                }
            with self.lock:
                self.history[prompt_id] = entry
                self.running = None
            with open(os.path.join(OUTPUT_DIR, "CREDITS.json"), "w") as handle:
                json.dump(self.credits, handle, indent=2)


SERVICE = None


class Handler(BaseHTTPRequestHandler):
    server_version = "GemComfyCompat/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[http] " + (fmt % args) + "\n")

    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 5 * 1024 * 1024:
            raise ValueError("Request body too large.")
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):  # noqa: N802
        url = urlparse(self.path)
        if url.path == "/system_stats":
            with SERVICE.lock:
                counts = {"submitted": SERVICE.counter, "completed": SERVICE.completed, "failed": SERVICE.failed,
                          "busy": bool(SERVICE.running or SERVICE.pending)}
            return self._json(200, {"system": {"comfyui_version": "gem-compat-1", "renderer": "gem_reels",
                                               "voice": SERVICE.kit.voice_available,
                                               "footage": bool(SERVICE.kit.pexels_key)},
                                    "devices": [], "gem_render": counts})
        if url.path == "/queue":
            return self._json(200, SERVICE.queue_state())
        if url.path == "/history":
            limit = int((parse_qs(url.query).get("max_items") or ["200"])[0])
            with SERVICE.lock:
                items = list(SERVICE.history.items())[-max(1, min(limit, 1000)):]
            return self._json(200, dict(items))
        if url.path.startswith("/history/"):
            prompt_id = unquote(url.path[len("/history/"):])
            with SERVICE.lock:
                entry = SERVICE.history.get(prompt_id)
            return self._json(200, {prompt_id: entry} if entry else {})
        if url.path == "/view":
            query = parse_qs(url.query)
            name = os.path.basename((query.get("filename") or [""])[0])
            if not name or (query.get("subfolder") or [""])[0] or (query.get("type") or ["output"])[0] != "output":
                return self._json(404, {"error": "not found"})
            path = os.path.join(OUTPUT_DIR, name)
            if not os.path.isfile(path):
                return self._json(404, {"error": "not found"})
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(os.path.getsize(path)))
            self.end_headers()
            with open(path, "rb") as handle:
                while chunk := handle.read(1024 * 1024):
                    self.wfile.write(chunk)
            return None
        return self._json(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        url = urlparse(self.path)
        try:
            body = self._body()
        except Exception as error:
            return self._json(400, {"error": str(error)})
        if url.path == "/prompt":
            workflow = body.get("prompt")
            if not isinstance(workflow, dict):
                return self._json(400, {"error": "prompt must be a workflow object"})
            try:
                recipe_text(workflow)
            except ValueError as error:
                return self._json(400, {"error": str(error)})
            prompt_id, number = SERVICE.submit(workflow, body.get("client_id"), body.get("extra_data"))
            return self._json(200, {"prompt_id": prompt_id, "number": number, "node_errors": {}})
        if url.path == "/queue":
            SERVICE.cancel(body.get("delete") or [])
            return self._json(200, {})
        return self._json(404, {"error": "not found"})


def main():
    global SERVICE
    SERVICE = RenderService()
    print(f"gem comfy-compat on http://{HOST}:{PORT} · voice {'on' if SERVICE.kit.voice_available else 'off'} · "
          f"footage {'on' if SERVICE.kit.pexels_key else 'off'}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
