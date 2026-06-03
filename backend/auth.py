from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = "oxxo-bdd-2026-super-secret-key-uaa"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 horas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    return decode_token(token)


PRIVILEGED = ("admin", "supervisor")   # roles con acceso global
ALL_ROLES  = ("admin", "supervisor", "gerente", "cajero")


async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") not in PRIVILEGED:
        raise HTTPException(status_code=403, detail="Se requiere rol administrador o supervisor")
    return user


async def require_store_access(user: dict = Depends(get_current_user)):
    """Permite admin/supervisor global o cajero/gerente de cualquier sucursal."""
    if user.get("role") not in ALL_ROLES:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return user
