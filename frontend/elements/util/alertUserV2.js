import Swal from 'sweetalert2'
import { isJSON } from '../../functions/utils'
import { wasReported } from '../../functions/reportedErrors'

export const alertUserV2 = (params) => {
  const {
    type, title, message, allowOutsideClick, allowEscapeKey, html,
    showConfirm, onConfirm, confirmButtonColor, confirmButtonText,
    showCancel, onCancel, cancelButtonColor, cancelButtonText,
    showDeny, onDeny, denyButtonColor, denyButtonText, reverseButtons,
    timer, timerProgressBar, toast, backdrop, animation, theme, position, target
  } = params

  Swal.fire({
    icon: type,
    title,
    text: message,
    allowOutsideClick: allowOutsideClick ?? false,
    allowEscapeKey: allowEscapeKey ?? true,
    html,
    showConfirmButton: showConfirm ?? true,
    confirmButtonText: confirmButtonText || 'OK',
    confirmButtonColor: confirmButtonColor || '#7cd1f9',
    showCancelButton: showCancel,
    cancelButtonText,
    cancelButtonColor,
    showDenyButton: showDeny,
    denyButtonText,
    denyButtonColor,
    heightAuto: false,
    reverseButtons: reverseButtons ?? true,
    timer: timer ?? false,
    timerProgressBar: timerProgressBar ?? false,
    toast: toast ?? false,
    backdrop: backdrop ?? true,
    animation: animation ?? true,
    theme: theme || 'light',
    position: position || 'center',
    target: target || 'body'
  }).then(value => {
    if (value.isConfirmed && onConfirm instanceof Function) {
      onConfirm()
    } else if (value.isDismissed && onCancel instanceof Function) {
      onCancel()
    } else if (value.isDenied && onDeny instanceof Function) {
      onDeny()
    }
  }).catch(err => {
    console.error(err)
  })
}

export const alertUserResponse = (params) => {
  const { response, type, onConfirm, confirmButtonColor } = params
  if (wasReported(response)) return
  const finalResponse = response?.response?.data || response?.data || response
  const responseContentType = response?.response?.headers?.['content-type'] || response?.headers?.['content-type'] || ''
  const status = response?.status || 500
  let alertType = type || response?.response?.data?.type?.toLowerCase() || response?.data?.type?.toLowerCase() || response?.type?.toLowerCase() || ''
  if (!alertType && status > 200) {
    alertType = 'error'
  }
  let title = response?.response?.data?.title || response?.data?.title || response?.title || response
  // Check if the title is JSON, for cases when the response doesn't contain the `title` key
  if (isJSON(title)) {
    title = ''
  }
  let message = response?.response?.data?.message || response?.data?.message || response?.message || ''
  // Check if the response Content-Type header includes text/html
  // The additional check whether the response is JSON is needed since some services return JSON with the Content-Type set to text/html
  const responseIsHtml = responseContentType.includes('text/html') && !isJSON(finalResponse)
  if (responseIsHtml) {
    title = ''
    message = ''
  }
  let renderMessageAsHtml = false
  // Check if the message contains a new line character (\n)
  if (message?.includes('\n')) {
    // Render it as HTML if it does, by replacing the new line with a <br /> element
    renderMessageAsHtml = true
    message = message.replace(/\n/g, '<br>')
  }
  Swal.fire({
    icon: alertType,
    title,
    text: message,
    html: renderMessageAsHtml ? message : responseIsHtml && finalResponse,
    allowOutsideClick: false,
    heightAuto: false,
    confirmButtonColor: confirmButtonColor || '#7cd1f9'
  }).then(value => {
    if (value.isConfirmed && onConfirm instanceof Function) {
      onConfirm()
    }
  })
}
