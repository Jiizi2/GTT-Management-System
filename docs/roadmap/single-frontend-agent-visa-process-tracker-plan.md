# Single Frontend Agent Access & Visa Process Tracker

Status: Proposed implementation baseline  
Document type: Detailed architecture and delivery plan  
Date: 2026-07-18  
Scope: Planning only; no runtime behavior is changed by this document

## 1. Executive Summary

GTT akan menggunakan satu frontend, satu backend, dan satu database untuk pengguna internal maupun Agent. Agent tidak diperlakukan sebagai aplikasi bisnis yang terpisah, melainkan sebagai principal dengan perspektif, permission, dan scope data yang berbeda.

Keputusan utamanya adalah:

1. `apps/frontend` menjadi satu-satunya frontend production untuk Super Admin, Admin, role internal lain, dan Agent.
2. Layout, design system, route presentation, serta komponen informasi digunakan bersama.
3. Menu, aksi, route, dan data yang dapat diakses ditentukan oleh permission terpusat.
4. Frontend permission hanya mengatur pengalaman pengguna. Backend tetap menjadi enforcement authority.
5. Agent hanya dapat membaca resource miliknya. `agentId` selalu berasal dari authenticated session dan tidak pernah dipercaya dari request Agent.
6. Projection API Agent tetap dipisahkan di namespace `/api/agent/*` agar DTO internal, PII, internal notes, audit payload, dan mutation contract tidak ikut terekspos.
7. Halaman `Visa Tracking` dan `Pengajuan Visa` dikonsolidasikan menjadi satu core feature bernama **Visa Process Tracker**.
8. Route canonical adalah `/visa-process` dan `/visa-process/:groupCode`.
9. Workflow visa menampilkan progress, current step, responsible team, ETA, blocking issue, riwayat step, dan—pada fase berikutnya—status per jamaah.
10. Agent bersifat read-only terhadap seluruh data operasional. Perubahan proses tetap dilakukan melalui UI internal berdasarkan permission.

Dokumen ini menggantikan keputusan frontend Agent terpisah, tetapi mempertahankan keputusan keamanan yang sudah benar: identitas Agent, token/cookie boundary, tenant scoping, safe projection, uniform not-found response, dan audit keamanan.

## 2. Repository Baseline dan Temuan Existing

### 2.1 Worktree saat dokumen dibuat

Worktree aktif berada pada `master` lokal yang tertinggal dari branch terbaru. Direktori `apps/agent-portal` pada worktree hanya berisi artefak build/test untracked, bukan source yang layak dikembangkan.

Source Agent Portal yang relevan tersedia di branch:

- `feat/strengthen-agent-entity`
- `feat/agent-portal`

Branch `feat/agent-portal` dibangun di atas `feat/strengthen-agent-entity` dan berisi:

- entity `Agent` dan ownership terhadap Group, Invoice, dan Hotel Agreement Draft;
- akun dan authentication boundary Agent;
- `/api/agent/*` tenant-scoped read endpoints;
- frontend `apps/agent-portal`;
- halaman Overview, Groups, Checklist, Visa Tracking, Visa Applications, Invoice, dan Profile;
- workflow awal `VisaApplication`;
- pengujian auth, tenant isolation, read policy, serta browser journey.

### 2.2 Kondisi fitur visa existing

Pada branch Agent Portal terdapat dua perspektif yang tumpang tindih:

1. `/visa`
   - berbasis `Group`, `VisaSetup`, dan `VisaHotelAgreement`;
   - menampilkan status visa, hotel agreement, payment, dan syarikah;
   - belum merupakan workflow end-to-end.

2. `/visa-applications`
   - berbasis `VisaApplication`;
   - memiliki facet dokumen, agreement, Nusuk, payment, dan visa;
   - belum terhubung langsung dengan `Group`;
   - belum memiliki step history, PIC, ETA, issue history, atau status per jamaah.

Kedua halaman tersebut harus dikonsolidasikan agar Agent tidak menerima dua sumber status yang dapat berbeda.

### 2.3 Gap domain

Data berikut sudah tersedia atau dapat diturunkan:

- Agent ownership;
- Group identity dan total pax;
- Group lifecycle;
- Visa status dan issued date;
- Hotel agreement dan approval status;
- Payment status;
- Nusuk/application facets;
- itinerary, checklist, invoice, dan timeline group.

Data berikut belum memiliki domain model yang memadai:

- jamaah individual;
- passport individual;
- visa status per jamaah;
- issue per jamaah;
- step completion history;
- responsible team per step;
- ETA per step atau issue;
- public blocking reason yang terpisah dari internal note.

## 3. Goals

### 3.1 Business goals

- Mengurangi pertanyaan operasional Agent melalui WhatsApp.
- Memberikan jawaban langsung untuk “sudah sampai mana”, “mengapa tertunda”, “menunggu siapa”, dan “apa yang harus dilakukan”.
- Menjadikan status proses dapat diaudit, konsisten, dan mudah dipahami.
- Memastikan seluruh pengembangan fitur internal dapat digunakan Agent ketika permission mengizinkan, tanpa membuat ulang aplikasi kedua.
- Menyiapkan pola yang dapat berkembang dari Visa Process Tracker menjadi Journey Tracker.

### 3.2 Technical goals

- Satu frontend production dan satu design system.
- Permission dan navigation terpusat.
- Backend authorization berbasis permission dan resource ownership.
- Agent read API menggunakan safe allowlisted projections.
- Tidak ada N+1 request per Group pada halaman Visa Process.
- Workflow memiliki state machine dan aturan transisi deterministik.
- Progress dihitung, bukan diinput manual.
- Internal notes dan PII tidak bocor ke Agent.
- Perubahan dapat diluncurkan bertahap dan dapat di-rollback.

## 4. Non-Goals

Hal berikut tidak termasuk MVP pertama:

- Agent membuat, mengedit, menghapus, mengapprove, mengimport, atau mengupload data operasional.
- Chat, komentar dua arah, atau WhatsApp automation.
- Push notification, email notification, atau SMS notification.
- Real-time socket tracking.
- Penyimpanan file passport baru.
- OCR passport baru.
- Penampilan nomor passport pada projection Agent.
- Generic workflow engine untuk semua domain GTT.
- Penghapusan authentication boundary Agent tanpa security review.
- Penggabungan account Agent ke `AuthUser` sebagai prasyarat single frontend.

## 5. Architecture Decisions

### 5.1 Keputusan yang berlaku

