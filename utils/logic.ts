import { Experience, MatchResult } from "../types";

export const calculateExperienceYears = (experience: Experience[]): number => {
    if (!experience || experience.length === 0) return 0;

    // 1. Sort by start date
    const sorted = [...experience].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    let totalMonths = 0;

    // Simple logic: sum durations. 
    // Advanced logic (overlap handling) can be added if needed, 
    // but for now let's sum ranges to avoid complexity with "concurrent" roles unless specified.
    // Actually, preventing double-counting overlaps is safer.

    // Let's us a set of "active months" to handle overlaps perfectly
    const activeMonths = new Set<string>();

    sorted.forEach(exp => {
        if (!exp.start_date) return;

        const start = new Date(exp.start_date);
        // Safe check for end_date
        let end = (exp.end_date && (exp.end_date.toLowerCase() === 'present' || exp.end_date.toLowerCase() === 'actualidad'))
            ? new Date()
            : (exp.end_date ? new Date(exp.end_date) : new Date()); // Default to now if missing/invalid

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

        let current = new Date(start);
        while (current <= end) {
            activeMonths.add(`${current.getFullYear()}-${current.getMonth()}`);
            current.setMonth(current.getMonth() + 1);
        }
    });

    return Math.floor(activeMonths.size / 12);
};

export const calculateDeterministicMatchScore = (breakdown: MatchResult['score_breakdown']): number => {
    return (
        (breakdown.skills || 0) * 0.40 +
        (breakdown.experience || 0) * 0.25 +
        (breakdown.domain || 0) * 0.20 +
        (breakdown.education_certifications || 0) * 0.10 +
        (breakdown.other || 0) * 0.05
    );
};
