#!/usr/bin/env python3
"""
create_missing_practice_packets.py

Scans the resources folder for quiz/exam PDFs that have no agent-packet yet,
OCR-extracts text via tesseract, and writes properly-formatted agent-packet
JSON files ready for build_local_drafts_from_packets.js to process.

Usage (from backend/):
  python src/scripts/create_missing_practice_packets.py
  python src/scripts/create_missing_practice_packets.py --type=quiz
  python src/scripts/create_missing_practice_packets.py --type=past_question
  python src/scripts/create_missing_practice_packets.py --limit=50 --dry-run
"""

import os
import re
import sys
import json
import uuid
import shutil
import subprocess
import tempfile
import argparse
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent.parent
RESOURCES_DIR = BACKEND_ROOT / 'uploads' / 'resources'
PACKETS_ROOT = BACKEND_ROOT / 'uploads' / '_generated-content' / 'agent-packets'
LOG_PATH = PACKETS_ROOT / 'create_missing_packets.log'

QUIZ_PACKET_DIR = PACKETS_ROOT / 'quiz'
PQ_PACKET_DIR = PACKETS_ROOT / 'past_question'


# ── Classifiers ───────────────────────────────────────────────────────────────

def classify_file(filename):
    """Return 'quiz', 'past_question', or None."""
    name = filename
    if re.search(r'Internal Quiz', name, re.IGNORECASE):
        return 'quiz'
    if re.search(r'External Quiz|Zonal(?:\s+Based)? Quiz', name, re.IGNORECASE):
        return 'quiz'
    if re.search(r'Sample Quiz|Sample Questions?|Obj Questions?|Essay Questions?|Trial Questions?', name, re.IGNORECASE):
        return 'quiz'
    if re.search(r'\bQuiz\b', name, re.IGNORECASE):
        return 'quiz'
    if re.search(r'End.of.Sem|End-of-Sem|Resit|Past Question|Mock Exam', name, re.IGNORECASE):
        if not re.search(r'Sample|Example', name, re.IGNORECASE):
            return 'past_question'
    return None


def classify_category(filename):
    name = filename
    if re.search(r'Internal Quiz', name, re.IGNORECASE):
        return 'quiz_internal'
    if re.search(r'External Quiz|Zonal(?:\s+Based)? Quiz', name, re.IGNORECASE):
        return 'quiz_external'
    if re.search(r'Sample Quiz|Sample Questions?', name, re.IGNORECASE):
        return 'sample_questions'
    if re.search(r'\bQuiz\b', name, re.IGNORECASE):
        return 'quiz_internal'
    if re.search(r'End.of.Sem|End-of-Sem|Resit|Past Question|Mock Exam', name, re.IGNORECASE):
        return 'past_question'
    return 'other'


def extract_year(filename):
    m = re.search(r'\b(19|20)\d{2}\b', filename)
    return m.group(0) if m else None


def derive_level_semester(rel_path):
    """Extract level and semester number from path like 100/sem-1/..."""
    parts = Path(rel_path).parts
    level = None
    semester = None
    for part in parts:
        if re.match(r'^(100|200|300|400)$', part):
            level = part
        m = re.match(r'^sem-(\d)$', part, re.IGNORECASE)
        if m:
            semester = m.group(1)
    return level, semester


