def score_creator(creator, campaign):
    """Six weighted, deterministic factors; result is always 0–100."""
    target_niche = campaign.get('niche', '').strip().lower()
    creator_niche = creator['niche'].strip().lower()
    niche = 30 if target_niche and target_niche == creator_niche else 18 if target_niche and target_niche in creator_niche else 8 if not target_niche else 0

    minimum_engagement = float(campaign.get('minimum_engagement', 0) or 0)
    engagement_rate = float(creator['engagement'] or 0)
    engagement = round(20 * min(engagement_rate / minimum_engagement, 1)) if minimum_engagement else round(20 * min(engagement_rate / 10, 1))

    minimum_followers = int(campaign.get('minimum_followers', 0) or 0)
    follower_count = int(creator['followers'] or 0)
    if minimum_followers:
        ratio = follower_count / minimum_followers
        followers = round(15 * min(ratio, 1)) if ratio < 1 else round(15 * max(0.5, 1 - min(ratio - 1, 10) / 20))
    else:
        followers = round(15 * min(follower_count / 100000, 1))

    trust = round(15 * max(0, min(int(creator['trust_score'] or 0), 100)) / 100)
    target_platform = campaign.get('target_platform', '').strip().lower()
    platform = 10 if target_platform and target_platform == creator['platform'].strip().lower() else 5 if not target_platform else 0
    completed = int(creator.get('completed_collaborations', 0) or 0)
    successful = int(creator.get('successful_posts', 0) or 0)
    history = round(10 * successful / completed) if completed else 5

    parts = {
        'niche_similarity': niche,
        'engagement': engagement,
        'follower_suitability': followers,
        'trust': trust,
        'platform': platform,
        'historical_performance': history,
    }
    total = max(0, min(100, sum(parts.values())))
    reason = f"{creator['name']} scored {total}/100 across niche alignment, engagement, audience suitability, operational trust, platform, and collaboration history."
    return {'score': total, 'breakdown': parts, 'reason': reason}
