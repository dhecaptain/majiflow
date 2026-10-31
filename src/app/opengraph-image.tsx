import { ImageResponse } from "next/og";

export const alt = "MajiFlow - Clean water, delivered simply";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0f172a",
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 18% 12%, rgba(0,87,230,0.55), transparent 62%), radial-gradient(ellipse 60% 60% at 92% 96%, rgba(0,194,214,0.40), transparent 60%)",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "76px",
              height: "76px",
              borderRadius: "20px",
              backgroundImage: "linear-gradient(135deg, #0057E6, #00C2D6)",
              color: "#ffffff",
              fontSize: "42px",
              fontWeight: "700",
            }}
          >
            M
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "40px",
              fontWeight: "700",
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            MajiFlow
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: "76px",
              fontWeight: "700",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#ffffff",
            }}
          >
            Clean water, delivered simply
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "26px",
              fontSize: "32px",
              lineHeight: 1.35,
              color: "#cbd5e1",
            }}
          >
            Order refills from stations near you. Browse, build a cart, pay on delivery and follow your order.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {["Verified stations", "Order tracking", "Secure payments"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.22)",
                backgroundColor: "rgba(255,255,255,0.07)",
                fontSize: "24px",
                color: "#e2e8f0",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
