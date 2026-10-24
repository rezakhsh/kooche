import json, sys
import tiktoken
from tokenizers import Tokenizer

samples_dir, tok_dir = sys.argv[1], sys.argv[2]
listings = json.load(open(f"{samples_dir}/listings.json", encoding="utf-8"))
prompt = open(f"{samples_dir}/prompt.txt", encoding="utf-8").read()

typ = listings["typical"]
desc = typ["description"]
while len(desc) < 5000:
    desc += " " + typ["description"]
listings["max"] = {
    "title": ("اتاق مبله در آپارتمان دو نفره نزدیک ایستگاه، Anmeldung ممکن، اجاره گرم ۶۲۰ یورو" * 2)[:90],
    "description": desc[:5000],
    "attributes": {f"field_{i}": ("متن آزاد برای ویژگی آگهی با حداکثر طول " * 3)[:60] for i in range(10)},
    "district": ("Charlottenburg-Wilmersdorf, nahe Ernst-Reuter-Platz " * 2)[:60],
}

def render(l):
    return (
        "<listing>\nCategory: خانه و اتاق > اتاق اجاره‌ای\n"
        f"Title: {l['title']}\nDescription: {l['description']}\n"
        f"Attributes: {json.dumps(l['attributes'], ensure_ascii=False)}\nDistrict: {l['district']}\n</listing>"
    )

output = json.dumps({
    "verdict": "violation", "section": "5.4", "confidence": 0.93,
    "evidence": "«حواله به ایران با نرخ روز، تومن به یورو»",
    "reason_fa": "این آگهی خدمات انتقال پول و حواله به ایران را پیشنهاد می‌کند که طبق بند ۵.۴ شرایط استفاده ممنوع است.",
}, ensure_ascii=False)

encoders = {"OpenAI o200k (GPT-4o/4.1/5)": tiktoken.get_encoding("o200k_base")}
for name, f in [("Gemma 3", "unsloth_gemma-3-4b-it"), ("Llama 3.2", "unsloth_Llama-3.2-11B-Vision-Instruct"),
                ("Llama 4", "unsloth_Llama-4-Scout-17B-16E-Instruct"), ("Qwen 2.5", "Qwen_Qwen2.5-VL-7B-Instruct"),
                ("Mistral Small 3.1", "unsloth_Mistral-Small-3.1-24B-Instruct-2503")]:
    encoders[name] = Tokenizer.from_file(f"{tok_dir}/{f}.json")

def n(enc, s):
    return len(enc.encode(s)) if isinstance(enc, tiktoken.Encoding) else len(enc.encode(s, add_special_tokens=False).ids)

rows = {"policy prompt": prompt, "output JSON": output}
for k in ["short", "typical", "finglish", "max"]:
    rows[f"listing {k} ({len(render(listings[k]))} chars)"] = render(listings[k])
print("chars per token, Persian description (typical):")
print(json.dumps({name: round(len(typ["description"]) / n(e, typ["description"]), 2) for name, e in encoders.items()}, ensure_ascii=False))
print("\t".join(["text"] + list(encoders)))
for label, s in rows.items():
    print("\t".join([label] + [str(n(e, s)) for e in encoders.values()]))
