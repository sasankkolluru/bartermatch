const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

type DemoStore = {
	users: any[];
	creators: any[];
	products: any[];
	campaigns: any[];
	collaborations: any[];
	shipments: any[];
	proofs: any[];
};

const STORAGE_KEY = "bartermatch-demo-store";

const defaultStore: DemoStore = {
	users: [
		{ id: 1, name: "Demo Brand", email: "brand@example.com", role: "brand" },
		{ id: 2, name: "Asha Rao", email: "asha@example.com", role: "creator" },
	],
	creators: [
		{ id: 1, name: "Asha Rao", handle: "@ashaliving", platform: "Instagram", followers: 42000, engagement: 5.8, niche: "beauty", city: "Hyderabad", trust_score: 92 },
		{ id: 2, name: "Rohan Eats", handle: "@rohaneats", platform: "Instagram", followers: 28000, engagement: 7.2, niche: "food", city: "Bengaluru", trust_score: 85 },
		{ id: 3, name: "Mira Style", handle: "@mirastyle", platform: "YouTube", followers: 86000, engagement: 4.9, niche: "fashion", city: "Hyderabad", trust_score: 78 },
		{ id: 4, name: "Kavya Creates", handle: "@kavyacreates", platform: "Instagram", followers: 15500, engagement: 8.1, niche: "beauty", city: "Chennai", trust_score: 96 },
	],
	products: [
		{ id: 1, name: "Neem Glow Serum", category: "beauty", price: 899, stock: 120, description: "Plant-based daily face serum" },
		{ id: 2, name: "Millet Snack Box", category: "food", price: 499, stock: 80, description: "Indian millet snack sampler" },
		{ id: 3, name: "Everyday Cotton Kurta", category: "fashion", price: 1299, stock: 45, description: "Soft cotton everyday kurta" },
	],
	campaigns: [
		{ id: 1, brand_id: 1, title: "Monsoon Glow Creators", product_id: 1, niche: "beauty", city: "Hyderabad", budget: 25000, status: "active", minimum_followers: 5000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "Instagram", deliverables: "1 Instagram Reel" },
		{ id: 2, brand_id: 1, title: "Fresh-Face Morning Routine", product_id: 1, niche: "beauty", city: "Mumbai", budget: 18000, status: "active", minimum_followers: 5000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "Instagram", deliverables: "1 Instagram Reel" },
		{ id: 3, brand_id: 3, title: "Pantry-to-Plate Tastemakers", product_id: 2, niche: "food", city: "Bengaluru", budget: 22000, status: "active", minimum_followers: 5000, minimum_engagement: 2, posting_deadline_days: 8, target_platform: "Instagram", deliverables: "1 recipe Reel" },
		{ id: 4, brand_id: 4, title: "Weekend Style Edit", product_id: 3, niche: "fashion", city: "Chennai", budget: 20000, status: "active", minimum_followers: 5000, minimum_engagement: 2, posting_deadline_days: 9, target_platform: "Instagram", deliverables: "1 outfit Reel" },
		{ id: 5, brand_id: 5, title: "Millet Snack Break", product_id: 2, niche: "food", city: "Delhi", budget: 16000, status: "active", minimum_followers: 3000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "Instagram", deliverables: "1 tasting Reel" },
		{ id: 6, brand_id: 6, title: "Festival Outfit Diaries", product_id: 3, niche: "fashion", city: "Hyderabad", budget: 24000, status: "active", minimum_followers: 8000, minimum_engagement: 3, posting_deadline_days: 10, target_platform: "Instagram", deliverables: "1 styling Reel" },
		{ id: 7, brand_id: 1, title: "Calm Evening Rituals", product_id: 1, niche: "beauty", city: "Pune", budget: 17500, status: "active", minimum_followers: 4000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "Instagram", deliverables: "1 routine Reel" },
		{ id: 8, brand_id: 3, title: "Five-Minute Meal Notes", product_id: 2, niche: "food", city: "Kochi", budget: 19000, status: "active", minimum_followers: 5000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "YouTube", deliverables: "1 YouTube Short" },
		{ id: 9, brand_id: 4, title: "Comfort-First Workwear", product_id: 3, niche: "fashion", city: "Jaipur", budget: 21000, status: "active", minimum_followers: 5000, minimum_engagement: 2, posting_deadline_days: 8, target_platform: "Instagram", deliverables: "1 outfit Reel" },
		{ id: 10, brand_id: 5, title: "Glow On the Go", product_id: 1, niche: "beauty", city: "Mumbai", budget: 17000, status: "active", minimum_followers: 3000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "Instagram", deliverables: "1 routine Reel" },
		{ id: 11, brand_id: 6, title: "Better Break Snacks", product_id: 2, niche: "food", city: "Ahmedabad", budget: 15000, status: "active", minimum_followers: 3000, minimum_engagement: 2, posting_deadline_days: 7, target_platform: "Instagram", deliverables: "1 tasting Reel" },
		{ id: 12, brand_id: 1, title: "Daily Routine Duo", product_id: 1, niche: "beauty", city: "Bengaluru", budget: 23000, status: "active", minimum_followers: 7000, minimum_engagement: 3, posting_deadline_days: 9, target_platform: "Instagram", deliverables: "1 routine Reel" },
	],
	collaborations: [],
	shipments: [],
	proofs: [],
};

