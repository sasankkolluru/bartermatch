def analytics(conn):
    campaigns=conn.execute('SELECT COUNT(*) n FROM campaigns').fetchone()['n']
    creators=conn.execute('SELECT COUNT(*) n FROM creators').fetchone()['n']
    collaborations=conn.execute('SELECT COUNT(*) n FROM collaborations').fetchone()['n']
    spend=conn.execute("""SELECT COALESCE(SUM(p.unit_cost),0) n FROM collaborations co
        JOIN campaigns c ON c.id=co.campaign_id JOIN products p ON p.id=c.product_id
        WHERE co.status IN ('shipped','delivered','proof_submitted','completed','deadline_missed')""").fetchone()['n']
    proofs=conn.execute('SELECT COUNT(*) n FROM proofs WHERE verified=1').fetchone()['n']
    # Illustrative earned-media value: ₹2,500 per verified content proof.
    ugc_value=proofs*2500
    roi=((ugc_value-spend)/spend*100) if spend else 0
    return {'campaigns':campaigns,'creators':creators,'collaborations':collaborations,'spend':round(spend,2),'verified_ugc':proofs,'ugc_value':round(ugc_value,2),'roi_percent':round(roi,1)}
