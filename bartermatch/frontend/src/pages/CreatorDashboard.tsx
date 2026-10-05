import React, { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { api } from "../services/api";

function formatDeadline(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Deadline unavailable";
	return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function deadlineRemaining(value: string, now: number) {
	const remaining = new Date(value).getTime() - now;
	if (!Number.isFinite(remaining) || remaining <= 0) return "Deadline passed";
	const totalMinutes = Math.ceil(remaining / 60000);
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;
	if (days > 0) return `${days}d ${hours}h remaining`;
	if (hours > 0) return `${hours}h ${minutes}m remaining`;
	return `${minutes}m remaining`;
}

export default function CreatorDashboard({ creator, view = "Opportunities" }: any) {
	const [dashboard, setDashboard] = useState<any>(null);
	const [riskAnalysis, setRiskAnalysis] = useState<any>(null);
	const [proofUrls, setProofUrls] = useState<Record<number, string>>({});
	const [message, setMessage] = useState("");
	const [busyId, setBusyId] = useState<number | null>(null);
	const [clock, setClock] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => setClock(Date.now()), 60000);
		return () => window.clearInterval(timer);
	}, []);

	const load = async () => {
		const creatorId = Number(creator?.id || 1);
		const result = await api<any>(`/dashboard/creator?creator_id=${creatorId}`);
		setDashboard(result);
		const risk = await api<any>("/ai/risk-explanation", {
			method: "POST",
			body: JSON.stringify({
				trust_score: result.creator.trust_score,
				ghosted_campaigns: result.creator.ghosted_campaigns || 0,
				missed_deadlines: result.collaborations.filter((item: any) => item.status === "deadline_missed").length,
				duplicate_proofs: 0,
			}),
		});
		setRiskAnalysis(risk);
	};

	useEffect(() => {
		load().catch((error) => setMessage(error.message));
	}, [creator?.id]);

	const claimCampaign = async (campaignId: number) => {
		setBusyId(campaignId);
		setMessage("");
		try {
			await api(`/campaigns/${campaignId}/claim`, { method: "POST", body: JSON.stringify({ creator_id: Number(creator?.id || 1) }) });
			setMessage("Product claimed. The collaboration is now saved.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Campaign could not be claimed.");
		} finally {
			setBusyId(null);
		}
	};

	const acceptInvite = async (collaborationId: number) => {
		setBusyId(collaborationId);
		try {
			await api(`/collaborations/${collaborationId}/claim`, { method: "POST" });
			setMessage("Invitation accepted. Your product is reserved.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Invitation could not be accepted.");
		} finally {
			setBusyId(null);
		}
	};

	const submitProof = async (collaborationId: number) => {
		setBusyId(collaborationId);
		try {
			await api(`/collaborations/${collaborationId}/proof`, {
				method: "POST",
				body: JSON.stringify({ collaboration_id: collaborationId, url: proofUrls[collaborationId] || "", caption: "Proof submission to brand" }),
			});
			setMessage("Proof submitted to the brand for review. Instagram was not contacted.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Proof could not be submitted.");
		} finally {
			setBusyId(null);
		}
	};

	if (!dashboard) return <section className="panel"><h1>Creator workspace</h1><p>{message || "Loading creator data..."}</p></section>;

	const creatorData = dashboard.creator;
	const invitations = dashboard.collaborations.filter((item: any) => item.status === "invited");
	const collaborationRows = view === "Proof of Post"
		? dashboard.collaborations.filter((item: any) => item.proof_id || ["delivered", "deadline_missed"].includes(item.status))
		: dashboard.collaborations.filter((item: any) => item.status !== "invited");
	const creatorCollaborations = dashboard.collaborations;
	const trustScore = Number(creatorData.trust_score || 0);

	return (
		<>
			<div className="section-head page-head"><div><span className="eyebrow">Creator workspace · demo profile</span><h1>{view === "Opportunities" ? "Opportunities" : view}</h1><p>{creatorData.name} · {creatorData.handle} · {creatorData.niche} · {creatorData.city}</p></div></div>
			{view === "Opportunities" && <div className="grid creator-stats">
				<div className="kpi"><small>Operational trust</small><strong>{trustScore}<small> / 100</small></strong><em>Platform score, not a character judgment</em></div>
				<div className="kpi"><small>Active collaborations</small><strong>{dashboard.active_collaborations}</strong><em>{invitations.length} invitations to review</em></div>
				<div className="kpi"><small>Completed</small><strong>{dashboard.completed_collaborations}</strong><em>Recorded successful posts</em></div>
				<div className="kpi"><small>On-time rate</small><strong>{dashboard.on_time_rate}%</strong><em>Demo estimate</em></div>
			</div>}
			{message && <p role="status" className="form-message">{message}</p>}
			{view === "Opportunities" && riskAnalysis && <section className="panel risk-panel"><div className="section-head"><div><h2>{riskAnalysis.risk}</h2><small>Operational collaboration risk · {riskAnalysis.source}</small></div><span className="badge">Platform events only</span></div><p>{riskAnalysis.text}</p><small>This is an operational estimate, not a claim about personal character.</small></section>}
			{view === "Opportunities" && invitations.length > 0 && <section className="panel"><div className="section-head"><h2>Brand invitations</h2><span className="badge">{invitations.length}</span></div>{invitations.map((item: any) => <div className="list-row" key={item.id}><div><strong>{item.campaign}</strong><small>{item.product} · {item.niche} · ₹{item.price}</small></div><button onClick={() => acceptInvite(item.id)} disabled={busyId !== null}>{busyId === item.id ? "Accepting..." : "Accept invitation"}</button></div>)}</section>}
			{view === "Opportunities" && <section className="panel"><div className="section-head"><h2>Available campaigns</h2><span className="badge success">{dashboard.available_campaigns.length} open</span></div>
				{dashboard.available_campaigns.map((campaign: any) => <article className="campaign-card" key={campaign.id}><div><strong>{campaign.title}</strong><small>{campaign.product} · {campaign.niche} · {campaign.target_platform} · minimum {campaign.minimum_followers} followers</small><small>{campaign.deliverables} · post within {campaign.posting_deadline_days} days of delivery</small></div><div className="campaign-meta"><span>₹{campaign.price}</span><button onClick={() => claimCampaign(campaign.id)} disabled={busyId !== null}>{busyId === campaign.id ? "Claiming..." : "Claim product"}</button></div></article>)}
				{dashboard.available_campaigns.length === 0 && <p>No active campaigns with available stock right now.</p>}
			</section>}
			{view === "Collaborations" && <section className="panel"><div className="section-head"><div><h2>My collaborations</h2><small>Products and current collaboration status</small></div><span className="badge">{creatorCollaborations.length} records</span></div>
				{creatorCollaborations.map((item: any) => {
					const collaborated = !["invited", "rejected", "cancelled"].includes(item.status);
					return <article className="creator-collaboration collab-state-row" key={item.id}><div className="section-head"><div><strong>{item.campaign}</strong><small>Product: {item.product} · ₹{Number(item.price || 0).toLocaleString()}</small>{item.tracking_code && <small>{item.courier || "Mock"} tracking · {item.tracking_code} · {item.shipment_stage?.replaceAll("_", " ")}</small>}{item.deadline && <time className="deadline-display" dateTime={item.deadline}><span>Post deadline: {formatDeadline(item.deadline)}</span><small>{deadlineRemaining(item.deadline, clock)}</small></time>}</div><div className="collab-badges"><span className={`badge ${collaborated ? "success" : ""}`}>{collaborated ? "Collaborated" : "Not collaborated yet"}</span><span className="badge">{item.status.replaceAll("_", " ")}</span></div></div></article>;
				})}
				{creatorCollaborations.length === 0 && <p>No brand collaborations yet.</p>}
			</section>}
			{view === "Proof of Post" && <section className="panel"><div className="section-head"><div><h2>Post verification</h2><small>Only the campaign's brand owner can approve a submitted post.</small></div><span className="badge">{collaborationRows.filter((item: any) => item.proof_id).length} submissions</span></div>
				{collaborationRows.map((item: any) => <article className="creator-collaboration proof-status-row" key={item.id}><div className="section-head"><div><strong>{item.campaign}</strong><small>{item.product}</small>{item.deadline && <time className="deadline-display" dateTime={item.deadline}><span>Post deadline: {formatDeadline(item.deadline)}</span><small>{deadlineRemaining(item.deadline, clock)}</small></time>}</div>{item.proof_id ? item.proof_verified ? <span className="proof-verified" title="Brand approval recorded in BarterMatch; Instagram did not verify this post"><BadgeCheck size={17} aria-hidden="true" />{item.proof_verified_by_name ? `Verified by ${item.proof_verified_by_name}` : "Verified demo sample"}</span> : <span className="badge warning">Not verified · awaiting brand review</span> : <span className="badge">No proof submitted</span>}</div>{item.proof_id ? <a className="proof-url" href={item.proof_url} target="_blank" rel="noreferrer">{item.proof_url}</a> : ["delivered", "deadline_missed"].includes(item.status) && <div className="proof-entry"><input type="url" value={proofUrls[item.id] || ""} onChange={(event) => setProofUrls((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="https://www.instagram.com/p/..." /><button onClick={() => submitProof(item.id)} disabled={busyId !== null || !proofUrls[item.id]}>{busyId === item.id ? "Submitting..." : "Submit for brand review"}</button></div>}</article>)}
				{collaborationRows.length === 0 && <p>No delivered collaborations are waiting for a post.</p>}
			</section>}
		</>
	);
}