import requests

def test_vendors_route():
    try:
        response = requests.get("http://127.0.0.1:8000/invoices/vendors")
        if response.status_code == 200:
            print("SUCCESS: /invoices/vendors returned 200 OK")
            print(f"Vendors found: {len(response.json())}")
        else:
            print(f"FAILURE: /invoices/vendors returned {response.status_code}")
            print(f"Detail: {response.text}")
    except Exception as e:
        print(f"ERROR: Could not connect to backend: {e}")

if __name__ == "__main__":
    test_vendors_route()
