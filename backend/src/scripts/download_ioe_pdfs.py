"""
download_ioe_pdfs.py
Downloads all available course materials from ioe.ucc.edu.gh,
extracts text, and creates agent-packet JSON files ready for
high-quality lesson drafting.

Requirements:
  pip install requests pdfminer.six
  Poppler must be in PATH (for pdftotext fallback)

Usage:
  cd backend
  python src/scripts/download_ioe_pdfs.py             # download + create packets
  python src/scripts/download_ioe_pdfs.py --dry-run   # show what would be downloaded
  python src/scripts/download_ioe_pdfs.py --course EBS228SW   # one course only
  python src/scripts/download_ioe_pdfs.py --skip-existing    # skip packets that already have text
"""

import json
import os
import sys
import time
import argparse
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("Missing dependency: pip install requests")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────────
BASE_URL = "https://ioe.ucc.edu.gh/sites/default/files"
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_BASE = os.path.join(BACKEND_DIR, "uploads")
DOWNLOADS_DIR = os.path.join(UPLOADS_BASE, "_generated-content", "ioe-downloads")
PACKETS_DIR = os.path.join(UPLOADS_BASE, "_generated-content", "agent-packets", "lessons")
MIN_TEXT_CHARS = 1000   # minimum chars to consider extraction successful
SLEEP_BETWEEN_DOWNLOADS = 1.0  # seconds between requests (be polite)
# ──────────────────────────────────────────────────────────────────────────────

def u(path):
    """Build full URL from path suffix (already percent-encoded)."""
    return f"{BASE_URL}/{path}"


