export function orgSearchSchema(intl) {
    return {
        schema: {
            type: "object",
            properties: {
                username: {
                    type: "string",
                    title: `${intl.formatMessage({ id: 'perun.admin_console.user', defaultMessage: 'perun.admin_console.user' })}`
                },
                pin: {
                    type: "string",
                    title: `${intl.formatMessage({ id: 'perun.adminConsole.pin', defaultMessage: 'perun.adminConsole.pin' })}`,
                },
            },
        },
        uiSchema: {}
    }
}