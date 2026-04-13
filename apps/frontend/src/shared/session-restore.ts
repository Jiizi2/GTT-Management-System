type SessionRestoreState = {
  hasSessionSnapshot: boolean;
  isPending: boolean;
  isFetching: boolean;
  isFetchedAfterMount: boolean;
};

export function shouldBlockSessionRestore(state: SessionRestoreState): boolean {
  if (state.hasSessionSnapshot) {
    return false;
  }

  return state.isPending || (state.isFetching && !state.isFetchedAfterMount);
}
