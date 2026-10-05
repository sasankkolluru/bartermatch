import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException

from app.database.connection import session
from app.schemas.schemas import (
    CampaignCreate,
    ClaimCreate,
    GenerateRequest,
    InviteCreate,
    LoginRequest,
    MatchRequest,
    ProductCreate,
    ProofCreate,
    ProofVerify,
    RiskRequest,
)
from app.services.analytics_service import analytics
from app.services.groq_service import generate_campaign
from app.services.matching_service import score_creator
from app.services.proof_service import check_duplicate, validate_proof_url
from app.services.shipping_service import MockCourier, STAGES
from app.services.trust_service import creator_trust

router = APIRouter(prefix="/api")


def rows(conn, sql, args=()):
    return [dict(row) for row in conn.execute(sql, args).fetchall()]


def row(conn, sql, args=(), missing="Record not found"):
    result = conn.execute(sql, args).fetchone()
    if result is None:
        raise HTTPException(404, missing)
    return dict(result)


def apply_deadline_misses(conn):
    now = datetime.now(timezone.utc)
    overdue = rows(
        conn,
        """SELECT co.id,co.creator_id FROM collaborations co
           WHERE co.status='delivered' AND co.deadline IS NOT NULL AND co.deadline<?
           AND NOT EXISTS (SELECT 1 FROM proofs pr WHERE pr.collaboration_id=co.id)""",
        (now.isoformat(),),
    )
    for collaboration in overdue:
        conn.execute("UPDATE collaborations SET status='deadline_missed' WHERE id=?", (collaboration["id"],))
        conn.execute(
            "UPDATE creators SET trust_score=MAX(0,trust_score-15),ghosted_campaigns=ghosted_campaigns+1 WHERE id=?",
            (collaboration["creator_id"],),
        )
        conn.execute(
            "INSERT INTO trust_events(creator_id,event_type,score_change,reason) VALUES(?,?,?,?)",
            (collaboration["creator_id"], "deadline_missed", -15, "Posting deadline passed without a proof submission."),
        )


def proof_matches_platform(platform, hostname):
    platform = platform.lower()
    hostname = hostname.lower()
    if platform == "instagram":
        return hostname == "instagram.com" or hostname.endswith(".instagram.com")
    if platform == "youtube":
        return hostname == "youtube.com" or hostname.endswith(".youtube.com") or hostname == "youtu.be"
    if platform == "tiktok":
        return hostname == "tiktok.com" or hostname.endswith(".tiktok.com")
    return platform in hostname


def match_campaign(conn, campaign):
    matches = [
        {"creator": creator, **score_creator(creator, campaign)}
        for creator in rows(conn, "SELECT * FROM creators")
        if creator["followers"] >= campaign.get("minimum_followers", 0)
        and creator["engagement"] >= campaign.get("minimum_engagement", 0)
        and (
            not campaign.get("target_platform")
            or creator["platform"].lower() == campaign["target_platform"].lower()
        )
    ]
    return sorted(matches, key=lambda item: item["score"], reverse=True)


@router.get("/health")
def health():
    with session() as conn:
        return {"status": "ok", "app": "BarterMatch", "storage": conn.dialect}


@router.post("/auth/login")
@router.post("/auth/demo-login")
def login(body: LoginRequest):
    with session() as conn:
        user = conn.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
        if not user:
            raise HTTPException(404, "Demo user not found; use brand@example.com or asha@example.com")
        user_data = dict(user)
        if user_data["role"] == "creator":
            creator = conn.execute("SELECT id FROM creators WHERE name=?", (user_data["name"],)).fetchone()
            user_data["creator_id"] = creator["id"] if creator else 1
        return {"user": user_data, "token": "demo-session-token"}


@router.get("/products")
def products():
    with session() as conn:
        return rows(conn, "SELECT * FROM products ORDER BY id")


@router.post("/products")
def create_product(body: ProductCreate):
    with session() as conn:
        cursor = conn.execute(
            "INSERT INTO products(name,category,price,stock,description,unit_cost) VALUES(?,?,?,?,?,?) RETURNING id",
            (body.name.strip(), body.category.strip(), body.price, body.stock, body.description.strip(), body.price),
        )
        return row(conn, "SELECT * FROM products WHERE id=?", (cursor.fetchone()["id"],))


