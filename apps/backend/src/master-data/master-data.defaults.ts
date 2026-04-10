export type MasterDataCategoryDefinition = {
  key: string;
  label: string;
  description: string;
};

export type MasterDataSeedOption = {
  categoryKey: string;
  value: string;
  label: string;
  description?: string;
  sortOrder: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
};

export const MASTER_DATA_CATEGORY_DEFINITIONS: MasterDataCategoryDefinition[] = [
  {
    key: "invoice-issuing-office",
    label: "Invoice Issuing Office",
    description: "Daftar kantor penerbit invoice.",
  },
  {
    key: "invoice-status",
    label: "Invoice Status",
    description: "Status invoice yang tersedia saat create/update.",
  },
  {
    key: "invoice-client-name",
    label: "Invoice Client Suggestion",
    description: "Saran nama client saat input manual di halaman invoice.",
  },
  {
    key: "bank-disbursement",
    label: "Bank Disbursement",
    description: "Daftar rekening yang tampil di invoice PDF.",
  },
  {
    key: "user-role",
    label: "User Role",
    description: "Role user operasional yang bisa dipilih di User Management.",
  },
  {
    key: "role-catalog",
    label: "Role Catalog",
    description: "Deskripsi role dan permission untuk tampilan katalog role.",
  },
  {
    key: "saudi-city",
    label: "Saudi City",
    description: "Daftar kota Saudi untuk dropdown itinerary dan city tour.",
  },
];

export const MASTER_DATA_VALUE_ALLOWLIST: Record<string, readonly string[]> = {
  "invoice-status": ["Pending", "Paid", "Overdue", "Cancelled"],
  "user-role": ["super-admin", "admin", "finance-manager", "customer-support"],
};

