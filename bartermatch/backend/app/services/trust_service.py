def trust_tier(score):
    if score >= 80: return 'High trust'
    if score >= 60: return 'Verified'
    if score >= 40: return 'Watch'
    return 'Low trust'

def creator_trust(creator, completed=0, verified_proofs=0, disputes=0):
    adjustments=min(completed,10)*1 + min(verified_proofs,10)*1 - disputes*8
    score=max(0,min(100,int(creator.get('trust_score',70) + adjustments)))
    return {'score':score,'tier':trust_tier(score)}
