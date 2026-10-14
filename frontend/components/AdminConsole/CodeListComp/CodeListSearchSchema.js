export default function getCodeListSearchSchema(intl) {
    const fmt = (id) => intl.formatMessage({ id, defaultMessage: id });
    return {
        schema: {
            title: fmt('perun.admin_console.code_list_search'),
            type: 'object',
            properties: {
                CODE_VALUE: {
                    type: 'string',
                    title: fmt('perun.admin_console.svarog_code_value'),
                },
            },
        },
        uiSchema: {},
    };
}
