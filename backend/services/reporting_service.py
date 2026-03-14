from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import datetime
from typing import Dict, Any

class ReportingService:
    @staticmethod
    def generate_profit_and_loss(db: Session, start_date: datetime.date = None, end_date: datetime.date = None, user_id: str = None) -> Dict[str, Any]:
        """
        Generates a Profit & Loss (Income Statement) aggregating Revenue and Expenses.
        """
        # Base query for ledger lines
        query = db.query(
            models.Category.name,
            models.Category.type,
            func.sum(models.JournalLine.credit - models.JournalLine.debit).label('net_balance')
        ).join(models.JournalLine).join(models.JournalEntry)
        
        if start_date:
            query = query.filter(models.JournalEntry.date >= start_date)
        if end_date:
            # Include the whole end date
            query = query.filter(models.JournalEntry.date < end_date + datetime.timedelta(days=1))
            
        # Only Revenue and Expense accounts for this user
        query = query.filter(
            models.Category.user_id == user_id,
            models.Category.type.in_([models.CategoryType.REVENUE, models.CategoryType.EXPENSE])
        )
        query = query.group_by(models.Category.name, models.Category.type)
        
        results = query.all()
        
        revenues = []
        expenses = []
        total_revenue = 0.0
        total_expense = 0.0
        
        for name, cat_type, net_balance in results:
            # Revenue accounts have a credit normal balance, so credit - debit is positive for revenue
            # Expense accounts have a debit normal balance, so we invert the sign for display
            balance = float(net_balance or 0.0)
            
            if cat_type == models.CategoryType.REVENUE:
                revenues.append({"name": name, "balance": balance})
                total_revenue += balance
            elif cat_type == models.CategoryType.EXPENSE:
                # Expense balance (debit normal) is debit - credit, so we invert `net_balance`
                expense_balance = -balance
                expenses.append({"name": name, "balance": expense_balance})
                total_expense += expense_balance
                
        net_income = total_revenue - total_expense
        
        return {
            "revenues": revenues,
            "total_revenue": total_revenue,
            "expenses": expenses,
            "total_expense": total_expense,
            "net_income": net_income
        }

    @staticmethod
    def generate_balance_sheet(db: Session, as_of_date: datetime.date = None, user_id: str = None) -> Dict[str, Any]:
        """
        Generates a Balance Sheet aggregating Assets, Liabilities, and Equity.
        """
        query = db.query(
            models.Category.name,
            models.Category.type,
            func.sum(models.JournalLine.debit - models.JournalLine.credit).label('net_balance')
        ).join(models.JournalLine).join(models.JournalEntry)
        
        if as_of_date:
            query = query.filter(models.JournalEntry.date < as_of_date + datetime.timedelta(days=1))
            
        # Assets, Liabilities, Equity for this user
        query = query.filter(
            models.Category.user_id == user_id,
            models.Category.type.in_([models.CategoryType.ASSET, models.CategoryType.LIABILITY, models.CategoryType.EQUITY])
        )
        query = query.group_by(models.Category.name, models.Category.type)
        
        results = query.all()
        
        assets = []
        liabilities = []
        equity = []
        
        total_assets = 0.0
        total_liabilities = 0.0
        total_equity = 0.0
        
        for name, cat_type, net_balance in results:
            balance = float(net_balance or 0.0)
            
            if cat_type == models.CategoryType.ASSET:
                # Asset normal balance is Debit
                assets.append({"name": name, "balance": balance})
                total_assets += balance
            elif cat_type == models.CategoryType.LIABILITY:
                # Liability normal balance is Credit, so invert
                liability_balance = -balance
                liabilities.append({"name": name, "balance": liability_balance})
                total_liabilities += liability_balance
            elif cat_type == models.CategoryType.EQUITY:
                # Equity normal balance is Credit, so invert
                equity_balance = -balance
                equity.append({"name": name, "balance": equity_balance})
                total_equity += equity_balance
                
        # Calculate Retained Earnings from P&L (All time up to as_of_date)
        pnl = ReportingService.generate_profit_and_loss(db, end_date=as_of_date, user_id=user_id)
        net_income = pnl["net_income"]
        
        # Add Net Income to Equity
        if net_income != 0:
            equity.append({"name": "Current Year Net Income", "balance": net_income})
            total_equity += net_income
            
        return {
            "assets": assets,
            "total_assets": total_assets,
            "liabilities": liabilities,
            "total_liabilities": total_liabilities,
            "equity": equity,
            "total_equity": total_equity,
            "total_liabilities_and_equity": total_liabilities + total_equity
        }
