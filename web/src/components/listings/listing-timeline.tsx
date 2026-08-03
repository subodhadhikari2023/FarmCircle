import type { BatchTimeline } from "@/lib/batches";

export function ListingTimeline({ timeline }: { timeline: BatchTimeline }) {
  return (
    <div className="mt-8 border-t border-border pt-8">
      <h2 className="text-lg font-[650]">Growth timeline</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {timeline.milestones.map((milestone) => {
          const reached = milestone.reachedAt !== null;
          return (
            <li key={milestone.order} className="flex items-start gap-3">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  reached ? "bg-success-600" : "bg-border"
                }`}
                aria-hidden="true"
              />
              <div>
                <p
                  className={`text-sm font-medium ${
                    reached ? "text-foreground" : "text-muted"
                  }`}
                >
                  {milestone.name}
                </p>
                <p className="text-xs text-muted">
                  {milestone.reachedAt
                    ? `Reached ${new Date(milestone.reachedAt).toLocaleDateString()}`
                    : `Expected in ~${milestone.expectedDurationDays} days`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
