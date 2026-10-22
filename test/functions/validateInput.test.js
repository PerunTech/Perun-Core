import { describe, expect, it } from 'vitest'
import validateInput from '../../frontend/functions/validateInput'

const EMPTY = 'perun.login.mandatory_login_empty'
const ASCII = 'perun.login.mandatory_asci'
const MIN_LENGTH = 'perun.login.mandatory_min_length'
const DIGIT = 'perun.login.password.digit_check'
const MISMATCH = 'perun.login.mandatory_pass_check'
const EMAIL = 'perun.login.mandatory_email_check'
const PIN = 'perun.login.mandatory_pin_check'

const registration = {
  username: 'ana',
  password: 'secret123',
  repeatPassword: 'secret123',
  eMail: 'ana@example.com',
  idNo: '1234567890123'
}

describe('validateInput', () => {
  describe('LOGIN', () => {
    it('accepts a username and password', () => {
      expect(validateInput({ username: 'ana', password: 'x' }, 'LOGIN')).toEqual({ errors: {}, isValid: true })
    })

    it('asks for both, in ASCII', () => {
      expect(validateInput({ username: '', password: '' }, 'LOGIN').errors).toEqual({ username: EMPTY, password: EMPTY })
      expect(validateInput({ username: 'ана', password: 'лозинка' }, 'LOGIN').errors).toEqual({ username: ASCII, password: ASCII })
    })
  })

  describe('REGISTER', () => {
    it('accepts a complete registration', () => {
      expect(validateInput(registration, 'REGISTER')).toEqual({ errors: {}, isValid: true })
    })

    it('wants a password of eight characters with a digit, typed twice the same', () => {
      const short = { ...registration, password: 'abc1', repeatPassword: 'abc1' }
      expect(validateInput(short, 'REGISTER').errors).toEqual({ password: MIN_LENGTH, repeatPassword: MIN_LENGTH })

      const noDigit = { ...registration, password: 'secretpass', repeatPassword: 'secretpass' }
      expect(validateInput(noDigit, 'REGISTER').errors).toEqual({ password: DIGIT, repeatPassword: DIGIT })

      const mismatch = { ...registration, repeatPassword: 'secret124' }
      expect(validateInput(mismatch, 'REGISTER').errors).toEqual({ password: MISMATCH, repeatPassword: MISMATCH })
    })

    it('checks the e-mail address and a thirteen-digit PIN', () => {
      expect(validateInput({ ...registration, eMail: 'ana@' }, 'REGISTER').errors).toEqual({ eMail: EMAIL })
      expect(validateInput({ ...registration, idNo: '12345678901ab' }, 'REGISTER').errors).toEqual({ idNo: PIN })
      expect(validateInput({ ...registration, idNo: '123456789012' }, 'REGISTER').errors).toEqual({ idNo: PIN })
    })
  })

  describe('CHANGE_PASS', () => {
    it('marks both passwords when they differ', () => {
      const data = { username: 'ana', idNo: '1234567890123', password: 'secret123', repeatPassword: 'secret124' }
      expect(validateInput(data, 'CHANGE_PASS').errors).toEqual({ password: MISMATCH, repeatPassword: MISMATCH })
    })
  })

  describe('CHANGE_EMAIL and ACTIVATION_LINK_FORM', () => {
    it('take a PIN of seven to thirteen digits', () => {
      const change = { username: 'ana', eMail: 'ana@example.com' }
      expect(validateInput({ ...change, idNo: '1234567' }, 'CHANGE_EMAIL').isValid).toBe(true)
      expect(validateInput({ ...change, idNo: '123456' }, 'CHANGE_EMAIL').errors).toEqual({ idNo: PIN })

      const activation = { username: 'ana', password: 'secret123' }
      expect(validateInput({ ...activation, idNo: '1234567890123' }, 'ACTIVATION_LINK_FORM').isValid).toBe(true)
      expect(validateInput({ ...activation, idNo: '12345678901234' }, 'ACTIVATION_LINK_FORM').errors).toEqual({ idNo: PIN })
    })
  })

  it('passes a form it does not know', () => {
    expect(validateInput({}, 'SOMETHING_ELSE')).toEqual({ errors: {}, isValid: true })
  })
})
