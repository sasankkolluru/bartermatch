import os
async def generate_campaign(product, audience='Indian customers', goal='awareness'):
    """Groq API when configured; deterministic copy otherwise."""
    key=os.getenv('GROQ_API_KEY')
    model=os.getenv('GROQ_MODEL')
    task=goal.lower()
    if 'match' in task:
        prompt=f'Explain in two concise sentences why this creator may fit the campaign. Cite only provided evidence and do not change or invent a numeric score. Creator: {product}. Campaign: {audience}.'
    elif 'outreach' in task:
        prompt=f'Write a short, warm, personalized creator outreach message. Be transparent that the collaboration is gifted. Creator/context: {product}. Campaign/product/context: {audience}.'
    elif 'insight' in task:
        prompt=f'Give three concise, evidence-based campaign insights. Label any inference as an estimate. Campaign/product: {product}. Available metrics: {audience}.'
    elif 'risk' in task:
        prompt=f'Explain this operational collaboration risk using only the provided platform history. Do not make claims about a person\'s character. History: {product}. Risk signals: {audience}.'
    else:
        prompt=f'Create a concise creator campaign brief with a title, description, and three deliverable bullets. Product: {product}. Audience: {audience}. Goal: {goal}.'
    if key and model:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=20) as client:
                r=await client.post('https://api.groq.com/openai/v1/chat/completions',headers={'Authorization':f'Bearer {key}'},json={'model':model,'messages':[{'role':'user','content':prompt}],'temperature':0.5})
                r.raise_for_status(); return {'text':r.json()['choices'][0]['message']['content'],'source':'groq'}
        except Exception: pass
    if 'match' in task:
        text=f"{product} aligns with the campaign context through the listed audience attributes. This explanation reflects supplied profile data only; the numeric match score is deterministic. Campaign context: {audience}."
    elif 'outreach' in task:
        text=f"Hi! We think your content could be a good fit for {audience}. We'd love to offer a gifted collaboration featuring {product}; if interested, we can share the deliverables and timeline."
    elif 'insight' in task:
        text=f"Campaign insights (demo estimates): review completion against the posting deadline; compare verified content value with shipped product cost; prioritize creators with stronger on-time collaboration history. Metrics context: {audience}."
    elif 'risk' in task:
        text=f"Operational risk summary based only on platform events: {audience}. This is an estimate for collaboration operations, not a claim about the creator's character."
    else:
        text=f"Campaign: {product} — {goal.title()}\nAudience: {audience}\n• Share an authentic first-use story.\n• Show the product in a practical daily routine.\n• Add a clear call to action and disclose the gifted partnership."
    return {'text':text,'source':'fallback'}
