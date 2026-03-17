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

    @staticmethod
    def generate_cash_flow_statement(db: Session, start_date: datetime.date = None, end_date: datetime.date = None, user_id: str = None) -> Dict[str, Any]:
        """
        Generates a Statement of Cash Flows using the Indirect Method.
        """
        if not start_date:
            # Default to beginning of current month
            start_date = datetime.date.today().replace(day=1)
        if not end_date:
            end_date = datetime.date.today()

        # 1. Start with Net Income from P&L
        pnl = ReportingService.generate_profit_and_loss(db, start_date, end_date, user_id)
        net_income = pnl["net_income"]

        # 2. Get changes in Balance Sheet accounts during the period
        # We query the net movement (Debit - Credit) for all non-revenue/expense accounts
        query = db.query(
            models.Category.name,
            models.Category.type,
            models.Category.code,
            func.sum(models.JournalLine.debit - models.JournalLine.credit).label('net_movement')
        ).select_from(models.Category) \
         .join(models.JournalLine, models.Category.id == models.JournalLine.account_id) \
         .join(models.JournalEntry, models.JournalLine.journal_id == models.JournalEntry.id)

        query = query.filter(
            models.JournalEntry.date >= start_date,
            models.JournalEntry.date < end_date + datetime.timedelta(days=1),
            models.Category.user_id == user_id,
            models.Category.type.in_([models.CategoryType.ASSET, models.CategoryType.LIABILITY, models.CategoryType.EQUITY])
        )
        query = query.group_by(models.Category.id, models.Category.name, models.Category.type, models.Category.code)
        
        results = query.all()

        operating_adjustments = []
        investing_activities = []
        financing_activities = []
        
        total_operating = net_income
        total_investing = 0.0
        total_financing = 0.0

        for name, cat_type, code, net_movement in results:
            movement = float(net_movement or 0.0)
            if movement == 0:
                continue

            # Skip Cash accounts (they are what we are reconciling to)
            if "cash" in name.lower() or code == "1000":
                continue

            # Classification Logic
            # Operating: Current Assets (AR, Inventory, Prepaids) and Current Liabilities (AP, Taxes, Unearned)
            # Investing: Long-term Assets (Equipment, PPE)
            # Financing: Loans, Equity

            if cat_type == models.CategoryType.ASSET:
                # Asset Increase (Debit movement) = Cash Outflow (-)
                # Asset Decrease (Credit movement) = Cash Inflow (+)
                impact = -movement
                
                if code in ["1100", "1200", "1300"] or "receivable" in name.lower() or "inventory" in name.lower():
                    operating_adjustments.append({"name": f"Change in {name}", "amount": impact})
                    total_operating += impact
                elif code == "1500" or "equipment" in name.lower() or "asset" in name.lower():
                    investing_activities.append({"name": name, "amount": impact})
                    total_investing += impact
                else:
                    # Fallback to Operating for other current assets
                    operating_adjustments.append({"name": f"Change in {name}", "amount": impact})
                    total_operating += impact

            elif cat_type in [models.CategoryType.LIABILITY, models.CategoryType.EQUITY]:
                # Liability/Equity Increase (Credit movement/negative net_movement) = Cash Inflow (+)
                # Liability/Equity Decrease (Debit movement/positive net_movement) = Cash Outflow (-)
                impact = -movement # Since net_movement is Debit - Credit, Credit increase makes it negative. So impact = -(-Value) = Positive.
                
                if code in ["2000", "2100", "2200", "2300"] or "payable" in name.lower():
                    operating_adjustments.append({"name": f"Change in {name}", "amount": impact})
                    total_operating += impact
                elif cat_type == models.CategoryType.LIABILITY:
                    # Other long term liabilities
                    financing_activities.append({"name": f"Change in {name}", "amount": impact})
                    total_financing += impact
                elif cat_type == models.CategoryType.EQUITY:
                    # Equity changes (Contributions, etc)
                    # Note: We already started with Net Income, so we should avoid double counting Retained Earnings if it's just from the current year.
                    if "net income" in name.lower() or "retained earnings" in name.lower():
                        continue
                    financing_activities.append({"name": name, "amount": impact})
                    total_financing += impact

        # 3. Calculate Cash Balances
        # Beginning Cash = Sum of Cash accounts before start_date
        def get_cash_balance(as_of):
            bal_query = db.query(
                func.sum(models.JournalLine.debit - models.JournalLine.credit)
            ).select_from(models.JournalLine) \
             .join(models.JournalEntry, models.JournalLine.journal_id == models.JournalEntry.id) \
             .join(models.Category, models.JournalLine.account_id == models.Category.id)
            
            bal_query = bal_query.filter(
                models.JournalEntry.date < as_of,
                models.Category.user_id == user_id,
                models.Category.type == models.CategoryType.ASSET,
                (models.Category.name.ilike("%cash%") | (models.Category.code == "1000"))
            )
            return float(bal_query.scalar() or 0.0)

        beginning_cash = get_cash_balance(start_date)
        net_change = total_operating + total_investing + total_financing
        ending_cash = beginning_cash + net_change

        return {
            "start_date": start_date,
            "end_date": end_date,
            "operating_activities": {
                "net_income": net_income,
                "adjustments": operating_adjustments,
                "total": total_operating
            },
            "investing_activities": {
                "items": investing_activities,
                "total": total_investing
            },
            "financing_activities": {
                "items": financing_activities,
                "total": total_financing
            },
            "net_cash_increase": net_change,
            "beginning_cash": beginning_cash,
            "ending_cash": ending_cash
        }
