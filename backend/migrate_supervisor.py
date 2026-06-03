"""Migración: cambia el rol de supervisor de 'admin' a 'supervisor'."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from database import get_central_db

db = get_central_db()
result = db["usuarios"].update_one(
    {"username": "supervisor"},
    {"$set": {"role": "supervisor"}}
)
if result.modified_count:
    print("✅ supervisor.role actualizado a 'supervisor'")
else:
    print("⚠️  No se modificó nada (¿ya estaba actualizado?)")