# ── All discovered courses and their PDFs ─────────────────────────────────────
# Each entry: course_code → { title, programme, pdfs: [url_path, ...] }
# url_path is the portion after /sites/default/files/ (percent-encoded as found on site)
COURSES = {

    # ── CERTIFICATE IN EDUCATION PROGRAMME ────────────────────────────────────
    "EIN050": {
        "title": "Introduction to Foundations of Education",
        "programme": "Certificate in Education",
        "pdfs": ["2023-01/EIN%20050%20INTRODUCTION%20TO%20EDUCATIONAL%20FOUNDATIONS.pdf"],
    },
    "EIN051": {
        "title": "English Language Studies",
        "programme": "Certificate in Education",
        "pdfs": ["2022-12/EIN051SW%20-%20ENGLISH%20LANGUAGE%20STUDIES.pdf"],
    },
    "EIN052": {
        "title": "Introduction to Special Needs Education",
        "programme": "Certificate in Education",
        "pdfs": ["2023-01/EIN%20052SW%20-%20INTRODUCTION%20TO%20SPECIAL%20NEEDS%20IN%20EDUCATION.pdf"],
    },
    "EIN053": {
        "title": "Introduction to Curriculum Studies",
        "programme": "Certificate in Education",
        "pdfs": ["2023-01/EIN%20060%20INTRODUCTION%20TO%20CURRICULUM%20STUDIES.pdf"],
    },
    "EIN054": {
        "title": "Introduction to Elementary Mathematics",
        "programme": "Certificate in Education",
        "pdfs": ["2023-01/EIN%20054%20-%20INTRODUCTION%20TO%20ELEMENTARY%20MATHEMATICS.pdf"],
    },
    "EIN055": {
        "title": "Introduction to Assessment in Schools",
        "programme": "Certificate in Education",
        "pdfs": [
            "2023-04/EIN%20055%20INTRODUCTION%20TO%20ASSESSMENT%20IN%20SCHOOLS.pdf",
            "2023-04/EIN055%20Introduction%20to%20Assessment%20In%20Schools%201.pdf",
        ],
    },
    "EIN056": {
        "title": "General Science",
        "programme": "Certificate in Education",
        "pdfs": ["2023-05/EIN%20056%20-%20General%20Science.pdf"],
    },
    "EIN057": {
        "title": "Introduction to ICT Integration in Teaching",
        "programme": "Certificate in Education",
        "pdfs": ["2023-04/EIN%20057%20INTRODUCTION%20TO%20ICT%20INTEGRATION%20IN%20TEACHING.docx_.pdf"],
    },
    "EIN058": {
        "title": "Introduction to Professional Practice and Ethics in Teaching",
        "programme": "Certificate in Education",
        "pdfs": [
            "2023-04/EIN058%20PROFESSIONAL%20PRACTICE%20AND%20ETHICS%20IN%20TEACHING.pdf",
            "2023-04/EIN058%20Professional%20Practice%20and%20Ethics%20in%20Teaching%20.pdf",
        ],
    },
    "EIN059": {
        "title": "Introduction to In-Service Education and Training",
        "programme": "Certificate in Education",
        "pdfs": [
            "2023-04/Units%201%20-%203%20%20EBS%20059SW%20%20Intro.%20to%20In-Service%20Education%20and%20Training.pdf",
            "2023-05/Unit%204%20IN-SERVICE%20TRAINING.pdf",
        ],
    },
    "EIN060": {
        "title": "Introduction to Methods of Teaching",
        "programme": "Certificate in Education",
        "pdfs": [
            "2023-04/EIN%20060%20INTRODUCTION%20TO%20METHODS%20OF%20TEACHING.pdf",
            "2023-04/EIN%20060%20-Intro%20to%20Methods%20of%20Teaching%20COURSE%20OUTLINE.pdf",
        ],
    },

    # ── BACHELOR OF EDUCATION (CORE) ──────────────────────────────────────────
    "EBS118SW": {
        "title": "Information Literacy Skills",
        "programme": "B.Ed Core",
        "pdfs": ["2023-02/EBS%20118SW%20-%20INFORMATION%20LITERACY%20SKILLS.pdf"],
    },
    "EBS135SW": {
        "title": "English Language Studies I",
        "programme": "B.Ed Core",
        "pdfs": ["2023-01/EBS%20135SW%20-%20ENGLISH%20LANGUAGE%20STUDIES%20I.pdf"],
    },
    "EBS157SW": {
        "title": "Human-Land Issues in Social Studies",
        "programme": "B.Ed Core",
        "pdfs": ["2023-01/EBS%20157SW%20-%20Huaman%20Land%20Issues%20-%20Revised.pdf"],
    },
    "EBS217SW": {
        "title": "Designing Instructional Materials Using ICT Tools",
        "programme": "B.Ed Core",
        "pdfs": ["2023-01/EBS%20217SW%20-%20DESIGNING%20INSTRUCTIONAL%20MATERIALS%20USING%20ICT.pdf"],
    },
    "EBS262": {
        "title": "General Principles and Methods of Teaching in Basic Schools",
        "programme": "B.Ed Core",
        "pdfs": [
            "2023-04/EBS_262_General_Principles_and_Methods_of_Teaching_in_Basic_Schools.pdf",
            "2023-04/Teaching%20Strategies%20in%20the%20Basic%20School%201.pdf",
            "2023-04/Introduction%20to%20Teaching.pdf",
            "2023-04/Classroom%20Management.pdf",
        ],
    },
    "EBS348": {
        "title": "Educational Statistics",
        "programme": "B.Ed Core",
        "pdfs": ["2023-05/EBS348%20SW-TP%20-%20EDUCATIONAL%20STATISTICS%20-%20GUIDE%20NOTES.pdf"],
    },
    "EBS401": {
        "title": "Introduction to Scientific Investigations",
        "programme": "B.Ed Core",
        "pdfs": [
            "2023-04/EBS401_%20Introduction%20to%20Scientific%20Investigations%20UNITS%201%20and%202.pdf",
            "2023-04/EBS401_INTRODUCTION%20TO%20SCIENTIFIC%20INVESTIGATIONS%20-%20UNIT%203_0.pdf",
            "2023-05/EBS401_UNIT%204%20EBS401%3A%20Intro.%20to%20Scientific%20Investigation_compressed.pdf",
            "2023-05/EBS401_UNIT%205_%20%20EBS401%3A%20Intro.%20to%20Scientific%20Investigation_compressed.pdf",
            "2023-05/EBS401_UNIT%206_How%20Scientists%20Work_compressed.pdf",
        ],
    },
    "EBS417": {
        "title": "Mathematical Investigations",
        "programme": "B.Ed Core",
        "pdfs": ["2023-04/EBS%20417%20MATHEMATICAL%20INVESTIGATIONS%20.pdf"],
    },

    # ── BACHELOR OF EDUCATION (EARLY CHILDHOOD) ───────────────────────────────
    "EBS101SW": {
        "title": "Elementary Algebra",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-01/EBS%20101SW%20-%20ELEMENTARY%20ALGEBRA.pdf"],
    },
    "EBS158SW": {
        "title": "Prose Fiction",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-01/EBS%20158SW%20-%20PROSE%20FICTION.pdf"],
    },
    "EBS238": {
        "title": "Curriculum Studies in ECE",
        "programme": "B.Ed Early Childhood",
        "pdfs": [
            "2023-04/EBS238%20Curriculum%20Studies%20in%20ECE.pdf",
            "2023-04/COURSE%20OUTLINE%20%20-%20EBS%20238%20-Curriculum%20Studies%20in%20ECE%20.pdf",
        ],
    },
    "EBS264SW": {
        "title": "Science Activities for ECE",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-01/EBS%20264SW%20-%20SCIENCE%20ACTIVITY%20FOR%20ECE.pdf"],
    },
    "EBS322SW": {
        "title": "Methods of Teaching Primary School Mathematics",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-01/EBS%20322%20-%20Methods%20of%20Teaching%20Primary%20School%20Mathematics.pdf"],
    },
    "EBS323": {
        "title": "Methods of Teaching Primary School Science",
        "programme": "B.Ed Early Childhood",
        "pdfs": [
            "2023-04/EBS323%20METHODS%20OF%20TEACHING%20PRIMARY%20SCHOOL%20SCIENCE%20Units%201%20and%202.pdf",
            "2023-05/EBS%20323%20Unit%207_Method%20of%20Teaching%20Pri.%20Sch.%20Sci.pdf",
            "2023-05/EBS%20323%20Unit%208_Brainstorming.pdf",
            "2023-05/EBS%20323%20Unit%208_Demonstration.pdf",
            "2023-05/EBS%20323%20Unit%208_Discovery.pdf",
            "2023-05/EBS%20323%20Unit%208_Discussion.pdf",
            "2023-05/EBS%20323%20Unit%208_Field%20Trip.pdf",
            "2023-05/EBS%20323%20Unit%208_Games.pdf",
            "2023-05/EBS%20323%20Unit%208_Lecture.pdf",
            "2023-05/EBS%20323%20Unit%208_Project.pdf",
            "2023-05/EBS%20323%20Unit%208_Role%20Play.pdf",
            "2023-05/EBS%20323%20Unit%208_Simulation.pdf",
        ],
    },
    "EBS327": {
        "title": "Principles and Methods of Teaching Social Studies",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-04/EBS%20327%20Principles%20and%20Methods%20of%20Teaching%20Social%20Studies.pdf"],
    },
    "EBS330": {
        "title": "Use of Ghanaian Language as a Medium of Instruction",
        "programme": "B.Ed Early Childhood",
        "pdfs": [
            "2023-04/UNIT%20%201%20-%20EBS%20330%20%20Ghan.%20Lang.%20as%20a%20Medium%20of%20Instruction.pdf",
            "2023-04/UNIT%202%20-%20EBS%20330%20%20Ghan.%20Lang.%20as%20a%20Medium%20of%20Instruction.pdf",
            "2023-04/UNIT%203%20-%20EBS%20330%20%20Ghan.%20Lang.%20as%20a%20Medium%20of%20Instruction.pdf",
            "2023-04/UNIT%20%204%20-%20EBS%20330%20%20Ghan.%20Lang.%20as%20a%20Medium%20of%20Instruction.pdf",
            "2023-04/UNIT%205%20-%20EBS%20330%20-%20Ghan.%20Lang.%20as%20a%20Medium%20of%20Instruction.pdf",
        ],
    },
    "EBS346SW": {
        "title": "Developmental Physical Activities in ECE",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-01/EBS%20346SW%20-%20Developmental%20Physical%20Activities%20in%20ECE.pdf"],
    },
    "EBS403_ECE": {
        "title": "School, Family and Community Partnership in ECE",
        "programme": "B.Ed Early Childhood",
        "pdfs": ["2023-04/EBS%20403%20School%2C%20Family%2C%20and%20Community%20Partnership%20in%20ECE.pdf"],
        "course_code_display": "EBS403",
    },
    "EBS404": {
        "title": "Contemporary Issues in ECE",
        "programme": "B.Ed Early Childhood",
        "pdfs": [
            "2023-04/UNIT%201%20EBS%20404SW%20Contemporary%20Issues%20in%20Early%20Childhood%20Education.pdf",
            "2023-04/EBS%20404SW%20Contemporary%20Issues%20in%20Early%20Childhood%20Education.pdf",
            "2023-04/EBS%20404%20CONTEMPORARY%20ISSUES%20IN%20ECE%20Course%20Pack.pdf",
            "2023-05/UNIT%202%20-%20Sub%20Unit%201%20CONTEMPORARY%20ISSUES%20IN%20ECE.pdf",
            "2023-05/EBS404%20-%20Contemporary%20Issues%20ECE%20-%20unit%202%2C%20sub-unit%203%201.pdf",
        ],
    },

    # ── BACHELOR OF EDUCATION - SOCIAL STUDIES ────────────────────────────────
    "EBS152SW": {
        "title": "Physical and Social Relations in Social Studies",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-01/EBS%20152SW%20-%20PHYSICAL%20AND%20SOCIAL%20RELATIONS%20IN%20SOCIAL%20STUDIES.pdf"],
    },
    "EBS159SW": {
        "title": "The Natural Environment",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-01/EBS%20159SW%20-%20THE%20NATURAL%20ENVIRONMENT.pdf"],
    },
    "EBS228SW": {
        "title": "Social Studies as an Integrated Subject",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-01/EBS228SW%20-%20Social%20Studies%20as%20an%20Integrated%20Subject.pdf"],
    },
    "EBS248SW": {
        "title": "Curriculum Studies in Social Studies",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-01/JHS%20ONLY%20----%20%20EBS%20248%20SW%20CURRICULUM%20STUDIES%20IN%20SOCIAL%20STUDIES.pdf"],
    },
    "EBS265": {
        "title": "The Social Structure of Ghana",
        "programme": "B.Ed Social Studies",
        "pdfs": [
            "2023-04/UNIT%201%20EBS265SW%20-%20SOCIAL%20STRUCTURE%20OF%20GHANA.pdf",
            "2023-04/UNIT%202%20SOCIAL%20STRUCTURE%20OF%20GHANA_compressed.pdf",
            "2023-04/UNIT%203%20SOCIAL%20STRUCTURE%20OF%20GHANA_compressed.pdf",
            "2023-04/UNIT%204%20SOCIAL%20STRUCTURE%20OF%20GHANA_compressed.pdf",
            "2023-04/UNIT%205%20SOCIAL%20STRUCTURE%20OF%20GHANA_compressed.pdf",
            "2023-04/UNIT%206%20SOCIAL%20STRUCTURE%20OF%20GHANA.pdf",
        ],
    },
    "EBS310": {
        "title": "Gender and Development in Africa",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-04/EBS310%20GENDER%20AND%20DEVELOPMENT%20IN%20AFRICA.pdf"],
    },
    "EBS347SW": {
        "title": "Population and Socio-economic Development in Ghana",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-01/EBS%20347%20Population%20and%20Socio-economic%20Development%20in%20Ghana.pdf"],
    },
    "EBS403J": {
        "title": "Colonization and Nationalism in Africa",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-04/EBS%20403%20403J%20COLONIZATION%20AND%20NATIONALISM%20IN%20AFRICA.pdf"],
        "course_code_display": "EBS403",
    },
    "EBS412": {
        "title": "History of Ghana from Ancient Times to the Present",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-04/EBS412%20History%20of%20Ghana%20from%20Ancient%20Times%20to%20the%20Present.pdf"],
    },
    "EBS217": {
        "title": "Designing Instructional Materials Using ICT",
        "programme": "B.Ed Social Studies",
        "pdfs": ["2023-04/EBS217%20Designing%20Instructional%20Materials%20Using%20ICT.pdf"],
    },

    # ── BACHELOR OF EDUCATION - ENGLISH ───────────────────────────────────────
    "EBS121SW": {
        "title": "Literature in English - Studies in African Poetry",
        "programme": "B.Ed English",
        "pdfs": ["2023-01/EBS%20121SW%20-%20LIT.%20IN%20ENG.%20%28STUDIES%20IN%20AFRICAN%20POETRY%29.pdf"],
    },
    "EBS149SW": {
        "title": "Literature in English II - Studies in Poetry",
        "programme": "B.Ed English",
        "pdfs": ["2023-01/EBS%20149SW%20-%20LIT%20IN%20ENG.%20%28STUDIES%20IN%20POETRY%29.pdf"],
    },
    "EBS280": {
        "title": "Introduction to Semantics",
        "programme": "B.Ed English",
        "pdfs": ["2023-01/EBS%20280%20INTRODUCTION%20TO%20SEMANTICS.pdf"],
    },
    "EBS282": {
        "title": "Forms and Functions of the English Clause",
        "programme": "B.Ed English",
        "pdfs": ["2023-01/EBS%20282_Forms%20and%20Functions%20of%20the%20Clause.pdf"],
    },
    "EBS313": {
        "title": "Phonetics and Phonology",
        "programme": "B.Ed English",
        "pdfs": ["2023-04/EBS313%20PHONETICS%20AND%20PHONOLOGY.pdf"],
    },
    "EBS402": {
        "title": "Children's Literature",
        "programme": "B.Ed English",
        "pdfs": ["2023-04/EBS%20402SW%20CHILDREN%E2%80%99S%20LITERATURE_0.pdf"],
    },
    "EBS423": {
        "title": "Varieties of English",
        "programme": "B.Ed English",
        "pdfs": ["2023-04/EBS%20423SW%20Varieties%20of%20English.pdf"],
    },
    "EBS432": {
        "title": "Literary Criticism",
        "programme": "B.Ed English",
        "pdfs": [
            "2023-05/EBS%20432SW%20LITERARY%20CRITIICISM%20%28UNIT%201%29.pdf",
            "2023-04/EBS%20423%20LITERARY%20CRITICISM%20-%20UNIT%203.pdf",
            "2023-05/UNIT%20FOUR%20FEMINISM.pdf",
            "2023-04/Toni%20Morrison.pdf",
            "2023-04/T.S.%20ELIOT%20AND%20METAPHYSICAL%20POETRY.pdf",
            "2023-05/Aristotle.%20The%20Poetics.pdf",
        ],
    },

    # ── POST-GRADUATE DIPLOMA IN EDUCATION (PGDE) ─────────────────────────────
    "EPS761P": {
        "title": "Introduction to Research Methods in Education",
        "programme": "PGDE",
        "pdfs": ["2023-01/EPS761P%20-%20INTRO%20TO%20RESEARCH%20METHODS.pdf"],
    },
    "EPS751P": {
        "title": "Educational Statistics (PGDE)",
        "programme": "PGDE",
        "pdfs": ["2023-01/EPS751P%20-%20Educational%20Statistics%20-%20PGDE.pdf"],
    },
    "EFO731P": {
        "title": "Social and Philosophical Foundations of Education",
        "programme": "PGDE",
        "pdfs": ["2023-01/EFO731P%20-%20SOCIAL%20AND%20PHILOSOPHICAL%20FOUNDATIONS%20OF%20EDUCATION%20-PGDE%20-%20Edited.pdf"],
    },
    "EPS751A": {
        "title": "Assessment in Education",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20%20-%20%20EPS751A%20-%20ASSESSMENT%20IN%20EDUCATION.pdf"],
    },
    "EAS711A": {
        "title": "Methods of Teaching Arts",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20%20-%20%20METHODS%20OF%20TEACHING%20ARTS.pdf"],
    },
    "EAS711ASW": {
        "title": "Methods of Teaching Social Sciences",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20-%20Methods%20of%20Teaching%20Social%20Sciences.pdf"],
    },
    "ESC711PSW": {
        "title": "Methods of Teaching Science",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20-%20ESC711P%20-%20METHODS%20OF%20TEACHING%20SCIENCE.pdf"],
    },
    "ESC711MSW": {
        "title": "Methods of Teaching Mathematics",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20-%20ESC%20711M%20-%20METHODS%20OF%20TEACHING%20MATHEMATICS.pdf"],
    },
    "EPS731ASW": {
        "title": "Principles of Guidance and Counseling",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20-%20EPS%20731A%20-%20PRINCIPLES%20OF%20GUIDANCE%20AND%20COUNSELING.pdf"],
    },
    "EAS712SW": {
        "title": "Curriculum Studies in Social Sciences",
        "programme": "PGDE",
        "pdfs": ["2023-01/PGDE%20-%20CURRICULUM%20STUDIES%20IN%20SOCIAL%20SCIENCES.pdf"],
    },
    "EAS711": {
        "title": "Curriculum Studies in Art",
        "programme": "PGDE",
        "pdfs": ["2023-01/CURRICULUM%20STUDIES%20IN%20ARTS%20-%20PGDE.pdf"],
    },
    "EPS731P": {
        "title": "Psychology of Human Learning and Instruction",
        "programme": "PGDE",
        "pdfs": ["2023-05/PDGE%20Adolescence.pdf"],
    },
    "EPS712P": {
        "title": "Computer Application in Education",
        "programme": "PGDE",
        "pdfs": [
            "2023-04/EMA%20712P%20COURSE%20MANUAL%20Computer%20Applications.pdf",
            "2023-04/EPS712%20Computer%20Application%20in%20Education%20-%20Microsoft%20Word.pdf",
            "2023-04/EPS712%20Computer%20Application%20in%20Education%20-%20POWER%20POINT.pdf",
            "2023-04/EPS712%20Computer%20Application%20in%20Education%20-%20MS%20Excel.pdf",
        ],
    },
    "EPA775": {
        "title": "Educational Management and Administration",
        "programme": "PGDE",
        "pdfs": ["2023-04/EPA%20775D%20%20Educational%20Management%20and%20Administration%20%20UNITS%201%20and%202.pdf"],
    },
    "EFO751P": {
        "title": "Development of Education in Ghana",
        "programme": "PGDE",
        "pdfs": [
            "2023-04/UNIT%201%20MERCHANT%20EDU%20CASTLE%20SCHOOLS.pdf",
            "2023-04/UNIT%202%20MISSIONARY%20ERA%20AND%20EDUCATIONAL%20DEVELOPMENT.pdf",
            "2023-04/UNIT%203%20GOVT%20OFFICIAL%20POICY%20ON%20EDUC.pdf",
            "2023-04/UNIT%204%20ADP.pdf",
        ],
    },
}

