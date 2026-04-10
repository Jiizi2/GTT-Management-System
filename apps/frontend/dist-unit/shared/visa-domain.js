function formatLocalIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
export function shiftIsoDate(isoDate, days) {
    if (!isoDate) {
        return "";
    }
    const parsedDate = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return isoDate;
    }
    parsedDate.setDate(parsedDate.getDate() + days);
    return formatLocalIsoDate(parsedDate);
}
export function formatVisaShortDate(isoDate) {
    if (!isoDate) {
        return "-";
    }
    const parsedDate = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return isoDate;
    }
    return parsedDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
    });
}
export function formatVisaLongDate(isoDate) {
    if (!isoDate) {
        return "-";
    }
    const parsedDate = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return isoDate;
    }
    return parsedDate.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}
export function formatVisaDateWithYear(isoDate) {
    if (!isoDate) {
        return "-";
    }
    const parsedDate = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return isoDate;
    }
    return parsedDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}
export function buildVisaAgreementNumber(groupCode, city) {
    const digits = groupCode.replace(/[^0-9]/g, "").slice(-6).padStart(6, "0");
    const citySuffix = city === "makkah" ? "65865716" : "77824519";
    return `2026${digits}${citySuffix}`;
}
export function isIsoDateValue(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
export function getGroupAgreementHotelsByCity(group, city) {
    if (!group?.visaSetup) {
        return [];
    }
    return city === "makkah" ? group.visaSetup.makkahHotels : group.visaSetup.madinahHotels;
}
export function resolveVisaAgreementNumber(row, group, city) {
    const primaryAgreement = getGroupAgreementHotelsByCity(group, city)[0];
    const customAgreementNumber = primaryAgreement?.agreementNumber?.trim();
    if (customAgreementNumber) {
        return customAgreementNumber;
    }
    return buildVisaAgreementNumber(row.groupCode, city);
}
export function resolveVisaAgreementDateRange(row, durationDays, group) {
    const normalizedDurationDays = Math.max(1, durationDays || 1);
    const fallbackMakkahStartIso = row.departureIso;
    const fallbackMadinahEndIso = row.returnIso && row.returnIso >= fallbackMakkahStartIso
        ? row.returnIso
        : shiftIsoDate(fallbackMakkahStartIso, Math.max(6, normalizedDurationDays - 1));
    const fallbackMakkahStayDays = Math.max(1, Math.min(3, Math.floor(normalizedDurationDays * 0.4)));
    const fallbackMakkahEndCandidate = shiftIsoDate(fallbackMakkahStartIso, fallbackMakkahStayDays);
    const fallbackMakkahEndIso = fallbackMakkahEndCandidate > fallbackMadinahEndIso ? fallbackMadinahEndIso : fallbackMakkahEndCandidate;
    const fallbackMadinahStartCandidate = shiftIsoDate(fallbackMakkahEndIso, 1);
    const fallbackMadinahStartIso = fallbackMadinahStartCandidate > fallbackMadinahEndIso ? fallbackMadinahEndIso : fallbackMadinahStartCandidate;
    const makkahHotels = getGroupAgreementHotelsByCity(group, "makkah");
    const madinahHotels = getGroupAgreementHotelsByCity(group, "madinah");
    const makkahStartCandidates = makkahHotels
        .map((hotel) => hotel.stayStartIso.trim())
        .filter((isoDate) => isIsoDateValue(isoDate));
    const makkahEndCandidates = makkahHotels
        .map((hotel) => hotel.stayEndIso.trim())
        .filter((isoDate) => isIsoDateValue(isoDate));
    const madinahStartCandidates = madinahHotels
        .map((hotel) => hotel.stayStartIso.trim())
        .filter((isoDate) => isIsoDateValue(isoDate));
    const madinahEndCandidates = madinahHotels
        .map((hotel) => hotel.stayEndIso.trim())
        .filter((isoDate) => isIsoDateValue(isoDate));
    const hasCustomAgreementDates = makkahStartCandidates.length > 0 ||
        makkahEndCandidates.length > 0 ||
        madinahStartCandidates.length > 0 ||
        madinahEndCandidates.length > 0;
    if (!hasCustomAgreementDates) {
        return {
            makkahStartIso: fallbackMakkahStartIso,
            makkahEndIso: fallbackMakkahEndIso,
            madinahStartIso: fallbackMadinahStartIso,
            madinahEndIso: fallbackMadinahEndIso,
        };
    }
    const customMakkahStartIso = [...makkahStartCandidates, ...madinahStartCandidates].sort()[0] ?? fallbackMakkahStartIso;
    const customMakkahEndIso = [...makkahEndCandidates].sort().at(-1) ?? fallbackMakkahEndIso;
    const customMadinahStartIso = [...madinahStartCandidates].sort()[0] ?? shiftIsoDate(customMakkahEndIso, 1);
    const customMadinahEndIso = [...madinahEndCandidates, ...makkahEndCandidates].sort().at(-1) ?? fallbackMadinahEndIso;
    const normalizedMakkahEndIso = customMakkahEndIso < customMakkahStartIso ? customMakkahStartIso : customMakkahEndIso;
    const normalizedMadinahStartIso = customMadinahStartIso < normalizedMakkahEndIso ? normalizedMakkahEndIso : customMadinahStartIso;
    const normalizedMadinahEndIso = customMadinahEndIso < normalizedMadinahStartIso ? normalizedMadinahStartIso : customMadinahEndIso;
    return {
        makkahStartIso: customMakkahStartIso,
        makkahEndIso: normalizedMakkahEndIso,
        madinahStartIso: normalizedMadinahStartIso,
        madinahEndIso: normalizedMadinahEndIso,
    };
}
export function resolveVisaProvider(packageName) {
    const normalizedPackage = packageName.trim().toLowerCase();
    if (normalizedPackage.includes("vip") || normalizedPackage.includes("premium")) {
        return "Al-Tayyar";
    }
    if (normalizedPackage.includes("silver")) {
        return "Rawaf Mina";
    }
    return "Nusuk Services";
}
export function hasMissingHotelAllocation(row) {
    return row.makkahVerified < row.pax || row.madinahVerified < row.pax;
}
export function isVisaRowActionRequired(row) {
    return row.visaStatus !== "Issued" || row.paymentStatus !== "Paid" || hasMissingHotelAllocation(row);
}
