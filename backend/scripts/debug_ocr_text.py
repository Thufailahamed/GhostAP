"""Debug script - dumps raw OCR text from the first PDF in temp_storage."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

import pytesseract
from pdf2image import convert_from_path

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
POPPLER_PATH = r'C:\Users\user\Downloads\Release-25.12.0-0\poppler-25.12.0\Library\bin'

storage = os.path.join(os.path.dirname(__file__), 'temp_storage')
pdfs = [f for f in os.listdir(storage) if f.endswith('.pdf')]

if not pdfs:
    print("No PDFs found in temp_storage!")
    sys.exit(0)

pdf_path = os.path.join(storage, pdfs[0])
print(f"Processing: {pdf_path}\n{'='*60}")

images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
for i, img in enumerate(images):
    text = pytesseract.image_to_string(img)
    print(f"--- PAGE {i+1} ---")
    print(repr(text))
    print()
    print(text)
    print('='*60)
