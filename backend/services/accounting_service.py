from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import datetime

class AccountingService:
    @staticmethod
    def create_journal_entry(db: Session, description: str, reference: str, lines: list, user_id: str = None):
        """
        Creates a journal entry with multiple lines (debits/credits).
        Each line in `lines` should be dict: {"account_id": int, "debit": float, "credit": float}
        """
        # 1. Verify Balance (Total Debits must equal Total Credits)
        total_debits = sum(line.get("debit", 0.0) for line in lines)
        total_credits = sum(line.get("credit", 0.0) for line in lines)
        
        if abs(total_debits - total_credits) > 0.001:
            raise ValueError(f"Journal entry is unbalanced. Debits ({total_debits}) != Credits ({total_credits})")

        # 2. Create Header
        entry = models.JournalEntry(
            user_id=user_id,
            description=description,
            reference=reference,
            date=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(entry)
        db.flush() # Get ID

        # 3. Create Lines
        for line_data in lines:
            line = models.JournalLine(
                user_id=user_id,
                journal_id=entry.id,
                account_id=line_data["account_id"],
                debit=line_data.get("debit", 0.0),
                credit=line_data.get("credit", 0.0)
            )
            db.add(line)
        
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def get_account_balance(db: Session, account_id: int):
        """
        Calculates the balance for a specific account from the ledger.
        """
        result = db.query(
            func.sum(models.JournalLine.debit).label("debits"),
            func.sum(models.JournalLine.credit).label("credits")
        ).filter(models.JournalLine.account_id == account_id).first()
        
        debits = result.debits or 0.0
        credits = result.credits or 0.0
        
        # Balance behavior depends on account type, but standard (D - C) works for assets/expenses
        # We can implement specific sign logic here if needed.
        return debits - credits

    @staticmethod
    def get_bank_balance(db: Session, bank_account_id: int):
        """
        Sum of all transactions for this bank account.
        """
        balance = db.query(func.sum(models.BankTransaction.amount)).filter(
            models.BankTransaction.bank_account_id == bank_account_id
        ).scalar()
        return balance or 0.0
