import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.validation_service import validate_invoice_data, ValidationResult
