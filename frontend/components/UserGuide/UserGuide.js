import React from 'react'
import { IntlContext } from 'react-intl'
import { createHashHistory } from 'history'
import axios from 'axios'
import { connect } from 'react-redux'
import { alertUserResponse, Icon } from '../../elements'
import Modal from '../Modal/Modal'
import { Link } from 'react-router-dom'

class UserGuide extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      documentsRender: null,
      showVideoModal: false,
      mediaTitle: '',
      mediaPath: ''
    }
    this.iterateDocs = this.iterateDocs.bind(this)
    this.generateRoutes = this.generateRoutes.bind(this)
    this.openGuide = this.openGuide.bind(this)
    this.showOrHideVideoModal = this.showOrHideVideoModal.bind(this)
    this.simpleAxios = this.simpleAxios.bind(this)
    this.hashHistory = createHashHistory()
  }

  componentDidMount() {
    this.simpleAxios('routes')
    const identificationScreen = document.getElementById('identificationScreen')
    if (identificationScreen) {
      identificationScreen.innerText = this.context.formatMessage({
        id: 'perun.main.user_guide', defaultMessage: 'perun.main.user_guide'
      })
    }
    document.addEventListener('keydown', this.closeByEscapeKey)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.closeByEscapeKey)
  }

  /* simple axios to get all routes and get guides */
  simpleAxios(axiosFor) {
    let url
    if (axiosFor) {
      if (axiosFor === 'routes') {
        this.generateRoutes(this.props.moduleLinks?.data?.data || [])
      } else {
        url = window.server + '/PublicWs/getGuides/' + this.props.svSession + '/UserGuideJson'
        axios.get(url).then((response) => {
          if (response?.data) {
            const resType = response.data?.type?.toLowerCase() || 'info'
            if (resType !== 'success') {
              alertUserResponse({ response: response.data })
            } else {
              if (response.data?.data) {
                this.iterateDocs(response.data.data)
              }
            }
          }
        }).catch((err) => {
          console.error(err)
          alertUserResponse({ response: err })
        })
      }
    }
  }

  generateRoutes(routes) {
    let arr = []
    for (let j = 0; j < routes.length; j++) {
      arr.push(routes[j].id)
    }
    this.setState({ route: arr })
    this.simpleAxios('userGuide')
  }

  /* iterate json and create documents html*/
  iterateDocs(json) {
    let docHTML
    let elArr = []
    let matchingResultArr = []

    /* check if the array of objects(current user guide JSON with correct routes) matches values from the array(all registred routes) */
    json.listDocs.map(x => {
      let trueResult = this.state.route.includes(x.moduleName)
      if (trueResult === true) {
        let matchingResult = x
        matchingResultArr.push(matchingResult)
      } else {
        if (x.moduleName === 'general') {
          // add user guide that is labeled as a general not any module
          let matchingResult = x
          matchingResultArr.push(matchingResult)
        }
      }
    })

    let typePdfArr = []
    let typeVideoArr = []
    let typeUrlArr = []

    /* check for the type in the object and push the result in empty array */
    for (let i = 0; i < matchingResultArr.length; i++) {
      if (matchingResultArr[i].type === 'pdf') {
        typePdfArr.push(matchingResultArr[i])
      }
      if (matchingResultArr[i].type === 'video') {
        typeVideoArr.push(matchingResultArr[i])
      }
      if (matchingResultArr[i].type === 'url') {
        typeUrlArr.push(matchingResultArr[i])
      }
    }

    /* create tmp array from the upper result of independent arrays */
    let typeArrs = [typePdfArr, typeVideoArr, typeUrlArr]

    /* iterate every array from the upper results and sort the objects by priority each arr independently */
    for (let i = 0; i < typeArrs.length; i++) {
      typeArrs[i].sort((a, b) => {
        if (a.priority && b.priority) {
          if (a.priority < b.priority) {
            return -1;
          }
          if (a.priority > b.priority) {
            return 1;
          }
          return 0;
        } else {
          console.warn('no priority key found in object')
        }
      })
    }

    /* create final array and merge all the sorted arrays by type and priority */
    let mergedFinalArray = [...typePdfArr, ...typeVideoArr, ...typeUrlArr]

    if (mergedFinalArray) {
      for (let i in mergedFinalArray) {
        for (let j in mergedFinalArray[i].userGuide) {
          let el = mergedFinalArray[i].userGuide[j]
          docHTML = <div key={el.id} id={el.id} className='user-guide-flex'>
            <div className='user-guide-title'>
              {el.exactLink &&
                <a href={`${el.exactLink}`} target='_blank' rel='noopener noreferrer' title={el.exactLink} className='user-guide-link-title user-guide-flex-align-items user-guide-document'>
                  <div className='user-guide-icon'>{<Icon name='IconLinkPlus' />}</div>
                  {el.title}
                </a>
              }
              {el.media &&
                <div className='user-guide-flex-align-items user-guide-document' onClick={() => this.showOrHideVideoModal(el.title, el.media)}>
                  <div className='user-guide-icon'>{<Icon name='IconVideo' />}</div>
                  {el.title}
                </div>
              }
              {el.pdfTab &&
                <div className='user-guide-flex-align-items user-guide-document' onClick={() => this.openGuide(el.pdfTab, el.title)}>
                  <div className='user-guide-icon'>{<Icon name='IconFileTypePdf' />}</div>
                  {el.title}
                </div>
              }
            </div>
          </div>
          elArr.push(docHTML)
        }
      }
    }
    this.setState({ documentsRender: elArr })
  }

  openGuide(url, docName) {
    if (url && docName) {
      window.open(url, docName)
    }
  }

  showOrHideVideoModal(mediaTitle, mediaPath) {
    this.setState({ showVideoModal: !this.state.showVideoModal, mediaTitle, mediaPath })
  }

  closeByEscapeKey = e => {
    if (e.keyCode === 27) {
      this.isCloseUserGuide();
    }
  }

  isCloseUserGuide = () => {
    const { history } = this.props
    // If the history size is larger than 2, it means the user has already been navigating through the app
    if (history.length > 2) {
      history.goBack()
    } else {
      history.push('/main')
    }
  }

  render() {
    const { documentsRender, showVideoModal, mediaTitle, mediaPath } = this.state
    let admConsoleVideo
    if (mediaPath) {
      admConsoleVideo = <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video controls height='600'>
          <source src={mediaPath} />
        </video>
      </div>
    }
    return (
      <React.Fragment>
        <div className='user-guide-data-holder'>
          <div className='user-guide-title-holder'>
            <p style={{ margin: '1vh' }}>
              {this.context.formatMessage({ id: 'perun.main.user_guide', defaultMessage: 'perun.main.user_guide' })}
            </p>
            <Link onClick={() => this.isCloseUserGuide()} id='main-screen' className='user-guide-close-user-guide'>{<Icon name='IconX' />}</Link>
          </div>
          <div className='user-guide-full-width-container'>
            {showVideoModal && mediaTitle && mediaPath &&
              <Modal
                modalTitle={mediaTitle}
                closeModal={() => this.showOrHideVideoModal('', '')}
                modalContent={admConsoleVideo}
              />
            }
            {documentsRender}
          </div>
        </div>
      </React.Fragment>
    )
  }
}

UserGuide.contextType = IntlContext

const mapStateToProps = state => ({
  svSession: state.security.svSession,
  moduleLinks: state.moduleLinks.data
})

export default connect(mapStateToProps)(UserGuide)
