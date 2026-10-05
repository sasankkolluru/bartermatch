import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from fastapi.testclient import TestClient
from app.main import app, init_db
init_db()
from app.services.matching_service import score_creator
from app.services.trust_service import trust_tier
from app.services.proof_service import validate_proof_url
from app.services.analytics_service import analytics
from app.database.connection import PostgresConnection
client=TestClient(app)
def test_health(): assert client.get('/api/health').json()['status']=='ok'
def test_seed_products(): assert len(client.get('/api/products').json())>=3
def test_seed_creators(): assert len(client.get('/api/creators').json())>=4
def test_seed_campaign(): assert len(client.get('/api/campaigns').json())>=1
def test_campaign_create():
 r=client.post('/api/campaigns',json={'title':'Test campaign','product_id':1,'niche':'beauty','city':'Hyderabad','budget':5000}); assert r.status_code==200
def test_matching_sorted():
 r=client.get('/api/matching/1'); assert r.status_code==200 and r.json()[0]['score']>=r.json()[-1]['score']
def test_matching_score_range():
 d=client.get('/api/matching/1').json(); assert all(0<=x['score']<=100 for x in d)
def test_match_has_six_factors(): assert len(client.get('/api/matching/1').json()[0]['breakdown'])==6
def test_creator_trust(): assert client.get('/api/trust/1').json()['tier']=='High trust'
def test_trust_tiers(): assert trust_tier(90)=='High trust' and trust_tier(75)=='Verified' and trust_tier(55)=='Watch' and trust_tier(20)=='Low trust'
def test_login_demo(): assert client.post('/api/auth/login',json={'email':'brand@example.com'}).status_code==200
def test_login_unknown(): assert client.post('/api/auth/login',json={'email':'no@example.com'}).status_code==404
def test_ai_fallback(): assert client.post('/api/ai/generate',json={'product':'Tea'}).json()['source'] in ('fallback','groq')
def test_live_demo(): assert client.post('/api/live-demo').status_code==200
def test_analytics_shape(): assert 'roi_percent' in client.get('/api/analytics').json()
def test_valid_instagram_url(): assert validate_proof_url('https://www.instagram.com/p/abc123/')
def test_invalid_proof_url():
 try: validate_proof_url('https://example.com/post'); assert False
 except ValueError: assert True
def test_campaign_not_found(): assert client.get('/api/matching/999999').status_code==404
def test_products_catalog_fields(): assert {'name','price','stock'} <= set(client.get('/api/products').json()[0])
def test_shipment_missing(): assert client.post('/api/shipments/999999').status_code==404
def test_creator_missing(): assert client.get('/api/trust/999999').status_code==404
def test_matching_explanation(): assert 'scored' in client.get('/api/matching/1').json()[0]['reason']
def test_campaign_validation(): assert client.post('/api/campaigns',json={'title':'x','product_id':1,'budget':-1}).status_code==422
def test_matching_weights_are_transparent():
 result=score_creator({'name':'Sample','niche':'fitness','followers':5000,'engagement':5,'trust_score':100,'platform':'Instagram','completed_collaborations':2,'successful_posts':2},{'niche':'fitness','minimum_followers':5000,'minimum_engagement':3,'target_platform':'Instagram'})
 assert result['score']==100 and sum(result['breakdown'].values())==100
def test_inventory_product_create_persists():
 product=client.post('/api/products',json={'name':'Persistent Test Gift','category':'demo','price':1250,'stock':7}).json()
 assert any(item['id']==product['id'] for item in client.get('/api/products').json())
def test_risk_explanation_is_operational():
 result=client.post('/api/ai/risk-explanation',json={'trust_score':30,'ghosted_campaigns':2}).json()
 assert result['risk']=='HIGH RISK' and 'character' in result['text']
def test_roi_uses_shipped_unit_cost():
 conn=sqlite3.connect(':memory:'); conn.row_factory=sqlite3.Row
 conn.executescript('CREATE TABLE campaigns(id INTEGER,product_id INTEGER); CREATE TABLE creators(id INTEGER); CREATE TABLE products(id INTEGER,unit_cost REAL); CREATE TABLE collaborations(id INTEGER,campaign_id INTEGER,creator_id INTEGER,status TEXT); CREATE TABLE proofs(id INTEGER,verified INTEGER);')
 conn.execute('INSERT INTO campaigns VALUES(1,1)'); conn.execute('INSERT INTO creators VALUES(1)'); conn.execute('INSERT INTO products VALUES(1,100)')
 conn.execute("INSERT INTO collaborations VALUES(1,1,1,'completed')"); conn.executemany('INSERT INTO proofs VALUES(?,1)',[(1,),(2,)])
 result=analytics(conn)
 assert result['spend']==100 and result['ugc_value']==5000 and result['roi_percent']==4900
 conn.close()
