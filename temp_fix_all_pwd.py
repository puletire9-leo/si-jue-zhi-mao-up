import bcrypt

password = b'123456'
salt = bcrypt.gensalt(rounds=12)
hashed = bcrypt.hashpw(password, salt).decode()
hashed = hashed.replace('$2b$', '$2a$')

# Verify
assert bcrypt.checkpw(password, hashed.replace('$2a$', '$2b$').encode()), 'Verification failed!'

print(f'Hash: {hashed}')

# Update ALL users
sql = f"UPDATE users SET password='{hashed}';"
with open('E:/temp_fix_all_pwd.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
print('SQL written: UPDATE users SET password=... (all users)')
