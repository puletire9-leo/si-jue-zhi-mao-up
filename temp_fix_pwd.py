import bcrypt

# Generate correct hash for admin123
password = b'admin123'
salt = bcrypt.gensalt(rounds=12)
hashed = bcrypt.hashpw(password, salt).decode()
# Convert $2b$ to $2a$ for Spring Security BCrypt compatibility
hashed = hashed.replace('$2b$', '$2a$')
print(f'Hash: {hashed}')

# Verify it works
assert bcrypt.checkpw(password, hashed.replace('$2a$', '$2b$').encode()), 'Verification failed!'
print('Verification: OK')

# Write SQL
sql = f"UPDATE users SET password='{hashed}' WHERE id=1;"
with open('E:/temp_fix_pwd.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
print(f'SQL written to E:/temp_fix_pwd.sql')