| ID       | Decision                                                     | Consequence                                                          |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| ARCH-001 | Satu frontend di `apps/frontend`                             | Tidak ada deployment frontend Agent terpisah setelah migrasi selesai |
| ARCH-002 | Satu backend dan database                                    | Semua domain tetap konsisten dan transaction boundary tidak terpecah |
| ARCH-003 | Agent adalah principal dengan permission dan ownership scope | UI dan API mengikuti capability, bukan hardcoded role branch         |
| ARCH-004 | Agent API tetap menggunakan `/api/agent/*`                   | Safe projection dan read-only boundary tetap reviewable              |
| ARCH-005 | Frontend menggunakan permission contract dari session        | Sidebar, route, dan action berasal dari sumber yang sama             |
| ARCH-006 | Authorization adalah RBAC + resource ownership               | Role saja tidak cukup untuk membatasi Agent A dari data Agent B      |
| ARCH-007 | `VisaApplication` dievolusikan menjadi basis Visa Process    | Tidak membuat workflow kedua yang bersaing                           |
| ARCH-008 | Visa Process dihubungkan ke Group secara opsional            | Proses dapat dimulai sebelum Group operasional terbentuk             |
| ARCH-009 | Progress dihitung dari step yang applicable                  | Tidak ada arbitrary percentage                                       |
| ARCH-010 | Jamaah tracking menjadi vertical slice terpisah              | Privacy dan model domain dapat diaudit secara khusus                 |

### 5.2 Keputusan yang digantikan

Keputusan untuk membangun `apps/agent-portal` sebagai frontend production independen dinyatakan **superseded**. Source dan test di branch tersebut tetap dipakai sebagai migration input, bukan dibuang sebelum parity tercapai.

### 5.3 Keputusan keamanan yang dipertahankan

- Dedicated Agent token audience dan cookie dapat tetap digunakan.
- Agent session menentukan `agentId`.
- Cross-tenant lookup dan missing resource menghasilkan response yang tidak dapat dibedakan.
- Agent DTO menggunakan field allowlist.
- Reads tidak boleh mengubah business state.
- Cache key selalu mencakup principal identity.
- Logout dan unauthorized response membersihkan seluruh cache Agent.

## 6. Target Architecture

```text
Browser
  |
  v
apps/frontend
  |
  +-- Session bootstrap
  |     +-- internal principal
  |     `-- agent principal
  |
  +-- AccessProvider
  |     +-- permission grants
  |     +-- ownership scope
  |     `-- navigation policy
  |
  +-- Shared page/view components
  |     +-- internal action slots
  |     `-- agent read-only presentation
  |
  +------------------------+
  |                        |
  v                        v
