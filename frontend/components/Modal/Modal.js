import React from 'react'
import { connect } from 'react-redux'

// modalSize: '40' to '90', the default.

class Modal extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      submitAction: '',
      showSubmitBtn: false,
      closeAction: '',
      showCloseBtn: false,
    }
  }

  componentDidMount = () => {
    if (this.props.submitAction) {
      this.setState({ submitAction: this.props.submitAction, showSubmitBtn: true })
    }
    if (this.props.closeAction) {
      this.setState({ closeAction: this.props.closeAction, showCloseBtn: true })
    }
    if (this.props.modalSize) {
      this.setState({ modalSize: this.props.modalSize })
    } else {
      this.setState({ modalSize: '90' })
    }
    if (this.props.onMouseEnterFunction) {
      this.setState({ onMouseEnterFunction: this.props.onMouseEnterFunction })
    }
    if (this.props.classBody) {
      this.setState({ classBodyState: this.props.classBody })
    } else {
      this.setState({ classBodyState: 'modal-body' })
    }
    if (this.props.customClassBtnModal) {
      this.setState({ customClassBtnModal: this.props.customClassBtnModal })
    } else {
      this.setState({ customClassBtnModal: 'modal-button button-closeModal' })
    }
    if (this.props.noFooter) {
      this.setState({ removeFooterHeight: 'no-modal-footer' })
    }
    if (this.props.noTopPadding) {
      this.setState({ removeTopPadding: 'no-modal-padding' })
    }
    document.addEventListener('keydown', this.closeModalByEscapeKey)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.closeModalByEscapeKey)
  }

  closeModalByEscapeKey = e => {
    // Esc
    if (e.keyCode === 27 && (!this.props.secondaryModalIsActive || this.props.forceCloseOnEsc)) {
      this.closeModal()
    }
  }

  closeModal = () => {
    this.props.closeModal()
  }

  render() {
    const { customHeaderContent } = this.props
    const { submitAction, showSubmitBtn, modalSize, onMouseEnterFunction, classBodyState, removeFooterHeight, removeTopPadding } = this.state
    return (
      <React.Fragment>
        <div className={`modal-bg ${removeTopPadding}`}>
          <div style={{ width: `${modalSize}%` }} className='modal-wrapper modalPopup'>
            <div className='modal-header'>
              <h3 className='modal-title'>{this.props.modalTitle}</h3>
              {customHeaderContent && <React.Fragment>{customHeaderContent}</React.Fragment>}
              <span className='close-modal-btn' onClick={this.closeModal}>&#215;</span>
            </div>
            <div className={classBodyState} onMouseEnter={onMouseEnterFunction ? onMouseEnterFunction : null}>{this.props.modalContent}</div>
            <div className={`modal-footer ${removeFooterHeight}`}>
              {showSubmitBtn && <button onClick={submitAction} className='modal-button button-submitModal'>{this.props.nameSubmitBtn}</button>}
            </div>
          </div>
        </div>
      </React.Fragment>
    )
  }
}

const mapStateToProps = state => ({
  secondaryModalIsActive: state.modal.secondaryModalIsActive
})

export default connect(mapStateToProps)(Modal)
