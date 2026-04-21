type ZcashBrandmarkProps = {
  label?: string;
  className?: string;
};

export function ZcashBrandmark({
  label = "Built on Zcash",
  className = ""
}: ZcashBrandmarkProps) {
  const rootClassName = className
    ? `zcash-brandmark ${className}`
    : "zcash-brandmark";

  return (
    <span className={rootClassName}>
      <img
        src="/brand/zcash-secondary-yellow.svg"
        alt=""
        width={18}
        height={18}
        className="zcash-brandmark-icon"
      />
      <span>{label}</span>
    </span>
  );
}
