import React, { useEffect, useState } from "react";
import { api } from "../services/api";

const stages = ["order_placed", "packed", "shipped", "out_for_delivery", "delivered"];

export default function LogisticsPage() {
	const [shipments, setShipments] = useState<any[]>([]);
	const [collaborations, setCollaborations] = useState<any[]>([]);
	const [busyId, setBusyId] = useState<number | null>(null);
	const [message, setMessage] = useState("");

	const load = async () => {
		const [shipmentRows, collaborationRows] = await Promise.all([api<any[]>("/shipments"), api<any[]>("/collaborations")]);
		setShipments(shipmentRows);
		setCollaborations(collaborationRows);
	};

	useEffect(() => {
		load().catch((error) => setMessage(error.message));
	}, []);

	const createShipment = async (collaborationId: number) => {
		setBusyId(collaborationId);
		setMessage("");
		try {
			await api(`/shipments/${collaborationId}`, { method: "POST" });
			setMessage("Mock shipment dispatched and tracking saved.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Shipment could not be created.");
		} finally {
			setBusyId(null);
		}
	};

	const advance = async (shipmentId: number) => {
		setBusyId(shipmentId);
		try {
			await api(`/shipments/${shipmentId}/advance`, { method: "POST" });
			setMessage("Shipment status updated.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Shipment could not be advanced.");
		} finally {
			setBusyId(null);
		}
	};

	const dispatchedCollaborationIds = new Set(shipments.map((shipment) => shipment.collaboration_id));
	const readyToShip = collaborations.filter((collaboration) => collaboration.status === "claimed" && !dispatchedCollaborationIds.has(collaboration.id));

	return (
		<>
			<div className="section-head page-head"><div><span className="eyebrow">Mock courier mode</span><h1>Logistics</h1><p>Simulated tracking only. No real courier API is contacted.</p></div><span className="badge success">{shipments.length} shipments</span></div>
			{message && <p role="status" className="form-message">{message}</p>}
			{readyToShip.length > 0 && <section className="panel"><div className="section-head"><h2>Ready to dispatch</h2><span className="badge">{readyToShip.length}</span></div>{readyToShip.map((collaboration) => <div className="list-row" key={collaboration.id}><div><strong>{collaboration.product} · {collaboration.creator}</strong><small>{collaboration.campaign} · Collaboration #{collaboration.id}</small></div><button onClick={() => createShipment(collaboration.id)} disabled={busyId !== null}>{busyId === collaboration.id ? "Dispatching..." : "Create shipment"}</button></div>)}</section>}
			<section className="panel"><div className="section-head"><h2>Shipment tracker</h2><span className="badge">Stages are demo-simulated</span></div>
				{shipments.map((shipment) => {
					const currentStage = stages.indexOf(shipment.stage);
					return <article className="shipment-card" key={shipment.id}><div className="section-head"><div><strong>{shipment.product} · {shipment.creator}</strong><small>{shipment.campaign} · {shipment.provider} · {shipment.tracking_code}</small></div><span className="badge success">{shipment.stage.replaceAll("_", " ")}</span></div><div className="shipment-timeline">{stages.map((stage, index) => <div className={`shipment-stage ${index <= currentStage ? "complete" : ""}`} key={stage}><span>{index < currentStage ? "✓" : index + 1}</span><small>{stage.replaceAll("_", " ")}</small></div>)}</div>{shipment.deadline && <p>Creator post deadline: {new Date(shipment.deadline).toLocaleDateString()}</p>}{currentStage < stages.length - 1 && <button className="secondary" onClick={() => advance(shipment.id)} disabled={busyId !== null}>{busyId === shipment.id ? "Updating..." : "Advance mock status"}</button>}</article>;
				})}
				{shipments.length === 0 && <div className="empty-state">No shipments yet. Accept an invitation as a creator, then dispatch the claimed product here.</div>}
			</section>
		</>
	);
}