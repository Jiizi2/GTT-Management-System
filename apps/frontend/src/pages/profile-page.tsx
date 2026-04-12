import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod/v4";
import type { NavId, SessionAccessTier } from "../shared/app-domain";
import { clearAuthSession } from "../shared/auth-session";

const profilePermissionTags = ["MANAGE_USERS", "EDIT_ITINERARIES", "VIEW_ANALYTICS", "APPROVE_CHECKLISTS"] as const;

type RoleTitleId = "super-admin" | "operations-manager" | "finance-manager" | "customer-support";

const roleTitleOptions: Array<{ id: RoleTitleId; label: string }> = [
  { id: "super-admin", label: "Super Administrator" },
  { id: "operations-manager", label: "Senior Operations Manager" },
  { id: "finance-manager", label: "Finance Operations Manager" },
  { id: "customer-support", label: "Customer Support Lead" },
];

type ProfileData = {
  fullName: string;
  roleTitleId: RoleTitleId;
  email: string;
  phone: string;
};

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ProfileNotice = {
  tone: "success" | "info" | "error";
  message: string;
};

const roleTitleSchema = z.enum(["super-admin", "operations-manager", "finance-manager", "customer-support"]);

const profileFormSchema = z.object({
  fullName: z.string().trim().min(1, "Semua field profile wajib diisi."),
  roleTitleId: roleTitleSchema,
  email: z.string().trim().min(1, "Semua field profile wajib diisi.").email("Format email tidak valid."),
  phone: z.string().trim().min(1, "Semua field profile wajib diisi."),
});

const passwordFormSchema = z
  .object({
    currentPassword: z.string().trim().min(1, "Password lama dan password baru wajib diisi."),
    newPassword: z
      .string()
      .min(1, "Password lama dan password baru wajib diisi.")
      .min(8, "Password baru minimal 8 karakter."),
    confirmPassword: z.string().min(1, "Konfirmasi password tidak sama."),
  })
  .superRefine((values, context) => {
    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak sama.",
      });
    }

    if (values.currentPassword.trim() && values.newPassword.trim() && values.currentPassword === values.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Password baru harus berbeda dari password lama.",
      });
    }
  });

function resolveRoleTitleLabel(roleTitleId: RoleTitleId): string {
  return roleTitleOptions.find((option) => option.id === roleTitleId)?.label ?? "Unknown Role";
}

function resolveRoleBadgeLabel(accessTier: SessionAccessTier): string {
  if (accessTier === "super-admin") {
    return "Super Admin";
  }

  return "Admin";
}

function resolveDefaultRoleTitleId(accessTier: SessionAccessTier): RoleTitleId {
  if (accessTier === "super-admin") {
    return "super-admin";
  }

  return "operations-manager";
}

function resolveNoticeStyle(tone: ProfileNotice["tone"]): string {
  if (tone === "success") {
    return "border-primary/25 bg-primary-fixed text-on-primary-fixed-variant";
  }

  if (tone === "error") {
    return "border-error-container/70 bg-error-container text-on-error-container";
  }

  return "border-outline-variant/55 bg-surface-container-low text-on-surface-variant";
}

function resolveNoticeIcon(tone: ProfileNotice["tone"]): string {
  if (tone === "success") {
    return "check_circle";
  }

  if (tone === "error") {
    return "error";
  }

  return "info";
}

function ProfileModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

function ProfileModalOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <ProfileModalPortal>
      <div
        className="serene-modal-overlay z-[120] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
        onClick={onClose}
        aria-hidden="true"
      >
        {children}
      </div>
    </ProfileModalPortal>
  );
}

