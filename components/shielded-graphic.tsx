export function ShieldedGraphic({
  className = "",
  title = "Trace the shielded route, not the voter.",
  body = "Abstract tracker rails expose process without exposing voter identity."
}: {
  className?: string;
  title?: string;
  body?: string;
}) {
  const classes = ["shielded-graphic", className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-hidden="true">
      <svg
        className="shielded-graphic__svg"
        viewBox="0 0 360 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M36 40C112 94 178 92 246 66"
          stroke="#B9924C"
          strokeWidth="1.6"
          strokeDasharray="7 10"
        />
        <path
          d="M126 100C158 118 182 156 180 230"
          stroke="#7FD9B8"
          strokeWidth="1.6"
          strokeDasharray="7 10"
        />
        <path
          d="M66 186C126 156 154 154 180 230"
          stroke="#E3C285"
          strokeWidth="1.6"
          strokeDasharray="7 10"
        />
        <path
          d="M246 66C292 126 304 164 286 214"
          stroke="#557261"
          strokeWidth="1.6"
          strokeDasharray="7 10"
        />
        <path
          d="M180 230C226 216 256 188 286 156"
          stroke="#7FD9B8"
          strokeWidth="1.6"
          strokeDasharray="7 10"
        />
      </svg>
      <div className="shielded-graphic__copy">
        <p className="eyebrow">Shielded route map</p>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}
