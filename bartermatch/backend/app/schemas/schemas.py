from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
class CampaignCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    product_id: int
    niche: str = ""
    city: str = ""
    budget: float = Field(default=0, ge=0)
    description: str = Field(default="", max_length=2000)
    minimum_followers: int = Field(default=0, ge=0)
    minimum_engagement: float = Field(default=0, ge=0, le=100)
    posting_deadline_days: int = Field(default=7, ge=1, le=90)
    target_platform: str = Field(default="Instagram", max_length=40)
    deliverables: str = Field(default="1 social post", max_length=500)

class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(default="", max_length=80)
    price: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    description: str = Field(default="", max_length=1000)

class InviteCreate(BaseModel):
    creator_id: int

class MatchRequest(BaseModel):
    campaign_id: int

class ClaimCreate(BaseModel):
    creator_id: int

class ProofVerify(BaseModel):
    proof_id: int
    reviewer_id: int = Field(default=1, ge=1)

class RiskRequest(BaseModel):
    trust_score: int = Field(default=70, ge=0, le=100)
    ghosted_campaigns: int = Field(default=0, ge=0)
    missed_deadlines: int = Field(default=0, ge=0)
    duplicate_proofs: int = Field(default=0, ge=0)
class ProofCreate(BaseModel):
    collaboration_id: int
    url: str
    caption: str = ""
class LoginRequest(BaseModel):
    email: str
    role: str = "brand"
class GenerateRequest(BaseModel):
    product: str
    audience: str = "Indian customers"
    goal: str = "awareness"
