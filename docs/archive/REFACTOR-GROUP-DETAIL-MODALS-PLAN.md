# Refactor Plan: group-detail-modals.tsx

## 📊 Current State Analysis

**File:** `apps/frontend/src/components/group-detail-modals.tsx`
**Lines:** 1897
**Test Coverage:**
- Statements: 22.97%
- Branches: 9.62%
- Functions: 19.51%
- Lines: 22.83%

**Issues Identified:**
1. File terlalu besar (1897 baris) - violates Single Responsibility Principle
2. 8 modal components dalam 1 file
3. Schema validation bercampur dengan UI components
4. Banyak conditional rendering yang complex
5. Helper functions tidak terorganisir
6. Inline functions sulit di-test
7. Mock dependencies sangat complex untuk testing

## 🎯 Refactor Goals

1. **Improve Testability** - Meningkatkan branches coverage dari 9.62% ke 60%+
2. **Better Organization** - Memisahkan concerns dengan jelas
3. **Reusability** - Membuat komponen yang bisa di-reuse
4. **Maintainability** - Memudahkan future development
5. **Type Safety** - Memperbaiki type definitions

## 🏗️ Proposed Architecture

```
src/components/group-detail-modals/
├── index.ts                          # Public exports
├── schemas/
│   ├── musyrif.schema.ts             # MusyrifModal validation
│   ├── group-edit.schema.ts          # GroupEditModal validation
│   ├── note.schema.ts                # NoteModal validation
│   ├── schedule.schema.ts            # ScheduleModal validation
│   └── index.ts                      # Schema exports
├── helpers/
│   ├── schedule-helpers.ts           # Schedule-related utilities
│   ├── validation-helpers.ts         # Validation utilities
│   └── index.ts                      # Helper exports
├── shared/
│   ├── ModalShell.tsx                # Reusable modal wrapper
│   ├── ModalField.tsx                # Reusable field component
│   ├── ModalFooter.tsx               # Reusable footer component
│   └── index.ts                      # Shared component exports
├── MusyrifModal.tsx                  # Extracted component
├── UnlinkGroupConfirmModal.tsx       # Extracted component
├── DeleteConfirmModal.tsx            # Extracted component
├── DeleteGroupModal.tsx              # Extracted component
├── GroupEditModal.tsx                # Extracted component
├── ScheduleModal.tsx                 # Extracted component
├── EditScheduleModal.tsx             # Extracted component
├── NoteModal.tsx                     # Extracted component
└── __tests__/
    ├── MusyrifModal.test.tsx
    ├── UnlinkGroupConfirmModal.test.tsx
    ├── DeleteConfirmModal.test.tsx
    ├── DeleteGroupModal.test.tsx
    ├── GroupEditModal.test.tsx
    ├── ScheduleModal.test.tsx
    ├── EditScheduleModal.test.tsx
    ├── NoteModal.test.tsx
    ├── schemas.test.ts
    └── helpers.test.ts
```

## 📋 Implementation Phases

### Phase 1: Extract Shared Components (2-3 hours)

**Goal:** Create reusable modal components

**Tasks:**
1. Create `ModalShell.tsx`
   - Extract modal wrapper logic
   - Handle focus trap
   - Manage overlay click
   - Support custom sizes

2. Create `ModalField.tsx`
   - Standardize field rendering
   - Handle error display
   - Support aria attributes

3. Create `ModalFooter.tsx`
   - Standardize footer layout
   - Support save/cancel buttons
   - Handle loading state

4. Create `schemas/` directory
   - Extract all Zod schemas
   - Create separate schema files
   - Add schema tests

**Acceptance Criteria:**
- ✅ Shared components created
- ✅ Existing modals still work
- ✅ No breaking changes
- ✅ Type definitions complete

---

### Phase 2: Extract Helper Functions (1-2 hours)

**Goal:** Separate business logic from UI

**Tasks:**
1. Create `helpers/schedule-helpers.ts`
   - Extract `shouldUseSaudiCityDropdown`
   - Extract schedule-related logic
   - Add unit tests

2. Create `helpers/validation-helpers.ts`
   - Extract validation utilities
   - Add unit tests

3. Refactor existing code to use helpers

**Acceptance Criteria:**
- ✅ All helper functions extracted
- ✅ Helper functions have 100% test coverage
- ✅ No logic changes

---

### Phase 3: Extract Modal Components (4-5 hours)

**Goal:** Split into individual component files