PACKET_TEMPLATE = {
    "packet_version": "1.0",
    "kind": "lesson",
    "subtype": "notes",
    "status": "ready",
    "instructions": (
        "You are a skilled curriculum writer for Sharether, an e-learning platform "
        "for Ghanaian teacher-education students. Using ONLY the extracted_text below "
        "(do NOT invent facts not in the source), write a complete lesson JSON following "
        "the draft_output_template schema. Use Ghanaian examples, analogies, and rhetorical "
        "questions. Lesson 1 opens with a warm course welcome. All other lessons open with "
        "a specific recap of the immediately preceding lesson."
    ),
    "draft_output_template": {
        "title": "",
        "description": "",
        "tags": [],
        "objectives": [],
        "chunks": [
            {"heading": "", "paragraphs": ["<p>...</p>"]}
        ],
        "exercises": [
            {
                "type": "multiple_choice",
                "prompt": "",
                "options": ["", "", "", ""],
                "answer": "",
                "explanation": ""
            }
        ]
    }
}


def make_session():
    s = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.headers["User-Agent"] = "Mozilla/5.0 (compatible; Sharether-IoE-Fetcher/1.0)"
    return s


def download_pdf(session, url_path, dest_dir, dry_run=False):
    """Download a single PDF. Returns (local_path, was_cached)."""
    filename = unquote(url_path.split("/")[-1])
    local = os.path.join(dest_dir, filename)
    if os.path.exists(local):
        return local, True
    if dry_run:
        return local, False

    url = f"{BASE_URL}/{url_path}"
    print(f"    ↓ {filename}", end=" ", flush=True)
    try:
        r = session.get(url, timeout=60, stream=True)
        r.raise_for_status()
        with open(local, "wb") as f:
            for chunk in r.iter_content(65536):
                f.write(chunk)
        size_kb = os.path.getsize(local) // 1024
        print(f"({size_kb} KB)")
        time.sleep(SLEEP_BETWEEN_DOWNLOADS)
        return local, False
    except Exception as e:
        print(f"ERROR: {e}")
        if os.path.exists(local):
            os.remove(local)
        return None, False


