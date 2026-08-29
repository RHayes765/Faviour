export interface ProductInfo {
  name: string | null;
  brand: string | null;
}

/**
 * Best-effort product lookup by barcode via the free Open Food Facts API.
 * Every failure mode (offline, timeout, unknown product, bad payload)
 * resolves to null — the add-item flow must never block on this.
 */
export async function lookupBarcode(barcode: string): Promise<ProductInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode,
      )}.json?fields=product_name,brands`,
      { signal: controller.signal },
    );
    if (!res.ok) {
      return null;
    }
    const json: unknown = await res.json();
    const product = (json as { product?: { product_name?: unknown; brands?: unknown } })
      .product;
    if (!product) {
      return null;
    }
    const name =
      typeof product.product_name === 'string' && product.product_name.trim()
        ? product.product_name.trim()
        : null;
    const brand =
      typeof product.brands === 'string' && product.brands.trim()
        ? product.brands.split(',')[0].trim()
        : null;
    if (!name && !brand) {
      return null;
    }
    return { name, brand };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
