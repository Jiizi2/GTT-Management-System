import type { GroupData, VisaHotelEditFormState } from "../shared/app-domain";
import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";
import { mapBackendGroupToFrontend } from "./groups-backend-mapper";
import {
  mapGroupIdentityDraftToBackendPayload,
  mapGroupToBackendPayload,
  mapGroupUpdateToBackendPayload,
  mapVisaHotelEditFormToBackendPayload,
  type GroupIdentityDraftPayload,
} from "./groups-backend-payload";
import {
  parseBackendGroupRecord,
  parseBackendGroupRecordArray,
} from "./groups-contract";
export {
  getVisaAgreementValidationError,
  sortHotelsByStayStart,
} from "./visa-agreement-validation";
export type { GroupIdentityDraftPayload } from "./groups-backend-payload";

export type GroupFetchProjection = "summary" | "detail";

export async function fetchGroupsFromBackend({
  signal,
  query,
  projection = "detail",
  activeOnly = false,
}: {
  signal?: AbortSignal;
  query?: string;
  projection?: GroupFetchProjection;
  activeOnly?: boolean;
} = {}): Promise<GroupData[]> {
  const searchParams = new URLSearchParams();
  const normalizedQuery = query?.trim() ?? "";
  if (normalizedQuery.length > 0) {
    searchParams.set("q", normalizedQuery);
  }
  if (projection) {
    searchParams.set("projection", projection);
  }
  if (activeOnly) {
    searchParams.set("activeOnly", "true");
  }
  const endpoint = searchParams.size > 0 ? `/groups?${searchParams.toString()}` : "/groups";
  const { response, payload, responseText } = await fetchBackendParsed(endpoint, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Backend fetch failed"));
  }

  const records = parseBackendGroupRecordArray(payload, "Backend fetch failed");
  const mappedGroups = records
    .map((item) => mapBackendGroupToFrontend(item))
    .filter((item): item is GroupData => item !== null);

  return mappedGroups;
}

export async function createGroupInBackend(group: GroupData): Promise<void> {
  const payload = mapGroupToBackendPayload(group);
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed("/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, responsePayload, responseText, "Backend sync failed"));
  }
}

export async function createGroupIdentityInBackend(identity: GroupIdentityDraftPayload): Promise<GroupData> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed("/groups/identity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mapGroupIdentityDraftToBackendPayload(identity)),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Identity create failed"),
    );
  }

  const mappedGroup = mapBackendGroupToFrontend(parseBackendGroupRecord(responsePayload, "Identity create failed"));
  if (!mappedGroup) {
    throw new Error("Identity create failed: response is not a group record.");
  }

  return mappedGroup;
}

export async function updateGroupInBackend(groupCode: string, group: GroupData): Promise<void> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mapGroupUpdateToBackendPayload(group)),
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, responsePayload, responseText, "Backend update failed"));
  }
}

export async function replaceGroupInBackend(groupCode: string, group: GroupData): Promise<void> {
  const payload = mapGroupToBackendPayload(group);
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Backend replace failed"),
    );
  }
}

export async function deleteGroupInBackend(groupCode: string): Promise<void> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, responsePayload, responseText, "Backend delete failed"));
  }
}

export async function saveVisaHotelAgreementInBackend({
  groupCode,
  city,
  hotel,
  hotelId,
}: {
  groupCode: string;
  city: "makkah" | "madinah";
  hotel: VisaHotelEditFormState;
  hotelId?: string;
}): Promise<GroupData> {
  const endpoint = hotelId
    ? `/groups/${encodeURIComponent(groupCode)}/visa/hotels/${encodeURIComponent(hotelId)}`
    : `/groups/${encodeURIComponent(groupCode)}/visa/hotels`;
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(endpoint, {
    method: hotelId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mapVisaHotelEditFormToBackendPayload(city, hotel)),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Hotel agreement save failed"),
    );
  }

  const mappedGroup = mapBackendGroupToFrontend(parseBackendGroupRecord(responsePayload, "Hotel agreement save failed"));
  if (!mappedGroup) {
    throw new Error("Hotel agreement save failed: response is not a group record.");
  }

  return mappedGroup;
}

export async function deleteVisaHotelAgreementInBackend({
  groupCode,
  hotelId,
}: {
  groupCode: string;
  hotelId: string;
}): Promise<GroupData> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}/visa/hotels/${encodeURIComponent(hotelId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Hotel agreement delete failed"),
    );
  }

  const mappedGroup = mapBackendGroupToFrontend(parseBackendGroupRecord(responsePayload, "Hotel agreement delete failed"));
  if (!mappedGroup) {
    throw new Error("Hotel agreement delete failed: response is not a group record.");
  }

  return mappedGroup;
}