@router.get("/creators")
def creators():
    with session() as conn:
        return rows(conn, "SELECT * FROM creators ORDER BY trust_score DESC")


@router.get("/creators/{creator_id}")
def get_creator(creator_id: int):
    with session() as conn:
        creator = row(conn, "SELECT * FROM creators WHERE id=?", (creator_id,), "Creator not found")
        creator["trust"] = creator_trust(creator)
        creator["trust_events"] = rows(
            conn,
            "SELECT event_type,score_change,reason,created_at FROM trust_events WHERE creator_id=? ORDER BY id DESC",
            (creator_id,),
        )
        return creator


@router.get("/campaigns")
def campaigns():
    with session() as conn:
        return rows(conn, "SELECT * FROM campaigns ORDER BY id DESC")


@router.post("/campaigns")
def create_campaign(body: CampaignCreate):
    with session() as conn:
        if not conn.execute("SELECT id FROM products WHERE id=?", (body.product_id,)).fetchone():
            raise HTTPException(404, "Product not found")
        cursor = conn.execute(
            """INSERT INTO campaigns(
                brand_id,title,product_id,niche,city,budget,description,minimum_followers,
                minimum_engagement,posting_deadline_days,target_platform,deliverables
            ) VALUES(1,?,?,?,?,?,?,?,?,?,?,?) RETURNING id""",
            (
                body.title.strip(), body.product_id, body.niche.strip(), body.city.strip(), body.budget,
                body.description.strip(), body.minimum_followers, body.minimum_engagement,
                body.posting_deadline_days, body.target_platform.strip(), body.deliverables.strip(),
            ),
        )
        return row(conn, "SELECT * FROM campaigns WHERE id=?", (cursor.fetchone()["id"],))


@router.post("/campaigns/{campaign_id}/invite")
def invite_creator(campaign_id: int, body: InviteCreate):
    with session() as conn:
        campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
        if not campaign:
            raise HTTPException(404, "Campaign not found")
        creator = conn.execute("SELECT * FROM creators WHERE id=?", (body.creator_id,)).fetchone()
        if not creator:
            raise HTTPException(404, "Creator not found")
        existing = conn.execute(
            "SELECT id FROM collaborations WHERE campaign_id=? AND creator_id=? AND status!='rejected'",
            (campaign_id, body.creator_id),
        ).fetchone()
        if existing:
            raise HTTPException(409, "This creator already has a collaboration for the campaign")
        cursor = conn.execute(
            "INSERT INTO collaborations(campaign_id,creator_id,status,agreed_value) VALUES(?,?,?,?) RETURNING id",
            (campaign_id, body.creator_id, "invited", campaign["budget"]),
        )
        return row(conn, "SELECT * FROM collaborations WHERE id=?", (cursor.fetchone()["id"],))


@router.post("/campaigns/{campaign_id}/claim")
def claim_campaign(campaign_id: int, body: ClaimCreate):
    with session() as conn:
        campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
        if not campaign:
            raise HTTPException(404, "Campaign not found")
        creator = conn.execute("SELECT * FROM creators WHERE id=?", (body.creator_id,)).fetchone()
        if not creator:
            raise HTTPException(404, "Creator not found")
        product = conn.execute("SELECT * FROM products WHERE id=?", (campaign["product_id"],)).fetchone()
        if not product or product["stock"] <= 0:
            raise HTTPException(409, "This product is currently out of stock")
        if creator["followers"] < campaign["minimum_followers"] or creator["engagement"] < campaign["minimum_engagement"]:
            raise HTTPException(409, "Creator does not meet this campaign's audience requirements")
        if campaign["target_platform"] and creator["platform"].lower() != campaign["target_platform"].lower():
            raise HTTPException(409, "Creator platform does not match this campaign")
        existing = conn.execute(
            "SELECT id FROM collaborations WHERE campaign_id=? AND creator_id=? AND status NOT IN ('rejected','cancelled')",
            (campaign_id, body.creator_id),
        ).fetchone()
        if existing:
            raise HTTPException(409, "You already have a collaboration for this campaign")
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE products SET stock=stock-1,reserved_units=reserved_units+1 WHERE id=?", (product["id"],))
        cursor = conn.execute(
            "INSERT INTO collaborations(campaign_id,creator_id,status,agreed_value,claimed_at) VALUES(?,?,?,?,?) RETURNING id",
            (campaign_id, body.creator_id, "claimed", product["price"], now),
        )
        return row(conn, "SELECT * FROM collaborations WHERE id=?", (cursor.fetchone()["id"],))


