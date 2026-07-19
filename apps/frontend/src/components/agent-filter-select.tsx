import { SereneSelect } from "./serene-select";
import { useAgentsQuery } from "../hooks/use-agents-backend";

type AgentFilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  className?: string;
  variant?: "toolbar" | "field" | "pill" | "inline";
  compact?: boolean;
};

export function AgentFilterSelect({
  value,
  onChange,
  includeAll = true,
  className = "",
  variant = "toolbar",
  compact = false,
}: AgentFilterSelectProps) {
  const query = useAgentsQuery();
  const activeAgents = (query.data ?? []).filter((agent) => agent.status === "ACTIVE");
  // SereneSelect reads direct option children. Keep these as an array (instead
  // of wrapping them in a Fragment) so the dropdown can discover every agent.
  const options = [
    includeAll ? (
      <option key="all" value="all">
        All Agents
      </option>
    ) : (
      <option key="empty" value="" disabled>
        Select Agent
      </option>
    ),
    ...activeAgents.map((agent) => (
      <option key={agent.id} value={agent.id}>
        {agent.name}
      </option>
    )),
  ];

  if (variant === "field") {
    return (
      <label className={`${compact ? "space-y-0.5" : "space-y-1"} ${className}`.trim()}>
        <span
          className={`block font-bold uppercase tracking-[0.14em] text-on-surface-variant/80 ${compact ? "text-[10px]" : "text-[11px]"}`}
        >
          Agent
        </span>
        <SereneSelect
          className={`serene-select w-full bg-surface-container-lowest font-medium text-on-surface-variant ${
            compact ? "h-8 rounded-lg px-2.5 pr-8 text-xs" : "rounded-xl text-sm"
          }`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Filter by Agent"
        >
          {options}
        </SereneSelect>
      </label>
    );
  }

  if (variant === "pill") {
    return (
      <div className={`relative min-w-[10.5rem] ${className}`.trim()}>
        <SereneSelect
          className={`serene-select-pill w-full pl-3 pr-9 normal-case tracking-normal ${compact ? "h-8 text-xs" : "h-9"}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Filter by Agent"
        >
          {options}
        </SereneSelect>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`min-w-0 ${className}`.trim()}>
        <SereneSelect
          className="h-8 w-full bg-transparent px-3 pr-8 text-left text-xs font-semibold text-on-surface-variant outline-none transition hover:text-on-surface"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Filter by Agent"
        >
          {options}
        </SereneSelect>
      </div>
    );
  }

  return (
    <div
      className={`flex h-12 min-w-0 items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-3 shadow-ambient sm:h-14 sm:min-w-[11rem] ${className}`.trim()}
    >
      <span className="material-symbols-outlined shrink-0 text-lg text-primary" aria-hidden="true">
        business
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-on-surface-variant/65">
          Agent
        </span>
        <SereneSelect
          className="mt-1 h-6 w-full bg-transparent pr-6 text-left text-sm font-bold leading-none text-on-surface outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Filter by Agent"
        >
          {options}
        </SereneSelect>
      </div>
    </div>
  );
}
