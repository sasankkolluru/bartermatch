import React, { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import KPICard from "../components/KPICard";
import { api } from "../services/api";

const trustColors = ["#ef4444", "#f59e0b", "#0ea5e9", "#10b981"];
const money = (value: number) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;

export default function BrandDashboard({ onNavigate, refreshToken }: { onNavigate: (page: string) => void; refreshToken: any }) {
	const [metrics, setMetrics] = useState<any>({});
	const [products, setProducts] = useState<any[]>([]);
	const [campaigns, setCampaigns] = useState<any[]>([]);
	const [creators, setCreators] = useState<any[]>([]);
	const [collaborations, setCollaborations] = useState<any[]>([]);
	const [message, setMessage] = useState("");
	const [insights, setInsights] = useState("");

	useEffect(() => {
		Promise.all([
			api<any>("/dashboard/brand"),
			api<any[]>("/products"),
			api<any[]>("/campaigns"),
			api<any[]>("/creators"),
			api<any[]>("/collaborations"),
		]).then(([dashboard, productRows, campaignRows, creatorRows, collaborationRows]) => {
			setMetrics(dashboard);
			setProducts(productRows);
			setCampaigns(campaignRows);
			setCreators(creatorRows);
			setCollaborations(collaborationRows);
		}).catch((error) => setMessage(error.message));
	}, [refreshToken]);

	const inventory = products.map((product) => ({ name: product.name, value: Number(product.price || 0) * Number(product.stock || 0) }));
	const trustDistribution = [
		{ name: "Low", value: creators.filter((creator) => creator.trust_score < 40).length },
		{ name: "Watch", value: creators.filter((creator) => creator.trust_score >= 40 && creator.trust_score < 60).length },
		{ name: "Verified", value: creators.filter((creator) => creator.trust_score >= 60 && creator.trust_score < 80).length },
		{ name: "High trust", value: creators.filter((creator) => creator.trust_score >= 80).length },
	].filter((item) => item.value > 0);
	const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
	const shipped = Number(metrics.products_shipped || products.reduce((sum, product) => sum + Number(product.shipped_units || 0), 0));
	const cards = [
		["Inventory value", money(metrics.inventory_value || products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0)), "Listed retail value · estimate", "primary"],
		["Active campaigns", activeCampaigns, `${campaigns.length} total saved`, "success"],
		["Products shipped", shipped, "Mock/demo shipment count", "warning"],
		["Verified UGC", metrics.verified_ugc || 0, "Mock proof submissions", "default"],
		["Ghosting rate", `${metrics.ghosting_rate ?? 0}%`, "Demo metric; no live history", "warning"],
	];
	const completed = collaborations.filter((item) => item.status === "completed").length;
	const shipmentCounts = new Map<string, number>();
	(metrics.shipments || []).forEach((shipment: any) => shipmentCounts.set(shipment.stage, shipment.count));
	const generateInsights = async () => {
		try {
			const result = await api<any>("/ai/insights", {
				method: "POST",
				body: JSON.stringify({ product: "BarterMatch brand dashboard", audience: `${campaigns.length} campaigns, ${collaborations.length} collaborations, ${metrics.verified_ugc || 0} verified mock proofs, ${metrics.roi_percent || 0}% estimated ROI`, goal: "campaign performance insights" }),
			});
			setInsights(`${result.text} (${result.source})`);
		} catch (error: any) {
			setMessage(error.message || "Insights could not be generated.");
		}
	};

	return (
		<>
			<section className="hero-panel panel">
				<div><span className="eyebrow">BarterMatch · sample workspace</span><h1>Turn products into partnerships.</h1><p>Match creators, gift inventory, follow mock shipments, and measure estimated content value from one workspace.</p><small className="estimate-note">Synthetic sample data and estimated metrics are labeled. No social or courier service is contacted.</small></div>
				<div className="hero-actions"><button onClick={() => onNavigate("Campaigns")}>Launch campaign</button><button className="secondary" onClick={() => onNavigate("AI Matching")}>Find creators</button></div>
			</section>
			{message && <p role="status" className="form-message">{message}</p>}
			<section className="grid">{cards.map(([label, value, trend, tone]: any) => <KPICard key={label} label={label} value={value} trend={trend} tone={tone} />)}</section>
			<section className="dashboard-grid chart-grid">
				<div className="panel chart-panel"><div className="section-head"><div><h2>Inventory value</h2><small>Retail value currently available · estimate</small></div><span className="badge">{products.length} products</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={inventory} margin={{ top: 8, right: 8, bottom: 4, left: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => money(Number(value))} /><Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
				<div className="panel chart-panel"><div className="section-head"><div><h2>Creator trust distribution</h2><small>Operational platform score bands</small></div><span className="badge">{creators.length} profiles</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={trustDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={3}>{trustDistribution.map((entry, index) => <Cell key={entry.name} fill={trustColors[index]} />)}</Pie><Tooltip /><text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="chart-center-label">{creators.length}</text></PieChart></ResponsiveContainer></div><div className="chart-legend">{trustDistribution.map((entry, index) => <span key={entry.name}><i style={{ background: trustColors[index] }} />{entry.name} {entry.value}</span>)}</div></div>
			</section>
			<section className="dashboard-grid">
				<div className="panel"><div className="section-head"><h2>Campaign pipeline</h2><span className="badge">{completed}/{collaborations.length} completed</span></div><div className="stack-list">{campaigns.slice(0, 5).map((campaign) => <div key={campaign.id} className="list-row"><div><strong>{campaign.title}</strong><small>{campaign.niche || "General"} · {campaign.city || "Any location"}</small></div><span className="badge">{campaign.status}</span></div>)}{campaigns.length === 0 && <p>No campaigns saved yet.</p>}</div></div>
				<div className="panel"><div className="section-head"><h2>Campaign economics</h2><button className="secondary" onClick={generateInsights}>Generate insights</button></div><p className="lead">Inventory deployed {money(metrics.spend || 0)} · estimated UGC value {money(metrics.ugc_value || 0)}</p><strong className="roi-value">{Number(metrics.roi_percent || 0)}% ROI estimate</strong><small className="estimate-note">Calculated from demo proof value; not audited campaign revenue.</small>{insights && <p className="insight-preview">{insights}</p>}<div className="shipment-summary">{[...shipmentCounts.entries()].map(([stage, count]) => <span key={stage} className="badge">{stage.replaceAll("_", " ")}: {count}</span>)}</div></div>
			</section>
			<section className="panel"><div className="section-head"><h2>Creator reliability</h2><button className="secondary" onClick={() => onNavigate("AI Matching")}>Open AI matching</button></div><div className="creator-row-grid">{creators.slice(0, 4).map((creator) => <div className="creator-card" key={creator.id}><div className="avatar">{creator.name.charAt(0)}</div><div><strong>{creator.name}</strong><small>{creator.niche} · {creator.city}</small></div><span>{creator.trust_score}/100</span></div>)}</div></section>
		</>
	);
}