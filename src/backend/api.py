"""
id
ammatti
tutkinto
link
"""

from fastapi import FastAPI
import sqlite3
from pydantic import BaseModel
from typing import List

app = FastAPI()
db_file = "ammatit.db"

class Ammatti(BaseModel):
    id: int
    ammatti: str
    tutkinto: str
    link: str
    def orm_mode(self):
        return True
    
def db_yhteys():
    conn = sqlite3.connect(db_file)
    return conn

@app.get("/ammatit/", response_model=List[Ammatti]) # hae kaikki ammatit
def get_ammatit():
    conn = db_yhteys()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ammatti, tutkinto, link FROM ammatit")
    rows = cursor.fetchall()
    
    # muuntaa rivit ammatti-olioiksi
    
    ammatit = [Ammatti(id=row[0], ammatti=row[1], tutkinto=row[2], link=row[3] ) for row in rows]
    conn.close()
    return ammatit

@app.get("/ammatit/{ammatti_id}", response_model=Ammatti) # hae tietty ammatti id:llä
def get_ammatti(ammatti_id: int):
    conn = db_yhteys()
    cursor = conn.cursor()
    cursor.execute("SELECT id, ammatti, tutkinto, link FROM ammatit WHERE id = ?", (ammatti_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return Ammatti(id=row[0], ammatti=row[1], tutkinto=row[2], link=row[3])
    else:
        return {"error": "Ammatti not found"}
    
