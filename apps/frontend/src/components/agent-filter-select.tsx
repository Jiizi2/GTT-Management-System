import { SereneSelect } from "./serene-select";
import { useAgentsQuery } from "../hooks/use-agents-backend";

type AgentFilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  className?: string;
  variant?: "toolbar" | "field" | "pill";
};

export function AgentFilterSelect({
  value,
  onChange,
  includeAll = true,
  className = "",
  variant = "toolbar",
}: AgentFilterSelectProps) {
  const query = useAgentsQuery();
  const activeAgents = (query.data ?? []).filter((agent) => agent.status === "ACTIVE");
  const allAgentsLabel = activeAgents.length === 1 ? activeAgents[0].name : "All Agents";
  const visibleAgentOptions = includeAll && activeAgents.length === 1 ? [] : activeAgents;
  const options = (
    <>
      {includeAll ? <option value="all">{allAgentsLabel}</option> : <option value="" disabled>Select Agent</option>}
      {visibleAgentOptions.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
    </>
  );

  if (variant === "field") {
    return (
      <label className={`space-y-1 ${className}`.trim()}>
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
          Agent
        </span>
        <SereneSelect
          className="serene-select rounded-xl bg-surface-container-lowest text-sm font-medium text-on-surface-variant"
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
          className="serene-select-pill h-9 w-full pl-3 pr-9 normal-case tracking-normal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          showCaret={false}
          aria-label="Filter by Agent"
        >
          {options}
        </SereneSelect>
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant"
          aria-hidden="true"
        >
          business
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-12 min-w-0 items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-3 shadow-ambient sm:h-14 sm:min-w-[11rem] ${className}`.trim()}
    >
      <span className="material-symbols-outlined shrink-0 text-lg text-primary" aria-hidden="true">business</span>
      <div className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-on-surface-variant/65">Agent</span>
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
