export function getNotificationsFormSchema(intl) {
  return {
    schema: {
      type: 'object',
      properties: {
        section_one: {
          type: 'object',
          title: `${intl.formatMessage({ id: 'perun.admin_console.type_and_title', defaultMessage: 'perun.admin_console.type_and_title' })}`,
          properties: {
            TITLE: {
              type: 'string',
              title: `${intl.formatMessage({ id: 'perun.admin_console.title', defaultMessage: 'perun.admin_console.title' })}`,
              maxLength: 250
            },
            TYPE: {
              type: 'string',
              title: `${intl.formatMessage({ id: 'perun.admin_console.message_type', defaultMessage: 'perun.admin_console.message_type' })}`,
              enum: ['PUBLIC', 'INTERNAL'],
              enumNames: [
                `${intl.formatMessage({
                  id: 'perun.admin_console.message_type_external', defaultMessage: 'perun.admin_console.message_type_external'
                })}`,
                `${intl.formatMessage({
                  id: 'perun.admin_console.message_type_internal', defaultMessage: 'perun.admin_console.message_type_internal'
                })}`
              ],
            },
          },
          required: ['TYPE', 'TITLE']
        },
        section_two: {
          type: 'object',
          title: `${intl.formatMessage({ id: 'perun.admin_console.message', defaultMessage: 'perun.admin_console.message' })}`,
          properties: {
            MESSAGE: {
              type: 'string',
              title: `${intl.formatMessage({ id: 'perun.admin_console.message', defaultMessage: 'perun.admin_console.message' })}`,
              maxLength: 2000
            },
          },
          required: ['MESSAGE']
        }
      },
    },
    uiSchema: {
      'section_one': {},
      'section_two': {
        MESSAGE: { 'ui:widget': 'textarea' },
      }
    }
  }
}
