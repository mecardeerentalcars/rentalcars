import assert from "node:assert/strict";
import test from "node:test";
import { userDeletionPolicy } from "../lib/user-access";

test("Admin and all Super Admin accounts are protected from deletion", () => {
  assert.equal(userDeletionPolicy({ id: "admin-id", username: "admin", role: "owner" }).allowed, false);
  assert.equal(userDeletionPolicy({ id: "root-id", username: "root", role: "superadmin" }).allowed, false);
});

test("the signed-in account cannot delete itself", () => {
  const policy = userDeletionPolicy({ id: "same-id", username: "owner", role: "owner" }, "same-id");
  assert.equal(policy.allowed, false);
});

test("delvin and dantees require the additional deletion warning", () => {
  assert.deepEqual(
    ["delvin", "DANTEES"].map((username) => userDeletionPolicy({ id: username, username, role: "owner" }).additionalWarning),
    [true, true],
  );
});

test("ordinary Owner and Viewer accounts can be deleted", () => {
  assert.equal(userDeletionPolicy({ id: "owner-id", username: "staff", role: "owner" }).allowed, true);
  assert.equal(userDeletionPolicy({ id: "viewer-id", username: "reader", role: "viewer" }).allowed, true);
});
