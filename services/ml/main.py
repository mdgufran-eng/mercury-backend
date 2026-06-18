"""
Mercury ML Service — translation stub.
Run with: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Mercury ML Service", version="0.1.0")


class SegmentInput(BaseModel):
    id: str
    text: str


class TranslateRequest(BaseModel):
    source_language: str
    target_language: str
    segments: List[SegmentInput]


class SegmentOutput(BaseModel):
    id: str
    translated_text: str
    provider: str


class TranslateResponse(BaseModel):
    segments: List[SegmentOutput]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/translate", response_model=TranslateResponse)
def translate(request: TranslateRequest) -> TranslateResponse:
    """
    Stub translation endpoint. Returns source text unchanged.
    TODO: integrate actual MT engine (DeepL, Google Translate, custom model).
    """
    translated = [
        SegmentOutput(
            id=seg.id,
            translated_text=seg.text,  # stub: return source unchanged
            provider="stub",
        )
        for seg in request.segments
    ]
    return TranslateResponse(segments=translated)
