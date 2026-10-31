"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatKES } from "@/lib/format";
import { productImage } from "@/lib/product-images";
import { getBusinessAvailability } from "@/lib/business-hours";
import { useBusiness } from "@/components/business/business-provider";
import type { BusinessProduct } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The station's own catalogue. Every change is saved on the server, and the
 * prices and stock here are the ones checkout validates orders against.
 */

const CATEGORIES: { value: BusinessProduct["category"]; label: string }[] = [
  { value: "refill", label: "Refill" },
  { value: "bottled", label: "Bottled water" },
  { value: "remineralised", label: "Remineralised" },
  { value: "dispenser", label: "Dispenser" },
];

const PHOTOS = [
  { value: "can", label: "20L can" },
  { value: "bottle", label: "Bottle" },
  { value: "glass", label: "Glass" },
  { value: "dispenser", label: "Dispenser" },
];

interface FormState {
  name: string;
  description: string;
  category: BusinessProduct["category"];
  unit: string;
  price: string;
  oldPrice: string;
  stock: string;
  stockLow: string;
  image: string;
  popular: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "refill",
  unit: "refill",
  price: "",
  oldPrice: "",
  stock: "0",
  stockLow: "10",
  image: "can",
  popular: false,
};

function formFrom(product: BusinessProduct): FormState {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    unit: product.unit,
    price: String(product.price),
    oldPrice: product.oldPrice ? String(product.oldPrice) : "",
    stock: String(product.stock),
    stockLow: String(product.stockLow),
    image: product.image,
    popular: Boolean(product.popular),
  };
}

