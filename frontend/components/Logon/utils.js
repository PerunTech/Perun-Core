import md5 from 'md5'
import isEmpty from 'lodash/isEmpty'
import isAscii from 'validator/es/lib/isAscii'
import isEmail from 'validator/es/lib/isEmail'
import isEmptyString from 'validator/es/lib/isEmpty'
import isInt from 'validator/es/lib/isInt'
import isLength from 'validator/es/lib/isLength'

// The five checks used below, each from its own module. The package's entry carries every
// validator it has, about 120 KB of the bundle for these five.
const validator = { isAscii, isEmail, isEmpty: isEmptyString, isInt, isLength }

function passwordStrengthTest(string) {
  if (!string.match(/\d/)) {
    return 'perun.login.password.digit_check'
  } else return null
}

/* form validator send: data and type of form, return error message */
function validateInput(data, type) {
  const errors = {}
  switch (type) {
    case 'LOGIN': {
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
    case 'REGISTER': {
      // password check
      if (validator.isEmpty(data.password)) {
        errors.password = 'perun.login.mandatory_login_empty'
      } else if (!validator.isAscii(data.password)) {
        errors.password = 'perun.login.mandatory_asci'
      } else if (!validator.isLength(data.password, {
        min: 8
      })) {
        errors.password = 'perun.login.mandatory_min_length'
      } else if (data.password !== data.repeatPassword) {
        errors.password = 'perun.login.mandatory_pass_check'
      }
      const passErr = passwordStrengthTest(data.password)
      if (passErr) {
        errors.password = passErr
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
      } else if (data.password !== data.repeatPassword) {
        errors.repeatPassword = 'perun.login.mandatory_pass_check'
      }
      const repPassErr = passwordStrengthTest(data.repeatPassword)
      if (repPassErr) {
        errors.repeatPassword = repPassErr
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
    case 'RECOVER_PASS': {
      if (validator.isEmpty(data.username)) {
        errors.username = 'perun.login.mandatory_login_empty'
      } else if (!validator.isAscii(data.username)) {
        errors.username = 'perun.login.mandatory_asci'
      }
      break
    }
    case 'CHANGE_PASS': {
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
      }
      const passErr = passwordStrengthTest(data.password)
      if (passErr) {
        errors.password = passErr
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
      }
      const repPassErr = passwordStrengthTest(data.repeatPassword)
      if (repPassErr) {
        errors.repeatPassword = repPassErr
      }
      if (data.password !== data.repeatPassword) {
        errors.repeatPassword = 'perun.login.mandatory_pass_check'
        errors.password = 'perun.login.mandatory_pass_check'
      }
      break
    }
    case 'CHANGE_EMAIL': {
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
    case 'ACTIVATION_LINK_FORM': {
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
        min: 7
      })) {
        errors.password = 'perun.login.mandatory_min_length'
      }
      const passErr = passwordStrengthTest(data.password)
      if (passErr) {
        errors.password = passErr
      }
      break
    }
  }
  return {
    errors,
    isValid: isEmpty(errors)
  }
}

export function isValid(state, component) {
  // validate user input
  const { errors, isValid } = validateInput(state, component)
  return { errors, isValid }
}

export function validateOnSubmit(e, state, component) {
  // validates input and does the server call
  e.preventDefault()
  const validatedData = isValid(state, component)
  if (validatedData.isValid) {
    return undefined
  } else {
    return validatedData.errors
  }
}

export function resetValidateOnChange(e, state) {
  // dynamically change component and field state, depending on user input
  const newKeyVal = {}
  const targetName = e.target.name
  const targetValue = e.target.value.trim()
  newKeyVal[targetName] = targetValue
  const errObj = state.errors
  delete errObj[targetName]
  return ({ newKeyVal: newKeyVal, errors: errObj })
}

export function createWebServiceFromStateParams(state, webService) {
  for (const item in state) {
    if (Object.prototype.hasOwnProperty.call(state, item) && state[item]) {
      if (webService.indexOf(`{${item}}`) > -1) {
        const checkItem = item.toLowerCase()
        if (checkItem === 'password' || checkItem === 'repeatpassword' || checkItem === 'repeat_password') {
          webService = webService.replace(`{${item}}`, md5(state[item]))
        } else webService = webService.replace(`{${item}}`, state[item])
      }
    }
  }
  return webService
}

export function createFormDataFromStateParams(state) {
  let formData = {}
  for (const item in state) {
    if (Object.prototype.hasOwnProperty.call(state, item)) {
      const checkItem = item.toLowerCase()
      if (checkItem === 'password' || checkItem === 'repeatpassword' || checkItem === 'repeat_password') {
        formData[item] = md5(state[item])
      } else if (item !== 'errors' && item !== 'alert') {
        formData[item] = state[item]
      }
    }
  }
  return formData
}

export function displayLoader(props, methodType) {
  if (!props.isBusy && props.configuration) {
    if (props.configuration.data && props.configuration.data[methodType]) {
      return true
    } else return false
  } else return false
}

export function getURLParameterByName(name, url) {
  if (!url) url = window.location.href
  name = name.replace(/[[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export function submitForm(path, method, params) {
  const form = document.createElement('form');
  form.method = method;
  form.action = path;
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.name = key;
      hiddenField.value = params[key];
      form.appendChild(hiddenField);
    }
  }
  document.body.appendChild(form);
  form.submit();
}