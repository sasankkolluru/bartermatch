import React, { useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { api } from "../services/api";

export default function ProofReviewPage({ reviewer }: { reviewer: any }) {
	const [proofs, setProofs] = useState<any[]>([]);
	const [filter, setFilter] = useState<"pending" | "verified">("pending");
	const [busyId, setBusyId] = useState<number | null>(null);
	const [message, setMessage] = useState("");

	const load = async () => setProofs(await api<any[]>(`/proofs?brand_id=${reviewer.id}`));

	useEffect(() => {
		load().catch((error) => setMessage(error.message || "Proof submissions could not be loaded."));
	}, []);

	const approve = async (proofId: number) => {
		setBusyId(proofId);
		setMessage("");
		try {
			await api("/proof/verify", { method: "POST", body: JSON.stringify({ proof_id: proofId, reviewer_id: reviewer.id }) });
			setMessage("Brand review saved. The proof is marked verified in BarterMatch; Instagram was not contacted.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Approval could not be saved.");
		} finally {
			setBusyId(null);
		}
	};

	const pending = proofs.filter((proof) => !proof.verified);
	const verified = proofs.filter((proof) => Boolean(proof.verified));
	const visibleProofs = filter === "pending" ? pending : verified;

	return (
		<>
			<div className="section-head page-head">
				<div><span className="eyebrow">Brand workspace · proof review</span><h1>Review creator posts</h1><p>Approve submitted links after your team has reviewed them. This does not verify content with Instagram.</p></div>
				<div className="proof-review-counts"><span className="badge">{pending.length} awaiting review</span><span className="badge success">{verified.length} approved</span></div>
			</div>
			<div className="proof-review-tabs" role="tablist" aria-label="Proof status filter">
				<button role="tab" aria-selected={filter === "pending"} className={filter === "pending" ? "active" : "secondary"} onClick={() => setFilter("pending")}>Awaiting review</button>
				<button role="tab" aria-selected={filter === "verified"} className={filter === "verified" ? "active" : "secondary"} onClick={() => setFilter("verified")}>Approved</button>
			</div>
			{message && <p role="status" className="form-message">{message}</p>}
			<section className="proof-review-list">
				{visibleProofs.map((proof) => <article className="panel proof-review-card" key={proof.id}>
					<div className="proof-review-main">
						<div className="proof-review-icon">{proof.verified ? <BadgeCheck size={21} /> : <ShieldCheck size={21} />}</div>
						<div><strong>{proof.creator} <small>{proof.handle}</small></strong><small>{proof.campaign} · {proof.product}</small><a href={proof.url} target="_blank" rel="noreferrer">Open submitted post <ExternalLink size={14} aria-hidden="true" /></a></div>
					</div>
					<div className="proof-review-action">
						{proof.verified ? <span className="proof-verified" title="BarterMatch brand review passed; Instagram did not verify this post"><BadgeCheck size={17} aria-hidden="true" />{proof.verified_by_name ? `Approved by ${proof.verified_by_name}` : "Verified demo sample"}</span> : <><span className="badge">Awaiting brand review</span><button onClick={() => approve(proof.id)} disabled={busyId !== null}>{busyId === proof.id ? "Saving approval..." : "Approve & mark verified"}</button></>}
					</div>
				</article>)}
				{visibleProofs.length === 0 && <div className="panel empty-state">{filter === "pending" ? "No proof submissions are waiting for review." : "No proofs have been approved yet."}</div>}
			</section>
		</>
	);
}