def extract_title(filename):
    title = filename
    title = re.sub(r'\s*-\s*Sharether\.com', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\.pdf$', '', title, flags=re.IGNORECASE)
    return title.strip()


def slugify(text):
    text = re.sub(r'\s*-\s*Sharether\.com', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\.pdf$', '', text, flags=re.IGNORECASE)
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text[:90]


# ── Existing packet detection ─────────────────────────────────────────────────

def load_existing_slugs(packet_dir):
    if not packet_dir.exists():
        return set()
    return {f.stem.lower() for f in packet_dir.glob('*.json')}


def has_packet(filename, existing_slugs):
    slug = slugify(filename)
    # Check if slug or a prefix of it matches anything in existing
    for s in existing_slugs:
        if slug[:40] in s or s[:40] in slug:
            return True
    return False


# ── OCR ───────────────────────────────────────────────────────────────────────

def find_tool(name):
    return shutil.which(name)


def ocr_pdf(pdf_path, dpi=200, language='eng'):
    pdftoppm = find_tool('pdftoppm')
    tesseract = find_tool('tesseract')

    if not pdftoppm or not tesseract:
        missing = [t for t, p in [('pdftoppm', pdftoppm), ('tesseract', tesseract)] if not p]
        return '', {'method': 'ocr', 'error': f'missing tools: {missing}', 'pages': 0}

    tmp = tempfile.mkdtemp(prefix='sharether_ocr_')
    prefix = os.path.join(tmp, 'page')
    try:
        subprocess.run(
            [pdftoppm, '-r', str(dpi), '-png', str(pdf_path), prefix],
            capture_output=True, check=True, timeout=120
        )
        images = sorted(
            [f for f in os.listdir(tmp) if re.match(r'^page-\d+\.png$', f, re.IGNORECASE)],
            key=lambda x: int(re.search(r'\d+', x).group())
        )
        page_texts = []
        for img in images:
            result = subprocess.run(
                [tesseract, os.path.join(tmp, img), 'stdout', '-l', language],
                capture_output=True, text=True, timeout=60
            )
            page_texts.append(result.stdout)
        text = '\n\n'.join(page_texts).strip()
        return text, {'method': 'ocr', 'pages': len(images), 'error': None}
    except subprocess.TimeoutExpired:
        return '', {'method': 'ocr', 'error': 'timeout', 'pages': 0}
    except Exception as e:
        return '', {'method': 'ocr', 'error': str(e), 'pages': 0}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def extract_pdf_text(pdf_path):
    """Try text extraction first; fall back to OCR."""
    try:
        result = subprocess.run(
            ['pdftotext', '-layout', str(pdf_path), '-'],
            capture_output=True, text=True, timeout=30
        )
        text = result.stdout.strip()
        # Filter out watermark-only content
        meaningful = re.sub(r'Downloaded from\s*sharether\.com\s*Get files and let\'s learn together', '', text, flags=re.IGNORECASE).strip()
        if len(meaningful) >= 250:
            return text, {'method': 'pdf_text', 'pages': None, 'error': None}
    except Exception:
        pass
    # Fall back to OCR
    return ocr_pdf(pdf_path)


def normalize_text(text):
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[ \t]+\n', '\n', text)
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    return text.strip()


# ── Packet builder ────────────────────────────────────────────────────────────

def build_packet(filename, rel_path, full_path, subtype, extracted_text, extraction_meta):
    title = extract_title(filename)
    year = extract_year(filename)
    level, semester = derive_level_semester(rel_path)
    category = classify_category(filename)

    # Derive a human-readable course title from path parts
    # e.g. 100/sem-1/math/col-alg → path[-2] folder is the subject, path[-1] is course slug
    parts = Path(rel_path).parts
    course_folder = parts[-2] if len(parts) >= 2 else ''
    course_title_guess = course_folder.replace('-', ' ').title() if course_folder else ''

    source_id = str(uuid.uuid4())
    windows_path = 'D:\\Projects\\sharether-spa-and-mobile-app\\backend\\uploads\\resources\\' + rel_path.replace('/', '\\')
    file_url = '/uploads/' + filename

    subtype_label = 'quiz' if subtype == 'quiz' else 'past-question exam pack'
    type_instruction = (
        "Prefer objective multiple-choice questions with four options and one answer. "
        "Mark uncertain answers with needs_review=true."
        if subtype == 'quiz' else
        "Preserve paper structure where visible: Section A (objective) and Section B (theory). "
        "Objective questions → multiple_choice. Essay/theory → type 'theory' with marking keywords."
    )

    return {
        'packet_version': 1,
        'kind': 'practice',
        'subtype': subtype,
        'status': 'ready',
        'instructions': [
            f'Generate one Sharether {subtype_label} JSON from extracted_text.',
            type_instruction,
            'Do not invent unsupported questions.',
            'Return JSON with title, description, tags, metadata, sections, questions.',
            f'Source: {title}. Course: {course_title_guess}.',
        ],
        'context': {
            'course_id': None,
            'course_title': course_title_guess,
            'course_code': None,
            'level': level,
            'semester': semester,
            'year': year,
            'lesson_number': None,
            'total_lessons': None,
            'previous_title': None,
            'next_title': None,
            'source_id': source_id,
            'source_title': title,
            'source_file_name': filename,
            'source_file_path': windows_path,
            'source_file_url': file_url,
            'source_category': category,
        },
        'extraction': {
            'sourceId': source_id,
            'sourceTitle': title,
            'sourceFileName': filename,
            'sourceFilePath': windows_path,
            'sourceFileUrl': file_url,
            'status': 'ok' if extracted_text else 'ok_empty_text',
            'method': extraction_meta.get('method'),
            'pages': extraction_meta.get('pages'),
            'bytesIn': os.path.getsize(full_path),
            'charsOut': len(extracted_text),
            'extractedChars': len(extracted_text),
            'durationMs': 0,
            'warnings': [],
            'error': extraction_meta.get('error'),
        },
        'extracted_text': normalize_text(extracted_text),
        'draft_output_template': {
            'title': '',
            'description': '',
            'tags': [],
            'metadata': {'needs_review': False, 'review_notes': ''},
            'sections': {},
            'questions': [{
                'type': 'multiple_choice', 'section': '', 'prompt': '',
                'options': ['', '', '', ''], 'answer': '', 'explanation': '',
                'needs_review': False,
            }],
        },
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--type', choices=['quiz', 'past_question', 'all'], default='all')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--offset', type=int, default=0, help='Skip first N uncovered PDFs')
    args = parser.parse_args()

    QUIZ_PACKET_DIR.mkdir(parents=True, exist_ok=True)
    PQ_PACKET_DIR.mkdir(parents=True, exist_ok=True)

    quiz_slugs = load_existing_slugs(QUIZ_PACKET_DIR)
    pq_slugs = load_existing_slugs(PQ_PACKET_DIR)

    # Collect all uncovered PDFs
    to_process = []
    for root, dirs, files in os.walk(RESOURCES_DIR):
        dirs.sort()
        for f in sorted(files):
            if not f.lower().endswith('.pdf'):
                continue
            if 'set 2' in f.lower():
                continue
            subtype = classify_file(f)
            if not subtype:
                continue
            if args.type != 'all' and subtype != args.type:
                continue
            existing = quiz_slugs if subtype == 'quiz' else pq_slugs
            if has_packet(f, existing):
                continue
            rel = os.path.relpath(os.path.join(root, f), RESOURCES_DIR)
            to_process.append((f, rel, os.path.join(root, f), subtype))

    total = len(to_process)
    to_process = to_process[args.offset:]
    if args.limit:
        to_process = to_process[:args.limit]

    print(f'Found {total} uncovered PDFs total; processing {len(to_process)} (offset={args.offset})', flush=True)

    counts = {'created': 0, 'empty_text': 0, 'error': 0, 'dry_run': 0}

    for i, (filename, rel_path, full_path, subtype) in enumerate(to_process):
        print(f'[{i+1}/{len(to_process)}] {subtype}: {filename[:70]}', end=' ', flush=True)

        if args.dry_run:
            print('(dry-run)')
            counts['dry_run'] += 1
            continue

        try:
            text, meta = extract_pdf_text(full_path)
            if not text:
                print(f'EMPTY ({meta.get("error", "no text")})')
                counts['empty_text'] += 1
                continue

            packet = build_packet(filename, rel_path, full_path, subtype, text, meta)
            slug = slugify(filename)
            packet_dir = QUIZ_PACKET_DIR if subtype == 'quiz' else PQ_PACKET_DIR
            out_path = packet_dir / f'{slug}.json'

            # Avoid overwriting if exists
            if out_path.exists():
                stem = out_path.stem
                suffix = str(uuid.uuid4())[:8]
                out_path = packet_dir / f'{stem}-{suffix}.json'

            out_path.write_text(json.dumps(packet, indent=2, ensure_ascii=False), encoding='utf-8')
            print(f'ok ({meta["method"]}, {len(text)} chars)')
            counts['created'] += 1

            # Log
            with open(LOG_PATH, 'a', encoding='utf-8') as log:
                log.write(f'[created] {out_path.name} ({len(text)} chars via {meta["method"]})\n')

        except Exception as e:
            print(f'ERROR: {e}')
            counts['error'] += 1

    print()
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