export const DEFAULT_MASTER_DATA_OPTIONS: MasterDataSeedOption[] = [
  {
    categoryKey: "invoice-issuing-office",
    value: "BEKASI_OFFICE",
    label: "Bekasi Office",
    sortOrder: 1,
  },
  {
    categoryKey: "invoice-issuing-office",
    value: "JAKARTA_HQ",
    label: "Jakarta HQ",
    sortOrder: 2,
  },
  {
    categoryKey: "invoice-status",
    value: "Pending",
    label: "Pending",
    sortOrder: 1,
  },
  {
    categoryKey: "invoice-status",
    value: "Paid",
    label: "Paid",
    sortOrder: 2,
  },
  {
    categoryKey: "invoice-status",
    value: "Overdue",
    label: "Overdue",
    sortOrder: 3,
  },
  {
    categoryKey: "invoice-status",
    value: "Cancelled",
    label: "Cancelled",
    sortOrder: 4,
  },
  {
    categoryKey: "bank-disbursement",
    value: "bsi",
    label: "Mandiri Syariah (BSI) - 7088 1234 5678",
    sortOrder: 1,
  },
  {
    categoryKey: "bank-disbursement",
    value: "bca",
    label: "BCA (IDR) - 035 123 4455",
    sortOrder: 2,
  },
  {
    categoryKey: "bank-disbursement",
    value: "bca_usd",
    label: "BCA (USD) - 035 998 7766",
    sortOrder: 3,
  },
  {
    categoryKey: "invoice-client-name",
    value: "YASSIR",
    label: "Yassir",
    sortOrder: 1,
  },
  {
    categoryKey: "invoice-client-name",
    value: "HARIS",
    label: "Haris",
    sortOrder: 2,
  },
  {
    categoryKey: "invoice-client-name",
    value: "JSA",
    label: "JSA",
    sortOrder: 3,
  },
  {
    categoryKey: "user-role",
    value: "super-admin",
    label: "Super Admin",
    description: "Akses penuh lintas modul, termasuk pengaturan role dan permission.",
    sortOrder: 1,
    isActive: false,
  },
  {
    categoryKey: "user-role",
    value: "admin",
    label: "Admin",
    description: "Mengelola operasional harian, itinerary, checklist, dan monitoring visa.",
    sortOrder: 2,
    isActive: false,
  },
  {
    categoryKey: "user-role",
    value: "finance-manager",
    label: "Finance Manager",
    description: "Fokus pada invoice, status pembayaran, dan rekap billing group.",
    sortOrder: 3,
    isActive: false,
  },
  {
    categoryKey: "user-role",
    value: "customer-support",
    label: "Customer Support",
    description: "Menangani komunikasi jamaah dan kebutuhan update informasi group.",
    sortOrder: 4,
    isActive: false,
  },
  {
    categoryKey: "role-catalog",
    value: "super-admin",
    label: "Super Admin",
    description: "Akses penuh lintas modul, termasuk pengaturan role dan permission.",
    sortOrder: 1,
    isActive: false,
    metadata: {
      permissions: ["MANAGE_USERS", "EDIT_ROLES", "VIEW_ALL_REPORTS", "SYSTEM_SETTINGS"],
    },
  },
  {
    categoryKey: "role-catalog",
    value: "admin",
    label: "Admin",
    description: "Mengelola operasional harian, itinerary, checklist, dan monitoring visa.",
    sortOrder: 2,
    isActive: false,
    metadata: {
      permissions: ["EDIT_ITINERARIES", "APPROVE_CHECKLISTS", "TRACK_VISA"],
    },
  },
  {
    categoryKey: "role-catalog",
    value: "finance-manager",
    label: "Finance Manager",
    description: "Fokus pada invoice, status pembayaran, dan rekap billing group.",
    sortOrder: 3,
    isActive: false,
    metadata: {
      permissions: ["MANAGE_INVOICES", "VIEW_PAYMENT_STATUS"],
    },
  },
  {
    categoryKey: "role-catalog",
    value: "customer-support",
    label: "Customer Support",
    description: "Menangani komunikasi jamaah dan kebutuhan update informasi group.",
    sortOrder: 4,
    isActive: false,
    metadata: {
      permissions: ["VIEW_GROUP_PROFILE", "UPDATE_CONTACT_NOTES"],
    },
  },
  {
    categoryKey: "saudi-city",
    value: "MAKKAH",
    label: "Makkah",
    sortOrder: 1,
  },
  {
    categoryKey: "saudi-city",
    value: "MADINAH",
    label: "Madinah",
    sortOrder: 2,
  },
  {
    categoryKey: "saudi-city",
    value: "JEDDAH",
    label: "Jeddah",
    sortOrder: 3,
  },
  {
    categoryKey: "saudi-city",
    value: "RIYADH",
    label: "Riyadh",
    sortOrder: 4,
  },
  {
    categoryKey: "saudi-city",
    value: "TAIF",
    label: "Taif",
    sortOrder: 5,
  },
  {
    categoryKey: "saudi-city",
    value: "ABHA",
    label: "Abha",
    sortOrder: 6,
  },
  {
    categoryKey: "saudi-city",
    value: "TABUK",
    label: "Tabuk",
    sortOrder: 7,
  },
  {
    categoryKey: "saudi-city",
    value: "DAMMAM",
    label: "Dammam",
    sortOrder: 8,
  },
  {
    categoryKey: "saudi-city",
    value: "KHOBAR",
    label: "Khobar",
    sortOrder: 9,
  },
  {
    categoryKey: "saudi-city",
    value: "BURAIDAH",
    label: "Buraidah",
    sortOrder: 10,
  },
  {
    categoryKey: "saudi-city",
    value: "ALULA",
    label: "AlUla",
    sortOrder: 11,
  },
  {
    categoryKey: "saudi-city",
    value: "YANBU",
    label: "Yanbu",
    sortOrder: 12,
  },
  {
    categoryKey: "saudi-city",
    value: "HAIL",
    label: "Hail",
    sortOrder: 13,
  },
  {
    categoryKey: "saudi-city",
    value: "JUBAIL",
    label: "Jubail",
    sortOrder: 14,
  },
  {
    categoryKey: "saudi-city",
    value: "NAJRAN",
    label: "Najran",
    sortOrder: 15,
  },
  {
    categoryKey: "saudi-city",
    value: "JAZAN",
    label: "Jazan",
    sortOrder: 16,
  },
  {
    categoryKey: "saudi-city",
    value: "AL_AHSA",
    label: "Al Ahsa",
    sortOrder: 17,
  },
  {
    categoryKey: "saudi-city",
    value: "QASSIM",
    label: "Qassim",
    sortOrder: 18,
  },
];
