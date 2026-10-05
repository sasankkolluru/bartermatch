import React, { useEffect, useState } from "react";
import { api } from "../services/api";

const emptyForm = {
	title: "",
	product_id: 1,
	niche: "beauty",
	city: "Hyderabad",
	budget: 25000,
	minimum_followers: 5000,
	minimum_engagement: 3,
	posting_deadline_days: 7,
	target_platform: "Instagram",
	deliverables: "1 Instagram Reel",
	description: "",
};

export default function CampaignWizard({ refresh }: { refresh: () => void }) {
	const [campaigns, setCampaigns] = useState<any[]>([]);
	const [products, setProducts] = useState<any[]>([]);
	const [form, setForm] = useState(emptyForm);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [brief, setBrief] = useState("");

	const loadCampaigns = async () => {
		const data = await api<any[]>("/campaigns");
		setCampaigns(data);
	};

	useEffect(() => {
		Promise.all([api<any[]>("/campaigns"), api<any[]>("/products")])
			.then(([campaignData, productData]) => {
				setCampaigns(campaignData);
				setProducts(productData);
				if (productData.length) setForm((current) => ({ ...current, product_id: productData[0].id }));
			})
			.catch((error) => setMessage(error.message));
	}, []);

	const update = (field: keyof typeof emptyForm, value: string | number) =>
		setForm((current) => ({ ...current, [field]: value }));

	const createCampaign = async (event: React.FormEvent) => {
		event.preventDefault();
		setBusy(true);
		setMessage("");
		try {
			await api("/campaigns", { method: "POST", body: JSON.stringify(form) });
			setMessage("Campaign saved to your workspace.");
			setForm(emptyForm);
			await loadCampaigns();
			refresh();
		} catch (error: any) {
			setMessage(error.message || "Campaign could not be saved.");
		} finally {
			setBusy(false);
		}
	};

	const generateBrief = async () => {
		setBusy(true);
		setMessage("");
		try {
			const product = products.find((item) => item.id === Number(form.product_id));
			const result = await api<any>("/ai/campaign-description", {
				method: "POST",
				body: JSON.stringify({ product: product?.name || "Product", audience: `${form.niche} creators in ${form.city}`, goal: form.deliverables }),
			});
			setBrief(result.text);
			setForm((current) => ({ ...current, description: result.text }));
			setMessage(result.source === "groq" ? "Brief generated with Groq." : "AI unavailable; deterministic demo brief shown.");
		} catch (error: any) {
			setMessage(error.message || "Brief generation failed.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<div className="section-head page-head">
				<div><span className="eyebrow">Campaigns</span><h1>Campaign builder</h1></div>
			</div>
			<div className="campaign-layout">
				<form className="panel form" onSubmit={createCampaign}>
					<label>Campaign name<input required minLength={3} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Monsoon Glow Creators" /></label>
					<label>Product<select value={form.product_id} onChange={(event) => update("product_id", Number(event.target.value))}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · ₹{product.price} · {product.stock} available</option>)}</select></label>
					<div className="form-grid">
						<label>Target niche<input required value={form.niche} onChange={(event) => update("niche", event.target.value)} /></label>
						<label>Location<input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
						<label>Budget (₹)<input type="number" min="0" value={form.budget} onChange={(event) => update("budget", Number(event.target.value))} /></label>
						<label>Minimum followers<input type="number" min="0" value={form.minimum_followers} onChange={(event) => update("minimum_followers", Number(event.target.value))} /></label>
						<label>Minimum engagement (%)<input type="number" min="0" max="100" step="0.1" value={form.minimum_engagement} onChange={(event) => update("minimum_engagement", Number(event.target.value))} /></label>
						<label>Platform<select value={form.target_platform} onChange={(event) => update("target_platform", event.target.value)}><option>Instagram</option><option>YouTube</option><option>TikTok</option></select></label>
						<label>Deliverable<input value={form.deliverables} onChange={(event) => update("deliverables", event.target.value)} /></label>
						<label>Deadline after delivery (days)<input type="number" min="1" max="90" value={form.posting_deadline_days} onChange={(event) => update("posting_deadline_days", Number(event.target.value))} /></label>
					</div>
					<label>Campaign description<textarea rows={4} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Generate a brief or enter campaign details" /></label>
					<div className="button-row"><button type="submit" disabled={busy}>{busy ? "Saving..." : "Create campaign"}</button><button type="button" className="secondary" onClick={generateBrief} disabled={busy}>Generate with AI</button></div>
					{message && <p role="status" className="form-message">{message}</p>}
					{brief && <div className="brief-preview"><strong>Campaign brief</strong><p>{brief}</p></div>}
				</form>
				<section className="panel">
					<div className="section-head"><h2>Recent campaigns</h2><span className="badge">{campaigns.length}</span></div>
					<div className="campaign-list">{campaigns.map((campaign) => <div className="campaign-card" key={campaign.id}><div><strong>{campaign.title}</strong><small>{campaign.niche || "General"} · {campaign.city || "Any location"} · {campaign.deliverables || "1 social post"}</small></div><div className="campaign-meta"><span>₹{campaign.budget}</span><em>#{campaign.id}</em></div></div>)}</div>
				</section>
			</div>
		</>
	);
}