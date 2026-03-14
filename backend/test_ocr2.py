import os
import sys
import traceback

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

import logging
logging.basicConfig(level=logging.INFO, filename="test_output.log")
logger = logging.getLogger(__name__)

from services.ocr_service import perform_ocr

storage = os.path.join(backend_dir, 'temp_storage')
pdfs = [f for f in os.listdir(storage) if f.endswith('.pdf')]
if not pdfs:
    print("No PDFs")
    sys.exit(0)

pdf_path = os.path.join(storage, 'invoice_Valerie Dominguez_19175.pdf')
try:
    result = perform_ocr(pdf_path)
    with open("test_output.txt", "w") as f:
        import json
        f.write(json.dumps(result, indent=2))
except Exception as e:
    with open("test_output.txt", "w") as f:
        f.write(traceback.format_exc())
