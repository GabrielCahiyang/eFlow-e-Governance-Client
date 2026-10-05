"""Conservative, local extraction: unrecognized layouts fail closed, never send raw PDS to AI."""
from io import BytesIO
import re
from pypdf import PdfReader

FIELDS = ('skills', 'education', 'trainings', 'certifications', 'work_experience', 'specializations')
HEADINGS = (
    (r'educational? background|^education$', 'education'),
    (r'civil service eligibility|certifications?', 'certifications'),
    (r'work experience|employment history', 'work_experience'),
    (r'learning and development|training programs?|^trainings?$', 'trainings'),
    (r'special skills|hobbies and skills|^skills$', 'skills'),
    (r'^specializations?$', 'specializations'),
)
PRIVATE = re.compile(r'government|\b(?:gsis|sss|philhealth|pag-ibig|tin|dob)\b|birth|home address|residen|family|spouse|father|mother|children|civil status|references?|signature|license (?:number|no)|passport|citizenship|religion|mobile|telephone|e-?mail|\b\d{6,}\b', re.I)
STOP = re.compile(r'personal information|family background|voluntary work|other information|references|declaration|questionnaire|^\s*(?:3[4-9]|4[0-2])\.', re.I)

def clean_professional_profile(values: dict) -> dict:
    result = {}
    for field in FIELDS:
        items = values.get(field, [])
        if not isinstance(items, list):
            raise ValueError('Professional fields must be lists.')
        safe = []
        for item in items[:40]:
            if not isinstance(item, str):
                raise ValueError('Professional entries must be text.')
            item = re.sub(r'\s+', ' ', item).strip()[:300]
            if item and not PRIVATE.search(item) and item not in safe:
                safe.append(item)
        result[field] = safe
    summary = str(values.get('competency_summary', '')).strip()[:1500]
    result['competency_summary'] = '' if PRIVATE.search(summary) else summary
    return result

def validate_pdf(payload: bytes) -> PdfReader:
    if not payload.startswith(b'%PDF-') or len(payload) > 10485760:
        raise ValueError('Upload a PDF smaller than 10 MB.')
    try:
        reader = PdfReader(BytesIO(payload), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 50:
            raise ValueError('Use an unencrypted PDF with at most 50 pages.')
        return reader
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('This PDF cannot be read. Export a new PDF and retry.') from exc

def extract_professional_profile(payload: bytes) -> dict:
    reader = validate_pdf(payload)
    values = {field: [] for field in FIELDS}
    section = None
    for page in reader.pages:
        # Extraction is performed once. Only allow-listed sections leave this function.
        text = page.extract_text(extraction_mode='layout') or ''
        if len(text) > 250000:
            raise ValueError('PDF content is too complex. Export a simpler text PDF.')
        for line in text.splitlines():
            line = re.sub(r'\s+', ' ', line).strip()
            if not line:
                continue
            matched = next((field for pattern, field in HEADINGS if re.search(pattern, line, re.I)), None)
            if matched:
                section = matched
                continue
            if STOP.search(line):
                section = None
            if section and not PRIVATE.search(line) and not re.search(r'CS FORM|Revised \d|Page \d|\b(?:NAME OF SCHOOL|INCLUSIVE DATES|FROM TO|LEVEL|RATING|LICENSE|ATTENDANCE|POSITION TITLE|DEPARTMENT / AGENCY|SALARY GRADE)\b', line, re.I):
                values[section].append(line)
    result = clean_professional_profile(values)
    if not any(result[field] for field in FIELDS):
        raise ValueError('No readable professional sections found. Use a text-based PDS PDF or enter your professional profile manually.')
    result['competency_summary'] = '; '.join(result['skills'][:5] + result['specializations'][:3])[:1000]
    return result
