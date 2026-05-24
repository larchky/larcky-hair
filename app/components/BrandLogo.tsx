import Image from "next/image";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({
  compact = false,
  className = "",
}: BrandLogoProps) {
  return (
    <div className={["flex items-center gap-3", className].join(" ")}>
      <Image
        src="/api/logo"
        alt="Dolapo"
        width={compact ? 48 : 64}
        height={compact ? 48 : 64}
        unoptimized
        className={[
          "shrink-0 rounded-full border border-accent/35 bg-white object-cover shadow-[0_14px_34px_rgba(190,143,47,0.18)]",
          compact ? "h-12 w-12" : "h-16 w-16",
        ].join(" ")}
      />

      <div>
        <p
          className={[
            "font-serif font-bold leading-none text-champagne",
            compact ? "text-2xl" : "text-4xl",
          ].join(" ")}
        >
          DOLAPO
        </p>
        <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent/80">
          Creator Tools
        </p>
      </div>
    </div>
  );
}
