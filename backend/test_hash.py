from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

try:
    hash = pwd_context.hash("password")
    print(f"Hash success: {hash}")
    print(f"Verify success: {pwd_context.verify('password', hash)}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
