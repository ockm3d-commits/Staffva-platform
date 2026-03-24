"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ServicePackage {
  id: string;
  title: string;
  description: string;
  whats_included: string[];
  whats_not_included: string[];
  delivery_days: number;
  price_usd: number;
  tier: string;
  category: string;
  status: string;
  max_concurrent_orders: number;
  created_at: string;
}

interface ServiceOrder {
  id: string;
  status: string;
  client_requirements: string;
  delivery_message: string | null;
  delivery_url: string | null;
  revision_note: string | null;
  ordered_at: string;
  submitted_at: string | null;
  auto_release_at: string | null;
  candidate_amount_usd: number;
  service_packages: { title: string; delivery_days: number; category: string } | null;
  clients: { full_name: string } | null;
}

const DELIVERY_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
  { value: 5, label: "5 days" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
];

const TIER_OPTIONS = ["basic", "standard", "premium"];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  released: "bg-green-100 text-green-700",
  disputed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function MyServicesPage() {
  const [tab, setTab] = useState<"packages" | "orders">("packages");
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [role, setRole] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [whatsIncluded, setWhatsIncluded] = useState<string[]>([""]);
  const [whatsNotIncluded, setWhatsNotIncluded] = useState<string[]>([]);
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [priceUsd, setPriceUsd] = useState("");
  const [tier, setTier] = useState("basic");
  const [category, setCategory] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [formStatus, setFormStatus] = useState<"draft" | "active">("draft");
  const [saving, setSaving] = useState(false);

  // Delivery form state
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [submittingDelivery, setSubmittingDelivery] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setRole(profile?.role || null);

    if (profile?.role === "candidate") {
      // Fetch packages
      const pkgRes = await fetch("/api/services/packages?own=true");
      const pkgData = await pkgRes.json();
      setPackages(pkgData.packages || []);

      // Fetch orders
      const ordRes = await fetch("/api/services/orders?role=candidate");
      const ordData = await ordRes.json();
      setOrders(ordData.orders || []);
    } else if (profile?.role === "client") {
      // Clients see their purchases
      const ordRes = await fetch("/api/services/orders?role=client");
      const ordData = await ordRes.json();
      setOrders(ordData.orders || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setWhatsIncluded([""]);
    setWhatsNotIncluded([]);
    setDeliveryDays(3);
    setPriceUsd("");
    setTier("basic");
    setCategory("");
    setMaxConcurrent(3);
    setFormStatus("draft");
    setEditingId(null);
    setError("");
  }

  function openEdit(pkg: ServicePackage) {
    setTitle(pkg.title);
    setDescription(pkg.description);
    setWhatsIncluded(pkg.whats_included.length > 0 ? pkg.whats_included : [""]);
    setWhatsNotIncluded(pkg.whats_not_included || []);
    setDeliveryDays(pkg.delivery_days);
    setPriceUsd(pkg.price_usd.toString());
    setTier(pkg.tier);
    setCategory(pkg.category);
    setMaxConcurrent(pkg.max_concurrent_orders);
    setFormStatus(pkg.status as "draft" | "active");
    setEditingId(pkg.id);
    setShowForm(true);
    setError("");
  }

  async function handleSave(publishStatus: "draft" | "active") {
    setError("");
    setSaving(true);

    const included = whatsIncluded.filter((item) => item.trim() !== "");
    if (!title.trim() || !description.trim() || !priceUsd || !category) {
      setError("Please fill in all required fields.");
      setSaving(false);
      return;
    }
    if (included.length === 0) {
      setError("Add at least one item to What's Included.");
      setSaving(false);
      return;
    }
    if (Number(priceUsd) < 25) {
      setError("Minimum price is $25.");
      setSaving(false);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      whats_included: included,
      whats_not_included: whatsNotIncluded.filter((i) => i.trim() !== ""),
      delivery_days: deliveryDays,
      price_usd: Number(priceUsd),
      tier,
      category,
      max_concurrent_orders: maxConcurrent,
      status: publishStatus,
    };

    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { id: editingId, ...payload } : payload;

    const res = await fetch("/api/services/packages", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save package");
      setSaving(false);
      return;
    }

    setSuccess(publishStatus === "active" ? "Service published!" : "Draft saved!");
    setTimeout(() => setSuccess(""), 3000);
    resetForm();
    setShowForm(false);
    fetchData();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this service package?")) return;

    const res = await fetch(`/api/services/packages?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to delete");
      return;
    }
    fetchData();
  }

  async function handleToggleStatus(pkg: ServicePackage) {
    const newStatus = pkg.status === "active" ? "paused" : "active";
    const res = await fetch("/api/services/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pkg.id, status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update status");
      return;
    }
    fetchData();
  }

  async function handleSubmitDelivery(orderId: string) {
    if (!deliveryMessage.trim()) {
      setError("Please add a delivery message.");
      return;
    }
    setError("");

    const res = await fetch("/api/services/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        action: "submit_delivery",
        delivery_message: deliveryMessage.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to submit delivery");
      return;
    }

    setSubmittingDelivery(null);
    setDeliveryMessage("");
    setSuccess("Delivery submitted! Client will be notified.");
    setTimeout(() => setSuccess(""), 3000);
    fetchData();
  }

  async function handleOrderAction(orderId: string, action: string, note?: string) {
    const res = await fetch("/api/services/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action, revision_note: note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    setSuccess("Done!");
    setTimeout(() => setSuccess(""), 3000);
    fetchData();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-text/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-text">
        {role === "client" ? "My Purchases" : "My Services"}
      </h1>
      <p className="mt-1 text-sm text-text/60">
        {role === "client"
          ? "Track your service orders"
          : "Create and manage your service packages"}
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}

      {role === "candidate" && (
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setTab("packages")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "packages"
                ? "bg-primary text-white"
                : "bg-gray-100 text-text/70 hover:bg-gray-200"
            }`}
          >
            My Packages ({packages.length}/3)
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "orders"
                ? "bg-primary text-white"
                : "bg-gray-100 text-text/70 hover:bg-gray-200"
            }`}
          >
            Orders ({orders.filter((o) => ["in_progress", "submitted"].includes(o.status)).length} active)
          </button>
        </div>
      )}

      {/* PACKAGES TAB */}
      {role === "candidate" && tab === "packages" && (
        <div className="mt-6">
          {!showForm && packages.length < 3 && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              + Create Service Package
            </button>
          )}

          {showForm && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-bold text-text">
                {editingId ? "Edit Service Package" : "Create Service Package"}
              </h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text">Title *</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Monthly Bookkeeping for Small Business"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-text/50">{title.length}/80</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text">Description *</label>
                  <textarea
                    maxLength={500}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe exactly what you will deliver"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-text/50">{description.length}/500</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text">Category *</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Bookkeeping"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text">Tier</label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {TIER_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text">Price (USD) *</label>
                    <input
                      type="number"
                      min={25}
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(e.target.value)}
                      placeholder="Min $25"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text">Delivery Time</label>
                    <select
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {DELIVERY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text">Max Concurrent</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxConcurrent}
                      onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* What's Included */}
                <div>
                  <label className="block text-sm font-medium text-text">
                    What&apos;s Included * (up to 8 items)
                  </label>
                  {whatsIncluded.map((item, i) => (
                    <div key={i} className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...whatsIncluded];
                          updated[i] = e.target.value;
                          setWhatsIncluded(updated);
                        }}
                        placeholder={`Item ${i + 1}`}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      {whatsIncluded.length > 1 && (
                        <button
                          onClick={() => setWhatsIncluded(whatsIncluded.filter((_, j) => j !== i))}
                          className="text-red-500 text-sm hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {whatsIncluded.length < 8 && (
                    <button
                      onClick={() => setWhatsIncluded([...whatsIncluded, ""])}
                      className="mt-2 text-sm font-medium text-primary hover:text-orange-600"
                    >
                      + Add item
                    </button>
                  )}
                </div>

                {/* What's Not Included */}
                <div>
                  <label className="block text-sm font-medium text-text">
                    What&apos;s Not Included (optional, up to 5)
                  </label>
                  {whatsNotIncluded.map((item, i) => (
                    <div key={i} className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...whatsNotIncluded];
                          updated[i] = e.target.value;
                          setWhatsNotIncluded(updated);
                        }}
                        placeholder={`Exclusion ${i + 1}`}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => setWhatsNotIncluded(whatsNotIncluded.filter((_, j) => j !== i))}
                        className="text-red-500 text-sm hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {whatsNotIncluded.length < 5 && (
                    <button
                      onClick={() => setWhatsNotIncluded([...whatsNotIncluded, ""])}
                      className="mt-2 text-sm font-medium text-primary hover:text-orange-600"
                    >
                      + Add exclusion
                    </button>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleSave("draft")}
                    disabled={saving}
                    className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save as Draft"}
                  </button>
                  <button
                    onClick={() => handleSave("active")}
                    disabled={saving}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {saving ? "Publishing..." : "Publish"}
                  </button>
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    className="text-sm text-text/60 hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Package cards */}
          <div className="mt-6 space-y-4">
            {packages.length === 0 && !showForm && (
              <p className="text-sm text-text/50">
                No service packages yet. Create your first one to start earning.
              </p>
            )}
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-text">{pkg.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pkg.status]}`}
                      >
                        {pkg.status}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {pkg.tier}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text/60">{pkg.category}</p>
                  </div>
                  <p className="text-xl font-bold text-primary">${Number(pkg.price_usd).toFixed(0)}</p>
                </div>

                <p className="mt-3 text-sm text-text/80">{pkg.description}</p>

                <div className="mt-3">
                  <p className="text-xs font-medium text-text/50 uppercase">Includes:</p>
                  <ul className="mt-1 space-y-1">
                    {pkg.whats_included.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-text/70">
                        <span className="text-green-500">&#10003;</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-text/50">
                    Delivery: {pkg.delivery_days} day{pkg.delivery_days !== 1 ? "s" : ""} &middot; Max {pkg.max_concurrent_orders} concurrent
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(pkg)}
                      className="text-sm font-medium text-primary hover:text-orange-600"
                    >
                      Edit
                    </button>
                    {pkg.status !== "draft" && (
                      <button
                        onClick={() => handleToggleStatus(pkg)}
                        className="text-sm font-medium text-text/60 hover:text-text"
                      >
                        {pkg.status === "active" ? "Pause" : "Activate"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(pkg.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {(tab === "orders" || role === "client") && (
        <div className="mt-6 space-y-4">
          {orders.length === 0 && (
            <p className="text-sm text-text/50">No orders yet.</p>
          )}
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-text">
                    {order.service_packages?.title || "Service Order"}
                  </h3>
                  <p className="mt-0.5 text-sm text-text/60">
                    {role === "candidate"
                      ? `Client: ${order.clients?.full_name || "Unknown"}`
                      : `By: ${((order as unknown as { candidates?: { display_name: string } })?.candidates?.display_name) || "Unknown"}`}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {order.status.replace("_", " ")}
                  </span>
                  <p className="mt-1 text-lg font-bold text-primary">
                    ${Number(order.candidate_amount_usd).toFixed(0)}
                  </p>
                </div>
              </div>

              {order.client_requirements && (
                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-text/50 uppercase">Client Requirements</p>
                  <p className="mt-1 text-sm text-text/80">{order.client_requirements}</p>
                </div>
              )}

              {order.revision_note && (
                <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-xs font-medium text-yellow-700 uppercase">Revision Requested</p>
                  <p className="mt-1 text-sm text-yellow-800">{order.revision_note}</p>
                </div>
              )}

              {order.delivery_message && (
                <div className="mt-3 rounded-lg bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-700 uppercase">Delivery</p>
                  <p className="mt-1 text-sm text-text/80">{order.delivery_message}</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-text/50">
                  Ordered: {new Date(order.ordered_at).toLocaleDateString()}
                  {order.auto_release_at && (
                    <> &middot; Auto-release: {new Date(order.auto_release_at).toLocaleDateString()}</>
                  )}
                </p>

                {/* Candidate actions */}
                {role === "candidate" && order.status === "in_progress" && (
                  <div>
                    {submittingDelivery === order.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryMessage}
                          onChange={(e) => setDeliveryMessage(e.target.value)}
                          placeholder="Describe what you delivered..."
                          className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                          maxLength={500}
                        />
                        <button
                          onClick={() => handleSubmitDelivery(order.id)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => {
                            setSubmittingDelivery(null);
                            setDeliveryMessage("");
                          }}
                          className="text-sm text-text/60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSubmittingDelivery(order.id)}
                        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
                      >
                        Submit Delivery
                      </button>
                    )}
                  </div>
                )}

                {/* Client actions */}
                {role === "client" && order.status === "submitted" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOrderAction(order.id, "approve")}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Approve & Release
                    </button>
                    <button
                      onClick={() => {
                        const note = prompt("What needs to be revised?");
                        if (note && note.length >= 10) {
                          handleOrderAction(order.id, "request_revision", note);
                        }
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-text hover:bg-gray-50"
                    >
                      Request Revision
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