function readStore(): DemoStore {
	if (typeof window === "undefined") return defaultStore;

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStore));
			return defaultStore;
		}

		const parsed = JSON.parse(raw) as Partial<DemoStore>;
		const storedCampaigns = parsed.campaigns ?? [];
		const nextCampaignId = storedCampaigns.reduce((largest, campaign) => Math.max(largest, Number(campaign.id) || 0), 0) + 1;
		const missingDemoCampaigns = defaultStore.campaigns
			.filter((campaign) => !storedCampaigns.some((stored) => stored.title === campaign.title))
			.map((campaign, index) => ({ ...campaign, id: nextCampaignId + index }));
		const nextStore: DemoStore = {
			users: parsed.users ?? defaultStore.users,
			creators: parsed.creators ?? defaultStore.creators,
			products: parsed.products ?? defaultStore.products,
			campaigns: [...storedCampaigns, ...missingDemoCampaigns],
			collaborations: parsed.collaborations ?? defaultStore.collaborations,
			shipments: parsed.shipments ?? defaultStore.shipments,
			proofs: parsed.proofs ?? defaultStore.proofs,
		};
		return nextStore;
	} catch {
		return defaultStore;
	}
}

function writeStore(next: DemoStore) {
	if (typeof window !== "undefined") {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}
}

function buildAnalytics(store: DemoStore) {
	const deployedStatuses = ["shipped", "delivered", "proof_submitted", "completed", "deadline_missed"];
	const spend = store.collaborations.filter((item) => deployedStatuses.includes(item.status)).reduce((total, collaboration) => {
		const campaign = store.campaigns.find((item) => item.id === collaboration.campaign_id);
		const product = store.products.find((item) => item.id === campaign?.product_id);
		return total + Number(product?.unit_cost || product?.price || 0);
	}, 0);
	const verifiedProofs = store.proofs.filter((proof) => proof.verified).length;
	const ugcValue = verifiedProofs * 2500;
	return {
		campaigns: store.campaigns.length,
		creators: store.creators.length,
		collaborations: Math.max(1, store.shipments.length + store.proofs.length),
		ugc_value: ugcValue,
		spend,
		roi_percent: spend ? Math.round((ugcValue - spend) / spend * 100) : 0,
		verified_ugc: verifiedProofs,
	};
}

