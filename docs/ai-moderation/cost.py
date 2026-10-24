# Cost per listing: prompt + listing text + photos in, JSON (+ any thinking) out.
# Token counts from count.py (o200k / Gemma / Qwen tokenizers); photos at 768x576 (4:3, 768 px long edge).
PROMPT, OUT_JSON = 970, 90
TEXT = {"typical": 300, "max": 2050}  # listing block
# name: (in $/M, out $/M, tokens per 768px photo, text factor vs o200k, extra thinking tokens, note)
M = {
    "Claude Haiku 5.5 (direct)":         (0.10, 0.50, 588, 1.5, 0,   "photo 28px patches; Persian text factor 1.5 assumed (weak)"),
    "Gemini 3.1 Flash-Lite (direct)":    (0.25, 1.50, 280, 1.0, 150, "media_resolution low = 280/photo; minimal thinking assumed"),
    "Gemini 3.1 Flash-Lite, medium res": (0.25, 1.50, 560, 1.0, 150, "media_resolution medium"),
    "Gemini 2.5 Flash-Lite (direct)":    (0.10, 0.40, 258, 1.0, 0,   "one 768 tile = 258; thinking off"),
    "Gemini 3.5 Flash-Lite (direct)":    (0.30, 2.50, 280, 1.0, 150, "low res"),
    "GPT-5.4-nano (direct)":             (0.20, 1.25, 519, 1.0, 100, "432 patches x1.2; reasoning minimal assumed"),
    "GPT-5.4-mini (direct)":             (0.75, 4.50, 519, 1.0, 100, ""),
    "Mistral Small 4 (direct, EU)":      (0.15, 0.60, 450, 1.05, 0,  "photo tokens weak estimate"),
    "Ministral 3 8B (direct, EU)":       (0.15, 0.15, 450, 1.05, 0,  "photo tokens weak estimate"),
    "CF Gemma 4 26B A4B":                (0.10, 0.30, 280, 0.95, 0,  "photo tokens weak estimate"),
    "CF Llama 4 Scout":                  (0.27, 0.85, 1008, 1.0, 0,  "7 tiles x 144, weak"),
    "CF Mistral Small 3.1 24B":          (0.351, 0.555, 450, 1.05, 0, "weak"),
    "OR Qwen3-VL 30B A3B (+5.5%)":       (0.15 * 1.055, 0.60 * 1.055, 432, 1.6, 0, "Qwen tokenizer 1.6x on Persian"),
}
SCEN = [("text only", "typical", 0), ("text + 1 photo", "typical", 1), ("text + 4 photos", "typical", 4), ("max text + 10 photos", "max", 10)]

print("| Model | " + " | ".join(s[0] for s in SCEN) + " | photo alone |")
print("|---|" + "---|" * (len(SCEN) + 1))
for name, (pin, pout, img, f, think, note) in M.items():
    cells = []
    for _, t, n in SCEN:
        tin = (PROMPT + TEXT[t]) * f + n * img
        tout = OUT_JSON * f + think
        cells.append(f"${(tin * pin + tout * pout) / 1e6 * 1000:.3f}")
    cells.append(f"${img * pin / 1e6 * 1000:.3f}")
    print(f"| {name} | " + " | ".join(cells) + " |")
print("\n(dollars per 1,000 listings)")
