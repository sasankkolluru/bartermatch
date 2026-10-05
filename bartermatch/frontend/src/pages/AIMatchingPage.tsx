import React, { useEffect, useState } from "react";
import { api } from "../services/api";

export default function AIMatchingPage() {
	const [campaigns, setCampaigns] = useState<any[]>([]);
	const [campaignId, setCampaignId] = useState("");
	const [matches, setMatches] = useState<any[]>([]);
	const [explanations, setExplanations] = useState<Record<number, string>>({});
	const [outreachMessages, setOutreachMessages] = useState<Record<number, string>>({});
	const [query, setQuery] = useState("");
	const [busyId, setBusyId] = useState<number | null>(null);
	const [explainId, setExplainId] = useState<number | null>(null);
	const [outreachId, setOutreachId] = useState<number | null>(null);
	const [message, setMessage] = useState("");

	useEffect(() => {
		api<any[]>("/campaigns").then((items) => {
			setCampaigns(items);
			if (items.length) setCampaignId(String(items[0].id));
		}).catch((error) => setMessage(error.message));
	}, []);

	useEffect(() => {
		if (!campaignId) return;
		setMatches([]);
		api<any[]>(`/matching/${campaignId}`).then(setMatches).catch((error) => setMessage(error.message));
	}, [campaignId]);

	const invite = async (creatorId: number) => {
		setBusyId(creatorId);
		setMessage("");
		try {
			await api(`/campaigns/${campaignId}/invite`, { method: "POST", body: JSON.stringify({ creator_id: creatorId }) });
			setMessage("Creator invited. The invitation is saved in collaborations.");
		} catch (error: any) {
			setMessage(error.message || "Invitation could not be saved.");
		} finally {
			setBusyId(null);
		}
	};

	const explainMatch = async (match: any) => {
		setExplainId(match.creator.id);
		try {
			const result = await api<any>("/ai/match-explanation", {
				method: "POST",
				body: JSON.stringify({ product: `${match.creator.name} (${match.creator.handle}), ${match.creator.niche}, ${match.creator.followers} followers, ${match.creator.engagement}% engagement, trust ${match.creator.trust_score}/100`, audience: `Campaign ${campaigns.find((campaign) => String(campaign.id) === campaignId)?.title}; target niche and location requirements`, goal: "explain the deterministic creator match" }),
			});
			setExplanations((current) => ({ ...current, [match.creator.id]: `${result.text} (${result.source === "groq" ? "Groq" : "fallback"})` }));
		} catch (error: any) {
			setMessage(error.message || "Could not generate an explanation.");
		} finally {
			setExplainId(null);
		}
	};

	const generateOutreach = async (match: any) => {
		setOutreachId(match.creator.id);
		try {
			const campaign = campaigns.find((item) => String(item.id) === campaignId);
			const result = await api<any>("/ai/outreach", {
				method: "POST",
				body: JSON.stringify({ product: `${match.creator.name} (${match.creator.handle})`, audience: `${campaign?.title || "gifted product campaign"}; creator niche ${match.creator.niche}`, goal: "personalized gifted creator outreach" }),
			});
			setOutreachMessages((current) => ({ ...current, [match.creator.id]: `${result.text} (${result.source})` }));
		} catch (error: any) {
			setMessage(error.message || "Could not generate outreach.");
		} finally {
			setOutreachId(null);
		}
	};

	const visibleMatches = matches.filter((match) => {
		const value = `${match.creator.name} ${match.creator.niche} ${match.creator.city} ${match.creator.handle}`.toLowerCase();
		return value.includes(query.toLowerCase());
	});

	return (
		<>
			<div className="section-head page-head">
				<div><span className="eyebrow">AI matching · deterministic scoring</span><h1>Creator matching intelligence</h1></div>
				<div className="search-box"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators, niches, or cities" /></div>
			</div>
			<div className="toolbar-row"><label>Campaign<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label><span className="badge">{matches.length} eligible creators</span></div>
			<p className="lead">Scores are calculated by the matching engine; AI is used for language, not numeric ranking.</p>
			{message && <p role="status" className="form-message">{message}</p>}
			{visibleMatches.map((match) => <article className="panel row match-item" key={match.creator.id}>
				<div className="match-profile"><div className="avatar">{match.creator.name.charAt(0)}</div><div><h3>{match.creator.name} <small>{match.creator.handle}</small></h3><p>{match.creator.niche} · {match.creator.city} · {Number(match.creator.followers).toLocaleString()} followers · {match.creator.engagement}% engagement</p><p className="match-reason">{explanations[match.creator.id] || match.reason}</p><small>Operational trust: {match.creator.trust_score}/100 · {match.creator.platform}</small><div className="match-actions"><button className="secondary explain-button" onClick={() => explainMatch(match)} disabled={explainId !== null}>{explainId === match.creator.id ? "Generating..." : "AI explanation"}</button><button className="secondary explain-button" onClick={() => generateOutreach(match)} disabled={outreachId !== null}>{outreachId === match.creator.id ? "Drafting..." : "Draft outreach"}</button></div>{outreachMessages[match.creator.id] && <p className="outreach-preview">{outreachMessages[match.creator.id]}</p>}</div></div>
					<div className="score-box"><strong className="score">{match.score}</strong><span>match / 100</span><button onClick={() => invite(match.creator.id)} disabled={busyId !== null}>{busyId === match.creator.id ? "Inviting..." : "Invite creator"}</button></div>
			</article>)}
			{campaignId && visibleMatches.length === 0 && <div className="panel empty-state">No creators meet the campaign requirements.</div>}
		</>
	);
}