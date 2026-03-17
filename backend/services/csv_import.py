"""
CSV Import Service for Bank Statements.
Handles common bank statement formats with configurable column mapping.
"""
import csv
import io
from typing import List, Dict, Optional
from pydantic import BaseModel
from datetime import datetime


class CSVImportRow(BaseModel):
    date: str
    description: str
    amount: float
    reference: Optional[str] = None


class CSVImportResult(BaseModel):
    rows_imported: int
    rows_skipped: int
    errors: List[str]
    preview: List[Dict] = []


def detect_columns(headers: List[str]) -> Dict[str, Optional[int]]:
    """Auto-detect column mapping based on common header names."""
    mapping = {
        "date": None,
        "description": None,
        "amount": None,
        "debit": None,
        "credit": None,
        "reference": None,
    }
    
    date_keywords = ["date", "transaction date", "post date", "posted", "value date"]
    desc_keywords = ["description", "details", "particulars", "narration", "memo", "merchant", "payee"]
    amount_keywords = ["amount", "total", "value"]
    debit_keywords = ["debit", "withdrawal", "out", "dr"]
    credit_keywords = ["credit", "deposit", "in", "cr"]
    ref_keywords = ["reference", "ref", "check", "cheque", "transaction id", "id"]
    
    for idx, header in enumerate(headers):
        h = header.strip().lower()
        if mapping["date"] is None and any(k in h for k in date_keywords):
            mapping["date"] = idx
        elif mapping["description"] is None and any(k in h for k in desc_keywords):
            mapping["description"] = idx
        elif mapping["amount"] is None and h in amount_keywords:
            mapping["amount"] = idx
        elif mapping["debit"] is None and any(k in h for k in debit_keywords):
            mapping["debit"] = idx
        elif mapping["credit"] is None and any(k in h for k in credit_keywords):
            mapping["credit"] = idx
        elif mapping["reference"] is None and any(k in h for k in ref_keywords):
            mapping["reference"] = idx
    
    return mapping


def parse_amount(value: str) -> float:
    """Parse an amount string, handling commas, currency symbols, and parentheses (negative)."""
    if not value or not value.strip():
        return 0.0
    
    cleaned = value.strip()
    # Remove currency symbols
    for sym in ["$", "€", "£", "¥", "₹", "AED", "USD", "EUR", "GBP"]:
        cleaned = cleaned.replace(sym, "")
    
    # Handle parentheses as negative
    is_negative = cleaned.startswith("(") and cleaned.endswith(")")
    if is_negative:
        cleaned = cleaned[1:-1]
    
    # Remove commas and spaces
    cleaned = cleaned.replace(",", "").replace(" ", "").strip()
    
    try:
        amount = float(cleaned)
        return -amount if is_negative else amount
    except ValueError:
        return 0.0


def parse_date(value: str) -> Optional[str]:
    """Try multiple date formats and return ISO format."""
    formats = [
        "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", 
        "%m-%d-%Y", "%d-%m-%Y",
        "%Y/%m/%d", "%d %b %Y", "%d %B %Y",
        "%b %d, %Y", "%B %d, %Y",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(value.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_csv(file_content: str, column_mapping: Optional[Dict[str, int]] = None) -> CSVImportResult:
    """
    Parse a CSV bank statement file content.
    Returns structured rows, with auto-detection if no mapping is provided.
    """
    reader = csv.reader(io.StringIO(file_content))
    rows = list(reader)
    
    if len(rows) < 2:
        return CSVImportResult(rows_imported=0, rows_skipped=0, errors=["CSV file is empty or has no data rows."])
    
    headers = rows[0]
    data_rows = rows[1:]
    
    # Auto-detect or use provided mapping
    mapping = column_mapping or detect_columns(headers)
    
    if mapping.get("date") is None:
        return CSVImportResult(rows_imported=0, rows_skipped=0, errors=["Could not detect a 'Date' column. Please check your CSV headers."])
    
    has_single_amount = mapping.get("amount") is not None
    has_split_amounts = mapping.get("debit") is not None or mapping.get("credit") is not None
    
    if not has_single_amount and not has_split_amounts:
        return CSVImportResult(rows_imported=0, rows_skipped=0, errors=["Could not detect an 'Amount' or 'Debit/Credit' column."])
    
    parsed = []
    errors = []
    skipped = 0
    
    for i, row in enumerate(data_rows):
        try:
            if not row or all(not cell.strip() for cell in row):
                skipped += 1
                continue
            
            # Parse date
            date_val = row[mapping["date"]] if mapping["date"] < len(row) else ""
            parsed_date = parse_date(date_val)
            if not parsed_date:
                errors.append(f"Row {i+2}: Could not parse date '{date_val}'")
                skipped += 1
                continue
            
            # Parse description
            desc_idx = mapping.get("description")
            description = row[desc_idx].strip() if desc_idx is not None and desc_idx < len(row) else f"Transaction #{i+1}"
            
            # Parse amount
            if has_single_amount:
                amount = parse_amount(row[mapping["amount"]] if mapping["amount"] < len(row) else "0")
            else:
                debit = parse_amount(row[mapping["debit"]] if mapping.get("debit") is not None and mapping["debit"] < len(row) else "0")
                credit = parse_amount(row[mapping["credit"]] if mapping.get("credit") is not None and mapping["credit"] < len(row) else "0")
                amount = credit - debit  # Positive = incoming, negative = outgoing
            
            if amount == 0:
                skipped += 1
                continue
            
            # Parse reference
            ref_idx = mapping.get("reference")
            reference = row[ref_idx].strip() if ref_idx is not None and ref_idx < len(row) else None
            
            parsed.append({
                "date": parsed_date,
                "description": description,
                "amount": amount,
                "reference": reference,
            })
            
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")
            skipped += 1
    
    return CSVImportResult(
        rows_imported=len(parsed),
        rows_skipped=skipped,
        errors=errors,
        preview=parsed
    )
