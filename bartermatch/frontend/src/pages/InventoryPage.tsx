import React, { useEffect, useState } from "react";
import { api } from "../services/api";

const emptyProduct = { name: "", category: "", price: 0, stock: 0, description: "" };

export default function InventoryPage() {
	const [items, setItems] = useState<any[]>([]);
	const [query, setQuery] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [product, setProduct] = useState(emptyProduct);
	const [message, setMessage] = useState("");

	const load = async () => setItems(await api<any[]>("/products"));
	useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

	const createProduct = async (event: React.FormEvent) => {
		event.preventDefault();
		try {
			await api("/products", { method: "POST", body: JSON.stringify(product) });
			setProduct(emptyProduct);
			setShowForm(false);
			setMessage("Product saved to inventory.");
			await load();
		} catch (error: any) {
			setMessage(error.message || "Product could not be saved.");
		}
	};

	const filteredItems = items.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
	const availableUnits = items.reduce((sum, item) => sum + Number(item.stock || 0), 0);
	const inventoryValue = items.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.price || 0), 0);

	return (
		<>
			<div className="section-head page-head"><div><span className="eyebrow">Inventory</span><h1>Gift inventory</h1></div><div className="inventory-actions"><div className="search-box"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" /></div><button onClick={() => setShowForm((shown) => !shown)}>{showForm ? "Close form" : "Add product"}</button></div></div>
			<div className="summary-row"><span className="badge success">{items.length} products</span><span className="badge">{availableUnits} available units</span><span className="badge">₹{inventoryValue.toLocaleString()} listed retail value · estimate</span></div>
			{message && <p role="status" className="form-message">{message}</p>}
			{showForm && <form className="panel product-form" onSubmit={createProduct}><label>Product name<input required minLength={2} value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><label>Category<input value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} /></label><label>Retail value (₹)<input type="number" min="0" value={product.price} onChange={(event) => setProduct({ ...product, price: Number(event.target.value) })} /></label><label>Available units<input type="number" min="0" value={product.stock} onChange={(event) => setProduct({ ...product, stock: Number(event.target.value) })} /></label><label>Description<input value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label><button type="submit">Save product</button></form>}
			<div className="inventory-table" role="table" aria-label="Gift inventory">
				<div className="inventory-table-head" role="row"><span>Product</span><span>Retail value</span><span>Available</span><span>Reserved</span><span>Shipped</span></div>
				{filteredItems.map((item) => <div className="inventory-table-row" role="row" key={item.id}><div><strong>{item.name}</strong><small>{item.category || "Gift item"}</small></div><strong>₹{Number(item.price).toLocaleString()}</strong><span>{item.stock} units</span><span>{item.reserved_units || 0} units</span><span>{item.shipped_units || 0} units</span></div>)}
			</div>
			{filteredItems.length === 0 && <div className="panel empty-state">No products match that search.</div>}
		</>
	);
}