@router.get("/matching/{campaign_id}")
def match(campaign_id: int):
    with session() as conn:
        campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
        if not campaign:
            raise HTTPException(404, "Campaign not found")
        return match_campaign(conn, dict(campaign))


@router.post("/matching")
def post_matching(body: MatchRequest):
    return match(body.campaign_id)


@router.post("/collaborations")
def collaborate(campaign_id: int, creator_id: int):
    return invite_creator(campaign_id, InviteCreate(creator_id=creator_id))


@router.get("/collaborations")
def collabs():
    with session() as conn:
        return rows(
            conn,
            """SELECT co.*,cr.name creator,cr.handle,c.title campaign,p.name product
               FROM collaborations co JOIN creators cr ON cr.id=co.creator_id
               JOIN campaigns c ON c.id=co.campaign_id JOIN products p ON p.id=c.product_id
               ORDER BY co.id DESC""",
        )


@router.post("/collaborations/{collaboration_id}/claim")
def claim_invitation(collaboration_id: int):
    with session() as conn:
        collab = conn.execute("SELECT * FROM collaborations WHERE id=?", (collaboration_id,)).fetchone()
        if not collab:
            raise HTTPException(404, "Collaboration not found")
        if collab["status"] != "invited":
            raise HTTPException(409, "This invitation is no longer available")
        product_id = conn.execute("SELECT product_id FROM campaigns WHERE id=?", (collab["campaign_id"],)).fetchone()["product_id"]
        product = conn.execute("SELECT stock FROM products WHERE id=?", (product_id,)).fetchone()
        if product["stock"] <= 0:
            raise HTTPException(409, "This product is currently out of stock")
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE products SET stock=stock-1,reserved_units=reserved_units+1 WHERE id=?", (product_id,))
        conn.execute("UPDATE collaborations SET status='claimed',claimed_at=? WHERE id=?", (now, collaboration_id))
        return row(conn, "SELECT * FROM collaborations WHERE id=?", (collaboration_id,))


@router.post("/collaborations/{collaboration_id}/ship")
@router.post("/shipments/{collaboration_id}")
def ship_collaboration(collaboration_id: int):
    with session() as conn:
        collab = conn.execute("SELECT * FROM collaborations WHERE id=?", (collaboration_id,)).fetchone()
        if not collab:
            raise HTTPException(404, "Collaboration not found")
        if collab["status"] not in ("claimed", "shipped"):
            raise HTTPException(409, "Creator must claim the product before shipping")
        if os.getenv("SHIPPING_MODE", "mock").lower() != "mock":
            raise HTTPException(503, "Only mock shipping is configured; no live courier integration is enabled")
        existing = conn.execute("SELECT * FROM shipments WHERE collaboration_id=?", (collaboration_id,)).fetchone()
        if existing:
            return dict(existing)
        now = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute("INSERT INTO shipments(collaboration_id) VALUES(?) RETURNING id", (collaboration_id,))
        shipment_id = cursor.fetchone()["id"]
        data = MockCourier().create_shipment(shipment_id)
        conn.execute(
            "UPDATE shipments SET provider=?,tracking_code=?,stage=?,dispatched_at=? WHERE id=?",
            ("Mock", data["tracking_code"], data["stage"], None, shipment_id),
        )
        return row(conn, "SELECT * FROM shipments WHERE id=?", (shipment_id,))


