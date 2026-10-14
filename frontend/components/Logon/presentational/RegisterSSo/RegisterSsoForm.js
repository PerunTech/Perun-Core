export default function getRegisterSsoForm(intl, data) {
    return {
        schema:
        {
            "title": `${intl.formatMessage({ id: 'perun.login.register', defaultMessage: 'perun.login.register' })}`,
            "type": "object",
            "properties": {
                "USER_NAME": {
                    "type": "string",
                    "title": `${intl.formatMessage({ id: 'perun.login.user_name', defaultMessage: 'perun.login.user_name' })}`,
                    "maxLength": 100
                },
                "FIRST_NAME": {
                    "type": "string",
                    "title": `${intl.formatMessage({ id: 'perun.form_labels.first_name', defaultMessage: 'perun.form_labels.first_name' })}`,
                    "maxLength": 200
                },
                "LAST_NAME": {
                    "type": "string",
                    "title": `${intl.formatMessage({ id: 'perun.form_labels.last_name', defaultMessage: 'perun.form_labels.last_name' })}`,
                    "maxLength": 200
                },
                "E_MAIL": {
                    "type": "string",
                    "title": `${intl.formatMessage({ id: 'perun.grid_labels.svarog_users.e_mail', defaultMessage: 'perun.grid_labels.svarog_users.e_mail' })}`,
                    "maxLength": 200
                },
                "PIN": {
                    "type": "string",
                    "title": `${intl.formatMessage({ id: 'perun.form_labels.pin', defaultMessage: 'perun.form_labels.pin' })}`,
                    "maxLength": 50
                },
                "TAX_ID": {
                    "type": "string",
                    "title": `${intl.formatMessage({ id: 'perun.grid_labels.svarog_users.tax_id', defaultMessage: 'perun.grid_labels.svarog_users.tax_id' })}`,
                    "maxLength": 50
                },
                "USER_TYPE": {
                    "type": "string",
                    "title": "User type",
                    "maxLength": 50
                },
                "ID": {
                    "type": "string",
                    "title": "ID",
                    "maxLength": 200
                }
            },
            "dependencies": {},
            "required": [
                "USER_NAME",
                "FIRST_NAME",
                "LAST_NAME",
                "E_MAIL",
                "PIN",
                "USER_TYPE"
            ]
        },
        uiSchema: {
            "USER_TYPE": {
                "ui:widget": "hidden"
            },
            "ID": {
                "ui:widget": "hidden"
            },
            "USER_NAME": {
                "ui:readonly": true
            },
            "PIN": {
                "ui:readonly": true
            }
        },
        formData: {
            "USER_TYPE": "External",
            "PIN": data['USER_NAME'],
            "USER_NAME": data['USER_NAME'],
            "FIRST_NAME": data['FIRST_NAME'] || undefined,
            "LAST_NAME": data['LAST_NAME'] || undefined,
            "TAX_ID": data['TAX_ID'] || undefined,
            "E_MAIL": data['E_MAIL'] || undefined,
            "ID": data['ID'] || undefined,
        }
    }
}