**Order of extraction (simplest to most complex):**
1. `UnlinkGroupConfirmModal.tsx` (simple confirm modal)
2. `DeleteConfirmModal.tsx` (simple confirm modal)
3. `DeleteGroupModal.tsx` (confirm with conditional)
4. `MusyrifModal.tsx` (simple form modal)
5. `NoteModal.tsx` (form modal with pin toggle)
6. `GroupEditModal.tsx` (complex form modal)
7. `ScheduleModal.tsx` (very complex form)
8. `EditScheduleModal.tsx` (very complex form)

**For each component:**
1. Create new file
2. Move component code
3. Import shared components
4. Update imports in parent
5. Add component-specific tests
6. Verify existing tests still pass

**Acceptance Criteria:**
- ✅ All 8 modals extracted
- ✅ Each modal in separate file
- ✅ Shared components used
- ✅ All existing tests pass
- ✅ No breaking changes

---

### Phase 4: Improve Test Coverage (6-8 hours)

**Goal:** Achieve 60%+ branches coverage

**Strategy:**
1. Test each modal individually
2. Test all branches and conditions
3. Test error states
4. Test edge cases
5. Test helper functions
6. Test schemas

**For each modal, test:**
- ✅ Render with different props
- ✅ All button clicks
- ✅ Form validation
- ✅ Error states
- ✅ Loading states
- ✅ Conditional rendering
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ Accessibility attributes

**Acceptance Criteria:**
- ✅ Branches coverage ≥ 60%
- ✅ All modals have individual test files
- ✅ Helper functions have 100% coverage
- ✅ Schemas have 100% coverage

---

### Phase 5: Documentation & Cleanup (1-2 hours)

**Goal:** Complete documentation and final cleanup

**Tasks:**
1. Add JSDoc comments to all components
2. Add prop type documentation
3. Update README with usage examples
4. Remove unused code
5. Final code review
6. Update PROJECT-REVIEW.md

**Acceptance Criteria:**
- ✅ All components documented
- ✅ Usage examples provided
- ✅ No dead code
- ✅ Code review completed

---

## 🧪 Testing Strategy

### Unit Tests
- Test each component in isolation
- Mock dependencies
- Test all props and states
- Test error handling

### Integration Tests
- Test modal interactions
- Test form submissions
- Test validation flows

### Coverage Targets
- Statements: ≥ 80%
- Branches: ≥ 60%
- Functions: ≥ 80%
- Lines: ≥ 80%

---

## ⚠️ Risks & Mitigation

### Risk 1: Breaking Changes
**Mitigation:**
- Keep original file as re-export wrapper
- Gradual migration
- Comprehensive testing

### Risk 2: Import Cycles
**Mitigation:**
- Clear dependency structure
- Use index.ts for exports
- Avoid circular imports

### Risk 3: Performance Impact
**Mitigation:**
- Lazy loading for modals
- Memoization where needed
- Performance testing

### Risk 4: Type Errors
**Mitigation:**
- Strict TypeScript checking
- Comprehensive type definitions
- Type testing

---

## 📅 Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Shared Components | 2-3 hours | None |
| Phase 2: Helper Functions | 1-2 hours | Phase 1 |
| Phase 3: Extract Modals | 4-5 hours | Phase 1, 2 |
| Phase 4: Test Coverage | 6-8 hours | Phase 3 |
| Phase 5: Documentation | 1-2 hours | Phase 4 |
| **Total** | **14-20 hours** | |

---

## ✅ Success Criteria

1. **Test Coverage:**
   - Branches: ≥ 60% (from 9.62%)
   - Statements: ≥ 80% (from 22.97%)
   - Functions: ≥ 80% (from 19.51%)
   - Lines: ≥ 80% (from 22.83%)

2. **Code Quality:**
   - No file > 300 lines
   - All components documented
   - No code duplication
   - Clear separation of concerns

3. **Maintainability:**
   - Easy to add new modals
   - Easy to modify existing modals
   - Clear component structure
   - Reusable components

4. **Backward Compatibility:**
   - All existing functionality preserved
   - No breaking changes
   - All existing tests pass

---

## 🚀 Next Steps

1. **Get approval** for this refactor plan
2. **Create feature branch:** `refactor/group-detail-modals`
3. **Start Phase 1:** Extract shared components
4. **Commit frequently** with clear messages
5. **Test after each phase**
6. **Create PR** when all phases complete

---

## 📝 Notes

- This refactor is **non-breaking** - existing code will continue to work
- Can be done **incrementally** - each phase is independent
- **Backward compatible** - original file can re-export from new structure
- **Test-driven** - write tests before refactoring
- **Documentation-first** - document as you go

---

## 🔗 Related Files

- `PROJECT-REVIEW.md` - Project review documentation
- `vitest.component.config.mts` - Test configuration
- `apps/frontend/src/components/group-detail-modals.tsx` - Target file
- `apps/frontend/src/components/group-detail-modals.test.tsx` - Current tests
