"""
reextract_failed_packets.py
Run this on your Windows machine to OCR the packets whose extracted_text is empty.

Requirements:
  pip install pdf2image pytesseract
  Tesseract must be installed at: C:\\Program Files\\Tesseract-OCR\\tesseract.exe
  Poppler must be installed (pdftoppm available in PATH or set POPPLER_PATH below)

Usage:
  python reextract_failed_packets.py
  python reextract_failed_packets.py --dry-run   (show what would be processed, no writes)
  python reextract_failed_packets.py --file lesson-macro-teaching-course-outline.json
"""

import json
import os
import sys
import subprocess
import tempfile
import argparse

# ── Configuration ──────────────────────────────────────────────────────────────
TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# Poppler bin dir — set if pdftoppm is not in PATH
POPPLER_PATH = None  # e.g. r"C:\tools\poppler\bin"

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_BASE = os.path.join(BACKEND_DIR, "uploads")
PACKETS_DIR = os.path.join(UPLOADS_BASE, "_generated-content", "agent-packets", "lessons")

MIN_CHARS = 3000       # packets below this threshold are re-extracted
MAX_PAGES = 30         # max pages to OCR per PDF (avoid huge jobs)
DPI = 180              # resolution for image conversion
# ───────────────────────────────────────────────────────────────────────────────


def setup():
    import pytesseract
    from pdf2image import convert_from_path
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    return pytesseract, convert_from_path


def ocr_pdf(pdf_path, pytesseract, convert_from_path, max_pages=MAX_PAGES):
    """Convert PDF pages to images and OCR each one."""
    kwargs = dict(dpi=DPI, first_page=1, last_page=max_pages, fmt="jpeg", thread_count=2)
    if POPPLER_PATH:
        kwargs["poppler_path"] = POPPLER_PATH

    images = convert_from_path(pdf_path, **kwargs)
    pages_text = []
    for i, img in enumerate(images, 1):
        print(f"    OCR page {i}/{len(images)}...", end=" ", flush=True)
        text = pytesseract.image_to_string(img, lang="eng", config="--oem 1 --psm 6")
        text = text.strip()
        if text:
            pages_text.append(text)
            print(f"{len(text)} chars")
        else:
            print("(empty)")

    return "\n\n".join(pages_text).strip()


def try_pdftotext(pdf_path):
    """Fast text extraction for text-based PDFs (no OCR needed)."""
    try:
        cmd = ["pdftotext", "-layout", pdf_path, "-"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.stdout.strip()
    except Exception:
        return ""


def process_packet(fn, fp, dry_run, pytesseract, convert_from_path):
    packet = json.load(open(fp, encoding="utf-8"))
    current_text = (packet.get("extracted_text") or "").strip()
    if len(current_text) >= MIN_CHARS:
        return "skipped (already ok)"

    ext = packet.get("extraction", {})
    src_path = ext.get("sourceFilePath", "")
    pdf_path = os.path.join(UPLOADS_BASE, src_path.replace("/", os.sep)) if src_path else ""

    if not pdf_path or not os.path.isfile(pdf_path):
        return f"SKIP — PDF not found: {os.path.basename(pdf_path) if pdf_path else '(no path)'}"

    kb = os.path.getsize(pdf_path) // 1024
    print(f"  PDF: {os.path.basename(pdf_path)} ({kb} KB)")

    if dry_run:
        return f"DRY RUN — would OCR {kb}KB PDF"

    # Try pdftotext first (fast, for text-based PDFs)
    extracted = try_pdftotext(pdf_path)
    method = "pdftotext"

    if len(extracted) < 500:
        print(f"  pdftotext got {len(extracted)} chars — switching to Tesseract OCR")
        try:
            extracted = ocr_pdf(pdf_path, pytesseract, convert_from_path)
            method = "tesseract-ocr"
        except Exception as e:
            return f"ERROR during OCR: {e}"

    chars = len(extracted)
    if chars < 200:
        return f"FAIL — only {chars} chars extracted"

    packet["extracted_text"] = extracted
    packet["extraction"]["status"] = "success"
    packet["extraction"]["charsOut"] = chars
    packet["extraction"]["extractedChars"] = chars
    packet["extraction"]["method"] = method
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(packet, f, indent=2, ensure_ascii=False)

    return f"OK — {chars:,} chars via {method}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--file", help="Process only this packet filename")
    args = parser.parse_args()

    print("Loading pdf2image and pytesseract...")
    try:
        pytesseract, convert_from_path = setup()
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Run: pip install pdf2image pytesseract")
        sys.exit(1)

    packets = sorted(os.listdir(PACKETS_DIR))
    if args.file:
        packets = [args.file]

    results = []
    for fn in packets:
        if not fn.endswith(".json"):
            continue
        fp = os.path.join(PACKETS_DIR, fn)
        packet = json.load(open(fp, encoding="utf-8"))
        current_text = (packet.get("extracted_text") or "").strip()
        if len(current_text) >= MIN_CHARS and not args.file:
            continue  # skip good ones silently

        ctx = packet.get("context", {})
        title = ctx.get("course_title", "?")
        code = ctx.get("course_code", "?")
        print(f"\n[{code}] {title}")
        print(f"  Packet: {fn}")

        status = process_packet(fn, fp, args.dry_run, pytesseract, convert_from_path)
        print(f"  Result: {status}")
        results.append((fn, status))

    print("\n\n=== SUMMARY ===")
    ok = [r for r in results if r[1].startswith("OK")]
    fail = [r for r in results if "ERROR" in r[1] or "FAIL" in r[1]]
    skip = [r for r in results if "SKIP" in r[1] or "skipped" in r[1] or "DRY" in r[1]]
    print(f"  Extracted: {len(ok)}")
    print(f"  Failed:    {len(fail)}")
    print(f"  Skipped:   {len(skip)}")
    for fn, status in fail:
        print(f"    ✗ {fn}: {status}")


if __name__ == "__main__":
    main()
