import { Button } from "react-aria-components";
import { useId } from "react";

interface StatusPanelProps {
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  headingLevel?: 1 | 2 | 3;
  onAction?: () => void;
}

export function StatusPanel({
  title,
  children,
  actionLabel,
  headingLevel = 1,
  onAction,
}: StatusPanelProps) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h1";

  return (
    <section className="status-panel" aria-labelledby={titleId}>
      <div className="status-mark" aria-hidden="true">
        !
      </div>
      <Heading id={titleId} className="section-title">
        {title}
      </Heading>
      <div className="supporting-copy">{children}</div>
      {actionLabel && onAction ? (
        <Button className="button button--primary" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
