import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import sys

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def register_watch():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            print("ERROR: token.json not found or invalid. Run generate_gmail_token.py first.")
            return

    try:
        service = build('gmail', 'v1', credentials=creds)
        
        # Replace this with your exact topic name from Google Cloud
        topic_name = "projects/ai-ap-ghost/topics/invoice-listener-topic" 
        
        request = {
            'labelIds': ['INBOX'],
            'topicName': topic_name
        }
        
        response = service.users().watch(userId='me', body=request).execute()
        
        print("\n✅ SUCCESS: GMAIL WATCH REGISTERED!")
        print(f"History ID: {response.get('historyId')}")
        print("Google will now push new emails to your Ngrok Webhook!")
        
    except Exception as error:
        print(f"❌ An error occurred: {error}")

if __name__ == '__main__':
    register_watch()
