export type UserDeletionTarget = {
  id: string;
  username: string;
  role: string;
};

export type UserDeletionPolicy = {
  allowed: boolean;
  additionalWarning: boolean;
  error?: string;
};

const additionalWarningUsers = new Set(["delvin", "dantees"]);

export function userDeletionPolicy(target: UserDeletionTarget, signedInUserId?: string): UserDeletionPolicy {
  const username = target.username.trim().toLowerCase();
  if (target.role === "superadmin" || username === "admin") {
    return {
      allowed: false,
      additionalWarning: false,
      error: "The Admin account is protected and cannot be deleted.",
    };
  }
  if (signedInUserId && target.id === signedInUserId) {
    return {
      allowed: false,
      additionalWarning: false,
      error: "You cannot delete the account you are currently signed in with.",
    };
  }
  return {
    allowed: true,
    additionalWarning: additionalWarningUsers.has(username),
  };
}
