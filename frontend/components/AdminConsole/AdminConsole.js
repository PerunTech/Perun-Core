import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import HelpContext from '../../elements/fieldHelp/HelpContext'
import { getServerOrigin } from '../../functions/utils'
import ACSideMenu from './ACSideMenu'
// COMPONENTS
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

const AdminConsole = (_props, context) => {
    const [dynamicComponent, setDynamicComponent] = useState('UserManagement')
    const [json, setJson] = useState([])
    const setDynamicComponentFunction = (comp) => {
        setDynamicComponent(comp)
    }
    useEffect(() => {
        getMenu()
        transformIdScreen()
    }, [])
    const transformIdScreen = () => {
        const idScreen = document.getElementById('identificationScreen')
        if (idScreen) {
            idScreen.innerText = context.intl.formatMessage({
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
    const sectionId = json.find(item => item.component === dynamicComponent)?.id

    return (
        <div className="admin-console-main-container">
            {json && <ACSideMenu
                json={json}
                setDynamicComponentFunction={setDynamicComponentFunction}
            />}
            <HelpContext.Provider value={{ sectionId }}>
                <div className="admin-console-content">
                    {dynamicComponent === 'UserManagement' && <UserManagement />}
                    {dynamicComponent === 'GeoLayerTypes' && <GeoLayerTypes />}
                    {dynamicComponent === 'SvarogSystemParams' && <SvarogSystemParams />}
                    {dynamicComponent === 'NotificationsComponent' && <NotificationsComponent />}
                    {dynamicComponent === 'DirectAccess' && <DirectAccess />}
                    {dynamicComponent === 'SystemConfLogs' && <SystemConfLogs />}
                    {dynamicComponent === 'OrganizationalUnit' && <OrganizationalUnit />}
                    {dynamicComponent === 'PerunPluginTable' && <PerunPluginTable />}
                    {dynamicComponent === 'SvarogMenu' && <SvarogMenu />}
                    {dynamicComponent === 'PerunMenu' && <PerunMenu />}
                    {dynamicComponent === 'BusinessType' && <BusinessType />}
                    {dynamicComponent === 'CodeListEditor' && <CodeListEditor />}
                    {dynamicComponent === 'LabelEditor' && <LabelEditor />}
                    {dynamicComponent === 'WorkFlowAutomaton' && <WorkFlowAutomaton />}
                    {dynamicComponent === 'SvarogTables' && <SvarogTables />}
                    {dynamicComponent === 'ConfigTables' && <ConfigTables />}
                    {dynamicComponent === 'UserGuidesAdmin' && <UserGuidesAdmin />}
                </div>
            </HelpContext.Provider>
        </div>
    )
}

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

AdminConsole.contextTypes = {
    intl: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(AdminConsole);