/api/*                 /api/agent/*
Internal commands      Agent safe reads
  |                        |
  +-----------+------------+
              v
         apps/backend
              |
              v
          PostgreSQL
```

Satu frontend tidak berarti satu DTO untuk semua principal. Internal dan Agent boleh menggunakan komponen tampilan yang sama, tetapi data contract dan command access tetap berbeda.

## 7. Identity dan Session Model

### 7.1 Normalized frontend principal

Frontend membutuhkan satu bentuk session yang dapat dipakai shell:

```ts
type AppPrincipal = {
  id: string;
  kind: "internal" | "agent";
  displayName: string;
  permissions: PermissionGrant[];
  agent?: {
    id: string;
    code: string;
    name: string;
  };
};

type PermissionGrant = {
  permission: PermissionKey;
  scope: "all" | "own" | "none";
};
```

### 7.2 Authentication strategy

Untuk fase migrasi:

- satu komponen Login dan satu visual language;
- internal login tetap menggunakan internal auth contract;
- Agent login tetap menggunakan Agent auth contract;
- token/cookie Agent tetap berbeda untuk mencegah role confusion;
- frontend menormalisasi session setelah autentikasi;
- kedua jenis credential tidak boleh diterima secara silang oleh backend.

Jika kemudian dibutuhkan satu endpoint login secara literal, perubahan tersebut harus melalui ADR dan security review tersendiri. Single frontend tidak bergantung pada perubahan itu.

### 7.3 Session permissions

Backend mengembalikan permission efektif, bukan hanya role label. Frontend tidak boleh membuat mapping otoritatif dari `role === "agent"`.

Contoh response:

```json
{
  "user": {
    "id": "portal-user-1",
    "kind": "agent",
    "displayName": "Ahmad Partner",
    "agent": {
      "id": "agent-1",
      "code": "AGT-001",
      "name": "PT Al Falah"
    },
    "permissions": [
      { "permission": "group.read", "scope": "own" },
      { "permission": "visa-process.read", "scope": "own" },
      { "permission": "agreement.read", "scope": "own" },
      { "permission": "invoice.read", "scope": "own" },
      { "permission": "checklist.read", "scope": "own" }
    ]
  }
}
```

## 8. Permission Model

### 8.1 Permission catalog

```text
overview.read

group.read
group.create
group.update
group.delete
group.reassign-agent

itinerary.read
itinerary.update

visa-process.read
visa-process.create
visa-process.update-step
visa-process.manage-issue
visa-process.link-group

agreement.read
agreement.create
agreement.update
agreement.approve
agreement.assign

invoice.read
invoice.read-amount
invoice.create
invoice.update
invoice.cancel

checklist.read
checklist.update
checklist.confirm-driver
checklist.reset-driver

raudhah.read
raudhah.update

profile.read
profile.update-own

admin.user.manage
admin.agent.manage
admin.master-data.manage
```

### 8.2 Default role matrix

| Capability                 | Super Admin |                          Admin |         Agent |
| -------------------------- | ----------: | -----------------------------: | ------------: |
| Overview                   |         All |                            All |           Own |
| Group read                 |         All |                            All |           Own |
| Group create/update/delete |       Allow |                          Allow |          Deny |
| Itinerary read             |         All |                            All |           Own |
| Itinerary update           |       Allow |                          Allow |          Deny |
| Visa Process read          |         All |                            All |           Own |
| Visa Process update        |       Allow |  Allow berdasarkan team policy |          Deny |
| Agreement read             |         All |                            All |           Own |
| Agreement mutation         |       Allow |                          Allow |          Deny |
| Invoice read metadata      |         All |                            All |           Own |
| Invoice amount             |       Allow | Berdasarkan finance permission | Feature-gated |
| Invoice mutation           |       Allow | Berdasarkan finance permission |          Deny |
| Checklist read             |         All |                            All |           Own |
| Checklist mutation         |       Allow |                          Allow |          Deny |
| User/Master Data           |       Allow |                           Deny |          Deny |

Role internal lain seperti Finance, Visa Officer, Hotel Team, Customer Support, atau Operator ditambahkan melalui permission mapping, bukan conditional UI baru.

### 8.3 Backend enforcement

Permission guard harus bekerja sebelum controller action. Ownership tetap diterapkan di query yang sama dengan resource lookup.

Contoh prinsip:

```ts
where: {
  agentId: principal.agentId,
  OR: [{ id: identity }, { code: normalizedCode }]
}
```

Tidak boleh:

1. membaca resource berdasarkan ID;
2. kemudian membandingkan `agentId` di memory;
3. atau menerima `agentId` dari query/body Agent.

## 9. Frontend Authorization Architecture

### 9.1 Access layer

Komponen dasar:

```text
AccessProvider
useAccess()
usePermission(permission)
can(permission)
Can
ProtectedRoute
PermissionBoundary
```

`Can` hanya untuk composition dan UX. Ia tidak dianggap security boundary.

### 9.2 Page composition

Halaman besar harus dipisahkan menjadi:

1. read/query boundary;
2. presentational view;
3. optional command/action slots.

Contoh:

```tsx
<GroupDetailView group={group}>
  <Can permission="group.update">
    <EditGroupAction group={group} />
  </Can>
  <Can permission="group.delete">
    <DeleteGroupAction group={group} />
  </Can>
</GroupDetailView>
```

Hindari satu file page yang dipenuhi puluhan kondisi `role === "agent"`.

### 9.3 Query dan mutation separation

Query dan command hooks dipisahkan secara eksplisit:

```text
useGroupReadQuery
useGroupAdminMutations

useVisaProcessReadQuery
useVisaProcessAdminMutations

useAgreementReadQuery
useAgreementAdminMutations
```

Agent bundle route tidak perlu menginisialisasi command hooks. Ini mengurangi accidental mutation dan memperjelas dependency.

### 9.4 Route guard behavior

- Route tanpa permission tidak dirender.
- Direct navigation ke route terlarang diarahkan ke `/overview` atau halaman `403` yang sesuai.
- Resource milik Agent lain tetap ditampilkan sebagai not found, bukan forbidden yang mengonfirmasi keberadaannya.
- Route guard tidak menggantikan backend check.

## 10. Navigation Plan

### 10.1 Internal sidebar

```text
Overview
Groups
Agreement
Visa Process
Checklist
Invoice
Raudhah Reminder
Master Data
Users
Profile
```

Visibility tetap mengikuti permission, sehingga role internal khusus tidak harus melihat semuanya.

### 10.2 Agent sidebar

```text
Overview
My Groups
Visa Process Tracker
Agreement
Invoice
Checklist
Profile
```

### 10.3 Canonical routes

| Feature             | Route                      |
| ------------------- | -------------------------- |
| Overview            | `/overview`                |
| My Groups           | `/groups`                  |
| Group Detail        | `/groups/:groupCode`       |
| Visa Process list   | `/visa-process`            |
| Visa Process detail | `/visa-process/:groupCode` |
| Agreement           | `/agreement`               |
| Invoice list        | `/invoice`                 |
| Invoice detail      | `/invoice/:invoiceId`      |
| Checklist           | `/checklist`               |
| Profile             | `/profile`                 |

Legacy redirects:

- `/visa` -> `/visa-process`
- `/visa/:groupCode` -> `/visa-process/:groupCode`
- `/visa-applications` -> `/visa-process`

Redirect diaktifkan setelah feature parity dan data cutover selesai.

### 10.4 Mobile navigation

Bottom navigation tidak menampilkan tujuh item sekaligus. Default:

- Overview
- My Groups
- Visa Process
- Checklist
- More

Menu More memuat Agreement, Invoice, dan Profile.

## 11. Visa Process Product Definition

### 11.1 Core questions yang harus dijawab

Setiap process detail harus menjawab:

- Group ini sudah sampai step mana?
- Berapa step yang sudah selesai?
- Apa yang sedang dikerjakan?
- Apakah proses tertunda atau blocked?
- Apa alasan publiknya?
- Tim mana yang bertanggung jawab?
- Berapa estimasi penyelesaiannya?
- Apakah Agent perlu melakukan sesuatu?
- Berapa jamaah yang selesai atau terdampak?

### 11.2 Canonical workflow

| Sequence | Step key                | Display label         |
| -------: | ----------------------- | --------------------- |
|        1 | `PASSPORT_COLLECTION`   | Passport Collection   |
|        2 | `DOCUMENT_VERIFICATION` | Document Verification |
|        3 | `NUSUK_ENTRY`           | Nusuk Entry           |
|        4 | `HOTEL_AGREEMENT`       | Hotel Agreement       |
|        5 | `READY_TO_SEND`         | Ready to Send         |
|        6 | `VISA_PAYMENT`          | Visa Payment          |
|        7 | `VISA_SUBMISSION`       | Visa Submitted        |
|        8 | `VISA_ISSUED`           | Visa Issued           |

### 11.3 Dependency graph

```text
Passport Collection
        |
        v
Document Verification
        |
        +------------------+
        |                  |
        v                  v
   Nusuk Entry       Hotel Agreement
        |                  |
        +--------+---------+
                 v
          Ready to Send
                 |
                 v
           Visa Payment
                 |
                 v
          Visa Submission
                 |
                 v
            Visa Issued
```

Nusuk Entry dan Hotel Agreement dapat aktif secara paralel. UI tetap dapat memilih satu primary current step untuk summary, tetapi detail menampilkan seluruh step aktif.

Urutan Payment dan Submission mengikuti baseline bisnis yang diberikan: Payment sebelum Visa Submitted. Dependency disimpan di domain configuration agar dapat diubah melalui code review tanpa migrasi struktur data.

### 11.4 Step statuses

```text
NOT_STARTED
IN_PROGRESS
WAITING
BLOCKED
COMPLETED
SKIPPED
UNKNOWN
```

Semantics:

- `NOT_STARTED`: prerequisite belum terpenuhi atau pekerjaan belum dimulai.
- `IN_PROGRESS`: tim sedang mengerjakan.
- `WAITING`: menunggu dependency normal, pihak eksternal, atau jadwal.
- `BLOCKED`: terdapat masalah yang menghambat critical path.
- `COMPLETED`: bukti penyelesaian tersedia.
- `SKIPPED`: step tidak berlaku dan memiliki alasan audit.
- `UNKNOWN`: data legacy belum cukup untuk menentukan status.

`UNKNOWN` penting agar migrasi tidak mengubah ketidakadaan data menjadi seolah-olah belum dimulai atau selesai.

### 11.5 Responsible team

Gunakan stable key, bukan nama orang:

```text
VISA_TEAM
HOTEL_TEAM
FINANCE_TEAM
DOCUMENT_TEAM
AGENT
MUASSASAH
SAUDI_PARTNER
SYSTEM
UNASSIGNED
```

Nama person/PIC internal dapat dicatat pada audit internal, tetapi projection Agent menampilkan team label untuk mencegah PII dan informasi cepat basi.

### 11.6 ETA

ETA disimpan sebagai rentang waktu terstruktur:

- `etaStartAt`
- `etaEndAt`
- optional timezone/derived local display

UI dapat menampilkan:

```text
1-3 hari
Diperkirakan 21-23 Juli
Belum tersedia
```

Hindari menyimpan ETA hanya sebagai free text.

### 11.7 Progress calculation

Progress dihitung server-side:

```text
completed applicable steps / total applicable steps
```

Aturan:

- `SKIPPED` dikeluarkan dari denominator jika memang tidak applicable.
- `UNKNOWN` membuat progress diberi status `incomplete-data`; UI tidak boleh menyajikan angka seolah presisi penuh.
- percentage dibulatkan ke integer terdekat.
- denominator dan numerator selalu ikut dikirim agar UI dapat menampilkan `5 / 8 Steps Completed`.
- process complete hanya ketika `VISA_ISSUED` selesai atau completion override tervalidasi.

### 11.8 Current step resolution

Backend mengembalikan:

- `activeSteps`: seluruh step aktif;
- `primaryCurrentStep`: step utama untuk summary;
- `primaryBlockingIssue`: blocker paling penting;
- `requiresAgentAction`: boolean;
- `agentActionMessage`: pesan publik jika Agent perlu bertindak.

Primary step ditentukan dengan urutan:

1. unresolved blocker pada critical path;
2. step waiting yang menghambat prerequisite berikutnya;
3. step in progress dengan sequence terendah;
4. step not started pertama yang prerequisite-nya terpenuhi;
5. completed state.

### 11.9 Blocking issue

Issue bukan sekadar text pada step. Issue memiliki lifecycle sendiri:

- dibuka;
- dapat diperbarui;
- ditetapkan responsible team dan ETA;
- dapat memengaruhi satu step, seluruh group, atau beberapa jamaah;
- diselesaikan tanpa menghapus histori.

Public reason dan internal note wajib dipisahkan.

## 12. Source-of-Truth Matrix

| Workflow step         | Source utama                           | Update behavior                        |
| --------------------- | -------------------------------------- | -------------------------------------- |
| Passport Collection   | Admin/document workflow                | Manual sampai document domain tersedia |
| Document Verification | Admin/document workflow                | Manual dengan audit                    |
| Nusuk Entry           | Visa Application/Nusuk data            | Manual atau integration event          |
| Hotel Agreement       | Group Visa Hotel Agreements            | Derived/synchronized                   |
| Ready to Send         | Dependency resolver                    | Selalu derived                         |
| Visa Payment          | Canonical visa payment status          | Synchronized                           |
| Visa Submission       | Visa operations                        | Manual dengan audit                    |
| Visa Issued           | `VisaSetup.visaStatus` dan issued date | Synchronized                           |

### 12.1 Synchronization rules

- Perubahan canonical data menghasilkan domain reconciliation, bukan frontend calculation.
- Reconciliation bersifat idempotent.
- Derived step tidak dapat diedit langsung tanpa explicit override permission.
- Override harus memiliki reason dan audit actor.
- Agent reads tidak menjalankan mutasi atau reconciliation write.
- Reconciliation dijalankan pada command path atau background job yang eksplisit, bukan pada `GET`.

### 12.2 Hotel Agreement completion

Step tidak dianggap selesai hanya karena satu agreement ada. Rule harus menggunakan domain completeness yang disetujui:

- agreement untuk kota/stay wajib tersedia;
- status approval memenuhi requirement;
- pax coverage memenuhi group requirement;
- rejected agreement menghasilkan blocker;
- missing agreement menghasilkan waiting atau blocker sesuai departure proximity.

### 12.3 Data conflict policy

Jika legacy `VisaApplication` dan `VisaSetup` berbeda:

- canonical Group data menang untuk agreement, payment, dan issued status;
- conflict dicatat untuk Admin review;
- Agent hanya melihat resolved public state;
- sistem tidak memperbaiki konflik melalui read request.

## 13. Proposed Data Model

Nama final dapat disesuaikan dengan konvensi Prisma repository, tetapi semantics berikut harus dipertahankan.

### 13.1 VisaApplication additions

```prisma
model VisaApplication {
  id                    String   @id @default(cuid())
  applicationNumber     String   @unique
  agentId               String
  groupId               String?
  createdByPortalUserId String
  initializedAt         DateTime?
  completedAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  agent       Agent
  group       Group?
  steps       VisaProcessStep[]
  issues      VisaProcessIssue[]
  events      VisaProcessEvent[]
  passengers  VisaProcessPassenger[]

  @@index([agentId, updatedAt(sort: Desc)])
  @@index([groupId])
}
```

Default MVP merekomendasikan satu active process per Group. Database invariant dapat berupa unique partial strategy atau service-level invariant yang diuji, tergantung apakah histori process lama harus tetap terhubung ke Group yang sama.

### 13.2 VisaProcessStep

```prisma
model VisaProcessStep {
  id                String   @id @default(cuid())
  visaApplicationId String
  key               VisaProcessStepKey
  sequence          Int
  status            VisaProcessStepStatus
  responsibleTeam   VisaProcessResponsibleTeam
  source            VisaProcessStepSource
  publicReason      String?
  internalNote      String?
  startedAt         DateTime?
  completedAt       DateTime?
  etaStartAt        DateTime?
  etaEndAt          DateTime?
  updatedAt         DateTime @updatedAt

  visaApplication VisaApplication
  issues          VisaProcessIssue[]

  @@unique([visaApplicationId, key])
  @@index([visaApplicationId, sequence])
  @@index([status, updatedAt])
}
```

### 13.3 VisaProcessIssue

```prisma
model VisaProcessIssue {
  id                       String   @id @default(cuid())
  visaApplicationId        String
  stepId                    String?
  code                      String
  status                    VisaProcessIssueStatus
  severity                  VisaProcessIssueSeverity
  responsibleTeam          VisaProcessResponsibleTeam
  publicMessage             String
  internalNote              String?
  affectedPassengerCount    Int?
  requiresAgentAction       Boolean  @default(false)
  agentActionMessage        String?
  etaStartAt                DateTime?
  etaEndAt                  DateTime?
  openedAt                  DateTime @default(now())
  resolvedAt                DateTime?
  createdByAuthUserId       String?
  resolvedByAuthUserId      String?

  visaApplication VisaApplication
  step            VisaProcessStep?

  @@index([visaApplicationId, status, severity])
}
```

### 13.4 VisaProcessEvent

Event menyimpan audit transition:

- previous dan next status;
- actor type/id;
- source;
- reason code;
- timestamp;
- metadata internal yang disanitasi.

Event tidak dikirim mentah ke Agent. Agent timeline dibangun dari step projection yang aman.

### 13.5 Passenger models—fase berikutnya

```prisma
model Pilgrim {
  id          String @id @default(cuid())
  groupId     String
  displayName String
  // Field sensitif lain membutuhkan privacy/security decision tersendiri.
}

model VisaProcessPassenger {
  id                String @id @default(cuid())
  visaApplicationId String
  pilgrimId         String
  currentStepKey    VisaProcessStepKey?
  status            VisaProcessPassengerStatus
  issueCode         String?
  publicIssueLabel  String?
  completedAt       DateTime?

  @@unique([visaApplicationId, pilgrimId])
  @@index([visaApplicationId, status])
}
```

Raw passport number, image, OCR payload, dan internal review note tidak termasuk Agent response.

## 14. Agent API Design

### 14.1 Endpoints

```text
GET /api/agent/visa-processes
GET /api/agent/visa-processes/:idOrGroupCode
GET /api/agent/visa-processes/:idOrGroupCode/passengers   # fase berikutnya
```

List query allowlist:

```text
q
status
step
hasIssue
requiresAgentAction
page
pageSize
sortBy
sortDirection
```

`agentId` dan semua variasinya ditolak sebagai query parameter.

### 14.2 List response example

```json
{
  "items": [
    {
      "id": "visa-process-1",
      "applicationNumber": "VA-2026-001",
      "group": {
        "code": "AA-240701",
        "name": "Group Al Falah",
        "pax": 30
      },
      "progress": {
        "completed": 4,
        "total": 8,
        "percentage": 50,
        "dataComplete": true
      },
      "primaryCurrentStep": {
        "key": "HOTEL_AGREEMENT",
        "label": "Waiting Hotel Agreement",
        "status": "WAITING",
        "responsibleTeam": "HOTEL_TEAM",
        "etaStartAt": "2026-07-19T00:00:00.000Z",
        "etaEndAt": "2026-07-21T00:00:00.000Z"
      },
      "primaryBlockingIssue": {
        "severity": "WARNING",
        "message": "Hotel Agreement belum di-approve.",
        "responsibleTeam": "HOTEL_TEAM",
        "requiresAgentAction": false
      },
      "updatedAt": "2026-07-18T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### 14.3 Detail response

Detail menambahkan:

- seluruh step yang sudah diproyeksikan;
- active step list;
- public issue list;
- group-level passenger summary jika tersedia;
- Nusuk reference yang diizinkan;
- timestamps relevan;
- `requiresAgentAction` dan public instruction.

Response tidak memuat:

- `internalNote`;
- internal actor identity;
- raw audit metadata;
- Agent lain;
- file storage key;
- passport number;
- document OCR payload;
- mutation URL atau optimistic command metadata.

### 14.4 Query performance

List endpoint harus menggunakan satu bounded projection, bukan pola:

```text
fetch groups
for every group fetch visa
for every group fetch agreements
```

Target awal:

- page size default 20, maksimum 50;
- stable secondary ordering by ID;
- narrow Prisma `select`;
- aggregate issue/current step melalui bounded relation query;
- p95 pilot list request di bawah 500 ms pada representative production-like data;
- ukur sebelum menambah materialized view.

## 15. Internal/Admin API Design

```text
GET   /api/visa-processes
GET   /api/visa-processes/:id
POST  /api/visa-processes
PATCH /api/visa-processes/:id/link-group
PATCH /api/visa-processes/:id/steps/:stepKey
POST  /api/visa-processes/:id/issues
PATCH /api/visa-processes/:id/issues/:issueId
POST  /api/visa-processes/:id/issues/:issueId/resolve
```

Setiap command memiliki permission khusus. DTO update step memisahkan:

- public reason;
- internal note;
- responsible team;
- ETA;
- status;
- override reason jika step derived.

Business invariants:

- Group dan Visa Application harus dimiliki Agent yang sama.
- Ready To Send tidak dapat completed jika prerequisite belum selesai, kecuali explicit override.
- Completed step tidak boleh mundur tanpa reopen permission dan reason.
- Issue resolve tidak menghapus history.
- `completedAt` konsisten dengan completed status.
- ETA end tidak boleh sebelum ETA start.
- Agent principal ditolak sebelum command service.

## 16. Agent Page Specifications

### 16.1 Visa Process list `/visa-process`

Bagian halaman:

1. Search dan refresh state.
2. Hero “Visa Process Tracker”.
3. Summary metrics:
   - Active Process;
   - Action Required;
   - Waiting External;
   - Visa Issued.
4. Filter chips.
5. Desktop table atau responsive cards.
6. Pagination.

Setiap row/card menampilkan:

- Group code dan name;
- total pax;
- completed/total steps;
- progress bar;
- primary current step;
- responsible team;
- ETA;
- blocker indicator;
- updated time;
- link menuju detail.

Tidak ada Export, Edit, Approve, Upload, atau Save untuk Agent kecuali sebuah kemampuan read-only export disetujui terpisah.

### 16.2 Visa Process detail `/visa-process/:groupCode`

Urutan layout:

1. Breadcrumb/back navigation.
2. Group header.
3. Progress summary.
4. Current step, responsible team, dan ETA.
5. Blocking issue banner.
6. Agent action card jika diperlukan.
7. Workflow timeline.
8. Step detail accordion.
9. Passenger aggregate/list—setelah fase jamaah tersedia.
10. Last updated information.

### 16.3 Step card

Setiap step menampilkan:

- label;
- status text dan icon;
- started/completed timestamp;
- responsible team;
- ETA;
- public reason;
- issue indicator;
- “not available” state jika data legacy belum lengkap.

Status tidak boleh disampaikan hanya melalui warna.

### 16.4 Blocking issue copy

Copy publik harus faktual dan aman:

```text
Visa submission is currently delayed.

Reason
Hotel Agreement belum di-approve.

Responsible
Hotel Team

Estimated Resolution
1-3 hari
```

Jika Agent perlu bertindak:

```text
Action Required
Mohon melengkapi passport untuk 1 jamaah melalui kanal operasional yang telah ditentukan.
```

Portal tetap read-only; action instruction tidak otomatis berarti ada tombol upload.

### 16.5 Empty dan partial states

Wajib mencakup:

- belum ada Group;
- Group belum memiliki Visa Process;
- workflow belum diinisialisasi;
- data legacy belum lengkap;
- ETA belum tersedia;
- tidak ada blocker;
- process completed;
- search/filter tidak menghasilkan data;
- API error;
- unauthorized session;
- resource not found;
- stale/refetching state.

## 17. Shared Page Refactor

### 17.1 My Groups

Agent menggunakan Group list dan detail presentation yang sama, tetapi:

- tanpa Add Group;
- tanpa edit/delete;
- tanpa reassign;
- tanpa internal notes;
- itinerary dan timeline read-only;
- hanya own groups.

### 17.2 Agreement

Agent Agreement page menggunakan dedicated safe query:

```text
GET /api/agent/agreements
```

Scope query melalui:

```text
VisaHotelAgreement -> VisaSetup -> Group -> agentId
```

Agent melihat status, hotel, kota, covered pax, dan tanggal yang disetujui policy. Agent tidak melihat assign/update/approve actions.

### 17.3 Invoice

Halaman Invoice yang sudah tersedia di branch Agent Portal dapat dimigrasikan. Amount, line item, recipient, dan document asset mengikuti finance exposure gate. Metadata dasar tetap tenant-scoped.

### 17.4 Checklist

Agent hanya melihat readiness/status dan count. Driver name, phone, plate, dan mutation controls tidak ikut projection kecuali ada approval terpisah.

### 17.5 Profile

Profile menampilkan account display name dan Agent code/name. Perubahan business profile dilakukan Admin. Password/security credential action dapat dipisahkan dari business read-only policy.

## 18. Passenger Tracking Plan

### 18.1 Release strategy

Passenger tracking adalah bagian dari target produk, tetapi dikirim setelah group workflow stabil karena:

- belum ada domain jamaah;
- nama jamaah adalah PII;
- passport merupakan data sensitif;
- ownership dan retention perlu ditetapkan;
- migration/backfill membutuhkan sumber data yang tervalidasi.

### 18.2 Agent UX

Aggregate:

```text
30 Pax
27 Completed
2 Waiting Hotel
1 Passport Expired
```

List:

```text
Ahmad     Waiting Hotel
Fatimah   Visa Issued
Ali       Passport Expired
```

Fitur:

- search;
- status filter;
- issue filter;
- pagination/virtualization jika diperlukan;
- no raw passport identifiers;
- optional masked display name jika privacy policy belum menyetujui full name.

### 18.3 Group blocker aggregation

Issue per jamaah dapat menghasilkan group-level blocker summary:

```text
1 jamaah memiliki passport kedaluwarsa.
2 jamaah masih menunggu Hotel Agreement.
```

Group progress dan passenger completion adalah metric berbeda dan tidak boleh dicampur.

## 19. Migration and Backfill

### 19.1 Source migration

1. Rebase/merge `feat/strengthen-agent-entity` dan `feat/agent-portal` ke baseline terbaru.
2. Pertahankan commit history atau lakukan transplant terkontrol; jangan menyalin dari minified build.
3. Pindahkan reusable Agent components, contracts, query boundaries, dan tests ke `apps/frontend`.
4. Gunakan shared Serene/theme foundation yang sudah ada.
5. Hapus workspace Agent terpisah hanya setelah parity, E2E, dan deployment cutover selesai.

### 19.2 Database migration

Migration bersifat additive:

- tambah optional Group relation;
- tambah process step, issue, dan event tables;
- tambah indexes;
- pertahankan legacy facets selama compatibility window;
- tidak menghapus data lama pada migration pertama.

### 19.3 Backfill strategy

Untuk existing Visa Applications:

- map document facet ke Passport/Verification dengan conservative rules;
- map agreement facet ke Hotel Agreement;
- map Nusuk facet ke Nusuk Entry;
- map payment facet ke Visa Payment;
- map visa facet ke Submission/Issued;
- gunakan `UNKNOWN` jika evidence tidak cukup;
- buat audit marker `BACKFILLED`;
- jangan mengarang `completedAt` jika timestamp tidak tersedia.

Untuk existing Groups tanpa Visa Application:

- jangan otomatis menampilkan `0%`;
- buat state “Workflow belum diinisialisasi” atau process placeholder;
- tawarkan Admin initialization queue;
- derived evidence seperti issued visa dapat dipakai setelah reconciliation rule tervalidasi.

### 19.4 Group linking

Jangan auto-link berdasarkan nama bebas. Link dilakukan melalui:

- explicit Group selection oleh Admin;
- exact owned Group invariant;
- optional candidate suggestion yang tidak melakukan write;
- audit event setelah link;
- rejection bila Agent ownership berbeda.

### 19.5 Compatibility window

Selama cutover:

- backend dapat membaca new workflow terlebih dahulu dan fallback ke legacy projection;
- Admin UI menulis new workflow;
- legacy field update diberi adapter sementara jika masih digunakan;
- setelah usage dan consistency metrics stabil, legacy facets dapat dideprecate melalui migration terpisah.

## 20. Detailed Delivery Phases

### Phase 0 — Baseline Recovery and Decision Freeze

Deliverables:

- branch baseline terbaru;
- decision record single frontend;
- inventory Agent Portal source;
- permission catalog;
- data exposure matrix;
- workflow step/dependency definition;
- finance and PII gates dicatat.

Exit criteria:

- tidak ada development dari `dist`;
- target branch disetujui;
- route dan API namespace final;
- product defaults terdokumentasi.

### Phase 1 — Central Authorization Foundation

Backend:

- permission metadata/decorator;
- permission guard;
- normalized principal;
- ownership scope helper;
- explicit deny for Agent mutations;
- wrong-audience tests.

Frontend:

- `AccessProvider`;
- `usePermission`;
- `Can`;
- `ProtectedRoute`;
- navigation filtering;
- principal-aware cache root.

Exit criteria:

- role check tidak tersebar di page baru;
- direct URL terproteksi;
- backend tetap menolak manual request;
- Agent and internal token mutually rejected where required.

### Phase 2 — Tenant-Scoped Read Vertical Slices

Urutan:

1. Groups;
2. Group detail/itinerary;
3. Agreement;
4. Invoice;
5. Checklist;
6. Profile.

Setiap slice membutuhkan:

- allowlisted projection;
- tenant predicate;
- cross-tenant tests;
- sensitive-field snapshot;
- frontend loading/error/empty states;
- internal regression.

### Phase 3 — Single Frontend Shell

- migrasikan Agent login presentation;
- gabungkan session bootstrap;
- implementasikan dynamic sidebar dan mobile nav;
- register Agent-eligible routes;
- migrasikan Agent query cache boundary;
- pertahankan route flags selama transisi.

Exit criteria:

- Agent dapat login dan menggunakan single frontend;
- internal UI tidak berubah tanpa permission reason;
- logout menghapus cache yang benar;
- source workspace Agent terpisah belum dihapus sebelum parity.

### Phase 4 — Read-Only Page Composition

- ekstrak shared views;
- pisahkan command components;
- audit semua buttons/modal/keyboard shortcuts;
- hilangkan import/export/approve/create/update/delete untuk Agent;
- audit data yang dirender, bukan hanya action.

Exit criteria:

- Agent page tidak memiliki mutation affordance;
- mutation network call tidak terjadi dalam Agent journey;
- internal users tetap dapat menjalankan action sesuai permission.

### Phase 5 — Visa Process Domain

- additive schema;
- step state machine;
- progress resolver;
- current step resolver;
- issue lifecycle;
- source synchronization;
- admin commands;
- audit events;
- legacy backfill.

Exit criteria:

- workflow invariant tests green;
- read tidak menghasilkan write;
- conflict policy teruji;
- Admin dapat mengelola semua public fields yang dibutuhkan Agent.

### Phase 6 — Visa Process UI

- list page;
- detail page;
- progress/timeline/issue components;
- responsive states;
- dynamic navigation;
- legacy redirects di balik flag;
- accessibility checks.

Exit criteria:

- Agent dapat menjawab lima core questions dari halaman;
- tidak ada N+1 frontend fetch;
- Admin update muncul setelah invalidation/refetch;
- route lama belum dihapus sebelum parity.

### Phase 7 — Passenger Tracking

- privacy/security ADR;
- Pilgrim ownership model;
- passenger process status;
- aggregate projection;
- safe list projection;
- status/error UX;
- retention and masking policy.

### Phase 8 — Security, Pilot, and Cutover

- full authorization matrix;
- production-like Prisma tests;
- performance measurement;
- feature flag pilot;
- operational runbook;
- rollback rehearsal;
- remove separate frontend deployment after successful cutover.

## 21. Testing Strategy

### 21.1 Unit tests

- permission resolution;
- navigation visibility;
- workflow dependency resolver;
- progress calculation;
- primary current step resolution;
- issue priority;
- ETA formatting;
- legacy mapping;
- public DTO sanitization;
- status label and tone mapping.

### 21.2 Backend policy tests

| Scenario                              | Expected                          |
| ------------------------------------- | --------------------------------- |
| Anonymous reads Agent endpoint        | `401`                             |
| Internal token on Agent-only boundary | rejected sesuai auth policy       |
| Agent token on internal mutation      | rejected before controller action |
| Agent A lists processes               | hanya Agent A                     |
| Agent A reads Agent B by ID           | uniform `404`                     |
| Agent A reads Agent B by code         | uniform `404`                     |
| Agent supplies `agentId` query        | `400`                             |
| Agent calls PATCH/POST/DELETE         | denied, no DB change              |
| Agent response snapshot               | tidak ada internal note/PII       |
| GET process                           | tidak mengubah row count/checksum |

### 21.3 Domain integration tests

- Group link requires matching Agent ownership;
- Hotel approval reconciliation;
- rejected agreement creates blocker;
- payment completion synchronizes step;
- issued visa completes final step;
- Ready To Send requires both parallel prerequisites;
- idempotent reconciliation;
- derived step override audit;
- reopen completed step rules;
- issue resolve history.

### 21.4 Frontend component tests

- Agent hides action slots;
- internal permission shows intended actions;
- route guard redirects;
- progress value and label match;
- multiple active steps render;
- blockers render severity and text, not color only;
- unknown/legacy state;
- no ETA state;
- empty/filter/error/loading states;
- responsive cards/table;
- keyboard and focus behavior.

### 21.5 E2E journeys

Agent journey:

1. login;
2. view own overview;
3. open My Groups;
4. open Visa Process;
5. inspect blocker and timeline;
6. confirm no mutation controls;
7. attempt direct forbidden URL;
8. logout;
9. confirm cache/session cleared.

Admin-to-Agent journey:

1. Admin updates a workflow step;
2. Admin opens public blocker with ETA;
3. Agent refreshes;
4. Agent sees updated progress, PIC, and reason;
5. Admin resolves issue;
6. Agent sees resolved state without internal notes.

Cross-tenant journey:

1. Agent A copies identifier for Agent B fixture;
2. direct URL returns not found;
3. list/search/count do not reveal Agent B;
4. browser cache does not retain Agent B after account/session change.

## 22. Performance and Caching

### 22.1 Backend

- tenant-aware composite indexes;
- stable pagination;
- bounded child selects;
- no per-row service call;
- no state mutation on read;
- query plan measurement using representative data.

Potential indexes:

```text
(agentId, updatedAt, id)
(groupId)
(visaApplicationId, sequence)
(visaApplicationId, status, severity)
```

Index final diputuskan setelah `EXPLAIN ANALYZE` pada disposable production-like database.

### 22.2 Frontend cache

Cache root mencakup principal:

```text
["app", principal.kind, principal.id, ...resourceKey]
```

Rules:

- logout membatalkan dan menghapus cache principal;
- `401` menghapus session dan business cache;
- switching principal tidak boleh me-reuse response;
- Admin workflow mutation menginvalidasi internal queries;
- Agent menggunakan refresh/poll ringan, bukan real-time pada MVP;
- default stale time ditetapkan berdasarkan resource, bukan global semata.

## 23. Security Requirements

### 23.1 Threats

| Threat                            | Control                                    |
| --------------------------------- | ------------------------------------------ |
| IDOR Group/process/invoice        | tenant predicate dalam resource query      |
| Agent mutation via manual request | backend permission guard dan method policy |
| Role confusion                    | separate token audience/cookie validation  |
| PII leakage                       | explicit projection dan snapshot tests     |
| Internal note leakage             | separate public/internal fields            |
| Cache leakage antar account       | principal-scoped cache dan logout clearing |
| Enumeration by response           | uniform not found behavior                 |
| Mass data export                  | pagination cap dan export permission       |
| Free-text sensitive log           | structured logging dan redaction           |
| Read side effects                 | checksum/count tests                       |

### 23.2 Public field policy

Setiap field Agent harus melewati klasifikasi:

- public business field;
- confidential business field;
- PII;
- credential/security data;
- internal operational note.

Default deny digunakan ketika klasifikasi belum diputuskan.

### 23.3 Passenger privacy gate

Sebelum full passenger name ditampilkan:

- Product menyetujui use case;
- Security menyetujui field projection;
- retention period ditentukan;
- masking policy ditentukan;
- audit access ditentukan;
- cross-tenant tests tersedia.

## 24. Observability dan Audit

Metrics awal:

- active visa processes;
- processes with open blocker;
- processes requiring Agent action;
- average age per current step;
- processes without update beyond threshold;
- reconciliation conflicts;
- Agent endpoint latency/error rate;
- unauthorized/cross-tenant access attempts;
- workflow transition failure.

Logging:

- structured event names;
- process/group opaque ID;
- actor category;
- permission result;
- no password/token;
- no raw passport/document content;
- public/internal free text tidak dicatat secara penuh kecuali benar-benar diperlukan dan disanitasi.

Audit event wajib untuk:

- process creation;
- Group link/relink;
- step transition;
- derived override;
- issue open/update/resolve;
- responsible team change;
- ETA change;
- passenger status change pada fase berikutnya.

## 25. Deployment and Rollback

### 25.1 Deployment order

1. Backup dan migration preflight.
2. Additive database migration.
3. Backend compatibility release dengan feature disabled.
4. Permission/session frontend foundation.
5. Single frontend Agent routes behind feature flag.
6. Internal Visa Process editor.
7. Agent Visa Process read feature.
8. Pilot account enablement.
9. Legacy redirect enablement.
10. Separate frontend deployment retirement.

### 25.2 Feature flags

Suggested flags:

```text
AGENT_SINGLE_FRONTEND_ENABLED
AGENT_SHARED_GROUP_PAGES_ENABLED
AGENT_VISA_PROCESS_ENABLED
VISA_PROCESS_ADMIN_EDITOR_ENABLED
VISA_PROCESS_LEGACY_REDIRECT_ENABLED
AGENT_PASSENGER_TRACKING_ENABLED
```

### 25.3 Rollback

- disable route flags;
- preserve additive data tables;
- restore legacy read projection;
- disable redirects;
- do not drop columns/tables during initial release;
- retain previous static deployment until pilot sign-off;
- rollback application independently from destructive schema removal.

## 26. Risk Register

| Risk                                          | Impact                  | Mitigation                                                |
| --------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| Single page menjadi penuh conditional         | Maintainability turun   | shared view + separate action slots + permission boundary |
| Frontend permission dianggap security         | Data/mutation breach    | backend authoritative enforcement                         |
| Reuse internal DTO membocorkan PII            | High                    | dedicated `/api/agent` projection                         |
| Dual status VisaSetup/VisaApplication berbeda | Kepercayaan Agent turun | source-of-truth matrix dan reconciliation                 |
| Backfill menghasilkan progress palsu          | Misleading              | `UNKNOWN`, initialization state, Admin review             |
| N+1 requests pada banyak Group                | Slow page/backend load  | aggregated list projection                                |
| Agent account boundary hilang saat merge UI   | Role confusion          | pertahankan Agent token/cookie boundary                   |
| Branch terlalu jauh dari master               | Merge regression        | baseline recovery phase dan small vertical PRs            |
| Passenger PII terlalu cepat dibuka            | Privacy incident        | separate gated phase                                      |
| Internal actions hilang untuk Admin           | Operational regression  | permission matrix and internal E2E                        |
| Route redirect memutus bookmark               | User disruption         | compatibility redirect setelah parity                     |

## 27. Pull Request Sequence

Recommended small PR sequence:

1. ADR/documentation and permission catalog.
2. Backend permission primitives and tests.
3. Frontend AccessProvider/Can/ProtectedRoute.
4. Agent session normalization and cache boundary.
5. Agent Group safe projection + shared Group pages.
6. Agreement/Invoice/Checklist/Profile vertical slices.
7. Dynamic sidebar and mobile navigation.
8. Visa Process additive schema and migration.
9. Visa Process state machine and reconciliation.
10. Internal Visa Process API/editor.
11. Agent Visa Process aggregate API.
12. Agent Visa Process list/detail UI.
13. Backfill/cutover tooling and consistency report.
14. Security/performance/pilot hardening.
15. Legacy redirects and separate frontend retirement.
16. Passenger tracking ADR/model/API/UI as a later series.

Setiap PR harus deployable atau dormant, memiliki rollback path, dan tidak bergantung pada perubahan destruktif yang belum digunakan.

## 28. Acceptance Criteria

### 28.1 Architecture

- Hanya `apps/frontend` yang menjadi frontend production setelah cutover.
- Backend dan database tetap tunggal.
- Source Agent Portal terpisah tidak dihapus sebelum feature parity.
- Tidak ada runtime dependency terhadap minified `dist`.

### 28.2 Permission

- Sidebar dan routes berasal dari permission contract.
- Tidak ada role check tersebar pada fitur baru.
- Agent tidak dapat menjalankan create/update/delete/approve/import/upload.
- Manual API request tetap ditolak backend.
- Resource ownership diterapkan dalam query.

### 28.3 Tenant isolation

- Agent hanya melihat Group, Visa Process, Agreement, Invoice, dan Checklist miliknya.
- Agent A tidak dapat menemukan data Agent B melalui list, search, filter, count, ID, atau code.
- Missing dan cross-tenant detail menghasilkan uniform response.
- Cache tidak bocor antar principal.

### 28.4 Visa Process MVP

- `/visa-process` menampilkan seluruh proses Agent yang diizinkan.
- `/visa-process/:groupCode` menampilkan satu workflow lengkap.
- Progress menampilkan numerator, denominator, dan percentage yang konsisten.
- Current step, responsible team, ETA, dan blocker tampil jika tersedia.
- Parallel Nusuk/Hotel state dapat ditampilkan dengan benar.
- Unknown legacy data tidak dianggap complete atau 0% secara palsu.
- Public reason terpisah dari internal note.
- Agent tidak melihat mutation controls.
- Admin dapat memperbarui process berdasarkan permission.
- Perubahan Admin muncul setelah cache invalidation/refetch.
- GET Agent tidak mengubah business data.

### 28.5 Passenger tracking

- Hanya dirilis setelah privacy gate.
- Aggregate sama dengan detail rows.
- Tidak ada raw passport number/file/OCR payload pada response.
- Cross-tenant passenger access ditolak.
- Full name atau masking mengikuti policy yang disetujui.

### 28.6 UX and accessibility

- Desktop dan mobile memiliki layout yang usable.
- Status disampaikan melalui text, bukan warna saja.
- Keyboard navigation dan focus state bekerja.
- Loading, error, empty, partial, unknown, completed, dan stale states tersedia.
- Mobile navigation tidak terlalu padat.

## 29. Product Defaults

Default berikut digunakan kecuali ada keputusan tertulis baru:

1. Satu active Visa Process per Group.
2. Visa Process dapat ada sebelum Group dan menggunakan application number sebagai identity sementara.
3. Nusuk Entry dan Hotel Agreement berjalan paralel.
4. Payment berada sebelum Visa Submitted pada dependency baseline.
5. Responsible yang terlihat Agent adalah team, bukan nama person.
6. ETA disimpan sebagai date range.
7. Agent hanya menerima public reason.
8. Agent Portal bersifat read-only untuk business data.
9. Invoice amount tetap feature-gated.
10. Passenger full name tetap privacy-gated.
11. Completed/archived own groups tetap terlihat kecuali retention policy memutuskan lain.
12. Tidak ada push notification pada MVP; blocker notification berarti on-page alert.

## 30. Open Decisions Before Relevant Phase

Keputusan berikut tidak menghalangi authorization dan group-centric work, tetapi harus selesai sebelum fitur terkait dirilis:

| Decision                                                       | Required before              |
| -------------------------------------------------------------- | ---------------------------- |
| Apakah payment selalu sebelum submission untuk semua provider? | State machine freeze         |
| Apakah satu Group dapat memiliki beberapa active visa batch?   | Schema invariant final       |
| Apakah Agent boleh melihat agreement number?                   | Agreement projection release |
| Apakah Agent boleh melihat invoice amount/line items?          | Invoice financial exposure   |
| Apakah full passenger name boleh tampil?                       | Passenger UI release         |
| Apa retention passenger/passport status?                       | Passenger migration          |
| Apakah Agent perlu tombol download/export read-only?           | Export implementation        |
| Berapa threshold proses dianggap stalled?                      | Alerting/observability       |

## 31. Definition of Done

Program dinyatakan selesai ketika:

- single frontend Agent journey production-ready;
- centralized permission model diterapkan pada frontend dan backend;
- seluruh Agent resources tenant-scoped;
- internal regression suite green;
- security matrix dan cross-tenant tests green pada Prisma;
- Visa Process state machine dan admin editor production-ready;
- Agent Visa Process list/detail memenuhi acceptance criteria;
- data backfill memiliki consistency report;
- performance target pilot terpenuhi;
- deployment dan rollback rehearsal selesai;
- legacy routes diarahkan dengan aman;
- separate Agent frontend deployment dapat dihentikan tanpa kehilangan fitur;
- runbook account disable, incident response, dan workflow correction tersedia.

Passenger tracking merupakan completion milestone terpisah karena memiliki privacy gate dan domain model baru.

## 32. Final Recommendation

Lanjutkan dengan pola **single frontend, shared presentation, centralized permissions, backend ownership enforcement, dan dedicated Agent-safe read projections**.

Visa Process Tracker menjadi core feature pertama yang membuktikan pola tersebut: Admin dan Agent melihat domain dan visual workflow yang sama, tetapi memperoleh data scope dan action capability yang berbeda. Pendekatan ini menjaga maintainability tanpa mengorbankan tenant isolation, privacy, atau keamanan command API.
