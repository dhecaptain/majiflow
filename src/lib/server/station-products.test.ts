import { describe, expect, it } from "vitest";
import { ProductValidationError, validateProductInput } from "./station-products";

const valid = {
  name: "Refill - 20L can",
  description: "Filtered and sealed at the station.",
  category: "refill",
  unit: "refill",
  price: 300,
  stock: 40,
};

function fieldsOf(input: unknown): Record<string, string> {
  try {
    validateProductInput(input);
    return {};
  } catch (error) {
    if (error instanceof ProductValidationError) return error.fields;
    throw error;
  }
}

describe("validateProductInput", () => {
  it("accepts a complete product and fills sensible defaults", () => {
    expect(validateProductInput(valid)).toMatchObject({
      name: "Refill - 20L can",
      price: 300,
      oldPrice: null,
      stockLow: 10,
      image: "bottle",
      isVisible: true,
      options: [],
    });
  });

  it("explains every missing or invalid field", () => {
    expect(fieldsOf({})).toMatchObject({
      name: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      price: expect.any(String),
    });
    expect(fieldsOf({ ...valid, price: -5 })).toHaveProperty("price");
    expect(fieldsOf({ ...valid, stock: 2.5 })).toHaveProperty("stock");
  });

  it("only accepts an old price above the current one", () => {
    expect(fieldsOf({ ...valid, oldPrice: 250 })).toHaveProperty("oldPrice");
    expect(validateProductInput({ ...valid, oldPrice: 350 }).oldPrice).toBe(350);
  });

  it("keeps choices with unique ids and refuses malformed ones", () => {
    const { options } = validateProductInput({
      ...valid,
      options: [
        { label: "Swap an empty can", priceDelta: 0 },
        { label: "New can", priceDelta: 200, deposit: 150 },
      ],
    });
    expect(options.map((o) => o.id)).toEqual(["swap-an-empty-can", "new-can"]);
    expect(options[1]).toMatchObject({ priceDelta: 200, deposit: 150 });
    expect(fieldsOf({ ...valid, options: [{ label: "", priceDelta: 0 }] })).toHaveProperty("options");
  });

  it("falls back to a known photo for an unknown image key", () => {
    expect(validateProductInput({ ...valid, image: "../../etc/passwd" }).image).toBe("bottle");
  });
});
