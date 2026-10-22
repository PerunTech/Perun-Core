import isEmpty from 'lodash/isEmpty'
import isAscii from 'validator/es/lib/isAscii'
import isEmail from 'validator/es/lib/isEmail'
import isEmptyString from 'validator/es/lib/isEmpty'
import isInt from 'validator/es/lib/isInt'
import isLength from 'validator/es/lib/isLength'

// The five checks used below, each from its own module. The package's entry carries every
// validator it has, about 120 KB of the bundle for these five.
const validator = { isAscii, isEmail, isEmpty: isEmptyString, isInt, isLength }

const hasDigit = (string) => /\d/.test(string)

/* form validator send: data and type of form, return error message */
export default function validateInput(data, type) {
  const errors = {}
  switch (type) {
    case 'LOGIN':
      {
        if (validator.isEmpty(data.username)) {
          // use id key label from database
          errors.username = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.username)) {
          // use id key label from database
          errors.username = 'perun.login.mandatory_asci'
        }
        if (validator.isEmpty(data.password)) {
          errors.password = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.password)) {
          errors.password = 'perun.login.mandatory_asci'
        }
        break
      }
    case 'REGISTER':
      {
        // password check
        if (validator.isEmpty(data.password)) {
          errors.password = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.password)) {
          errors.password = 'perun.login.mandatory_asci'
        } else if (!validator.isLength(data.password, {
          min: 8
        })) {
          errors.password = 'perun.login.mandatory_min_length'
        } else if (!hasDigit(data.password)) {
          errors.password = 'perun.login.password.digit_check'
        } else if (data.password !== data.repeatPassword) {
          errors.password = 'perun.login.mandatory_pass_check'
        }
        // password check
        if (validator.isEmpty(data.repeatPassword)) {
          errors.repeatPassword = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.repeatPassword)) {
          errors.repeatPassword = 'perun.login.mandatory_asci'
        } else if (!validator.isLength(data.repeatPassword, {
          min: 8
        })) {
          errors.repeatPassword = 'perun.login.mandatory_min_length'
        } else if (!hasDigit(data.repeatPassword)) {
          errors.repeatPassword = 'perun.login.password.digit_check'
        } else if (data.password !== data.repeatPassword) {
          errors.repeatPassword = 'perun.login.mandatory_pass_check'
        }
        // username check
        if (validator.isEmpty(data.username)) {
          errors.username = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.username)) {
          errors.username = 'perun.login.mandatory_asci'
        }
        // eMail check
        if (validator.isEmpty(data.eMail)) {
          errors.eMail = 'perun.login.mandatory_login_empty'
        } else if (!validator.isEmail(data.eMail)) {
          errors.eMail = 'perun.login.mandatory_email_check'
        } else if (!validator.isAscii(data.eMail)) {
          errors.eMail = 'perun.login.mandatory_asci'
        }
        // idNo check
        if (validator.isEmpty(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_asci'
        } else if (!validator.isInt(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        } else if (!validator.isLength(data.idNo, { min: 13, max: 13 })) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        }
        break
      }
    case 'RECOVER_PASS':
      {
        if (validator.isEmpty(data.username)) {
          errors.username = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.username)) {
          errors.username = 'perun.login.mandatory_asci'
        }
        break
      }
    case 'CHANGE_PASS':
      {
        if (validator.isEmpty(data.username)) {
          errors.username = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.username)) {
          errors.username = 'perun.login.mandatory_asci'
        }
        // idNo check
        if (validator.isEmpty(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_asci'
        } else if (!validator.isInt(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        } else if (!validator.isLength(data.idNo, { min: 13, max: 13 })) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        }
        // PASSWORD check
        if (validator.isEmpty(data.password)) {
          errors.password = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.password)) {
          errors.password = 'perun.login.mandatory_asci'
        } else if (!validator.isLength(data.password, {
          min: 8
        })) {
          errors.password = 'perun.login.mandatory_min_length'
        } else if (!hasDigit(data.password)) {
          errors.password = 'perun.login.password.digit_check'
        }
        // PASSWORD check
        if (validator.isEmpty(data.repeatPassword)) {
          errors.repeatPassword = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.repeatPassword)) {
          errors.repeatPassword = 'perun.login.mandatory_asci'
        } else if (!validator.isLength(data.repeatPassword, {
          min: 8
        })) {
          errors.repeatPassword = 'perun.login.mandatory_min_length'
        } else if (!hasDigit(data.repeatPassword)) {
          errors.repeatPassword = 'perun.login.password.digit_check'
        }
        if (data.password !== data.repeatPassword) {
          errors.repeatPassword = 'perun.login.mandatory_pass_check'
          errors.password = 'perun.login.mandatory_pass_check'
        }
        break
      }
    case 'CHANGE_EMAIL':
      {
        // username check
        if (validator.isEmpty(data.username)) {
          errors.username = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.username)) {
          errors.username = 'perun.login.mandatory_asci'
        }
        // eMail check
        if (validator.isEmpty(data.eMail)) {
          errors.eMail = 'perun.login.mandatory_login_empty'
        } else if (!validator.isEmail(data.eMail)) {
          errors.eMail = 'perun.login.mandatory_email_check'
        } else if (!validator.isAscii(data.eMail)) {
          errors.eMail = 'perun.login.mandatory_asci'
        }
        // idNo check
        if (validator.isEmpty(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_asci'
        } else if (!validator.isInt(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        } else if (!validator.isLength(data.idNo, { min: 7, max: 13 })) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        }
        break
      }
    case 'ACTIVATION_LINK_FORM':
      {
        // username check
        if (validator.isEmpty(data.username)) {
          errors.username = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.username)) {
          errors.username = 'perun.login.mandatory_asci'
        }
        // idNo check
        if (validator.isEmpty(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_asci'
        } else if (!validator.isInt(data.idNo)) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        } else if (!validator.isLength(data.idNo, { min: 7, max: 13 })) {
          errors.idNo = 'perun.login.mandatory_pin_check'
        }
        // PASSWORD check
        if (validator.isEmpty(data.password)) {
          errors.password = 'perun.login.mandatory_login_empty'
        } else if (!validator.isAscii(data.password)) {
          errors.password = 'perun.login.mandatory_asci'
        } else if (!validator.isLength(data.password, {
          min: 8
        })) {
          errors.password = 'perun.login.mandatory_min_length'
        } else if (!hasDigit(data.password)) {
          errors.password = 'perun.login.password.digit_check'
        }
        break
      }
  }
  return {
    errors,
    isValid: isEmpty(errors)
  }
}