def extract_text_pdftotext(pdf_path):
    """Use pdftotext (Poppler) to extract text from a PDF."""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", pdf_path, "-"],
            capture_output=True, text=True, timeout=60, encoding="utf-8", errors="replace"
        )
        return result.stdout.strip()
    except FileNotFoundError:
        return ""
    except Exception:
        return ""


def extract_text_pdfminer(pdf_path):
    """Use pdfminer.six as fallback for text extraction."""
    try:
        from pdfminer.high_level import extract_text
        return (extract_text(pdf_path) or "").strip()
    except ImportError:
        return ""
    except Exception:
        return ""


def extract_text(pdf_path):
    """Try pdftotext first, then pdfminer, return best result."""
    text = extract_text_pdftotext(pdf_path)
    if len(text) < 200:
        text2 = extract_text_pdfminer(pdf_path)
        if len(text2) > len(text):
            return text2, "pdfminer"
        return text, "pdftotext"
    return text, "pdftotext"


def make_packet_filename(course_code):
    """Convert course code to packet filename slug."""
    slug = course_code.lower().replace("_", "-").replace(" ", "-")
    return f"lesson-ioe-{slug}.json"


def load_existing_packet(packet_path):
    """Load existing packet if valid JSON."""
    try:
        with open(packet_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def process_course(code, info, session, args):
    """Download PDFs for a course, extract text, write/update packet."""
    display_code = info.get("course_code_display", code)
    title = info["title"]
    programme = info["programme"]
    pdfs = info["pdfs"]

    print(f"\n[{display_code}] {title} ({programme})")

    packet_fn = make_packet_filename(code)
    packet_path = os.path.join(PACKETS_DIR, packet_fn)

    # Check if we already have a good packet
    if args.skip_existing and os.path.exists(packet_path):
        existing = load_existing_packet(packet_path)
        if existing:
            existing_text = (existing.get("extracted_text") or "").strip()
            if len(existing_text) >= MIN_TEXT_CHARS:
                print(f"  SKIP — existing packet has {len(existing_text):,} chars")
                return "skipped"

    # Download PDFs into course-specific folder
    course_dir = os.path.join(DOWNLOADS_DIR, code)
    os.makedirs(course_dir, exist_ok=True)

    local_pdfs = []
    for url_path in pdfs:
        local, cached = download_pdf(session, url_path, course_dir, dry_run=args.dry_run)
        if local:
            status_tag = "(cached)" if cached else "(downloaded)"
            if not args.dry_run:
                local_pdfs.append(local)
            else:
                fn = unquote(url_path.split("/")[-1])
                print(f"    DRY RUN — would download: {fn}")

    if args.dry_run:
        return "dry_run"

    if not local_pdfs:
        return "no_pdfs_downloaded"

    # Extract and concatenate text from all PDFs
    all_text_parts = []
    methods_used = set()
    for pdf_path in local_pdfs:
        fn = os.path.basename(pdf_path)
        print(f"  Extracting: {fn}", end=" ", flush=True)
        text, method = extract_text(pdf_path)
        methods_used.add(method)
        chars = len(text)
        print(f"→ {chars:,} chars via {method}")
        if chars > 100:
            all_text_parts.append(f"=== {fn} ===\n{text}")

    combined_text = "\n\n".join(all_text_parts).strip()
    total_chars = len(combined_text)

    if total_chars < MIN_TEXT_CHARS:
        print(f"  WARNING: only {total_chars} chars total — may need OCR")
        extraction_status = "needs_ocr"
    else:
        extraction_status = "success"

    method_str = "+".join(sorted(methods_used))

    # Build relative source paths for packet
    rel_paths = [
        f"_generated-content/ioe-downloads/{code}/{unquote(p.split('/')[-1])}"
        for p in pdfs
    ]

    packet = dict(PACKET_TEMPLATE)
    packet["context"] = {
        "course_id": "?",
        "course_code": display_code,
        "course_title": title,
        "programme": programme,
        "source": "ioe.ucc.edu.gh",
        "lesson_number": 1,
        "total_lessons": 1
    }
    packet["extraction"] = {
        "sourceFilePaths": rel_paths,
        "sourceFilePath": rel_paths[0],
        "status": extraction_status,
        "method": method_str,
        "charsOut": total_chars,
        "extractedChars": total_chars,
        "pdfCount": len(local_pdfs),
    }
    packet["extracted_text"] = combined_text

    with open(packet_path, "w", encoding="utf-8") as f:
        json.dump(packet, f, indent=2, ensure_ascii=False)

    print(f"  ✓ Packet: {packet_fn} ({total_chars:,} chars)")
    return f"ok_{total_chars}"


def main():
    parser = argparse.ArgumentParser(description="Download IoE UCC course PDFs and create agent packets.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be downloaded, no writes")
    parser.add_argument("--course", help="Process only this course code (e.g. EBS228SW)")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip courses that already have a packet with sufficient text")
    args = parser.parse_args()

    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(PACKETS_DIR, exist_ok=True)

    courses = COURSES
    if args.course:
        code = args.course.upper()
        if code not in courses:
            print(f"Unknown course code: {code}")
            print("Available:", ", ".join(sorted(courses.keys())))
            sys.exit(1)
        courses = {code: courses[code]}

    print(f"IoE UCC PDF Downloader — {len(courses)} courses")
    print(f"  Downloads → {DOWNLOADS_DIR}")
    print(f"  Packets   → {PACKETS_DIR}")
    if args.dry_run:
        print("  MODE: DRY RUN (no files written)")
    print()

    session = make_session()
    results = {}

    for code, info in sorted(courses.items()):
        try:
            result = process_course(code, info, session, args)
            results[code] = result
        except Exception as e:
            print(f"  ERROR processing {code}: {e}")
            results[code] = f"error: {e}"

    # Summary
    print("\n\n=== SUMMARY ===")
    ok = [c for c, r in results.items() if str(r).startswith("ok_")]
    skipped = [c for c, r in results.items() if r in ("skipped", "dry_run")]
    needs_ocr = [c for c, r in results.items() if str(r) == "ok_needs_ocr" or "needs" in str(r)]
    errors = [c for c, r in results.items() if str(r).startswith("error")]

    print(f"  Packets created/updated: {len(ok)}")
    print(f"  Skipped (already OK):    {len(skipped)}")
    print(f"  Errors:                  {len(errors)}")
    if errors:
        for c in errors:
            print(f"    FAIL {c}: {results[c]}")
    print(f"\nTotal courses processed. Packets in: {PACKETS_DIR}")
    print("Next step: Claude Cowork reads packets and writes lesson drafts.")
    print("Then run:  cd backend && node src/scripts/import_agent_drafts.js --dry-run")


if __name__ == "__main__":
    main()
