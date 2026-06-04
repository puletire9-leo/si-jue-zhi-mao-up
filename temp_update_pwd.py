import bcrypt
h = bcrypt.hashpw(b'admin123', bcrypt.gensalt(12)).decode()
h = h.replace('$2b$', '$2a$')
sql = f"UPDATE users SET password='{h}' WHERE id=1;"
print("SQL:", sql)
with open('E:/temp_update_pwd.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
print("Written to E:/temp_update_pwd.sql")
