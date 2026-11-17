import React, { useState, useEffect } from 'react'
import { useIntl } from 'react-intl'
import { connect } from 'react-redux'
import HelpContext from '../../elements/fieldHelp/HelpContext'
import { getServerOrigin } from '../../functions/utils'
import ACSideMenu from './ACSideMenu'
import UserManagement from '../User Management/UserManagement'
import OrganizationalUnit from './OrgUnit/OrganizationalUnit'
import NotificationsComponent from './NotificationsComponent'
import DirectAccess from './DirectAccess'
import SystemConfLogs from './SystemConfLogs'
import SvarogSystemParams from './SvarogSystemParams'
import GeoLayerTypes from './GeoLayerTypes'
import PerunPluginTable from './PerunPluginTable'
import SvarogMenu from './SvarogMenu'
import PerunMenu from './PerunMenu/PerunMenu'
import BusinessType from './BusinessType'
import CodeListEditor from './CodeListComp/CodeListEditor'
import LabelEditor from './LabelEditorComp/LabelEditor'
import WorkFlowAutomaton from './Workflow/WorkFlowAutomaton'
import SvarogTables from './SvarogTables/SvarogTables'
import ConfigTables from './SvarogTables/ConfigTables'
import UserGuidesAdmin from './Help/UserGuidesAdmin'
import { adminConsolePath } from './adminConsolePath'

const SECTIONS = {
    UserManagement, GeoLayerTypes, SvarogSystemParams, NotificationsComponent, DirectAccess, SystemConfLogs,
    OrganizationalUnit, PerunPluginTable, SvarogMenu, PerunMenu, BusinessType, CodeListEditor, LabelEditor,
    WorkFlowAutomaton, SvarogTables, ConfigTables, UserGuidesAdmin
}
const DEFAULT_SECTION = 'UserManagement'

const AdminConsole = ({ match, history }) => {
    const intl = useIntl()
    const [json, setJson] = useState([])
    const params = match?.params || {}
    const section = Object.prototype.hasOwnProperty.call(SECTIONS, params.section ?? '') ? params.section : DEFAULT_SECTION
    const Section = SECTIONS[section]
    useEffect(() => {
        getMenu()
        transformIdScreen()
    }, [])
    const transformIdScreen = () => {
        const idScreen = document.getElementById('identificationScreen')
        if (idScreen) {
            idScreen.innerText = intl.formatMessage({
                id: 'perun.plugin.system_settings', defaultMessage: 'perun.plugin.system_settings'
            })
        }
    }
    const getMenu = () => {
        const url = `${getServerOrigin()}${window.assets}/json/config/AppSettings.json`
        fetch(url).then(res => res.json()).then(json => {
            if (json?.length > 0) {
                setJson(json)
            }
        }).catch(err => { throw err });
    }
    const sectionId = json.find(item => item.component === section)?.id
    const sectionProps = section === 'UserManagement'
        ? { id: params.id, tab: params.tab, navigate: (...parts) => history.push(adminConsolePath(section, ...parts)) }
        : {}

    return (
        <div className="admin-console-main-container">
            {json && <ACSideMenu
                json={json}
                active={section}
                onSelect={(component) => history.push(adminConsolePath(component))}
            />}
            <HelpContext.Provider value={{ sectionId }}>
                <div className="admin-console-content">
                    <Section {...sectionProps} />
                </div>
            </HelpContext.Provider>
        </div>
    )
}

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

export default connect(mapStateToProps)(AdminConsole);