@router.post("/proofs")
@router.post("/collaborations/{collaboration_id}/proof")
def submit_proof(body: ProofCreate, collaboration_id: int | None = None):
    target_id = collaboration_id or body.collaboration_id
    try:
        validate_proof_url(body.url)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    with session() as conn:
        if check_duplicate(conn, body.url):
            raise HTTPException(409, "This proof URL was already submitted.")
        collab = conn.execute("SELECT * FROM collaborations WHERE id=?", (target_id,)).fetchone()
        if not collab:
            raise HTTPException(404, "Collaboration not found")
        if collab["status"] not in ("delivered", "deadline_missed"):
            raise HTTPException(409, "Proof can be submitted after delivery")
        proof_platform = urlparse(body.url).hostname or ""
        campaign = conn.execute("SELECT target_platform FROM campaigns WHERE id=?", (collab["campaign_id"],)).fetchone()
        platform = campaign["target_platform"].lower()
        if platform and not proof_matches_platform(platform, proof_platform):
            raise HTTPException(400, "Proof URL platform does not match the campaign platform")
        is_late = bool(collab["deadline"] and datetime.fromisoformat(collab["deadline"]) < datetime.now(timezone.utc))
        if is_late and collab["status"] != "deadline_missed":
            conn.execute("UPDATE creators SET trust_score=MAX(0,trust_score-15),ghosted_campaigns=ghosted_campaigns+1 WHERE id=?", (collab["creator_id"],))
            conn.execute("INSERT INTO trust_events(creator_id,event_type,score_change,reason) VALUES(?,?,?,?)", (collab["creator_id"], "deadline_missed", -15, "Proof was submitted after the posting deadline."))
        try:
            cursor = conn.execute(
                "INSERT INTO proofs(collaboration_id,url,caption) VALUES(?,?,?) RETURNING id",
                (target_id, body.url.strip(), body.caption.strip()),
            )
        except Exception as error:
            raise HTTPException(409, "This proof URL was already submitted.") from error
        conn.execute("UPDATE collaborations SET status='proof_submitted' WHERE id=?", (target_id,))
        return row(conn, "SELECT * FROM proofs WHERE id=?", (cursor.fetchone()["id"],))


@router.get("/proofs")
def list_proofs(verified: int | None = None, brand_id: int | None = None):
    with session() as conn:
        sql = """SELECT pr.*,co.creator_id,cr.name creator,cr.handle,c.title campaign,p.name product,
                        co.deadline,u.name verified_by_name
                 FROM proofs pr JOIN collaborations co ON co.id=pr.collaboration_id
                 JOIN creators cr ON cr.id=co.creator_id JOIN campaigns c ON c.id=co.campaign_id
                 JOIN products p ON p.id=c.product_id LEFT JOIN users u ON u.id=pr.verified_by"""
        filters = []
        args = []
        if verified is not None:
            filters.append("pr.verified=?")
            args.append(verified)
        if brand_id is not None:
            filters.append("c.brand_id=?")
            args.append(brand_id)
        if filters:
            sql += " WHERE " + " AND ".join(filters)
        return rows(conn, sql + " ORDER BY pr.submitted_at DESC", args)


@router.post("/proofs/{proof_id}/verify")
def verify_proof_by_id(proof_id: int):
    return verify_proof(ProofVerify(proof_id=proof_id))


@router.post("/proof/verify")
def verify_proof(body: ProofVerify):
    with session() as conn:
        proof = conn.execute("SELECT * FROM proofs WHERE id=?", (body.proof_id,)).fetchone()
        if not proof:
            raise HTTPException(404, "Proof not found")
        reviewer = conn.execute("SELECT id,role FROM users WHERE id=?", (body.reviewer_id,)).fetchone()
        if not reviewer or reviewer["role"] != "brand":
            raise HTTPException(403, "Only a brand workspace can approve a proof")
        campaign_owner = conn.execute(
            """SELECT c.brand_id FROM proofs pr JOIN collaborations co ON co.id=pr.collaboration_id
               JOIN campaigns c ON c.id=co.campaign_id WHERE pr.id=?""",
            (body.proof_id,),
        ).fetchone()
        if not campaign_owner or campaign_owner["brand_id"] != body.reviewer_id:
            raise HTTPException(403, "Only the campaign's brand owner can approve this proof")
        if proof["verified"]:
            return {"proof": dict(proof), "status": "verified", "verification_mode": "mock", "verified_by": proof["verified_by"]}
        collab = conn.execute("SELECT * FROM collaborations WHERE id=?", (proof["collaboration_id"],)).fetchone()
        creator = conn.execute("SELECT * FROM creators WHERE id=?", (collab["creator_id"],)).fetchone()
        now = datetime.now(timezone.utc).isoformat()
        late = bool(collab["deadline"] and datetime.fromisoformat(collab["deadline"]) < datetime.now(timezone.utc))
        score_change = 5 if late else 10
        new_score = max(0, min(100, creator["trust_score"] + score_change))
        approval = conn.execute(
            "UPDATE proofs SET verified=1,verified_by=?,verified_at=? WHERE id=? AND verified=0 RETURNING id",
            (body.reviewer_id, now, body.proof_id),
        ).fetchone()
        if not approval:
            current = row(conn, "SELECT * FROM proofs WHERE id=?", (body.proof_id,))
            return {"proof": current, "status": "verified", "verification_mode": "mock", "verified_by": current["verified_by"]}
        conn.execute(
            "UPDATE collaborations SET status='completed',completed_at=? WHERE id=?",
            (now, collab["id"]),
        )
        conn.execute(
            "UPDATE creators SET trust_score=?,completed_collaborations=completed_collaborations+1,successful_posts=successful_posts+1 WHERE id=?",
            (new_score, creator["id"]),
        )
        conn.execute(
            "INSERT INTO trust_events(creator_id,event_type,score_change,reason) VALUES(?,?,?,?)",
            (creator["id"], "proof_verified", score_change, "Mock proof validation completed; no social platform was scraped."),
        )
        updated = row(conn, "SELECT * FROM proofs WHERE id=?", (body.proof_id,))
        return {"proof": updated, "status": "verified", "verification_mode": "mock", "verified_by": body.reviewer_id, "trust_score": new_score}


