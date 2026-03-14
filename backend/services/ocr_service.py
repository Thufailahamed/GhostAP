import os
import json
import logging
from dotenv import load_dotenv
from pdf2image import convert_from_path
import google.generativeai as genai
from PIL import Image
import io

# Load env vars immediately so they are available at module level
load_dotenv()

logger = logging.getLogger(__name__)

# Configure Poppler path for Windows
POPPLER_PATH = r'C:\Users\user\Downloads\Release-25.12.0-0\poppler-25.12.0\Library\bin'

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


EXTRACTION_PROMPT = """
You are an expert invoice parser. Analyze this invoice image and extract the following data.
Return ONLY a valid JSON object with no markdown, no code fences, no explanation — just raw JSON.

Required JSON schema:
{
  "vendor_name": "string (the company/vendor name issuing the invoice)",
  "invoice_number": "string",
  "date": "string (in YYYY-MM-DD format if possible, else as-is)",
  "due_date": "string (in YYYY-MM-DD format if possible, else as-is. Leave null if not explicitly stated)",
  "currency": "string (3-letter ISO currency code, e.g. USD, GBP, EUR, AED, INR)",
  "subtotal": number (float, 0.0 if not found),
  "discount": number (float, 0.0 if not found),
  "tax": number (float, 0.0 if not found),
  "shipping": number (float, 0.0 if not found),
  "total": number (float, 0.0 if not found),
  "line_items": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "total": number
    }
  ]
}

Rules:
- All monetary values must be numbers (not strings).
- If a field is not found, use null for strings and 0.0 for numbers.
- Line items should be all the specific products/services listed in the invoice, NOT totals or taxes.
- CRITICAL: Look explicitly for 'Discount', 'Savings', or negative values in the subtotals or line items. Extract the absolute positive value into the 'discount' field.
- If a discount is listed as a negative line item, DO NOT include it in the line_items array. Instead, put the absolute value in the 'discount' field.
- CRITICAL MATH CHECK: You MUST verify your math. If Subtotal + Tax + Shipping > Total, then the difference MUST be extracted into the 'discount' field (discount = Subtotal + Tax + Shipping - Total) to make the math perfectly balance.
- The date should be the invoice date, NOT a due date.
- vendor_name should be the company issuing the invoice (the seller), not the buyer.
- Detect the currency from symbols: £ or GBP = GBP, $ = USD, € = EUR, AED or دإ = AED. Default to USD if unclear.
"""

def perform_ocr(pdf_path: str) -> dict:
    """
    Uses Gemini Vision API to extract structured invoice data from a PDF.
    """
    empty_result = {
        "vendor_name": "Unknown Vendor",
        "invoice_number": "",
        "date": "",
        "due_date": "",
        "subtotal": 0.0,
        "discount": 0.0,
        "tax": 0.0,
        "shipping": 0.0,
        "total": 0.0,
        "line_items": [],
        "confidence_score": 10.0
    }

    if not os.path.exists(pdf_path):
        logger.error(f"Cannot find PDF: {pdf_path}")
        return empty_result

    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set in environment. Cannot perform AI extraction.")
        return empty_result

    try:
        # Convert PDF pages to images
        images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
        
        if not images:
            logger.error("No images extracted from PDF.")
            return empty_result

        # Use the first page (most invoices fit on one page)
        page_image = images[0]

        # Convert PIL image to bytes for Gemini
        img_byte_arr = io.BytesIO()
        page_image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        image_data = img_byte_arr.getvalue()

        # Call Gemini Vision API - configure fresh each time to ensure key is loaded
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        import time
        max_retries = 3
        raw_text = None
        
        for attempt in range(max_retries):
            try:
                response = model.generate_content([
                    EXTRACTION_PROMPT,
                    {
                        "mime_type": "image/png",
                        "data": image_data
                    }
                ])
                raw_text = response.text.strip()
                break # Success
            except Exception as e:
                if ("429" in str(e) or "Resource exhausted" in str(e)) and attempt < max_retries - 1:
                    sleep_time = (attempt + 1) * 4 # Sleep 4s, 8s...
                    logger.warning(f"Gemini API rate limit hit (429). Retrying in {sleep_time}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(sleep_time)
                else:
                    raise e
                    
        if not raw_text:
            raise Exception("Failed to get response text from Gemini API")

        logger.info(f"Gemini raw response:\n{raw_text}")

        # Clean up potential markdown code fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        extracted = json.loads(raw_text)

        # Normalize and calculate confidence
        raw_currency = extracted.get("currency") or "USD"
        # Ensure it's a 3-letter code and uppercase
        currency = str(raw_currency).strip().upper()[:3] if raw_currency else "USD"

        def safe_str(val, default="") -> str:
            if val is None or val == "null":
                return default
            return str(val).strip()

        def safe_float(val) -> float:
            if val is None or val == "null":
                return 0.0
            if isinstance(val, (int, float)):
                return float(val)
            import re
            cleaned = re.sub(r'[^\d.-]', '', str(val))
            try:
                return float(cleaned) if cleaned else 0.0
            except ValueError:
                return 0.0

        result = {
            "vendor_name": safe_str(extracted.get("vendor_name"), "Unknown Vendor") or "Unknown Vendor",
            "invoice_number": safe_str(extracted.get("invoice_number"), ""),
            "date": safe_str(extracted.get("date"), ""),
            "due_date": safe_str(extracted.get("due_date"), ""),
            "currency": currency,
            "subtotal": safe_float(extracted.get("subtotal")),
            "discount": safe_float(extracted.get("discount")),
            "tax": safe_float(extracted.get("tax")),
            "shipping": safe_float(extracted.get("shipping")),
            "total": safe_float(extracted.get("total")),
            "line_items": [],
            "confidence_score": 50.0
        }

        # Process line items
        raw_items = extracted.get("line_items") or []
        for item in raw_items:
            if isinstance(item, dict) and item.get("description"):
                result["line_items"].append({
                    "description": safe_str(item.get("description"), ""),
                    "quantity": safe_float(item.get("quantity")) or 1.0,
                    "unit_price": safe_float(item.get("unit_price")),
                    "total": safe_float(item.get("total")),
                })

        # Boost confidence based on how much data was found
        if result["vendor_name"] != "Unknown Vendor": result["confidence_score"] += 15
        if result["invoice_number"]: result["confidence_score"] += 15
        if result["date"]: result["confidence_score"] += 10
        if result["total"] > 0: result["confidence_score"] += 20
        if result["line_items"]: result["confidence_score"] += 10
        if result["subtotal"] > 0: result["confidence_score"] += 5
        if result["tax"] > 0: result["confidence_score"] += 5

        result["confidence_score"] = min(99.9, result["confidence_score"])

        logger.info(f"Gemini extraction complete: {result}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini JSON response: {e}\nRaw: {raw_text}")
        return empty_result
    except Exception as e:
        logger.error(f"Gemini OCR extraction failed: {e}")
        return empty_result
