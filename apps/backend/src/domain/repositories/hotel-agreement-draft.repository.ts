import {
  UpsertHotelAgreementDraftDto,
  AssignHotelAgreementDraftDto,
} from "../../groups/dto/hotel-agreement-draft.dto";

export interface HotelAgreementDraftRepository {
  findAll(query?: string, status?: string): Promise<unknown[]>;
  create(payload: UpsertHotelAgreementDraftDto): Promise<unknown>;
  update(draftId: string, payload: UpsertHotelAgreementDraftDto): Promise<unknown>;
  remove(draftId: string): Promise<void>;
  assign(draftId: string, payload: AssignHotelAgreementDraftDto): Promise<unknown>;
  unassign(draftId: string, groupCode?: string): Promise<unknown>;
}
