import Setting from '@/models/Setting';

export async function getGlobalStartDate(): Promise<Date | null> {
    try {
        const setting = await Setting.findOne({ key: 'filterDataFrom' }).lean();
        if (setting && setting.value) {
            return new Date(setting.value);
        }
        return null;
    } catch (error) {
        console.error("Error fetching global start date:", error);
        return null;
    }
}

export async function applyDateFilter(query: any, fieldName: string = 'createdAt') {
    const startDate = await getGlobalStartDate();
    if (startDate) {
        if (!query[fieldName]) {
            query[fieldName] = {};
        }
        
        // If there is already a $gte filter, keep the later one (stricter)
        if (query[fieldName].$gte) {
            const existingDate = new Date(query[fieldName].$gte);
            if (existingDate < startDate) {
                query[fieldName].$gte = startDate;
            }
            // else: existing date is later than global start, so keep existing (it falls within allowed range)
        } else {
            query[fieldName].$gte = startDate;
        }
    }
    return query;
}
