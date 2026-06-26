import json
import re
import unicodedata
from typing import Any

from openai import OpenAI

from app.config import Settings
from app.schemas.title_extraction import TitleExtractionRequest, TitleExtractionResponse

JSON_BLOCK_RE = re.compile(r"```json\s*(\{.*?\})\s*```", re.IGNORECASE | re.DOTALL)
NORMALIZE_TEXT_RE = re.compile(r"[^a-z0-9]+")


class TitleExtractionService:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self.settings = settings
        self.client = client or OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=settings.deepseek_timeout_seconds,
        )

    def extract(self, request: TitleExtractionRequest) -> TitleExtractionResponse:
        if not self.settings.deepseek_api_key and self._is_real_client():
            raise RuntimeError("DEEPSEEK_API_KEY is not configured")

        response = self.client.chat.completions.create(**self._build_completion_kwargs(request))
        content = self._read_content(response)
        payload = self._parse_json_payload(content)

        raw_carrier = self._clean_text(payload.get("carrier"))
        carrier, carrier_from_candidates = self._resolve_carrier(raw_carrier, request.carrier_candidates)
        element = self._clean_text(payload.get("element"))

        return TitleExtractionResponse(
            marketplace=request.marketplace.upper(),
            title=request.title,
            is_custom=bool(payload.get("is_custom", False)),
            carrier=carrier,
            raw_carrier=raw_carrier,
            carrier_from_candidates=carrier_from_candidates,
            element=element,
            confidence=self._coerce_confidence(payload.get("confidence")),
            reason=self._clean_text(payload.get("reason")) or "No reason provided.",
            matched_carrier_anchor=self._clean_text(request.matched_carrier_anchor),
        )

    def extract_batch(self, requests: list[TitleExtractionRequest]) -> list[TitleExtractionResponse]:
        return [self.extract(item) for item in requests]

    def _build_completion_kwargs(self, request: TitleExtractionRequest) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": self.settings.deepseek_model,
            "messages": self._build_messages(request),
            "stream": False,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }
        if self.settings.deepseek_reasoning_effort:
            kwargs["reasoning_effort"] = self.settings.deepseek_reasoning_effort
        if self.settings.deepseek_enable_thinking:
            kwargs["extra_body"] = {"thinking": {"type": "enabled"}}
        return kwargs

    def _build_messages(self, request: TitleExtractionRequest) -> list[dict[str, str]]:
        candidates = request.carrier_candidates or []
        user_prompt = (
            "Analyze this ecommerce product title and extract only factual structure.\n"
            "Return JSON with keys: is_custom, carrier, element, confidence, reason.\n"
            "Rules:\n"
            "- is_custom is true only when the title clearly describes an element/theme attached to a product carrier.\n"
            "- carrier should be the physical carrier/product form.\n"
            "- element should be the theme, motif, character, animal, event, or visual concept.\n"
            "- confidence must be between 0 and 1.\n"
            "- If the title is generic or standard functional goods, set is_custom=false and carrier/element=null.\n\n"
            f"Marketplace: {request.marketplace.upper()}\n"
            f"Title: {request.title}\n"
            f"Carrier candidates: {json.dumps(candidates, ensure_ascii=False)}\n"
            f"Matched carrier anchor: {request.matched_carrier_anchor or ''}\n"
            f"Category hint: {request.category_hint or ''}\n"
            f"Language hint: {request.language_hint or ''}\n"
            f"Notes: {request.notes or ''}"
        )
        return [
            {
                "role": "system",
                "content": (
                    "You extract structured ecommerce title facts. "
                    "Be conservative. Reply with valid JSON only."
                ),
            },
            {"role": "user", "content": user_prompt},
        ]

    def _parse_json_payload(self, content: str) -> dict[str, Any]:
        if not content:
            return {}

        match = JSON_BLOCK_RE.search(content)
        if match:
            return json.loads(match.group(1))

        stripped = content.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            return json.loads(stripped)

        start = stripped.find("{")
        end = stripped.rfind("}")
        if start >= 0 and end > start:
            return json.loads(stripped[start : end + 1])

        raise ValueError("Model response does not contain a JSON object")

    def _resolve_carrier(self, raw_carrier: str | None, candidates: list[str]) -> tuple[str | None, bool]:
        if raw_carrier is None:
            return None, False
        if not candidates:
            return raw_carrier, False

        normalized_raw = self._normalize_key(raw_carrier)
        if not normalized_raw:
            return raw_carrier, False

        best_candidate: str | None = None
        best_score = 0
        raw_tokens = set(normalized_raw.split())

        for candidate in candidates:
            normalized_candidate = self._normalize_key(candidate)
            if not normalized_candidate:
                continue
            candidate_tokens = set(normalized_candidate.split())

            score = 0
            if normalized_candidate == normalized_raw:
                score = 3
            elif raw_tokens and (
                raw_tokens.issubset(candidate_tokens) or candidate_tokens.issubset(raw_tokens)
            ):
                score = 2

            if score > best_score:
                best_score = score
                best_candidate = candidate

        if best_candidate is not None and best_score >= 2:
            return best_candidate, True
        return raw_carrier, False

    def _coerce_confidence(self, value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(1.0, round(number, 4)))

    def _read_content(self, response: Any) -> str:
        choices = getattr(response, "choices", None) or []
        if not choices:
            return ""
        message = getattr(choices[0], "message", None)
        return getattr(message, "content", "") or ""

    def _normalize_key(self, value: str | None) -> str:
        cleaned = self._clean_text(value)
        if cleaned is None:
            return ""
        normalized = unicodedata.normalize("NFKC", cleaned).lower()
        normalized = NORMALIZE_TEXT_RE.sub(" ", normalized).strip()
        return " ".join(normalized.split())

    def _clean_text(self, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _is_real_client(self) -> bool:
        return isinstance(self.client, OpenAI)
