/**
 * DBW Care Board – Gradient Pill Logo
 * Reusable branded component for login screens.
 */

type TDBWCareLogoProps = {
  className?: string;
};

export function DBWCareLogo({ className }: TDBWCareLogoProps) {
  return (
    <div className={className}>
      <span
        style={{
          display: "inline-block",
          padding: "8px 20px",
          borderRadius: "999px",
          border: "2px solid transparent",
          background:
            "linear-gradient(#0d0d0d, #0d0d0d) padding-box, linear-gradient(135deg, #ea2b1f, #ff3c6f, #ff4fdd, #7e56ff, #00b2ff) border-box",
          color: "#fff",
          fontSize: "20px",
          letterSpacing: "0.08em",
          lineHeight: 1,
        }}
      >
        <span style={{ fontWeight: 400 }}>DBW</span>
        <span style={{ fontWeight: 700 }}>CARE</span>
      </span>
    </div>
  );
}
