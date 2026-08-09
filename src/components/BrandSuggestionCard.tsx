import { Sparkles, X } from "lucide-react";
import { BrandSuggestion } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface BrandSuggestionCardProps {
  brand: BrandSuggestion;
  onApplyColors: () => void;
  onApplyLogo: () => void;
  onApplyBoth: () => void;
  onDismiss: () => void;
  className?: string;
}

export function BrandSuggestionCard({
  brand,
  onApplyColors,
  onApplyLogo,
  onApplyBoth,
  onDismiss,
  className,
}: BrandSuggestionCardProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 p-3 space-y-2.5", className)}>
      <div className="flex items-start gap-2.5">
        <img
          src={brand.logo}
          alt=""
          className="w-8 h-8 rounded-lg object-contain bg-background border border-border/70 p-0.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            {brand.name} detected
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{brand.domain}</p>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-4 h-4 rounded-full border border-border"
            style={{ backgroundColor: brand.fgColor }}
          />
          <span
            className="w-4 h-4 rounded-full border border-border"
            style={{ backgroundColor: brand.bgColor }}
          />
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss brand suggestion"
            className="ml-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onApplyBoth}
          className="flex-1 h-8 rounded-xl bg-foreground text-background text-[11px] font-medium hover:opacity-90 transition-opacity"
        >
          Brand it
        </button>
        <button
          type="button"
          onClick={onApplyColors}
          className="flex-1 h-8 rounded-xl border border-border text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          Colours only
        </button>
        <button
          type="button"
          onClick={onApplyLogo}
          className="flex-1 h-8 rounded-xl border border-border text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          Logo only
        </button>
      </div>
    </div>
  );
}
