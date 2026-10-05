"""Load processed JSON creator and product records into the local SQLite database."""
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.database.connection import session
from app.main import init_db
def main():
    creators=json.loads((ROOT/'data/processed/creators.json').read_text())
    products=json.loads((ROOT/'data/processed/products.json').read_text())
    init_db()
    with session() as c:
        for x in creators:
            c.execute('''INSERT INTO creators(id,name,handle,platform,followers,engagement,niche,city,trust_score)
                VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,handle=excluded.handle,
                platform=excluded.platform,followers=excluded.followers,engagement=excluded.engagement,
                niche=excluded.niche,city=excluded.city,trust_score=excluded.trust_score''',(x['id'],x['name'],x['handle'],x['platform'],x['followers'],x['engagement'],x['niche'],x['city'],x.get('trust_score',70)))
        for x in products:
            c.execute('''INSERT INTO products(id,name,category,price,stock,unit_cost) VALUES(?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,
                price=excluded.price,stock=excluded.stock,unit_cost=excluded.unit_cost''',(x['id'],x['name'],x['category'],x['price'],x['stock'],x['price']))
    print(f'Imported {len(creators)} creators and {len(products)} products into SQLite.')
if __name__=='__main__': main()
