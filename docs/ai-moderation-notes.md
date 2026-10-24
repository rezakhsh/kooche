# AI moderation: research notes (in progress)

Oct 24, 2026 · roadmap step 11 · research only, no code. Interim notes so a later session can continue; the deliverable is still `docs/ai-moderation.md` (comparison table, recommendation, risks). Sample listings, the prompt draft and the scripts are in `docs/ai-moderation/`.

**Status:** the owner approved the per-listing cost work. Prices and token counts are done, and there is a first recommendation, **pending a live test**. Still open: GDPR and DPA details per provider, rate limits, the DSA and privacy-policy wording, the test-set design and shadow mode, and the final document.

## Recommendation so far

- **Primary: Claude Haiku 5.5, called directly by the worker.** About $0.0005 per listing (4 photos), $2.20 a month at 3,000 listings. We already need an Anthropic key for AI posting (step 5), and the architecture planned the Claude API. Weak point: no Persian benchmark has tested Haiku 5.5 yet; Haiku 4.5 scored 0.83, behind gpt-5-nano at 0.90 ([persian-llm-eval](https://github.com/heyparsadev/persian-llm-eval), not peer-reviewed, about ±3 points).
- **Fallback: GPT-5.4-nano or Gemini 3.1 Flash-Lite, direct.** About $0.0009–0.001 per listing, about $4 a month at 3,000.
- **Not Cloudflare Workers AI:** its cheap vision models are open models (Gemma 4, Llama 4 Scout, Mistral Small 3.1) with the weakest Persian evidence. Zero-shot Llama 3 and Gemma 2 did poorly on Persian toxicity ([arXiv 2506.03458](https://arxiv.org/pdf/2506.03458)). The [privacy page](https://developers.cloudflare.com/workers-ai/platform/privacy/) says no training and no retention of content, but gives no EU processing guarantee and names no DPA. Llama Guard 3 reads text only and doesn't know our terms sections.
- **OpenRouter only if direct is not possible:** the same closed models plus a 5.5% credit fee (8% on Business). [ZDR](https://openrouter.ai/docs/guides/features/zdr) can be forced per request (`provider.zdr: true`). EU in-region routing (`eu.openrouter.ai`) needs the Business plan ([pricing](https://openrouter.ai/pricing)). It adds a second processor and another point of failure.
- **Cost doesn't decide this.** Every candidate stays under about $40 a month at 30,000 listings. Accuracy in Persian and Finglish, photo understanding and GDPR do.

## Token counts (offline tokenizers, synthetic listings)

`count.py` ran in a throwaway `python:3.12-slim` container with `tiktoken` and `tokenizers`. The `tokenizer.json` files came from Hugging Face (`Qwen/Qwen2.5-VL-7B-Instruct` and the unsloth mirrors of Gemma 3, Llama 3.2 Vision, Llama 4 Scout and Mistral Small 3.1). They are not committed (100 MB). Run it as `python -I count.py <dir with listings.json and prompt.txt> <dir with tokenizer files>`.

| Text | o200k (OpenAI) | Gemma 3 | Llama 3.2 | Llama 4 | Qwen 2.5 | Mistral Small 3.1 |
|---|---|---|---|---|---|---|
| Policy prompt (`prompt.txt`) | 959 | 972 | 964 | 961 | 980 | 974 |
| Output JSON | 82 | 79 | 87 | 80 | 114 | 84 |
| Short listing (293 characters) | 100 | 103 | 103 | 104 | 138 | 108 |
| Typical listing (900 characters) | 304 | 297 | 298 | 303 | 468 | 326 |
| Finglish listing (303 characters) | 94 | 93 | 94 | 93 | 104 | 98 |
| Maximum (90 + 5,000 characters, 10 attributes) | 2,065 | 1,882 | 2,028 | 2,011 | 3,510 | 2,097 |

Persian runs at about 2.9 characters per token (Qwen 1.7). Claude's tokenizer can't be counted without a key, so `cost.py` assumes 1.5× o200k (weak). The prompt is under 1,024 tokens, below most providers' caching minimums, so no caching is assumed.

## Image tokens per photo (768 × 576 px, from the providers' pages)

| Provider | Rule | Tokens |
|---|---|---|
| Claude (Haiku 5.5 is in the high-resolution tier) | ⌈w/28⌉ × ⌈h/28⌉ ([vision](https://platform.claude.com/docs/en/build-with-claude/vision)) | 588 |
| Gemini 3.x | fixed per `media_resolution`: low 280, medium 560, high and default 1,120 ([media resolution](https://ai.google.dev/gemini-api/docs/media-resolution)) | 280 at low |
| Gemini 2.5 | 258 per 768 px tile ([tokens](https://ai.google.dev/gemini-api/docs/tokens)) | 258 |
| OpenAI | 32 px patches × multiplier (5.4-mini and 5.4-nano 1.2, gpt-5-nano 1.5, 4.1-mini 1.62) ([vision](https://developers.openai.com/api/docs/guides/images-vision)) | 519 |
| Mistral, Gemma 4, Llama 4 Scout, Qwen3-VL | not published; estimated | ~450 / ~280 / ~1,008 / ~432 (weak) |

**Photo size matters:** Gemini 3.x defaults to 1,120 tokens per photo, so the worker must set `media_resolution` to low or medium. imgproxy today only serves 160², 480×360 and 1280; a 768 px size would have to be added (or the 480×360 card size used for a first pass).

## Prices checked Oct 24, 2026 (USD per million tokens, input / output)

- **Anthropic** ([claude.com/pricing](https://claude.com/pricing)): Haiku 5.5 $0.10 / $0.50 (batch half price, cache read $0.01); Haiku 4.5 $1 / $5. US-only inference costs 1.1×; the page names no EU option.
- **Google Gemini API** ([pricing](https://ai.google.dev/gemini-api/docs/pricing), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations)): 2.5 Flash-Lite $0.10 / $0.40; 3.1 Flash-Lite $0.25 / $1.50 (shuts down May 7, 2027 at the earliest, replaced by 3.5 Flash-Lite); 3.5 Flash-Lite $0.30 / $2.50; 3.6 and 3.8 Flash $0.75 / $3.75 until Dec 31, 2026, then $1.50 / $7.50. The free tier is "used to improve our products"; the paid tier is not.
- **OpenAI** ([pricing](https://developers.openai.com/api/docs/pricing)): gpt-5.4-nano $0.20 / $1.25; gpt-5.4-mini $0.75 / $4.50; gpt-5-nano $0.05 / $0.40 (deprecated); gpt-4.1-nano $0.10 / $0.40. Data-residency endpoints cost 10% more for models released on or after Mar 5, 2026.
- **Mistral** ([pricing](https://docs.mistral.ai/inference/pricing)): Mistral Small 4 $0.15 / $0.60; Ministral 3 3B / 8B / 14B $0.10 / $0.15 / $0.20 (input and output the same); Medium 3.5 $1.50 / $7.50; moderation model free. Ministral 3 has vision; vision for Small 4 is not stated. The currency (USD or EUR) is unclear on the page.
- **Cloudflare Workers AI** ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)): $0.011 per 1,000 neurons; 10,000 neurons a day free (about $3.30 a month). Gemma 4 26B A4B $0.10 / $0.30 (vision); Llama 4 Scout $0.27 / $0.85 (vision); Mistral Small 3.1 24B $0.351 / $0.555; Gemma 3 12B $0.345 / $0.556; Llama 3.2 11B Vision $0.049 / $0.676; Llama Guard 3 8B $0.484 / $0.030 (text only). No image billing rule published.
- **OpenRouter** (live `/api/v1/models`, Oct 24, 2026): provider prices with no markup, plus the credit fee. Examples: claude-haiku-5.5 $0.10 / $0.50; gemini-3.1-flash-lite $0.25 / $1.50; gpt-5.4-nano $0.20 / $1.25; qwen3-vl-30b-a3b $0.15 / $0.60; llama-4-scout $0.10 / $0.30; gemma-4-26b-a4b $0.0675 / $0.225; mistral-small-2603 $0.15 / $0.60.

## Cost per 1,000 listings (`cost.py`)

Prompt + listing + JSON out; reasoning models get 100–150 thinking tokens (minimal effort assumed).

| Model | Text only | Text + 1 photo | Text + 4 photos | Max text + 10 photos | Per photo |
|---|---|---|---|---|---|
| Claude Haiku 5.5 (direct) | $0.258 | $0.317 | $0.493 | $1.108 | $0.059 |
| Gemini 3.1 Flash-Lite (low res) | $0.677 | $0.748 | $0.958 | $1.815 | $0.070 |
| Gemini 3.1 Flash-Lite (medium res) | $0.677 | $0.818 | $1.238 | $2.515 | $0.140 |
| Gemini 2.5 Flash-Lite | $0.163 | $0.189 | $0.266 | $0.596 | $0.026 |
| Gemini 3.5 Flash-Lite | $0.981 | $1.065 | $1.317 | $2.346 | $0.084 |
| GPT-5.4-nano | $0.491 | $0.595 | $0.907 | $1.880 | $0.104 |
| GPT-5.4-mini | $1.808 | $2.197 | $3.365 | $7.012 | $0.389 |
| Mistral Small 4 (EU) | $0.257 | $0.324 | $0.527 | $1.207 | $0.068 |
| Ministral 3 8B (EU) | $0.214 | $0.282 | $0.484 | $1.165 | $0.068 |
| Cloudflare Gemma 4 26B A4B | $0.146 | $0.174 | $0.258 | $0.593 | $0.028 |
| Cloudflare Llama 4 Scout | $0.419 | $0.692 | $1.508 | $3.614 | $0.272 |
| Cloudflare Mistral Small 3.1 | $0.521 | $0.678 | $1.152 | $2.745 | $0.158 |
| OpenRouter Qwen3-VL 30B (+5.5%) | $0.413 | $0.481 | $0.686 | $1.539 | $0.068 |

**Monthly cost** (4 photos, about 1.5 checks per listing because edits re-check):

| Model | 300 | 3,000 | 30,000 |
|---|---|---|---|
| Claude Haiku 5.5 | $0.22 | $2.20 | $22 |
| Gemini 2.5 Flash-Lite | $0.12 | $1.20 | $12 |
| Mistral Small 4 | $0.24 | $2.40 | $24 |
| GPT-5.4-nano / Gemini 3.1 Flash-Lite | $0.42 | $4.20 | $42 |
| Cloudflare Gemma 4 | free | free | ~$8 |

## Evidence on Persian quality (weak to moderate)

- [persian-llm-eval](https://github.com/heyparsadev/persian-llm-eval) (544 items, bootstrap CIs about ±3 points, not peer-reviewed): gpt-5-mini 0.93, gpt-5-nano 0.90, Claude Haiku 4.5 0.83; Sonnet and Opus 0.87–0.92. No Gemini, Gemma, Qwen or Mistral. Finglish appears only as Finglish-to-script conversion, not scored on its own.
- DivanBench (SilkRoadNLP @ EACL 2026, [arXiv 2602.17623](https://arxiv.org/abs/2602.17623)): Gemma 3 12B leads 7–12B models (87% facts, 66% cultural reasoning). Knowledge, not moderation. Seen through a [blog summary](https://hussain-nazary.github.io/persian-ai-2026-local-models.html); paper not read yet.
- Persian toxic-language detection (ACL 2025, [arXiv 2506.03458](https://arxiv.org/pdf/2506.03458)): zero-shot Llama 3 and Gemma 2 did poorly; earlier work found ChatGPT weak on Persian hate speech (the best fine-tuned Persian BERT reached F1 of about 0.61). Offensive language in Persian and Pashto: Bokaei et al., [SilkRoadNLP 2026](https://preview.aclanthology.org/credits/2026.silkroadnlp-1.2) (not read yet).
- **No evidence found on Finglish or slang in moderation.** Only our own test can show it.

## Code notes for the build session

- The check plugs in as one more entry in `CHECKS` (`src/modules/moderation/checks.ts`), writing `take_down` (decided_by `ai`) or `flag` (an `escalate` row), with the model's JSON in `ai_output`.
- `runListingChecks` runs all checks inside one transaction that holds the listing's row lock. A 2–10 s model call shouldn't run there: call the model first (or in its own job), then lock and apply the verdict only if `listing.revision` hasn't changed.
- The photos are WebP masters in R2 (EU). Send them base64 from the worker at a small size, not as public URLs.
- The worker calls the model; n8n never does (CLAUDE.md).

## Next steps

1. **Live test (needs the owner's keys; I create none):** 150–200 synthetic, labelled Persian listings (clean ones, every terms section, slang, Finglish, borderline cases, photo-only violations), run through Haiku 5.5, GPT-5.4-nano and Gemini 3.1 Flash-Lite. Under $1 in total.
2. Check per provider: the DPA, retention, no training, where processing happens (EU or SCCs), rate limits.
3. Shadow mode design (log only, 2–4 weeks, compare with staff decisions) and target error rates.
4. The DSA art. 17(3)(c) "automated means" wording and the privacy-policy changes (processor, transfer, legal basis); GDPR art. 22 (account sanctions stay with a person).
5. Write `docs/ai-moderation.md`.
