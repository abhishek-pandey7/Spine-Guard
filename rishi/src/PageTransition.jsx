import { useEffect, useState } from "react";

export default function PageTransition({ children, transitionKey }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so the animation triggers on mount
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [transitionKey]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </div>
  );
}