@router.get("/analytics")
def get_analytics():
    with session() as conn:
        return analytics(conn)


@router.get("/dashboard/brand")
def brand_dashboard():
    with session() as conn:
        apply_deadline_misses(conn)
        metrics = analytics(conn)
        metrics["inventory_value"] = conn.execute("SELECT COALESCE(SUM(price*stock),0) n FROM products").fetchone()["n"]
        metrics["products_shipped"] = conn.execute("SELECT COALESCE(SUM(shipped_units),0) n FROM products").fetchone()["n"]
        total_collaborations = conn.execute("SELECT COUNT(*) n FROM collaborations").fetchone()["n"]
        ghosted = conn.execute("SELECT COUNT(*) n FROM collaborations WHERE status='deadline_missed'").fetchone()["n"]
        metrics["ghosting_rate"] = round(ghosted / total_collaborations * 100, 1) if total_collaborations else 0
        metrics["ghosted_collaborations"] = ghosted
        metrics["estimated"] = True
        metrics["shipments"] = rows(conn, "SELECT stage,COUNT(*) count FROM shipments GROUP BY stage")
        metrics["campaigns_list"] = rows(conn, "SELECT id,title,status FROM campaigns ORDER BY id DESC")
        return metrics


@router.get("/dashboard/creator")
def creator_dashboard(creator_id: int = 1):
    with session() as conn:
        apply_deadline_misses(conn)
        creator = row(conn, "SELECT * FROM creators WHERE id=?", (creator_id,), "Creator not found")
        collaborations = rows(
            conn,
                """SELECT co.*,c.title campaign,c.niche,c.city,c.posting_deadline_days,p.name product,p.price,
                                pr.id proof_id,pr.url proof_url,pr.verified proof_verified,
                                pr.verified_by proof_verified_by,pr.verified_at,reviewer.name proof_verified_by_name,
                             s.tracking_code,s.stage shipment_stage,s.provider courier
               FROM collaborations co JOIN campaigns c ON c.id=co.campaign_id
                    JOIN products p ON p.id=c.product_id LEFT JOIN proofs pr ON pr.collaboration_id=co.id
                        LEFT JOIN users reviewer ON reviewer.id=pr.verified_by
                    LEFT JOIN shipments s ON s.collaboration_id=co.id
                    WHERE co.creator_id=? ORDER BY co.id DESC""",
            (creator_id,),
        )
        completed_items = [item for item in collaborations if item["status"] == "completed" and item["completed_at"] and item["deadline"]]
        on_time_items = [item for item in completed_items if datetime.fromisoformat(item["completed_at"]) <= datetime.fromisoformat(item["deadline"])]
        return {
            "creator": creator,
            "active_collaborations": sum(item["status"] != "completed" for item in collaborations),
            "completed_collaborations": creator["completed_collaborations"],
            "on_time_rate": round(len(on_time_items) / len(completed_items) * 100) if completed_items else 0,
            "collaborations": collaborations,
            "available_campaigns": rows(
                conn,
                """SELECT c.*,p.name product,p.price FROM campaigns c JOIN products p ON p.id=c.product_id
                   WHERE c.status='active' AND p.stock>0 AND NOT EXISTS (
                       SELECT 1 FROM collaborations co WHERE co.campaign_id=c.id AND co.creator_id=?
                       AND co.status NOT IN ('rejected','cancelled')
                   ) ORDER BY c.id DESC""",
                (creator_id,),
            ),
        }


