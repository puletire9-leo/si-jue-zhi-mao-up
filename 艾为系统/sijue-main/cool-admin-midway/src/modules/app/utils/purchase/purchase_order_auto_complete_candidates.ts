export interface AutoCompleteCandidateQueryOptions {
    limit?: number | string | null;
    all?: boolean;
    syncPlans?: boolean;
}

export function normalizeAutoCompleteCandidateOptions(options: AutoCompleteCandidateQueryOptions = {}) {
    const limitValue = Number(options.limit);
    const hasExplicitLimit = options.all !== true
        && options.limit !== undefined
        && options.limit !== null
        && options.limit !== ''
        && Number.isFinite(limitValue)
        && limitValue > 0;
    const limit = hasExplicitLimit ? Math.floor(limitValue) : null;

    return {
        limit,
        all: !limit,
        syncPlans: options.syncPlans === true,
    };
}

export function buildAutoCompleteCandidateQuery(options: AutoCompleteCandidateQueryOptions = {}) {
    const normalizedOptions = normalizeAutoCompleteCandidateOptions(options);
    const limit = normalizedOptions.limit;
    const sql = `
            SELECT DISTINCT plan_sn
            FROM (
                SELECT pp.plan_sn
                FROM app_amz_bsr_purchase_plan_lingxing pp
                WHERE pp.plan_sn IS NOT NULL
                  AND pp.plan_sn <> ''
                  AND pp.plan_remark LIKE '%【自动补全V1】%'
                UNION
                SELECT acs.plan_sn
                FROM app_amz_bsr_purchase_plan_remark_auto_complete_status acs
                WHERE acs.plan_sn IS NOT NULL
                  AND acs.plan_sn <> ''
            ) t
            ORDER BY plan_sn DESC
            ${limit ? 'LIMIT ?' : ''}
        `;

    return {
        sql,
        params: limit ? [limit] : [],
        ...normalizedOptions,
    };
}
