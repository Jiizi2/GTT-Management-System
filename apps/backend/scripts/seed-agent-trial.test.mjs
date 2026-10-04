import assert from "node:assert/strict";
import { test } from "node:test";
import { compare } from "bcrypt";
import { DEFAULT_TRIAL_EMAIL, resolveTrialEmail, seedAgentTrial } from "./seed-agent-trial.mjs";

const agent = { id: "partner", code: "PARTNER", name: "Partner", type: "PARTNER", status: "ACTIVE", _count: { groups: 20 } };

function database({ existing, candidate = agent, auditFails = false } = {}) {
  const state = { accounts: existing ? [existing] : [], audits: [], agentSelections: 0 };
  return {
    state,
    async $transaction(callback) {
      const originalAccounts = [...state.accounts];
      const originalAudits = [...state.audits];
      try {
        return await callback({
          agentPortalUser: {
            async findUnique() { return state.accounts[0] ?? null; },
            async create({ data }) {
              const account = { ...data, id: "trial-account", agent };
              state.accounts.push(account);
              return { id: account.id };
            },
          },
          agent: {
            async findFirst() { state.agentSelections++; return candidate; },
          },
          agentPortalAccountAuditLog: {
            async create({ data }) {
              if (auditFails) throw new Error("Audit insert failed");
              state.audits.push(data);
            },
          },
        });
      } catch (error) {
        state.accounts = originalAccounts;
        state.audits = originalAudits;
        throw error;
      }
    },
  };
}

test("creates one account with a hashed random password and preserves it on repeated runs", async () => {
  const prisma = database();
  const first = await seedAgentTrial(prisma, DEFAULT_TRIAL_EMAIL);
  const second = await seedAgentTrial(prisma, DEFAULT_TRIAL_EMAIL);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.password, undefined);
  assert.equal(prisma.state.accounts.length, 1);
  assert.equal(prisma.state.audits.length, 1);
  assert.equal(prisma.state.agentSelections, 1);
  assert.equal(await compare(first.password, prisma.state.accounts[0].passwordHash), true);
  assert.notEqual(prisma.state.accounts[0].passwordHash, first.password);
  assert.equal(prisma.state.accounts[0].mustChangePassword, true);
  assert.equal(prisma.state.audits[0].actorAuthUserId, null);
  assert.equal(prisma.state.audits[0].portalUserId, first.accountId);
});

test("refuses to reactivate a disabled account or an ineligible Agent", async () => {
  for (const existing of [
    { id: "existing", status: "DISABLED", agent },
    { id: "existing", status: "ACTIVE", agent: { ...agent, status: "INACTIVE" } },
    { id: "existing", status: "ACTIVE", agent: { ...agent, type: "DIRECT" } },
  ]) {
    const prisma = database({ existing });
    await assert.rejects(seedAgentTrial(prisma, DEFAULT_TRIAL_EMAIL), /not eligible/);
    assert.deepEqual(prisma.state.accounts, [existing]);
    assert.equal(prisma.state.audits.length, 0);
  }
});

test("does not add data when no eligible Agent has groups", async () => {
  const prisma = database({ candidate: null });
  await assert.rejects(seedAgentTrial(prisma, DEFAULT_TRIAL_EMAIL), /No active Partner Agent with groups/);
  assert.equal(prisma.state.accounts.length, 0);
  assert.equal(prisma.state.audits.length, 0);
});

test("rolls back the account when its audit record cannot be created", async () => {
  const prisma = database({ auditFails: true });
  await assert.rejects(seedAgentTrial(prisma, DEFAULT_TRIAL_EMAIL), /Audit insert failed/);
  assert.equal(prisma.state.accounts.length, 0);
  assert.equal(prisma.state.audits.length, 0);
});

test("accepts a normalized custom email and rejects unsupported seed arguments", () => {
  assert.equal(resolveTrialEmail([]), DEFAULT_TRIAL_EMAIL);
  assert.equal(resolveTrialEmail(["--email", " Trial@Example.com "]), "trial@example.com");
  assert.throws(() => resolveTrialEmail(["--email", "invalid"]), /valid email/);
  assert.throws(() => resolveTrialEmail(["--reset"]), /Usage/);
  assert.throws(() => resolveTrialEmail(["--email", "trial@example.com", "--reset"]), /Usage/);
});