@router.get("/trust/{creator_id}")
def trust(creator_id: int):
    with session() as conn:
        creator = conn.execute("SELECT * FROM creators WHERE id=?", (creator_id,)).fetchone()
        if not creator:
            raise HTTPException(404, "Creator not found")
        return creator_trust(dict(creator))


@router.post("/ai/generate")
async def ai(body: GenerateRequest):
    return await generate_campaign(body.product, body.audience, body.goal)


@router.post("/ai/campaign-description")
async def ai_campaign_description(body: GenerateRequest):
    return await generate_campaign(body.product, body.audience, body.goal)


@router.post("/ai/match-explanation")
async def ai_match_explanation(body: GenerateRequest):
    return await generate_campaign(body.product, body.audience, "brief natural-language creator match explanation")


@router.post("/ai/outreach")
async def ai_outreach(body: GenerateRequest):
    result = await generate_campaign(body.product, body.audience, "personalized creator outreach")
    return {"text": result["text"], "source": result["source"]}


@router.post("/ai/insights")
async def ai_insights(body: GenerateRequest):
    result = await generate_campaign(body.product, body.audience, "campaign performance insights")
    return {"text": result["text"], "source": result["source"]}


@router.post("/ai/risk-explanation")
async def ai_risk_explanation(body: RiskRequest):
    signals = []
    if body.ghosted_campaigns:
        signals.append(f"{body.ghosted_campaigns} deadline-missed collaboration(s)")
    if body.missed_deadlines:
        signals.append(f"{body.missed_deadlines} late proof submission(s)")
    if body.duplicate_proofs:
        signals.append(f"{body.duplicate_proofs} duplicate proof attempt(s)")
    if body.trust_score < 40 or body.ghosted_campaigns >= 2 or body.duplicate_proofs:
        risk = "HIGH RISK"
    elif body.trust_score < 60 or body.ghosted_campaigns or body.missed_deadlines:
        risk = "MEDIUM RISK"
    else:
        risk = "LOW RISK"
    context = "; ".join(signals) or "no recorded risk events"
    generated = await generate_campaign("creator collaboration history", context, "operational risk explanation")
    return {"risk": risk, "reasons": signals or ["No recorded risk signals."], "text": generated["text"], "source": generated["source"]}


@router.post("/live-demo")
async def live_demo():
    with session() as conn:
        campaign_row = conn.execute("SELECT * FROM campaigns ORDER BY id LIMIT 1").fetchone()
        if not campaign_row:
            raise HTTPException(404, "Create a campaign first")
        campaign = dict(campaign_row)
        matches = match_campaign(conn, campaign)
        if not matches:
            raise HTTPException(409, "No creators meet this campaign's requirements")
        creator = matches[0]["creator"]
        product = conn.execute("SELECT * FROM products WHERE id=?", (campaign["product_id"],)).fetchone()
        if product["stock"] <= 0:
            raise HTTPException(409, "No product stock is available for the live demo")
        generated = await generate_campaign(product["name"], f"{campaign['niche']} creators", "campaign description")
        if not campaign.get("description"):
            campaign["description"] = generated["text"]
            conn.execute("UPDATE campaigns SET description=? WHERE id=?", (generated["text"], campaign["id"]))
        now = datetime.now(timezone.utc)
        cursor = conn.execute(
            "INSERT INTO collaborations(campaign_id,creator_id,status,agreed_value,claimed_at) VALUES(?,?,?,?,?) RETURNING id",
            (campaign["id"], creator["id"], "claimed", product["price"], now.isoformat()),
        )
        collaboration_id = cursor.fetchone()["id"]
        conn.execute("UPDATE products SET stock=stock-1,shipped_units=shipped_units+1 WHERE id=?", (product["id"],))
        shipment_cursor = conn.execute("INSERT INTO shipments(collaboration_id,provider,tracking_code,stage,dispatched_at) VALUES(?,?,?,?,?) RETURNING id", (collaboration_id, "Mock", f"BM{collaboration_id:06d}", "delivered", now.isoformat()))
        shipment_id = shipment_cursor.fetchone()["id"]
        deadline = (now + timedelta(days=campaign["posting_deadline_days"])).isoformat()
        conn.execute("UPDATE shipments SET delivered_at=? WHERE id=?", (now.isoformat(), shipment_id))
        conn.execute("UPDATE collaborations SET status='delivered',shipped_at=?,delivered_at=?,deadline=? WHERE id=?", (now.isoformat(), now.isoformat(), deadline, collaboration_id))
        proof_cursor = conn.execute("INSERT INTO proofs(collaboration_id,url,caption,verified) VALUES(?,?,?,1) RETURNING id", (collaboration_id, f"https://www.instagram.com/p/bm-demo-{collaboration_id}/", "Synthetic demo proof; no platform verification performed."))
        proof_id = proof_cursor.fetchone()["id"]
        conn.execute("UPDATE collaborations SET status='completed',completed_at=? WHERE id=?", (now.isoformat(), collaboration_id))
        conn.execute("UPDATE creators SET trust_score=MIN(100,trust_score+10),completed_collaborations=completed_collaborations+1,successful_posts=successful_posts+1 WHERE id=?", (creator["id"],))
        conn.execute("INSERT INTO trust_events(creator_id,event_type,score_change,reason) VALUES(?,?,?,?)", (creator["id"], "demo_proof_verified", 10, "Synthetic one-click demo lifecycle."))
        result = analytics(conn)
        result["estimated"] = True
        return {
            "campaign": campaign,
            "collaboration_id": collaboration_id,
            "shipment_id": shipment_id,
            "proof_id": proof_id,
            "ai_source": generated["source"],
            "generated_brief": generated["text"],
            "ranked_creators": matches,
            "analytics": result,
            "message": "Live demo completed: match, claim, mock delivery, proof, and trust score update. No social platform was contacted.",
        }