function EditProfileModal({
  initialValues,
  canEditRoleTitle,
  onClose,
  onSave,
}: {
  initialValues: ProfileData;
  canEditRoleTitle: boolean;
  onClose: () => void;
  onSave: (values: ProfileData) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  return (
    <ProfileModalOverlay onClose={onClose}>
      <section
        className="serene-modal-shell my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto p-5 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold tracking-tight text-on-surface">Edit Profile</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              <span className="sm:hidden">Perbarui akun operator.</span>
              <span className="hidden sm:inline">Perbarui informasi akun operator.</span>
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
            aria-label="Close edit profile modal"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        <form className="mt-5" onSubmit={handleSubmit((values) => onSave(values))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="serene-field sm:col-span-2">
              <span className="text-sm font-semibold text-on-surface-variant">Full Name</span>
              <input type="text" className="serene-input" {...register("fullName")} />
            </label>

            <label className="serene-field sm:col-span-2">
              <span className="text-sm font-semibold text-on-surface-variant">Role Title</span>
              <select className="serene-select" {...register("roleTitleId")} disabled={!canEditRoleTitle}>
                {roleTitleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span
                className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                  canEditRoleTitle ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {canEditRoleTitle ? "lock_open" : "lock"}
                </span>
                {canEditRoleTitle
                  ? "Role Title dapat diubah oleh akun Super Admin."
                  : "Role Title hanya bisa diubah oleh role Super Admin."}
              </span>
            </label>

            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">Email Address</span>
              <input type="email" className="serene-input" {...register("email")} />
            </label>

            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">Phone</span>
              <input type="text" className="serene-input" {...register("phone")} />
            </label>
          </div>

          {errors.fullName?.message || errors.email?.message || errors.phone?.message || errors.roleTitleId?.message ? (
            <p className="mt-4 rounded-md border border-error-container/65 bg-error-container px-3 py-2 text-sm font-semibold text-on-error-container">
              {errors.fullName?.message ??
                errors.email?.message ??
                errors.phone?.message ??
                errors.roleTitleId?.message}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="serene-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="serene-btn-primary" disabled={isSubmitting}>
              Save Changes
            </button>
          </div>
        </form>
      </section>
    </ProfileModalOverlay>
  );
}

function ChangePasswordModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    reset({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }, [reset]);

  return (
    <ProfileModalOverlay onClose={onClose}>
      <section
        className="serene-modal-shell my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto p-5 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-bold tracking-tight text-on-surface">Change Password</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              <span className="sm:hidden">Buat password baru.</span>
              <span className="hidden sm:inline">Buat password baru untuk akun operator.</span>
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high"
            aria-label="Close change password modal"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        <form className="mt-5" onSubmit={handleSubmit(() => onSave())}>
          <div className="grid gap-3">
            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">Current Password</span>
              <input type="password" className="serene-input" {...register("currentPassword")} />
            </label>

            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">New Password</span>
              <input type="password" className="serene-input" {...register("newPassword")} />
            </label>

            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">Confirm New Password</span>
              <input type="password" className="serene-input" {...register("confirmPassword")} />
            </label>
          </div>

          {errors.currentPassword?.message || errors.newPassword?.message || errors.confirmPassword?.message ? (
            <p className="mt-4 rounded-md border border-error-container/65 bg-error-container px-3 py-2 text-sm font-semibold text-on-error-container">
              {errors.currentPassword?.message ?? errors.newPassword?.message ?? errors.confirmPassword?.message}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="serene-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="serene-btn-primary" disabled={isSubmitting}>
              Update Password
            </button>
          </div>
        </form>
      </section>
    </ProfileModalOverlay>
  );
}

export function ProfileScreen({
  onNavigate,
  sessionAccessTier = "admin",
}: {
  onNavigate: (navId: NavId) => void;
  sessionAccessTier?: SessionAccessTier;
}) {
  const canEditRoleTitle = sessionAccessTier === "super-admin";
  const roleBadgeLabel = resolveRoleBadgeLabel(sessionAccessTier);

  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: "Operator Admin",
    roleTitleId: resolveDefaultRoleTitleId(sessionAccessTier),
    email: "operator.admin@ghaniyatravel.com",
    phone: "+62 812 3456 7890",
  });
  const [notice, setNotice] = useState<ProfileNotice | null>(null);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  const currentRoleTitleLabel = useMemo(
    () => resolveRoleTitleLabel(profileData.roleTitleId),
    [profileData.roleTitleId],
  );

  const hasOpenModal = isEditProfileModalOpen || isChangePasswordModalOpen || isSignOutModalOpen;

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  useEffect(() => {
    if (!hasOpenModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsEditProfileModalOpen(false);
        setIsChangePasswordModalOpen(false);
        setIsSignOutModalOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasOpenModal]);

  const openEditProfileModal = () => {
    setIsEditProfileModalOpen(true);
  };

  const closeEditProfileModal = () => {
    setIsEditProfileModalOpen(false);
  };

  const handleSaveProfile = (values: ProfileData) => {
    const nextRoleTitleId = canEditRoleTitle ? values.roleTitleId : profileData.roleTitleId;
    setProfileData({
      fullName: values.fullName.trim(),
      roleTitleId: nextRoleTitleId,
      email: values.email.trim(),
      phone: values.phone.trim(),
    });
    setIsEditProfileModalOpen(false);
    setNotice({
      tone: "success",
      message: "Profile berhasil diperbarui.",
    });
  };

  const openChangePasswordModal = () => {
    setIsChangePasswordModalOpen(true);
  };

  const closeChangePasswordModal = () => {
    setIsChangePasswordModalOpen(false);
  };

  const handleSavePassword = () => {
    setIsChangePasswordModalOpen(false);
    setNotice({
      tone: "success",
      message: "Password berhasil diperbarui.",
    });
  };

  const openSignOutModal = () => {
    setIsSignOutModalOpen(true);
  };

  const closeSignOutModal = () => {
    setIsSignOutModalOpen(false);
  };

  const handleConfirmSignOut = () => {
    setIsSignOutModalOpen(false);
    clearAuthSession();
    onNavigate("overview");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">Profile</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
          <span className="sm:hidden">Manage account and permissions.</span>
          <span className="hidden sm:inline">
            Manage account details, permission visibility, dan akses cepat ke workspace penting.
          </span>
        </p>
      </header>

      {notice ? (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-ambient ${resolveNoticeStyle(
            notice.tone,
          )}`}
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            {resolveNoticeIcon(notice.tone)}
          </span>
          <p className="leading-relaxed">{notice.message}</p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-outline-variant/35 bg-surface-container-lowest shadow-ambient">
        <div className="flex flex-col gap-8 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-9">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
            <div className="shrink-0">
              <div className="inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-surface-container-low text-primary shadow-ambient sm:h-28 sm:w-28">
                <span
                  className="material-symbols-outlined text-[3.5rem] leading-none sm:text-[4.25rem]"
                  aria-hidden="true"
                >
                  account_circle
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">
                  {profileData.fullName}
                </h2>
                <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-on-primary">
                  {roleBadgeLabel}
                </span>
              </div>

              <p className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-on-surface-variant sm:justify-start">
                <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">
                  verified
                </span>
                {currentRoleTitleLabel}
              </p>

              <div className="mt-4 grid gap-2.5 justify-items-center text-sm font-medium text-on-surface-variant sm:grid-cols-2 sm:justify-items-start sm:gap-4">
                <span className="flex min-w-0 items-start justify-center gap-2 sm:justify-start">
                  <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">
                    mail
                  </span>
                  <span className="min-w-0 break-all leading-relaxed">{profileData.email}</span>
                </span>
                <span className="flex min-w-0 items-start justify-center gap-2 sm:justify-start">
                  <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">
                    call
                  </span>
                  <span className="min-w-0 break-words leading-relaxed">{profileData.phone}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-auto">
            <button
              type="button"
              className="serene-btn-primary w-full sm:w-auto lg:min-w-[13rem]"
              onClick={openEditProfileModal}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                edit
              </span>
              Edit Profile
            </button>
          </div>
        </div>

        <div className="mx-5 h-px bg-surface-container-high sm:mx-7 lg:mx-9" />

        <div className="p-5 sm:p-7 lg:p-9">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Account Settings</h3>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">Email Address</span>
              <span className="relative block">
                <input type="email" className="serene-input pr-10" value={profileData.email} readOnly />
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/45">
                  lock_open
                </span>
              </span>
            </label>

            <label className="serene-field">
              <span className="text-sm font-semibold text-on-surface-variant">Password</span>
              <span className="relative block">
                <input type="password" className="serene-input pr-20" value="************" readOnly />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-bold text-primary transition hover:bg-primary/10"
                  onClick={openChangePasswordModal}
                >
                  Change
                </button>
              </span>
            </label>
          </div>
        </div>

        <div className="mx-5 h-px bg-surface-container-high sm:mx-7 lg:mx-9" />

        <div className="p-5 sm:p-7 lg:p-9">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">System Permissions</h3>

          <article className="mt-5 rounded-2xl border border-outline-variant/35 bg-surface-container-low p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  shield_person
                </span>
              </span>
              <p className="text-base font-bold text-on-surface sm:text-lg">Administrator Access</p>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
              <span className="sm:hidden">Akses penuh untuk itinerary, checklist, dan workspace.</span>
              <span className="hidden sm:inline">
                Kamu memiliki akses penuh untuk mengelola itinerary, checklist operasional, dan pengaturan workspace
                lintas modul.
              </span>
            </p>

            <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap">
              {profilePermissionTags.map((permission) => (
                <span
                  key={permission}
                  className="inline-flex rounded-md border border-outline-variant/35 bg-surface-container-lowest px-2 py-1 text-[10px] font-black tracking-[0.08em] text-on-surface-variant"
                >
                  {permission}
                </span>
              ))}
            </div>
          </article>
        </div>

        <div className="flex flex-col gap-4 border-t border-outline-variant/35 bg-surface-container-low/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7 lg:p-9">
          <p className="text-xs italic text-on-surface-variant">Last login: 09 April 2026 | 09:42 WIB</p>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-error-container px-5 py-3 text-sm font-bold text-on-error-container transition hover:brightness-95 sm:w-auto"
            onClick={openSignOutModal}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              logout
            </span>
            <span className="sm:hidden">Sign Out</span>
            <span className="hidden sm:inline">Sign Out of Session</span>
          </button>
        </div>
      </section>

      {isEditProfileModalOpen ? (
        <EditProfileModal
          initialValues={profileData}
          canEditRoleTitle={canEditRoleTitle}
          onClose={closeEditProfileModal}
          onSave={handleSaveProfile}
        />
      ) : null}

      {isChangePasswordModalOpen ? (
        <ChangePasswordModal onClose={closeChangePasswordModal} onSave={handleSavePassword} />
      ) : null}

      {isSignOutModalOpen ? (
        <ProfileModalOverlay onClose={closeSignOutModal}>
          <section
            className="serene-modal-shell my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto p-5 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Sign out confirmation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-error-container text-on-error-container">
              <span className="material-symbols-outlined" aria-hidden="true">
                logout
              </span>
            </div>

            <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">Sign Out Session?</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              <span className="sm:hidden">Kamu akan keluar dan kembali ke overview.</span>
              <span className="hidden sm:inline">Kamu akan keluar dari halaman profile dan kembali ke overview.</span>
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="serene-btn-secondary" onClick={closeSignOutModal}>
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-error-container px-4 py-2 text-sm font-semibold text-on-error-container transition hover:brightness-95"
                onClick={handleConfirmSignOut}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  logout
                </span>
                Sign Out
              </button>
            </div>
          </section>
        </ProfileModalOverlay>
      ) : null}
    </div>
  );
}
