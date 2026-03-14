import os
import sys

# Add the backend directory to sys.path so we can import services
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from services.ocr_service import perform_ocr

storage = os.path.join(backend_dir, 'temp_storage')
if not os.path.exists(storage):
    print(f"Directory not found: {storage}")
    sys.exit(0)

pdfs = [f for f in os.listdir(storage) if f.endswith('.pdf')]
if not pdfs:
    print("No PDFs found in temp_storage!")
    sys.exit(0)

pdf_path = os.path.join(storage, pdfs[0])
print(f"Processing: {pdf_path}")

result = perform_ocr(pdf_path)
import json
print(json.dumps(result, indent=2))
