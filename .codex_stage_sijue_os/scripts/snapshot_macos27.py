from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ORIGIN = "https://macos27.kimi.page/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reference" / "macos27-public-build"

TECH_SIGNATURES = {
    "react": ["createRoot", "react.dev/errors", "useSyncExternalStore"],
    "zustand": ["zustand persist middleware", "onRehydrateStorage"],
    "lucide": ["lucide-", "iconNode"],
    "tailwind": ["--tw-", "tailwind"],
    "local_storage": ["localStorage"],
    "liquid_glass": ["backdrop-filter", "color-mix", "feDisplacementMap"],
    "pointer_interactions": ["pointerdown", "requestAnimationFrame", "ResizeObserver"],
}


def request(url: str) -> tuple[bytes, dict[str, str], int]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read(), dict(response.headers), response.status


def safe_relative_path(url: str) -> Path:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.lstrip("/") or "index.html"
    if path.endswith("/"):
        path += "index.html"
    return Path(path)


def save_bytes(relative: Path, data: bytes) -> Path:
    destination = OUTPUT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return destination


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def asset_candidates(text: str) -> set[str]:
    candidates: set[str] = set()
    patterns = [
        r'(?:src|href)=["\']([^"\']+)["\']',
        r'(?<![A-Za-z0-9_])((?:\./|/)?assets/[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+)',
    ]
    for pattern in patterns:
        for value in re.findall(pattern, text):
            if isinstance(value, tuple):
                value = value[0]
            if value.startswith("data:") or value.startswith("javascript:"):
                continue
            candidates.add(urllib.parse.urljoin(ORIGIN, value))
    return candidates


def external_urls(text: str) -> set[str]:
    found = set(re.findall(r'https?://[^"\'`\\\s<>]+', text))
    return {value.rstrip(").,;}") for value in found}


def source_paths(text: str) -> set[str]:
    return set(
        re.findall(
            r'(?:src|node_modules)/[A-Za-z0-9_./@-]+\.(?:tsx?|jsx?|css|scss)',
            text,
        )
    )


def decode(data: bytes) -> str:
    return data.decode("utf-8", "replace")


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    queue = [ORIGIN]
    visited: set[str] = set()
    records: list[dict[str, object]] = []
    texts: list[str] = []
    discovered_external: set[str] = set()
    discovered_sources: set[str] = set()

    while queue:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        parsed = urllib.parse.urlparse(url)
        is_origin = parsed.netloc == urllib.parse.urlparse(ORIGIN).netloc
        if not is_origin and parsed.netloc not in {"www.kimi.com", "statics.moonshot.cn"}:
            continue

        try:
            data, headers, status = request(url)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            records.append({"url": url, "error": str(exc)})
            continue

        if is_origin:
            relative = safe_relative_path(url)
        else:
            relative = Path("external") / parsed.netloc / safe_relative_path(url)

        destination = save_bytes(relative, data)
        content_type = headers.get("Content-Type", "")
        record = {
            "url": url,
            "status": status,
            "content_type": content_type,
            "bytes": len(data),
            "sha256": sha256(data),
            "saved_as": destination.relative_to(OUTPUT).as_posix(),
            "headers": headers,
        }
        records.append(record)

        if any(marker in content_type for marker in ("text/", "javascript", "json", "xml")) or relative.suffix in {".js", ".css", ".html"}:
            text = decode(data)
            texts.append(text)
            discovered_external.update(external_urls(text))
            discovered_sources.update(source_paths(text))
            for candidate in asset_candidates(text):
                candidate_host = urllib.parse.urlparse(candidate).netloc
                if candidate_host in {
                    urllib.parse.urlparse(ORIGIN).netloc,
                    "www.kimi.com",
                    "statics.moonshot.cn",
                } and candidate not in visited:
                    queue.append(candidate)

    combined = "\n".join(texts)
    technology = {
        name: {
            signature: combined.lower().count(signature.lower())
            for signature in signatures
        }
        for name, signatures in TECH_SIGNATURES.items()
    }
    react_version_match = re.search(r'\.version="(19\.[0-9.]+)"', combined)
    if react_version_match:
        technology["react_version"] = react_version_match.group(1)

    analysis_dir = OUTPUT / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    (analysis_dir / "asset-manifest.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (analysis_dir / "technology-signatures.json").write_text(
        json.dumps(technology, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (analysis_dir / "external-urls.txt").write_text(
        "\n".join(sorted(discovered_external)), encoding="utf-8"
    )
    (analysis_dir / "source-paths.txt").write_text(
        "\n".join(sorted(discovered_sources)), encoding="utf-8"
    )
    (analysis_dir / "snapshot-metadata.json").write_text(
        json.dumps(
            {
                "origin": ORIGIN,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "user_agent": USER_AGENT,
                "resource_count": len(records),
                "source_path_count": len(discovered_sources),
                "external_url_count": len(discovered_external),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(json.dumps({"resources": len(records), "output": str(OUTPUT)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
