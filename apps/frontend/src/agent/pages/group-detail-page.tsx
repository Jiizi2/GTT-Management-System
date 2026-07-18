import { useNavigate, useParams } from "react-router-dom";
import { GroupDetail } from "../../pages/group-detail-page";
import { EmptyState, ErrorState, LoadingState } from "../components/data-state";
import { useAgentGroupData } from "../data/use-agent-group-data";

const readOnlyResult = () => ({ ok: false as const, message: "Portal Agent bersifat read-only." });

export function GroupDetailPage({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const navigate = useNavigate();
  const identity = useParams().identity ?? "";
  const query = useAgentGroupData({ principalId, agentId, agentName });

  if (query.isPending) return <LoadingState label="Memuat detail group..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  const group = query.data.find((item) => item.code === identity || item.id === identity);
  if (!group) return <EmptyState title="Group tidak ditemukan" />;

  return (
    <GroupDetail
      group={group}
      groups={query.data}
      readOnly
      showThemeToggle={false}
      onBack={() => navigate("/agent/groups")}
      onDeleteGroup={() => undefined}
      onSaveGroup={readOnlyResult}
      onPatchGroup={readOnlyResult}
    />
  );
}
