from pymongo import MongoClient
import datetime

client = MongoClient('mongodb://localhost:27017/')
db = client['crowdsense']
regs = list(db['registrations'].find())
print(f"Total registrations: {len(regs)}")
for r in regs:
    print(r)
