import sqlite3

def check_tallies():
    conn = sqlite3.connect('../ghost_mvp.db')
    cursor = conn.cursor()
    
    print("=== Financial Audit ===")
    
    # 1. Double-Entry Accounting Check
    cursor.execute('SELECT SUM(debit), SUM(credit) FROM journal_lines')
    debits, credits = cursor.fetchone()
    print(f"Total Debits:  ${debits or 0:,.2f}")
    print(f"Total Credits: ${credits or 0:,.2f}")
    if abs((debits or 0) - (credits or 0)) < 0.01:
        print("✅ Journal entries balance (Debits = Credits)")
    else:
        print("❌ WARNING: Journal entries DO NOT balance!")
        
    # 2. Bank Accounts
    cursor.execute('SELECT id, name FROM bank_accounts')
    accounts = cursor.fetchall()
    
    total_bank_cash = 0
    print("\n--- Bank Accounts ---")
    for acc_id, name in accounts:
        cursor.execute('SELECT SUM(amount) FROM bank_transactions WHERE bank_account_id = ?', (acc_id,))
        balance = cursor.fetchone()[0] or 0
        print(f"[{name}] Balance: ${balance:,.2f}")
        total_bank_cash += balance
        
    print(f"Total Available Cash: ${total_bank_cash:,.2f}")
    
    # 3. Payables
    cursor.execute('''
        SELECT SUM(total_amount) FROM invoices 
        WHERE status NOT IN ('PAID', 'REJECTED')
    ''')
    payables = cursor.fetchone()[0] or 0
    print(f"\nTotal Payables: ${payables:,.2f}")
    
    # 4. Receivables
    cursor.execute('''
        SELECT SUM(total_amount), SUM(paid_amount) FROM receivables 
        WHERE status != 'PAID'
    ''')
    rec_results = cursor.fetchone()
    total_rec = rec_results[0] or 0
    paid_rec = rec_results[1] or 0
    print(f"Total Receivables: ${(total_rec - paid_rec):,.2f}")
    
    # 5. Net Position
    net_position = total_bank_cash + (total_rec - paid_rec) - payables
    print(f"\nFormula: Cash + Receivables - Payables = Net Position")
    print(f"Net Position: ${net_position:,.2f}")
    
    conn.close()

if __name__ == '__main__':
    check_tallies()