function scoreCreator(creator: any, campaign: any) {
	const targetNiche = String(campaign.niche || "").toLowerCase();
	const creatorNiche = String(creator.niche || "").toLowerCase();
	const niche = targetNiche === creatorNiche ? 30 : targetNiche && creatorNiche.includes(targetNiche) ? 18 : targetNiche ? 0 : 8;
	const engagement = Number(campaign.minimum_engagement) ? Math.round(20 * Math.min(Number(creator.engagement || 0) / Number(campaign.minimum_engagement), 1)) : Math.round(20 * Math.min(Number(creator.engagement || 0) / 10, 1));
	const minimumFollowers = Number(campaign.minimum_followers || 0);
	const ratio = minimumFollowers ? Number(creator.followers || 0) / minimumFollowers : Number(creator.followers || 0) / 100000;
	const followers = minimumFollowers ? Math.round(15 * (ratio < 1 ? Math.min(ratio, 1) : Math.max(0.5, 1 - Math.min(ratio - 1, 10) / 20))) : Math.round(15 * Math.min(ratio, 1));
	const trust = Math.round(15 * Math.max(0, Math.min(Number(creator.trust_score || 0), 100)) / 100);
	const targetPlatform = String(campaign.target_platform || "").toLowerCase();
	const platform = targetPlatform ? (targetPlatform === String(creator.platform || "").toLowerCase() ? 10 : 0) : 5;
	const completed = Number(creator.completed_collaborations || 0);
	const history = completed ? Math.round(10 * Number(creator.successful_posts || 0) / completed) : 5;
	const breakdown = { niche_similarity: niche, engagement, follower_suitability: followers, trust, platform, historical_performance: history };
	const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0)));
	return { score, breakdown, reason: `${creator.name} scored ${score}/100 across niche alignment, engagement, audience suitability, operational trust, platform, and collaboration history.` };
}

