import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  isMasterDataClientOptionId,
  mergeInvoiceClientsWithMasterData,
} from "../pages/invoice-page-shared.js";
import { runCase } from "../test/run-case.js";

describe("invoice-page-shared", () => {
  runCase("merges master data invoice clients without duplicating existing backend clients", () => {
    const mergedClients = mergeInvoiceClientsWithMasterData(
      [
        {
          id: "client-1",
          name: "Yassir",
          sortOrder: 1,
          label: "01. Yassir",
          groupCode: "9017000001",
          groupName: "Dummy Trip Lengkap",
        },
      ],
      [
        {
          value: "YASSIR",
          label: " Yassir ",
          sortOrder: 1,
          isActive: true,
        },
        {
          value: "UMRAH_CORPORATE",
          label: "Umrah Corporate",
          sortOrder: 2,
          isActive: true,
        },
        {
          value: "VIP_CLIENT",
          label: "VIP Client",
          sortOrder: 3,
          isActive: false,
        },
      ],
    );

    assert.equal(mergedClients.length, 2);
    assert.equal(mergedClients[0].id, "client-1");
    assert.equal(mergedClients[1].name, "Umrah Corporate");
    assert.equal(isMasterDataClientOptionId(mergedClients[1].id), true);
    assert.equal(mergedClients[1].sortOrder, 2);
  });

  runCase("recognizes only synthetic master data invoice client ids", () => {
    assert.equal(isMasterDataClientOptionId("__invoice_client_master_data__:jsa"), true);
    assert.equal(isMasterDataClientOptionId("client-regular"), false);
  });
});