def test_postgres_sql_adapter_translates_placeholders_and_ignore():
 query=PostgresConnection._translate('INSERT OR IGNORE INTO users(id,email) VALUES(?,?)')
 assert query=='INSERT INTO users(id,email) VALUES(%s,%s) ON CONFLICT DO NOTHING'
def test_postgres_sql_adapter_translates_sqlite_clamps():
 query=PostgresConnection._translate('UPDATE creators SET trust_score=MAX(0,trust_score-15),score=MIN(100,score+10)')
 assert 'GREATEST(0,trust_score-15)' in query and 'LEAST(100,score+10)' in query
def test_matching_post_body():
 campaign=client.post('/api/campaigns',json={'title':'POST Match Test','product_id':1,'niche':'beauty','minimum_followers':0,'minimum_engagement':0}).json()
 response=client.post('/api/matching',json={'campaign_id':campaign['id']})
 assert response.status_code==200 and response.json()
def test_invite_ship_proof_lifecycle():
 campaign=client.post('/api/campaigns',json={'title':'Lifecycle Test','product_id':1,'niche':'beauty','city':'Hyderabad','budget':2500,'minimum_followers':0,'minimum_engagement':0,'posting_deadline_days':7}).json()
 invitation=client.post(f"/api/campaigns/{campaign['id']}/invite",json={'creator_id':1})
 assert invitation.status_code==200 and invitation.json()['status']=='invited'
 collaboration_id=invitation.json()['id']
 claimed=client.post(f'/api/collaborations/{collaboration_id}/claim')
 assert claimed.status_code==200 and claimed.json()['status']=='claimed'
 shipment=client.post(f'/api/collaborations/{collaboration_id}/ship')
 assert shipment.status_code==200 and shipment.json()['stage']=='order_placed'
 shipment_id=shipment.json()['id']
 client.post(f'/api/shipments/{shipment_id}/advance')
 client.post(f'/api/shipments/{shipment_id}/advance')
 client.post(f'/api/shipments/{shipment_id}/advance')
 delivered=client.post(f'/api/shipments/{shipment_id}/advance').json()
 assert delivered['stage']=='delivered'
 collaboration=client.get('/api/collaborations').json()
 delivered_record=next(item for item in collaboration if item['id']==collaboration_id)
 assert delivered_record['deadline']
 deadline_at=datetime.fromisoformat(delivered_record['deadline'])
 delivered_at=datetime.fromisoformat(delivered_record['delivered_at'])
 assert deadline_at.tzinfo is not None and deadline_at-delivered_at==timedelta(days=7)
 proof=client.post(f'/api/collaborations/{collaboration_id}/proof',json={'collaboration_id':collaboration_id,'url':f'https://www.instagram.com/p/lifecycle-{collaboration_id}/','caption':'Demo post'})
 assert proof.status_code==200 and proof.json()['verified']==0
 pending=client.get('/api/proofs?verified=0').json()
 assert any(item['id']==proof.json()['id'] for item in pending)
 assert client.post('/api/proof/verify',json={'proof_id':proof.json()['id'],'reviewer_id':2}).status_code==403
 assert client.post('/api/proof/verify',json={'proof_id':proof.json()['id'],'reviewer_id':3}).status_code==403
 assert any(item['id']==proof.json()['id'] for item in client.get('/api/proofs?verified=0').json())
 verified=client.post(f"/api/proofs/{proof.json()['id']}/verify")
 assert verified.status_code==200 and verified.json()['verification_mode']=='mock' and verified.json()['verified_by']==1
 assert any(item['id']==proof.json()['id'] and item['verified']==1 and item['verified_by_name']=='Demo Brand' for item in client.get('/api/proofs?verified=1').json())
 creator_dashboard=client.get('/api/dashboard/creator?creator_id=1').json()
 lifecycle=next(item for item in creator_dashboard['collaborations'] if item['id']==collaboration_id)
 assert lifecycle['proof_verified']==1 and lifecycle['proof_id']==proof.json()['id'] and lifecycle['proof_verified_by_name']=='Demo Brand'
 assert lifecycle['tracking_code'] and lifecycle['shipment_stage']=='delivered'
