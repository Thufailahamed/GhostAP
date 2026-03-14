import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from dotenv import load_dotenv
import datetime

load_dotenv()

import requests
from jose import jwk, jwt
from jose.utils import base64url_decode

# JWT Secret for fallback or HS256 tokens
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
ALGORITHM = "HS256"

security = HTTPBearer()

# Cache for JWKS to avoid redundant calls
cached_jwks = None

def get_jwks():
    global cached_jwks
    if cached_jwks:
        return cached_jwks
    try:
        url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        response = requests.get(url)
        cached_jwks = response.json()
        return cached_jwks
    except Exception as e:
        print(f"FAILED TO FETCH JWKS: {e}")
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Decodes and verifies the Supabase JWT.
    Supports both ES256 (asymmetric) and HS256 (symmetric).
    """
    token = credentials.credentials
    
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        
        if alg == "ES256":
            # Verification for the new ECC keys
            jwks = get_jwks()
            if not jwks:
                raise HTTPException(status_code=500, detail="Could not fetch JWKS")
            
            # Find the correct key in JWKS
            key = next((k for k in jwks["keys"] if k["kid"] == header.get("kid")), None)
            if not key:
                raise HTTPException(status_code=401, detail="Invalid token: key not found in JWKS")
            
            payload = jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
        else:
            # Fallback to HS256 with provide JWT_SECRET
            if not JWT_SECRET:
                raise HTTPException(status_code=500, detail="Missing SUPABASE_JWT_SECRET")
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], audience="authenticated")

        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
            
        return payload
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
