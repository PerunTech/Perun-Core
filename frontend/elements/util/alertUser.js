import Swal from 'sweetalert2'

// Built on sweetalert2, as alertUserV2 is, with the signature it had when it was built on
// sweetalert 1 (https://sweetalert.js.org). Its look is alertUserV2's; where the two libraries
// behave differently, what sweetalert 1 did is kept, so callers see the same buttons and callbacks.

/**
  A simple alerting function which renders an alert/prompt on the client side.
  Renders a React element in the DOM, which means that the function output
  DOES NOT HAVE TO BE RENDERED in the React Component. No problems arise if
  it is, however.
* MANDATORY PARAMETERS
* @param {boolean} show - renders an alert if true, removes existing alerts if false
* @param {string} type - displays an image depending on one of the following alert types: success, error, warning, info
* @param {string} title - main title/text of the alert body
*
* OPTIONAL PARAMETERS
* @param {string} text - message in the alert body - goes below the text with a smaller font
* @param {function} onConfirm - a function which is invoked when the user clicks on the alert confirmation button - if no function is passed as a parameter, the default function only closes the alert
* @param {function} onCancel - a function which is invoked when the user clicks on the alert cancel button
* @param {boolean} showCancelButton - renders the cancel button if true
* @param {string} confirmButtonText - replaces the default "OK" confirm button text with the one passed in this parameter
* @param {string} cancelButtonText - replaces the default "Cancel" cancel button text with the one passed in this parameter
* @param {boolean} showLoaderOnConfirm - display a loader in the confirm button if that button is clicked
* @param {string} confirmButtonColor - replaces the default confirm button color with the one passed as a parameter
* @param {boolean} disableOutsideClick - closes the alert when clicking outside of it if true
* @param {object} content - renders a custom component in the alert
* @param {boolean} buttonsFlag - when true hides all buttons in the alert
*/

export function alertUser(
  show, type, title, text, onConfirm, onCancel, showCancelButton,
  confirmButtonText, cancelButtonText, showLoaderOnConfirm, confirmButtonColor, disableOutsideClick, content, buttonsFlag
) {
  // sweetalert 1's dangerMode: a red confirm button, and the focus on cancel
  const danger = type === 'warning'
  show && Swal.fire({
    icon: type,
    title,
    text,
    // a DOM element; sweetalert 1 put it below the text, sweetalert2 shows it in the text's place
    html: content,
    showConfirmButton: !buttonsFlag,
    confirmButtonText: confirmButtonText || 'OK',
    confirmButtonColor: danger ? '#e64942' : '#7cd1f9',
    // sweetalert 1 left the cancel button out when it was asked for without a text
    showCancelButton: !buttonsFlag && Boolean(showCancelButton && cancelButtonText),
    cancelButtonText,
    focusCancel: danger,
    reverseButtons: true,
    allowOutsideClick: false,
    heightAuto: false
  }).then((value) => {
    if (value.isConfirmed && onConfirm instanceof Function) {
      onConfirm()
    // Only a dismissal the user made carries a reason. A dialog that another one replaces is
    // dismissed without one, and sweetalert 1 never answered for that dialog at all.
    } else if (value.dismiss && onCancel instanceof Function) {
      onCancel()
    }
  })
}
