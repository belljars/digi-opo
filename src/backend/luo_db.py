import sqlite3
import os

db_file = "ammatit.db"

if os.path.exists(db_file):
    os.remove(db_file)

conn = sqlite3.connect(db_file)
cursor = conn.cursor()

cursor.execute('''
    CREATE TABLE IF NOT EXISTS ammatit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ammatti TEXT NOT NULL,
        tutkinto TEXT NOT NULL,
        link TEXT NOT NULL
    )
''')

with open('ammatit.txt', 'r', encoding='utf-8') as file:
    a = file.readlines()
    
    for i in range(0, len(a), 3):
        if i + 2 < len(a):
            ammatti = a[i].strip()
            tutkinto = a[i + 1].strip()
            link = a[i + 2].strip()
            
            cursor.execute('''
                INSERT INTO ammatit (ammatti, tutkinto, link)
                VALUES (?, ?, ?)
            ''', (ammatti, tutkinto, link))

conn.commit()
conn.close()

