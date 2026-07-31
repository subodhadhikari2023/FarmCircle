import Link from "next/link";

/**
 * Signature element: a closed orbit — Grower, Vendor, Customer nodes
 * circling a central "Circle" core (Admin) — literalizing the product's
 * own name and its four-role loop instead of a generic marketplace hero.
 */

type OrbitNode = {
  label: string;
  angle: number;
  color: string;
};

const NODES: OrbitNode[] = [
  { label: "Grower", angle: -90, color: "var(--color-role-grower)" },
  { label: "Vendor", angle: 30, color: "var(--color-role-vendor)" },
  { label: "Customer", angle: 150, color: "var(--color-role-customer)" },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export function Hero() {
  const cx = 260;
  const cy = 260;
  const orbitR = 170;

  return (
    <section className="fc-hero">
      <div className="fc-hero__grid max-w-5xl">
        <div className="fc-hero__copy">
          <span className="fc-hero__eyebrow">
            Grower · Vendor · Customer · Admin
          </span>
          <h1 className="fc-hero__title">
            FarmCircle
            <br />
            From Farms to Table.
          </h1>
          <p className="fc-hero__body">
            FarmCircle closes the loop between the people who grow, the
            people who sell, and the people who buy — in one marketplace,
            without the usual middle layers.
          </p>
          <div className="fc-hero__actions">
            <Link href="/listings" className="fc-hero__cta-primary">
              Browse the circle
            </Link>
            <Link href="#how-it-works" className="fc-hero__cta-secondary">
              See how it works
            </Link>
          </div>
        </div>

        <div className="fc-hero__art" aria-hidden="true">
          <svg viewBox="0 0 520 520" className="fc-hero__svg">
            <defs>
              <radialGradient id="fc-core-glow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor="var(--color-icy-aqua-500)"
                  stopOpacity="0.55"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-icy-aqua-500)"
                  stopOpacity="0"
                />
              </radialGradient>
              <filter
                id="fc-node-glow"
                x="-60%"
                y="-60%"
                width="220%"
                height="220%"
              >
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ambient core glow */}
            <circle cx={cx} cy={cy} r="140" fill="url(#fc-core-glow)" />

            {/* orbit path */}
            <circle
              cx={cx}
              cy={cy}
              r={orbitR}
              fill="none"
              stroke="var(--color-dark-slate-grey-600)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeDasharray="2 8"
            />

            {/* rotating group carrying the three role-nodes */}
            <g
              className="fc-hero__orbit-group"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              {NODES.map((node) => {
                const pos = polarToCartesian(cx, cy, orbitR, node.angle);
                return (
                  <g key={node.label}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="14"
                      fill={node.color}
                      filter="url(#fc-node-glow)"
                    />
                    {/* counter-rotate the label so text stays upright */}
                    <g
                      className="fc-hero__label-counter"
                      style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                    >
                      <text
                        x={pos.x}
                        y={pos.y - 24}
                        textAnchor="middle"
                        className="fc-hero__node-label"
                      >
                        {node.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {/* central core mark — the platform/Admin */}
            <circle
              cx={cx}
              cy={cy}
              r="46"
              fill="var(--color-role-admin)"
              stroke="var(--color-icy-aqua-500)"
              strokeWidth="2"
            />
            <circle cx={cx} cy={cy} r="10" fill="var(--color-icy-aqua-400)" />
          </svg>
        </div>
      </div>

      <style>{`
        .fc-hero {
          --fc-bg: var(--color-background);
          --fc-fg: var(--color-ink);
          --fc-muted: var(--color-muted);
          background: var(--fc-bg);
          color: var(--fc-fg);
          padding: 5rem 1.5rem;
        }

        .fc-hero__grid {
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          align-items: center;
          gap: 3rem;
        }

        .fc-hero__eyebrow {
          display: inline-block;
          font-size: 0.75rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-primary-text);
          margin-bottom: 1.25rem;
        }

        .fc-hero__title {
          font-size: clamp(2.25rem, 4.5vw, 3.5rem);
          line-height: 1.08;
          letter-spacing: -0.02em;
          margin: 0 0 1.25rem;
        }

        .fc-hero__body {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: var(--fc-muted);
          max-width: 34ch;
          margin: 0 0 2rem;
        }

        .fc-hero__actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .fc-hero__cta-primary {
          display: inline-block;
          background: var(--color-primary);
          color: var(--color-primary-foreground);
          border: none;
          font-weight: 600;
          padding: 0.75rem 1.5rem;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 0 0 0 transparent;
          transition: box-shadow 0.2s ease;
        }

        .fc-hero__cta-primary:hover,
        .fc-hero__cta-primary:focus-visible {
          box-shadow: 0 0 24px 2px
            color-mix(in srgb, var(--color-icy-aqua-500) 45%, transparent);
        }

        .fc-hero__cta-secondary {
          display: inline-block;
          background: transparent;
          color: var(--color-secondary);
          border: 1px solid var(--color-secondary);
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }

        .fc-hero__cta-primary:focus-visible,
        .fc-hero__cta-secondary:focus-visible {
          outline: 2px solid var(--color-focus-ring);
          outline-offset: 2px;
        }

        .fc-hero__art {
          display: flex;
          justify-content: center;
        }

        .fc-hero__svg {
          width: 100%;
          max-width: 460px;
          height: auto;
        }

        .fc-hero__node-label {
          font-size: 13px;
          fill: var(--color-dark-slate-grey-700);
          font-weight: 500;
        }

        .fc-hero__orbit-group {
          animation: fc-orbit 24s linear infinite;
        }

        .fc-hero__label-counter {
          animation: fc-counter-orbit 24s linear infinite;
        }

        @keyframes fc-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes fc-counter-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .fc-hero__orbit-group,
          .fc-hero__label-counter {
            animation: none;
          }
        }

        @media (max-width: 1023px) {
          .fc-hero__grid {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .fc-hero__body {
            margin-left: auto;
            margin-right: auto;
          }
          .fc-hero__actions {
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
