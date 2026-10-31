import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Droplet } from "lucide-react";

type MarqueeProps = {
  items: string[];
  speed?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  separator?: ReactNode;
  className?: string;
};

const repetitionsPerCopy = 6;

export function Marquee({
  items,
  speed = 35,
  direction = "left",
  pauseOnHover = true,
  separator = <Droplet aria-hidden="true" className="size-4 shrink-0 text-brand" />,
  className,
}: MarqueeProps) {
  const duration = Number.isFinite(speed) && speed > 0 ? speed : 35;
  const trackStyle = { "--marquee-duration": `${duration}s` } as CSSProperties;

  const renderCopy = (copy: number) => (
    <div aria-hidden="true" className="marquee-copy">
      {Array.from({ length: repetitionsPerCopy }, (_, repetition) => (
        <div className="marquee-repeat gap-6 px-3" key={`${copy}-${repetition}`}>
          {items.map((item, index) => (
            <Fragment key={`${index}-${item}`}>
              <span className="marquee-item">{item}</span>
              <span aria-hidden="true" className="marquee-separator">
                {separator}
              </span>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className={`marquee-root${className ? ` ${className}` : ""}`}
      data-pause-on-hover={pauseOnHover}
    >
      <div className="marquee-viewport">
        <div
          className="marquee-track animate-marquee flex w-max min-w-full items-center will-change-transform"
          data-direction={direction}
          style={trackStyle}
        >
          {renderCopy(0)}
          {renderCopy(1)}
        </div>
      </div>
    </div>
  );
}
