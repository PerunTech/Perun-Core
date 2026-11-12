import Swal from 'sweetalert2'

// sweetalert 1's signature and behaviour (buttons, callbacks) on sweetalert2, in alertUserV2's look.

// buttonsFlag hides every button; content is a DOM element, shown in the text's place.

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
