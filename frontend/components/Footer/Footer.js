import React, { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import { getServerOrigin } from '../../functions/utils'

const Footer = (props) => {
  const [json, setJson] = useState([])

  useEffect(() => {
    getFooterJson()
  }, [])

  const getFooterJson = () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/Footer.json`
    fetch(url)
      .then(res => res.json())
      .then(json => setJson(json))
      .catch(err => { throw err })
  }
  let className = 'footer '

  return (
    <div id='footer' className={!props.svSession ? className += 'hide-footer' : className}>
      <div className='footer-list'>
        <div className='footer-list-title'>
          {json.map((element) => {
            if (element.href) {
              return <a key={element.id} id={element.id} href={element.href} target='_blank' rel='noopener noreferrer' className={`${element.className ? element.className : 'link-firm'}`}>
                {element.label}
              </a>
            } else {
              return <span key={element.id} id={element.id} className={`${element.className ? element.className : 'footer-item'}`}>
                {element.label}
              </span>
            }
          })}
        </div>
      </div>
    </div>
  )
}

const mapStateToProps = (state) => {
  return {
    svSession: state.security.svSession
  }
}

export default connect(mapStateToProps)(Footer);
