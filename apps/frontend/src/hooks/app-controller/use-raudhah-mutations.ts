import { useCallback } from "react";
import type { GroupRaudhahAppointment, VisaRaudhahEditFormState } from "../../shared/app-domain";
import type { UpdateVisaSetupForGroupAndSync } from "./types";

/**
 * Raudhah appointment mutations.
 *
 * All three are pure optimistic edits of a group's visa setup, so they need only
 * the updateVisaSetupForGroupAndSync primitive - no record list, no navigation,
 * no sync queue of their own.
 */
export function useRaudhahMutations(updateVisaSetupForGroupAndSync: UpdateVisaSetupForGroupAndSync) {
  const handleUpdateRaudhahAppointment = useCallback(
    (groupCode: string, appointment: VisaRaudhahEditFormState) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ group, visaSetup }) => {
        const nextAppointments: GroupRaudhahAppointment[] = appointment.appointments
          .map((entry, index) => ({
            id: entry.id?.trim() || `${group.code}-raudhah-${Date.now().toString(36)}-${index + 1}`,
            dateIso: entry.dateIso.trim(),
            status: entry.status,
            tasrehPrinted: Boolean(entry.tasrehPrinted),
          }))
          .filter((entry) => entry.dateIso.length > 0)
          .sort((left, right) => left.dateIso.localeCompare(right.dateIso));

        return {
          ...visaSetup,
          raudhahAppointments: nextAppointments,
        };
      });
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleSetRaudhahTasrehPrinted = useCallback(
    (groupCode: string, appointmentId: string, tasrehPrinted: boolean) => {
      updateVisaSetupForGroupAndSync(
        groupCode,
        ({ visaSetup }) => {
          const nextAppointments = visaSetup.raudhahAppointments.map((entry) =>
            entry.id === appointmentId
              ? {
                  ...entry,
                  tasrehPrinted,
                }
              : entry,
          );

          const hasChanged = nextAppointments.some((entry, index) => entry !== visaSetup.raudhahAppointments[index]);
          if (!hasChanged) {
            return visaSetup;
          }

          return {
            ...visaSetup,
            raudhahAppointments: nextAppointments,
          };
        },
        {
          successMessage: "Status print tasreh Raudhah berhasil diperbarui.",
          failureMessage: "Perubahan status print tasreh Raudhah belum berhasil disimpan ke backend.",
        },
      );
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleClearRaudhahAppointment = useCallback(
    (groupCode: string) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        raudhahAppointments: [],
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );


  return {
    handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment,
  };
}
