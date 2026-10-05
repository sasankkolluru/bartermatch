from pathlib import Path
from datetime import datetime, timedelta, timezone
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.api.endpoints import router
from app.database.connection import DB_PATH, get_connection
BASE=Path(__file__).resolve().parents[1]
@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield

app=FastAPI(title='BarterMatch API',version='1.0.0',description='Creator-brand barter collaboration demo API',lifespan=lifespan)
origins=[origin.strip() for origin in os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['GET','POST','OPTIONS'],allow_headers=['Content-Type','Authorization'])
app.include_router(router)
def init_db():
    conn=get_connection()
    try:
        additions={
            'creators': {'completed_collaborations':'INTEGER DEFAULT 0','successful_posts':'INTEGER DEFAULT 0','ghosted_campaigns':'INTEGER DEFAULT 0'},
            'products': {'reserved_units':'INTEGER DEFAULT 0','shipped_units':'INTEGER DEFAULT 0','unit_cost':'REAL DEFAULT 0'},
            'campaigns': {'description':"TEXT DEFAULT ''",'minimum_followers':'INTEGER DEFAULT 0','minimum_engagement':'REAL DEFAULT 0','posting_deadline_days':'INTEGER DEFAULT 7','target_platform':"TEXT DEFAULT 'Instagram'",'deliverables':"TEXT DEFAULT '1 social post'"},
            'collaborations': {'claimed_at':'TEXT','shipped_at':'TEXT','delivered_at':'TEXT','deadline':'TEXT','completed_at':'TEXT'},
            'shipments': {'dispatched_at':'TEXT','delivered_at':'TEXT'},
            'proofs': {'verified_by':'BIGINT REFERENCES users(id)','verified_at':'TEXT'},
        }
        if conn.dialect == 'postgres':
            conn.executescript((BASE/'app/database/schema_postgres.sql').read_text())
            for table, columns in additions.items():
                for name, definition in columns.items():
                    conn.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {definition}')
        else:
            conn.executescript((BASE/'app/database/schema.sql').read_text())
            for table, columns in additions.items():
                existing={row['name'] for row in conn.execute(f'PRAGMA table_info({table})')}
                for name, definition in columns.items():
                    if name not in existing:
                        conn.execute(f'ALTER TABLE {table} ADD COLUMN {name} {definition}')
        conn.executescript((BASE/'app/database/seed.sql').read_text())
        conn.execute('UPDATE products SET unit_cost=price WHERE unit_cost=0')
        for brand_id in range(3, 7):
            conn.execute(
                'INSERT OR IGNORE INTO users(id,name,email,role) VALUES(?,?,?,?)',
                (brand_id, f'Demo Brand {brand_id}', f'brand{brand_id}@example.com', 'brand'),
            )

        niches=['beauty','food','fashion','fitness','technology']
        cities=['Hyderabad','Bengaluru','Chennai','Mumbai','Delhi']
        platforms=['Instagram','Instagram','YouTube','TikTok']
        first_names=['Aarav','Diya','Ishaan','Kiara','Vivaan','Anaya','Reyansh','Myra','Advait','Saanvi','Kabir','Ira','Arjun','Tara','Neil','Rhea','Dev','Aditi','Zayn','Mira','Kian','Nisha','Om','Aanya']
        surnames=['Kapoor','Menon','Iyer','Shah','Reddy','Bose','Malhotra','Joshi','Nair','Mehta','Rao','Khanna','Pillai','Saxena','Desai','Bhat','Kulkarni','Sethi','Chopra']
        for creator_id in range(5, 51):
            first=first_names[(creator_id*7)%len(first_names)]
            last=surnames[(creator_id*11)%len(surnames)]
            existing=conn.execute('SELECT handle FROM creators WHERE id=?',(creator_id,)).fetchone()
            if existing and existing['handle'].startswith('@sample_creator_'):
                conn.execute('UPDATE creators SET name=?,handle=? WHERE id=?',(f'{first} {last}',f'@{first.lower()}_{last.lower()}_{creator_id:02d}',creator_id))
        creator_count=conn.execute('SELECT COUNT(*) FROM creators').fetchone()[0]
        for creator_id in range(creator_count+1, 51):
            niche=niches[(creator_id-1)%len(niches)]
            first=first_names[(creator_id*7)%len(first_names)]
            last=surnames[(creator_id*11)%len(surnames)]
            conn.execute(
                'INSERT OR IGNORE INTO creators(id,name,handle,platform,followers,engagement,niche,city,trust_score) VALUES(?,?,?,?,?,?,?,?,?)',
                (creator_id, f'{first} {last}', f'@{first.lower()}_{last.lower()}_{creator_id:02d}', platforms[(creator_id-1)%len(platforms)], 8000+(creator_id*2371)%180000, round(2.1+(creator_id%61)/10,1), niche, cities[(creator_id-1)%len(cities)], 55+(creator_id*7)%46),
            )

        categories=['beauty','food','fashion','fitness','technology']
        product_count=conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        for product_id in range(product_count+1, 21):
            category=categories[(product_id-1)%len(categories)]
            conn.execute(
                'INSERT OR IGNORE INTO products(id,name,category,price,stock,description,unit_cost) VALUES(?,?,?,?,?,?,?)',
                (product_id, f'Demo {category.title()} Gift {product_id:02d}', category, 399+product_id*75, 20+product_id, 'Synthetic sample product for demo use', 250+product_id*40),
            )

        demo_campaigns=[
            ('Fresh-Face Morning Routine','beauty','Instagram','1 Instagram Reel'),
            ('Everyday Skin Stories','beauty','Instagram','1 Instagram Reel'),
            ('Pantry-to-Plate Tastemakers','food','Instagram','1 recipe Reel'),
            ('Weekend Style Edit','fashion','Instagram','1 outfit Reel'),
            ('Small-Space Fitness Finds','fitness','YouTube','1 YouTube Short'),
            ('Tech for the Commute','technology','YouTube','1 product Short'),
            ('Millet Snack Break','food','Instagram','1 tasting Reel'),
            ('City Hydration Club','fitness','Instagram','1 routine Reel'),
            ('Festival Outfit Diaries','fashion','Instagram','1 styling Reel'),
            ('Calm Evening Rituals','beauty','TikTok','1 product video'),
            ('Creator Kitchen Challenge','food','YouTube','1 recipe video'),
            ('Clean Desk Essentials','technology','TikTok','1 product video'),
            ('Run Club Starter Kit','fitness','Instagram','1 training Reel'),
            ('Summer Skin Reset','beauty','Instagram','1 skincare Reel'),
            ('Comfort-First Workwear','fashion','YouTube','1 styling Short'),
            ('Five-Minute Meal Notes','food','TikTok','1 recipe video'),
            ('Travel-Ready Layers','fashion','Instagram','1 travel Reel'),
            ('Glow On the Go','beauty','TikTok','1 routine video'),
            ('Better Break Snacks','food','Instagram','1 tasting Reel'),
            ('Homegrown Wellness Box','fitness','YouTube','1 YouTube Short'),
            ('Smart Bottle Everyday','technology','Instagram','1 product Reel'),
            ('Local Finds Lookbook','fashion','TikTok','1 styling video'),
            ('Daily Routine Duo','beauty','Instagram','1 routine Reel'),
            ('Camera-Ready Basics','technology','YouTube','1 review Short'),
            ('Spring Reset Creators','fitness','Instagram','1 wellness Reel'),
        ]
        legacy_campaigns=conn.execute("SELECT id FROM campaigns WHERE title LIKE 'Demo % Campaign %' AND description='Synthetic demo campaign; sample data only.' ORDER BY id").fetchall()
        for index, legacy in enumerate(legacy_campaigns[:len(demo_campaigns)]):
            conn.execute('UPDATE campaigns SET title=?,niche=?,target_platform=?,deliverables=? WHERE id=?',(demo_campaigns[index][0],demo_campaigns[index][1],demo_campaigns[index][2],demo_campaigns[index][3],legacy['id']))

        for index,(title,niche,platform,deliverables) in enumerate(demo_campaigns):
            if conn.execute('SELECT id FROM campaigns WHERE title=?',(title,)).fetchone():
                continue
            product_id=(index%20)+1
            conn.execute(
                '''INSERT INTO campaigns(brand_id,title,product_id,niche,city,budget,status,description,minimum_followers,minimum_engagement,posting_deadline_days,target_platform,deliverables)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                ([1,3,4,5,6][index%5],title,product_id,niche,cities[index%len(cities)],12000+(index+1)*1500,'active','Synthetic demo campaign; sample data only.',5000,2.0,7+(index%7),platform,deliverables),
            )

        collaboration_count=conn.execute('SELECT COUNT(*) FROM collaborations').fetchone()[0]
        if collaboration_count < 30:
            now=datetime.now(timezone.utc)
            for index in range(collaboration_count+1, 31):
                campaign_id=((index-1)%10)+1
                creator_id=((index-1)%50)+1
                campaign=conn.execute('SELECT product_id FROM campaigns WHERE id=?',(campaign_id,)).fetchone()
                product=conn.execute('SELECT price FROM products WHERE id=?',(campaign['product_id'],)).fetchone()
                state='completed' if index <= 12 else 'shipped' if index <= 22 else 'invited'
                claimed=(now-timedelta(days=index+3)).isoformat()
                shipped=(now-timedelta(days=index+2)).isoformat() if state in ('completed','shipped') else None
                delivered=(now-timedelta(days=index+1)).isoformat() if state == 'completed' else None
                deadline=(now+timedelta(days=5)).isoformat() if state == 'completed' else None
                completed=delivered if state == 'completed' else None
                cursor=conn.execute(
                    'INSERT INTO collaborations(campaign_id,creator_id,status,agreed_value,claimed_at,shipped_at,delivered_at,deadline,completed_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id',
                    (campaign_id,creator_id,state,product['price'],claimed,shipped,delivered,deadline,completed),
                )
                collaboration_id=cursor.fetchone()['id']
                if state in ('completed','shipped'):
                    stage='delivered' if state == 'completed' else 'shipped'
                    conn.execute(
                        'INSERT INTO shipments(collaboration_id,provider,tracking_code,stage,updated_at,dispatched_at,delivered_at) VALUES(?,?,?,?,?,?,?)',
                        (collaboration_id,'Mock',f'BMDEMO{index:04d}',stage,now.isoformat(),shipped,delivered),
                    )
                    conn.execute('UPDATE products SET stock=MAX(0,stock-1),shipped_units=shipped_units+1 WHERE id=?',(campaign['product_id'],))
                if state == 'completed':
                    conn.execute(
                        'INSERT INTO proofs(collaboration_id,url,caption,verified,submitted_at) VALUES(?,?,?,?,?)',
                        (collaboration_id,f'https://www.instagram.com/p/bartermatch-demo-{index:04d}/','Synthetic demo proof; no platform verification performed.',1,delivered),
                    )
                    conn.execute(
                        'INSERT INTO trust_events(creator_id,event_type,score_change,reason) VALUES(?,?,?,?)',
                        (creator_id,'demo_completion',5,'Synthetic demo lifecycle record.'),
                    )
        if conn.dialect == 'postgres':
            for table in ('users','creators','products','campaigns','collaborations','shipments','proofs','trust_events'):
                conn.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}','id'), COALESCE(MAX(id),1), COUNT(id)>0) FROM {table}"
                )
        conn.commit()
    finally:
        conn.close()
@app.get('/',include_in_schema=False)
def home(): return FileResponse(BASE.parent/'frontend/dist/index.html')