@router.get("/shipments")
def shipments():
    with session() as conn:
        return rows(
            conn,
            """SELECT s.*,co.creator_id,cr.name creator,c.title campaign,p.name product,co.deadline
               FROM shipments s JOIN collaborations co ON co.id=s.collaboration_id
               JOIN creators cr ON cr.id=co.creator_id JOIN campaigns c ON c.id=co.campaign_id
               JOIN products p ON p.id=c.product_id ORDER BY s.id DESC""",
        )


@router.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: int):
    with session() as conn:
        return row(conn, "SELECT * FROM shipments WHERE id=?", (shipment_id,), "Shipment not found")


@router.post("/shipments/{shipment_id}/advance")
def advance(shipment_id: int):
    with session() as conn:
        shipment = conn.execute("SELECT * FROM shipments WHERE id=?", (shipment_id,)).fetchone()
        if not shipment:
            raise HTTPException(404, "Shipment not found")
        stage = MockCourier().advance(shipment["stage"])
        now = datetime.now(timezone.utc)
        delivered_at = now.isoformat() if stage == "delivered" else shipment["delivered_at"]
        dispatched_at = now.isoformat() if stage == "shipped" else shipment["dispatched_at"]
        conn.execute("UPDATE shipments SET stage=?,updated_at=?,dispatched_at=?,delivered_at=? WHERE id=?", (stage, now.isoformat(), dispatched_at, delivered_at, shipment_id))
        if stage == "shipped":
            conn.execute("UPDATE collaborations SET status='shipped',shipped_at=? WHERE id=?", (now.isoformat(), shipment["collaboration_id"]))
            conn.execute("UPDATE products SET reserved_units=MAX(0,reserved_units-1),shipped_units=shipped_units+1 WHERE id=(SELECT product_id FROM campaigns c JOIN collaborations co ON co.campaign_id=c.id WHERE co.id=?)", (shipment["collaboration_id"],))
        elif stage == "delivered":
            collab = conn.execute("SELECT * FROM collaborations WHERE id=?", (shipment["collaboration_id"],)).fetchone()
            days = conn.execute("SELECT posting_deadline_days FROM campaigns WHERE id=?", (collab["campaign_id"],)).fetchone()["posting_deadline_days"]
            deadline = (now + timedelta(days=days)).isoformat()
            conn.execute("UPDATE collaborations SET status='delivered',delivered_at=?,deadline=? WHERE id=?", (now.isoformat(), deadline, collab["id"]))
        return row(conn, "SELECT * FROM shipments WHERE id=?", (shipment_id,))