/** Demo stations live in the seeded catalogue and cannot be edited from here. */
const isEditableStation = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export function BusinessProducts() {
  const { business } = useBusiness();
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = useState<BusinessProduct[]>(business.products);
  const [syncedFor, setSyncedFor] = useState(business);
  const [editing, setEditing] = useState<BusinessProduct | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const availability = getBusinessAvailability(business.openingHours);
  const editable = isEditableStation(business.id);

  // A fresh server copy (another station selected, or a refresh) replaces local edits.
  if (syncedFor !== business) {
    setSyncedFor(business);
    setProducts(business.products);
  }

  const counts = useMemo(
    () => ({
      live: products.filter((p) => !p.hidden).length,
      total: products.length,
      low: products.filter((p) => p.stock <= p.stockLow).length,
    }),
    [products]
  );

  async function send(path: string, init: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
    if (response.status === 204) return {};
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      fields?: Record<string, string>;
      product?: BusinessProduct;
    };
    if (!response.ok) {
      const error = new Error(body.error ?? "Something went wrong. Please try again.") as Error & {
        fields?: Record<string, string>;
      };
      error.fields = body.fields;
      throw error;
    }
    return body;
  }

  function openEditor(product: BusinessProduct | "new") {
    setEditing(product);
    setForm(product === "new" ? EMPTY_FORM : formFrom(product));
    setErrors({});
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy("form");
    setErrors({});
    const payload = {
      businessId: business.id,
      ...form,
      oldPrice: form.oldPrice.trim() ? form.oldPrice : null,
      // Choices are not edited here; keep whatever the product already offers.
      options: editing === "new" ? [] : editing.options ?? [],
      isVisible: editing === "new" ? true : !editing.hidden,
    };
    try {
      const { product } =
        editing === "new"
          ? await send("/api/business/products", { method: "POST", body: JSON.stringify(payload) })
          : await send(`/api/business/products/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (product) {
        setProducts((current) =>
          editing === "new" ? [...current, product] : current.map((p) => (p.id === product.id ? product : p))
        );
      }
      toast({ kind: "success", title: editing === "new" ? `${form.name} added` : `${form.name} saved` });
      setEditing(null);
      router.refresh();
    } catch (error) {
      setErrors((error as { fields?: Record<string, string> }).fields ?? {});
      toast({ kind: "error", title: "Could not save the product", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function toggle(product: BusinessProduct) {
    setBusy(product.id);
    try {
      const { product: updated } = await send(`/api/business/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ businessId: business.id, isVisible: Boolean(product.hidden) }),
      });
      if (updated) setProducts((current) => current.map((p) => (p.id === updated.id ? updated : p)));
      toast({
        kind: "info",
        title: product.hidden ? `${product.name} is back on your menu` : `${product.name} hidden`,
        message: "Customers see the change within a minute.",
      });
      router.refresh();
    } catch (error) {
      toast({ kind: "error", title: "Could not update the product", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(product: BusinessProduct) {
    if (!window.confirm(`Remove ${product.name} from your catalogue? This cannot be undone.`)) return;
    setBusy(product.id);
    try {
      await send(`/api/business/products/${product.id}?businessId=${encodeURIComponent(business.id)}`, {
        method: "DELETE",
      });
      setProducts((current) => current.filter((p) => p.id !== product.id));
      toast({ kind: "info", title: `${product.name} removed` });
      router.refresh();
    } catch (error) {
      toast({ kind: "error", title: "Could not remove the product", message: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.total === 0
              ? "Nothing on your menu yet"
              : `${counts.live} of ${counts.total} on your menu`}
            {counts.low > 0 && <span className="text-warning"> · {counts.low} at reorder point</span>}
          </p>
        </div>
        {editable && (
          <Button onClick={() => openEditor("new")}>
            <Plus className="size-4" aria-hidden /> New product
          </Button>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-white p-5 shadow-card">
        <Badge variant={availability.state === "open" ? "success" : "muted"}>{availability.hoursLabel}</Badge>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {editable
            ? "Checkout charges the prices below. Hide an item to take it off your menu without deleting it."
            : "This is a demo station from the sample catalogue, so its products cannot be edited."}
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-6" aria-hidden />}
          title="Add your first product"
          description="Customers can order once your station has at least one product and its opening hours."
          action={editable ? <Button onClick={() => openEditor("new")}>New product</Button> : undefined}
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const isLive = !p.hidden;
            return (
              <article
                key={p.id}
                className={cn(
                  "rounded-2xl border border-border bg-white p-5 shadow-card transition-opacity",
                  !isLive && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand/10">
                    <Image src={productImage(p.image)} alt="" className="size-full object-cover" />
                  </span>
                  <Badge variant={isLive ? "softAccent" : "muted"}>{isLive ? "On menu" : "Hidden"}</Badge>
                </div>
                <h2 className="mt-3 font-display text-lg text-foreground">{p.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-display text-xl text-foreground">
                    {formatKES(p.price)}
                    {p.oldPrice && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                        {formatKES(p.oldPrice)}
                      </span>
                    )}
                  </span>
                  <span className={cn("font-mono text-xs", p.stock <= p.stockLow ? "text-danger" : "text-muted-foreground")}>
                    {p.stock} in stock
                  </span>
                </div>
                {editable && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => openEditor(p)}>
                      <Pencil className="size-4" aria-hidden /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void toggle(p)}
                      aria-label={isLive ? `Hide ${p.name}` : `Show ${p.name}`}
                    >
                      {isLive ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                      {isLive ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void remove(p)}
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden /> Remove
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New product" : "Edit product"}
        description="Prices are in KES and are what checkout charges."
      >
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Description" required error={errors.description}>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={3} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" error={errors.category}>
              <Select value={form.category} onChange={(e) => set("category", e.target.value as FormState["category"])}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Photo">
              <Select value={form.image} onChange={(e) => set("image", e.target.value)}>
                {PHOTOS.map((photo) => (
                  <option key={photo.value} value={photo.value}>
                    {photo.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price (KES)" required error={errors.price}>
              <Input inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="Old price (KES)" hint="Optional, shown crossed out." error={errors.oldPrice}>
              <Input inputMode="decimal" value={form.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
            </Field>
            <Field label="In stock" error={errors.stock}>
              <Input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
            </Field>
            <Field label="Reorder point" hint="Flag stock at or below this." error={errors.stockLow}>
              <Input inputMode="numeric" value={form.stockLow} onChange={(e) => set("stockLow", e.target.value)} />
            </Field>
            <Field label="Sold per" hint="e.g. refill, bottle, can.">
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} maxLength={24} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.popular}
              onChange={(e) => set("popular", e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Mark as popular
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy === "form"}>
              {busy === "form" ? "Saving…" : "Save product"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
