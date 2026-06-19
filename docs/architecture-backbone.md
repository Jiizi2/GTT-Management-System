# Application Backbone Architecture

This document serves as a reference for the application's core backbone, covering the database relations, backend data flow, and frontend consumption. Maintaining this standard ensures that future developments are clean, scalable, and non-destructive.

## 1. Technology Stack Overview
- **Database**: PostgreSQL
- **ORM**: Prisma Client
- **Backend Framework**: NestJS (TypeScript, Express/Platform Express under the hood)
- **Frontend Framework**: React (Vite/ESBuild) with `@tanstack/react-query` for data fetching and `Tailwind CSS` for styling.

---

## 2. Database Structure & Relations (Prisma)

The central piece of the application's domain revolves around the `Group` model and its various relationships representing a travel or tour system (likely Hajj/Umrah given the domain terms like Musyrif, Raudhah, Makkah, Madinah).

### Core Entities:
- **`Group`**: The central record for a travel group.
  - Relates to `Musyrif` (1-to-1)
  - Relates to `VisaSetup` (1-to-1)
  - Relates to `Invoice` and `InvoiceClient` (1-to-Many)
  - Relates to `ItineraryItem`, `GroupNote`, `GroupTimelineItem`, `NextActivity` (1-to-Many)
  - Supports Hierarchical Sub-groups via `parentGroupId` & `childGroups`.

- **`VisaSetup` & Agreements**:
  - `VisaSetup` tracks visa statuses and links to `VisaHotelAgreement` (Makkah/Madinah hotels).
  - Also linked to `RaudhahAppointment` representing appointments during the trip.

- **`ItineraryItem` & Checklists**:
  - Detailed schedule mapping to `ChecklistAssignment` and further down to `ChecklistDriver`.

- **`AuthUser`**:
  - Handles authentication and authorization using Role-Based Access Control (`AuthUserRole`: SUPER_ADMIN, ADMIN, FINANCE_MANAGER, CUSTOMER_SUPPORT).

> [!IMPORTANT]
> **Data Integrity:** Always use Prisma's nested writes or transaction capabilities when creating or updating a `Group` alongside its nested records (like Musyrif, ItineraryItems) to ensure atomicity. 

---

## 3. Backend Flow (NestJS)

The backend follows a domain-driven, modular architecture using NestJS:

- **Modules (`src/groups`, `src/auth`, `src/invoices`)**: Encapsulates related logic.
- **Controllers (HTTP Layer)**: Define REST API endpoints, using decorators like `@Get()`, `@Post()`, `@UseGuards()` for Auth.
- **DTOs (Data Transfer Objects)**: Input validation is handled using `class-validator` and `class-transformer`. Always validate incoming request payloads before they reach the service layer.
- **Services (Business Logic)**: Classes like `GroupsService` hold the core business rules and interface with Prisma.
- **PrismaService (`src/prisma`)**: A centralized service wrapping the Prisma Client for database access.

### Standard Request Lifecycle:
1. Client sends HTTP Request to Endpoint.
2. **Guards/Middleware**: Validates JWT (`@nestjs/jwt`) and user roles (`@nestjs/throttler` for rate limiting).
3. **Pipes**: Transforms and validates payload via DTOs.
4. **Controller**: Routes data to the appropriate Service.
5. **Service**: Processes business logic and queries Prisma.
6. **Controller**: Returns serialized JSON.

---

## 4. Frontend Flow (React)

The frontend is built for performance and type-safety.

- **Routing**: Handled by `react-router-dom`.
- **Data Fetching & State Management**: `@tanstack/react-query` is the standard for server state. It caches responses, handles background refetching, and provides loading/error states.
  - *Rule*: Do not use `useEffect` for basic data fetching. Always use React Query's `useQuery` or `useMutation`.
- **Form Handling**: Forms are managed via `react-hook-form` and validated using `zod` schemas. This ensures type safety from the UI down to the API payload.
- **Styling**: `Tailwind CSS` is used for utility-first styling. Component files should maintain a clean separation of concerns, extracting complex logic into custom hooks.

### Standard Data Consumption Lifecycle:
1. A component mounts and calls a custom hook (e.g., `useGetGroup(id)`).
2. React Query checks the cache; if stale or empty, it triggers an API call (`fetch` or `axios`).
3. The component renders a skeleton or loading spinner (`isLoading`).
4. Data is returned, React Query caches it, and the component renders the UI.
5. Updates/Deletions are handled via `useMutation`, which should invalidate the relevant queries to refresh the list automatically.

---

## 5. Guidelines for Future Development

To keep the backbone clean and non-destructive:

1. **Database Migrations**: Never modify `schema.prisma` without running `npm run db:migrate:backend` to generate migration files. Do not modify the database schema directly via SQL.
2. **Type Safety**: Keep the types synced between backend DTOs and Frontend Zod schemas. If a field is added to Prisma, ensure the DTOs and Zod validators are updated to reflect it.
3. **Avoiding N+1 Queries**: When querying relational data in Prisma, use the `include` or `select` property thoughtfully. Over-including can cause massive performance bottlenecks; under-including will lead to multiple sequential queries.
4. **Component Reusability**: Do not duplicate UI logic. If a widget (e.g., a Status Badge) is used in multiple places, extract it into a shared component.

> [!TIP]
> Before implementing a new feature, review this architecture. Ensure that your database relations respect existing paradigms and that you are utilizing React Query's caching effectively on the frontend.
