import React, { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router-dom'
import { MainMenu } from '../ComponentsIndex'
import { changeLanguageAndLocale } from '../../client'
import * as cookies from '../../functions/cookies'
import PropTypes from 'prop-types';
import { store } from '../../model'
import { isValidObject, getServerOrigin } from '../../functions/utils'
import axios from 'axios'

const HomeMenu = (props, context) => {
  const [menuItems, setMenuItems] = useState([]);
  const [activeLanguage, setActiveLanguage] = useState('');

  // if (!props.svSession) is the new flag used to determine if the component should behave like <Internal,<External. This was the old way of rendering changed after 01.09.2024
  useEffect(() => {
    if (!props.svSession) {
      fetchHeaderJson();
      setActiveLanguage(cookies.getCookie('defaultLocale'));
      ssoAltLogin();
    }
  }, [props.svSession]);

  const fetchHeaderJson = async () => {
    const url = `${getServerOrigin()}${window.assets}/json/config/Header.json`;
    try {
      const response = await fetch(url);
      const json = await response.json();
      setMenuItems(json);
    } catch (error) {
      console.error('Error fetching header JSON:', error);
    }
  };

  const handleLanguageChange = (locale, language) => {
    changeLanguageAndLocale(locale, language);
    setActiveLanguage(language);
  };

  const ssoAltLogin = async () => {
    if (window.sessionToken) {
      try {
        const response = await axios.get(`${window.server}/SvSecurity/configuration/getConfiguration/undefined/LOGIN`);
        const configData = response.data.data.sso_config;

        if (configData && isValidObject(configData, 1)) {
          const data = {
            type: 'SUCCESS',
            title: 'login.success',
            message: 'login.success',
            data: {
              token: window.sessionToken,
            },
            saml: true,
          };
          store.dispatch({ type: 'LOGIN_FULFILLED_SAML', payload: data });

          const currentURL = window.location.href;
          const newURL = currentURL.replace(/(\?session=[^#]*)/, '');
          window.history.replaceState({}, document.title, newURL);

          window.sessionToken = undefined;
        }
      } catch (error) {
        console.error('Error during SSO login:', error);
      }
    }
  };

  const renderMenuItems = () => {
    return menuItems.map((element) => {
      if (element.route) {
        return (
          <li key={element.id} className='nav-item'>
            <Link
              to={element.route}
              id={element.id}
              className={`nav-link ${element.className || 'link-default'}`}
            >
              {context.intl.formatMessage({ id: `perun.login.${element.label}`, defaultMessage: `perun.login.${element.label}` })}
            </Link>
          </li>
        );
      } else if (element.img) {
        return (
          <li key={element.id} className='nav-item'>
            <img
              id={element.id}
              src={element.img}
              alt={element.label}
              className={element.className || 'header-img'}
            />
          </li>
        );
      } else if (element.language) {
        return (
          <li key={element.id} className='nav-item'>
            <p
              onClick={() => handleLanguageChange(element.locale, element.language)}
              className={`${element.className || 'header-item'} ${activeLanguage === element.language ? 'active-language' : ''}`}
            >
              {element.label}
            </p>
          </li>
        );
      } else {
        return (
          <li key={element.id} className='nav-item'>
            <span id={element.id} className={element.className || 'header-item'}>
              {element.label}
            </span>
          </li>
        );
      }
    });
  };

  let className
  if (!props.svSession) className = 'hide-navbar';

  return (
    <React.Fragment>
      {!props.svSession && <div id='header' className='header fadeIn'></div>}
      <div id='navbar' className={className}>
        {!props.svSession ? <ul className='nav'>{renderMenuItems()}</ul> : <MainMenu />}
      </div>
    </React.Fragment>
  );
};

HomeMenu.propTypes = {
  svSession: PropTypes.string,
};

HomeMenu.contextTypes = {
  intl: PropTypes.object.isRequired
}

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(HomeMenu);
