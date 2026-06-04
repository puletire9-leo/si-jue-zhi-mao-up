import bcrypt

# Generate fresh hash
hashed = bcrypt.hashpw(b'123456', bcrypt.gensalt(12)).decode()
print(f"Hash: {hashed}")

# Verify
print(f"Verify: {bcrypt.checkpw(b'123456', hashed.encode())}")