async function fallbackApi<T = any>(path: string, init?: RequestInit): Promise<T> {
	const method = (init?.method || "GET").toUpperCase();
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const store = readStore();

	if (normalizedPath === "/auth/login" && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}");
		const email = body.email || "brand@example.com";
		const role = body.role || "brand";
		const user = store.users.find((entry) => entry.email === email) || {
			id: store.users.length + 1,
			name: email.includes("@") ? email.split("@")[0] : "Demo user",
			email,
			role,
		};

		const nextStore = { ...store, users: store.users.some((entry) => entry.email === user.email) ? store.users : [...store.users, user] };
		writeStore(nextStore);
		return { user, token: "demo-session-token" } as T;
	}

	if (normalizedPath === "/products" && method === "GET") {
		return store.products as T;
	}

	if (normalizedPath === "/products" && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}");
		const product = { id: (store.products.at(-1)?.id ?? 0) + 1, name: body.name, category: body.category || "", price: Number(body.price || 0), stock: Number(body.stock || 0), reserved_units: 0, shipped_units: 0, unit_cost: Number(body.price || 0), description: body.description || "" };
		writeStore({ ...store, products: [...store.products, product] });
		return product as T;
	}

	if (normalizedPath === "/creators" && method === "GET") {
		return store.creators as T;
	}

	if (normalizedPath === "/campaigns" && method === "GET") {
		return store.campaigns as T;
	}

	if (normalizedPath === "/campaigns" && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}") as any;
		const nextCampaign = {
			id: (store.campaigns.at(-1)?.id ?? 0) + 1,
			brand_id: 1,
			title: body.title || "New campaign",
			product_id: body.product_id ?? 1,
			niche: body.niche || "general",
			city: body.city || "Bengaluru",
			budget: Number(body.budget || 0),
			status: "active",
		};

		const nextStore = { ...store, campaigns: [nextCampaign, ...store.campaigns] };
		writeStore(nextStore);
		return nextCampaign as T;
	}

	if (normalizedPath === "/collaborations" && method === "GET") {
		return store.collaborations.map((collaboration) => {
			const campaign = store.campaigns.find((item) => item.id === collaboration.campaign_id);
			return {
				...collaboration,
				creator: store.creators.find((item) => item.id === collaboration.creator_id)?.name || "Creator",
				campaign: campaign?.title || "Campaign",
				product: store.products.find((item) => item.id === campaign?.product_id)?.name || "Product",
			};
		}) as T;
	}

	if (normalizedPath.startsWith("/dashboard/creator") && method === "GET") {
		const creatorId = Number(new URLSearchParams(normalizedPath.split("?")[1] || "").get("creator_id") || 1);
		const creator = store.creators.find((item) => item.id === creatorId) || store.creators[0];
		const collaborations = store.collaborations.filter((item) => item.creator_id === creator.id).map((item) => {
			const campaign = store.campaigns.find((campaignItem) => campaignItem.id === item.campaign_id);
			const product = store.products.find((productItem) => productItem.id === campaign?.product_id);
			const proof = store.proofs.find((proofItem) => proofItem.collaboration_id === item.id);
			return { ...item, campaign: campaign?.title, niche: campaign?.niche, product: product?.name, price: product?.price, proof_id: proof?.id, proof_url: proof?.url, proof_verified: proof?.verified, proof_verified_by_name: proof?.verified_by ? store.users.find((user) => user.id === proof.verified_by)?.name : undefined };
		});
		const completed = collaborations.filter((item) => item.status === "completed" && item.deadline && item.completed_at);
		const onTime = completed.filter((item) => Date.parse(item.completed_at) <= Date.parse(item.deadline));
		return {
			creator,
			active_collaborations: collaborations.filter((item) => item.status !== "completed").length,
			completed_collaborations: Number(creator.completed_collaborations || 0),
			on_time_rate: completed.length ? Math.round(onTime.length / completed.length * 100) : 0,
			collaborations,
			available_campaigns: store.campaigns.filter((campaign) => campaign.status === "active" && !collaborations.some((item) => item.campaign_id === campaign.id && !["rejected", "cancelled"].includes(item.status))).map((campaign) => {
				const product = store.products.find((item) => item.id === campaign.product_id);
				return { ...campaign, product: product?.name, price: product?.price };
			}).filter((campaign) => Number(campaign.stock ?? store.products.find((item) => item.id === campaign.product_id)?.stock ?? 0) > 0),
		} as T;
	}

	const inviteMatch = normalizedPath.match(/^\/campaigns\/(\d+)\/invite$/);
	if (inviteMatch && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}");
		const collaboration = {
			id: (store.collaborations.at(-1)?.id ?? 0) + 1,
			campaign_id: Number(inviteMatch[1]),
			creator_id: Number(body.creator_id),
			status: "invited",
			created_at: new Date().toISOString(),
		};
		writeStore({ ...store, collaborations: [...store.collaborations, collaboration] });
		return collaboration as T;
	}

	const campaignClaimMatch = normalizedPath.match(/^\/campaigns\/(\d+)\/claim$/);
	if (campaignClaimMatch && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}");
		const campaignId = Number(campaignClaimMatch[1]);
		const campaign = store.campaigns.find((item) => item.id === campaignId);
		const product = store.products.find((item) => item.id === campaign?.product_id);
		if (!product || product.stock < 1) throw new Error("This product is currently out of stock");
		const collaboration = {
			id: (store.collaborations.at(-1)?.id ?? 0) + 1,
			campaign_id: campaignId,
			creator_id: Number(body.creator_id || 1),
			status: "claimed",
			claimed_at: new Date().toISOString(),
			agreed_value: product.price,
		};
		writeStore({
			...store,
			products: store.products.map((item) => item.id === product.id ? { ...item, stock: item.stock - 1, reserved_units: Number(item.reserved_units || 0) + 1 } : item),
			collaborations: [...store.collaborations, collaboration],
		});
		return collaboration as T;
	}

	const invitationClaimMatch = normalizedPath.match(/^\/collaborations\/(\d+)\/claim$/);
	if (invitationClaimMatch && method === "POST") {
		const collaborationId = Number(invitationClaimMatch[1]);
		const collaboration = store.collaborations.find((item) => item.id === collaborationId);
		if (!collaboration) throw new Error("Collaboration not found");
		const campaign = store.campaigns.find((item) => item.id === collaboration.campaign_id);
		const product = store.products.find((item) => item.id === campaign?.product_id);
		if (!product || product.stock < 1) throw new Error("This product is currently out of stock");
		const updated = { ...collaboration, status: "claimed", claimed_at: new Date().toISOString(), agreed_value: product.price };
		writeStore({
			...store,
			products: store.products.map((item) => item.id === product.id ? { ...item, stock: item.stock - 1, reserved_units: Number(item.reserved_units || 0) + 1 } : item),
			collaborations: store.collaborations.map((item) => item.id === collaborationId ? updated : item),
		});
		return updated as T;
	}

	const shipMatch = normalizedPath.match(/^\/shipments\/(\d+)$/);
	if (shipMatch && method === "POST") {
		const collaborationId = Number(shipMatch[1]);
		const collaboration = store.collaborations.find((item) => item.id === collaborationId);
		if (!collaboration) throw new Error("Collaboration not found");
		const existing = store.shipments.find((item) => item.collaboration_id === collaborationId);
		if (existing) return existing as T;
		if (collaboration.status !== "claimed") throw new Error("Creator must claim the product before shipping");
		const shipmentId = (store.shipments.at(-1)?.id ?? 0) + 1;
		const campaign = store.campaigns.find((item) => item.id === collaboration.campaign_id);
		const product = store.products.find((item) => item.id === campaign?.product_id);
		const shipment = {
			id: shipmentId,
			collaboration_id: collaborationId,
			creator_id: collaboration.creator_id,
			creator: store.creators.find((item) => item.id === collaboration.creator_id)?.name || "Creator",
			campaign: campaign?.title || "Campaign",
			product: product?.name || "Product",
			provider: "Mock",
			tracking_code: `BM${String(shipmentId).padStart(6, "0")}`,
			stage: "order_placed",
			updated_at: new Date().toISOString(),
		};
		writeStore({ ...store, shipments: [shipment, ...store.shipments] });
		return shipment as T;
	}

	if (normalizedPath.startsWith("/matching/") && method === "GET") {
		const campaignId = Number(normalizedPath.split("/").at(-1) || 0);
		const campaign = store.campaigns.find((item) => item.id === campaignId) || store.campaigns[0];
		if (!campaign) return [] as T;

		const ranked = store.creators
			.filter((creator) => Number(creator.followers || 0) >= Number(campaign.minimum_followers || 0))
			.filter((creator) => Number(creator.engagement || 0) >= Number(campaign.minimum_engagement || 0))
			.filter((creator) => !campaign.target_platform || creator.platform.toLowerCase() === campaign.target_platform.toLowerCase())
			.map((creator) => ({ creator, ...scoreCreator(creator, campaign) }));
		return ranked.sort((a, b) => b.score - a.score) as T;
	}

	if (normalizedPath === "/analytics" && method === "GET") {
		return buildAnalytics(store) as T;
	}

	if (normalizedPath === "/dashboard/brand" && method === "GET") {
		return {
			...buildAnalytics(store),
			inventory_value: store.products.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.price || 0), 0),
			products_shipped: store.products.reduce((sum, item) => sum + Number(item.shipped_units || 0), 0),
			ghosting_rate: 0,
			estimated: true,
			shipments: store.shipments.reduce((grouped: any[], shipment) => {
				const current = grouped.find((item) => item.stage === shipment.stage);
				if (current) current.count += 1;
				else grouped.push({ stage: shipment.stage, count: 1 });
				return grouped;
			}, []),
			campaigns_list: store.campaigns.map(({ id, title, status }) => ({ id, title, status })),
		} as T;
	}

	if (normalizedPath === "/shipments" && method === "GET") {
		return store.shipments as T;
	}

	if (normalizedPath.startsWith("/shipments/") && normalizedPath.endsWith("/advance") && method === "POST") {
		const shipmentId = Number(normalizedPath.split("/")[2] || 0);
		const stages = ["order_placed", "packed", "shipped", "out_for_delivery", "delivered"];
		const shipmentIndex = store.shipments.findIndex((item) => item.id === shipmentId);
		if (shipmentIndex === -1) {
			throw new Error("Shipment not found");
		}

		const current = store.shipments[shipmentIndex];
		const nextStage = stages[Math.min(stages.indexOf(current.stage || "order_placed") + 1, stages.length - 1)];
		const updated = { ...current, stage: nextStage, updated_at: new Date().toISOString() };
		const collaboration = store.collaborations.find((item) => item.id === current.collaboration_id);
		const campaign = store.campaigns.find((item) => item.id === collaboration?.campaign_id);
		const nextStore = {
			...store,
			shipments: store.shipments.map((item) => (item.id === shipmentId ? updated : item)),
			collaborations: store.collaborations.map((item) => item.id === current.collaboration_id ? { ...item, status: nextStage === "delivered" ? "delivered" : nextStage === "shipped" ? "shipped" : item.status, shipped_at: nextStage === "shipped" ? updated.updated_at : item.shipped_at, delivered_at: nextStage === "delivered" ? updated.updated_at : item.delivered_at, deadline: nextStage === "delivered" ? new Date(Date.now() + Number(campaign?.posting_deadline_days || 7) * 86400000).toISOString() : item.deadline } : item),
			products: nextStage === "shipped" ? store.products.map((item) => item.id === campaign?.product_id ? { ...item, reserved_units: Math.max(0, Number(item.reserved_units || 0) - 1), shipped_units: Number(item.shipped_units || 0) + 1 } : item) : store.products,
		};
		writeStore(nextStore);
		return updated as T;
	}

	if (normalizedPath.startsWith("/proofs") && method === "GET") {
		const params = new URLSearchParams(normalizedPath.split("?")[1] || "");
		const brandId = Number(params.get("brand_id") || 0);
		const verifiedFilter = params.has("verified") ? Number(params.get("verified")) : null;
		return store.proofs.filter((proof) => {
			const collaboration = store.collaborations.find((item) => item.id === proof.collaboration_id);
			const campaign = store.campaigns.find((item) => item.id === collaboration?.campaign_id);
			return (!brandId || Number(campaign?.brand_id || 1) === brandId) && (verifiedFilter === null || Number(proof.verified) === verifiedFilter);
		}).map((proof) => {
			const collaboration = store.collaborations.find((item) => item.id === proof.collaboration_id);
			const campaign = store.campaigns.find((item) => item.id === collaboration?.campaign_id);
			const creator = store.creators.find((item) => item.id === collaboration?.creator_id);
			const product = store.products.find((item) => item.id === campaign?.product_id);
			return { ...proof, creator: creator?.name, handle: creator?.handle, campaign: campaign?.title, product: product?.name, deadline: collaboration?.deadline, verified_by_name: proof.verified_by ? store.users.find((user) => user.id === proof.verified_by)?.name : undefined };
		}) as T;
	}

	if ((normalizedPath === "/proofs" || /^\/collaborations\/\d+\/proof$/.test(normalizedPath)) && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}") as any;
		const collaborationId = normalizedPath === "/proofs" ? Number(body.collaboration_id || 1) : Number(normalizedPath.split("/")[2]);
		let proofUrl: URL;
		try {
			proofUrl = new URL(body.url);
		} catch {
			throw new Error("Submit a valid public social post URL.");
		}
		const host = proofUrl.hostname.toLowerCase();
		if (!(["http:", "https:"].includes(proofUrl.protocol) && ["instagram.com", "youtube.com", "youtu.be", "tiktok.com"].some((domain) => host === domain || host.endsWith(`.${domain}`)))) throw new Error("Submit a public Instagram, YouTube, or TikTok URL.");
		if (store.proofs.some((item) => item.url === body.url)) throw new Error("This proof URL was already submitted.");
		const collaboration = store.collaborations.find((item) => item.id === collaborationId);
		if (!collaboration) throw new Error("Collaboration not found");
		if (!["delivered", "deadline_missed"].includes(collaboration.status)) throw new Error("Proof can be submitted after delivery");
		const campaign = store.campaigns.find((item) => item.id === collaboration.campaign_id);
		const targetPlatform = String(campaign?.target_platform || "").toLowerCase();
		if (targetPlatform && targetPlatform !== "youtube" && !host.endsWith(`${targetPlatform}.com`)) throw new Error("Proof URL platform does not match the campaign platform");
		if (targetPlatform === "youtube" && !host.endsWith("youtube.com") && host !== "youtu.be") throw new Error("Proof URL platform does not match the campaign platform");
		const nextProof = {
			id: (store.proofs.at(-1)?.id ?? 0) + 1,
			collaboration_id: collaborationId,
			url: body.url || "https://www.instagram.com/p/demo/",
			caption: body.caption || "Campaign proof",
			verified: 0,
			submitted_at: new Date().toISOString(),
		};

		const nextStore = {
			...store,
			proofs: [nextProof, ...store.proofs],
			collaborations: store.collaborations.map((item) => item.id === collaborationId ? { ...item, status: "proof_submitted" } : item),
		};
		writeStore(nextStore);
		return nextProof as T;
	}

	if ((normalizedPath === "/proof/verify" || /^\/proofs\/\d+\/verify$/.test(normalizedPath)) && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}");
		const proofId = normalizedPath === "/proof/verify" ? Number(body.proof_id) : Number(normalizedPath.split("/")[2]);
		const proof = store.proofs.find((item) => item.id === proofId);
		if (!proof) throw new Error("Proof not found");
		const collaboration = store.collaborations.find((item) => item.id === proof.collaboration_id);
		const campaign = store.campaigns.find((item) => item.id === collaboration?.campaign_id);
		const reviewerId = Number(body.reviewer_id || 1);
		const reviewer = store.users.find((item) => item.id === reviewerId && item.role === "brand");
		if (!reviewer) throw new Error("Only a brand workspace can approve a proof");
		if (Number(campaign?.brand_id || 1) !== reviewerId) throw new Error("Only the campaign's brand owner can approve this proof");
		const verified = { ...proof, verified: 1, verified_by: reviewerId, verified_at: new Date().toISOString() };
		const nextStore = {
			...store,
			proofs: store.proofs.map((item) => item.id === proofId ? verified : item),
			collaborations: store.collaborations.map((item) => item.id === proof.collaboration_id ? { ...item, status: "completed", completed_at: new Date().toISOString() } : item),
			creators: store.creators.map((item) => item.id === collaboration?.creator_id ? { ...item, trust_score: Math.min(100, Number(item.trust_score || 70) + 10), completed_collaborations: Number(item.completed_collaborations || 0) + 1, successful_posts: Number(item.successful_posts || 0) + 1 } : item),
		};
		writeStore(nextStore);
		return { proof: verified, status: "verified", verification_mode: "mock" } as T;
	}

	if (["/ai/generate", "/ai/campaign-description", "/ai/match-explanation", "/ai/outreach", "/ai/insights", "/ai/risk-explanation"].includes(normalizedPath) && method === "POST") {
		const body = JSON.parse((init?.body as string) || "{}") as any;
		if (normalizedPath === "/ai/risk-explanation") {
			const reasons = [Number(body.ghosted_campaigns) ? `${body.ghosted_campaigns} missed deadline(s)` : "", Number(body.missed_deadlines) ? `${body.missed_deadlines} late submission(s)` : "", Number(body.duplicate_proofs) ? `${body.duplicate_proofs} duplicate proof attempt(s)` : ""].filter(Boolean);
			const trustScore = Number(body.trust_score ?? 70);
			const risk = trustScore < 40 || Number(body.ghosted_campaigns) >= 2 || Number(body.duplicate_proofs) ? "HIGH RISK" : trustScore < 60 || Number(body.ghosted_campaigns) || Number(body.missed_deadlines) ? "MEDIUM RISK" : "LOW RISK";
			return { risk, reasons: reasons.length ? reasons : ["No recorded risk signals."], text: "Operational risk is based only on recorded platform events, not a claim about the creator's character.", source: "fallback" } as T;
		}
		return {
			text: `AI brief for ${body.product || "your product"}: focus on ${body.audience || "target creators"}, share authentic product-story content, and measure creator engagement through honest UGC and conversion-driven callouts.`,
			source: "fallback",
		} as T;
	}

	if (normalizedPath === "/live-demo" && method === "POST") {
		const campaign = store.campaigns[0];
		const rankedCreators = store.creators.map((creator) => ({ creator, ...scoreCreator(creator, campaign) })).sort((a, b) => b.score - a.score);
		const creator = rankedCreators[0]?.creator;
		if (!campaign || !creator) throw new Error("Demo data is unavailable");
		const collaborationId = (store.collaborations.at(-1)?.id ?? 0) + 1;
		const shipmentId = (store.shipments.at(-1)?.id ?? 0) + 1;
		const proofId = (store.proofs.at(-1)?.id ?? 0) + 1;
		const now = new Date().toISOString();
		const product = store.products.find((item) => item.id === campaign.product_id);
		const generatedBrief = campaign.description || `Campaign brief for ${product?.name || "your product"}: focus on ${campaign.niche} creators, show an authentic product experience, and disclose the gifted partnership.`;
		const nextStore = {
			...store,
			campaigns: store.campaigns.map((item) => item.id === campaign.id ? { ...item, description: generatedBrief } : item),
			products: store.products.map((item) => item.id === product?.id ? { ...item, stock: Math.max(0, item.stock - 1), shipped_units: Number(item.shipped_units || 0) + 1 } : item),
			collaborations: [{ id: collaborationId, campaign_id: campaign.id, creator_id: creator.id, status: "completed", claimed_at: now, shipped_at: now, delivered_at: now, completed_at: now, deadline: new Date(Date.now() + Number(campaign.posting_deadline_days || 7) * 86400000).toISOString(), agreed_value: product?.price || 0 }, ...store.collaborations],
			shipments: [{ id: shipmentId, collaboration_id: collaborationId, creator_id: creator.id, creator: creator.name, campaign: campaign.title, product: product?.name || "Product", provider: "Mock", tracking_code: `BM${String(shipmentId).padStart(6, "0")}`, stage: "delivered", updated_at: now, deadline: new Date(Date.now() + Number(campaign.posting_deadline_days || 7) * 86400000).toISOString() }, ...store.shipments],
			proofs: [{ id: proofId, collaboration_id: collaborationId, url: `https://www.instagram.com/p/bm-demo-${proofId}/`, caption: "Synthetic demo proof; no platform verification performed.", verified: 1, submitted_at: now }, ...store.proofs],
			creators: store.creators.map((item) => item.id === creator.id ? { ...item, trust_score: Math.min(100, Number(item.trust_score || 70) + 10), completed_collaborations: Number(item.completed_collaborations || 0) + 1, successful_posts: Number(item.successful_posts || 0) + 1 } : item),
		};
		writeStore(nextStore);
		return {
			campaign,
			ai_source: "fallback",
			generated_brief: generatedBrief,
			collaboration_id: collaborationId,
			shipment_id: shipmentId,
			proof_id: proofId,
			ranked_creators: rankedCreators,
			analytics: buildAnalytics(nextStore),
			message: "Demo lifecycle completed: match, claim, mock delivery, proof, and trust update. No social platform was contacted.",
		} as T;
	}

	throw new Error("This feature is unavailable without the backend service.");
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(API + path, {
			...init,
			headers: {
				"Content-Type": "application/json",
				...(init?.headers || {}),
			},
		});
	} catch {
		return fallbackApi<T>(path, init);
	}

	if (!response.ok) {
		let message = `HTTP ${response.status}`;
		const body = await response.text();
		try {
			const error = JSON.parse(body);
			message = error.detail || message;
		} catch {
			message = body || message;
		}
		throw new Error(message);
	}

	return (await response.json()) as T;
}
