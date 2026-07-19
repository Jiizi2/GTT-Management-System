import { useNavigate } from "react-router-dom";
import { VisaTrackingScreen } from "../../pages/visa-tracking-page";
import { ErrorState, LoadingState } from "../components/data-state";
import { useAgentGroupData } from "../data/use-agent-group-data";

export function AgentVisaTrackingPage({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const navigate = useNavigate();
  const query = useAgentGroupData({ principalId, agentId, agentName });
  if (query.isPending) return <LoadingState label="Memuat Visa Tracking..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  return (
    <VisaTrackingScreen
      groups={query.data}
      fixedAgentName={agentName}
      readOnly
      showThemeToggle={false}
      onOpenDetail={(row) => navigate(`/agent/visa/${encodeURIComponent(row.groupCode)}`)}
      onUpdateAgreementStatus={() => undefined}
    />
  );
}
