export function formatDashboardCurrency(
    value
) {

    if (
        !Number.isFinite(
            value
        )
    ) {

        return '—';

    }


    return new Intl.NumberFormat(
        'pt-PT',
        {
            style:
                'currency',

            currency:
                'EUR',

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2
        }
    ).format(
        value
    );
}
