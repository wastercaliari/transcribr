"""Servidor local de transcrição (faster-whisper, CPU, int8).

Recebe um WAV via POST em http://127.0.0.1:8765/transcribe?prompt=...&hotwords=... e devolve JSON
com o texto e os segmentos (com as métricas usadas pelo bot para filtrar alucinações).

Configuração por variáveis de ambiente (definidas no .env do bot):
  WHISPER_MODEL    modelo (small, medium, large-v3-turbo...). Padrão: small
  WHISPER_THREADS  threads de CPU. Padrão: núcleos - 1 (entre 2 e 8)
  WHISPER_BEAM     beam size. Padrão: 5
"""
import io
import json
import os
import sys
import threading
import urllib.parse
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding="utf-8")

HOST, PORT = "127.0.0.1", 8765
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small").strip() or "small"
CPU_THREADS = int(os.environ.get("WHISPER_THREADS") or min(8, max(2, (os.cpu_count() or 4) - 1)))
BEAM_SIZE = int(os.environ.get("WHISPER_BEAM") or 5)

print(f"[STT] Carregando Whisper '{MODEL_SIZE}' (int8, {CPU_THREADS} threads, beam {BEAM_SIZE})...", flush=True)
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8", cpu_threads=CPU_THREADS)
lock = threading.Lock()  # uma transcrição por vez
print(f"[STT] Pronto em http://{HOST}:{PORT}", flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send(200, {"status": "ok", "model": MODEL_SIZE})

    def do_POST(self):
        try:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            prompt = query.get("prompt", [""])[0] or None
            hotwords = query.get("hotwords", [""])[0] or None
            length = int(self.headers.get("Content-Length", 0))
            with wave.open(io.BytesIO(self.rfile.read(length)), "rb") as wf:
                # O bot envia WAV PCM 16-bit, mono, 16 kHz
                audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0

            with lock:
                segments, _info = model.transcribe(
                    audio,
                    language="pt",
                    beam_size=BEAM_SIZE,
                    # Se a decodificação sair ruim (repetição/baixa confiança), tenta de novo com mais variação
                    temperature=(0.0, 0.2, 0.4),
                    compression_ratio_threshold=2.4,
                    log_prob_threshold=-1.0,
                    no_speech_threshold=0.6,
                    initial_prompt=prompt,
                    hotwords=hotwords,  # nomes e gírias do vocabulario.txt: viram "dica" de vocabulário
                    condition_on_previous_text=False,
                    vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 250},
                )
                segs = [
                    {
                        "text": s.text,
                        "no_speech_prob": s.no_speech_prob,
                        "avg_logprob": s.avg_logprob,
                        "compression_ratio": s.compression_ratio,
                    }
                    for s in segments
                ]
            text = " ".join(s["text"].strip() for s in segs).strip()
            self._send(200, {"text": text, "segments": segs})
        except Exception as e:
            self._send(500, {"error": str(e)})


if __name__ == "__main__":
    try:
        HTTPServer((HOST, PORT), Handler).serve_forever()
    except OSError:
        print(f"[STT] Porta {PORT} já está em uso (servidor já rodando?).", flush=True)
        sys.exit(1)
