import React, { useState, useEffect, useRef } from "react";
import { useIntl } from 'react-intl';
import { ComponentManager, GridManager, axios } from "../../../client";
import { connect } from "react-redux";
import { alertUserResponse } from "../../../elements";
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton';
import LabelSearchSchema from "./LabelSearchSchema";
import { TABLE_NAME, FORM_ID, GRID_ID, fetchLocales, generateExport } from './utils';
import LabelSearchForm from './LabelSearchForm';
import LabelFormModal from './LabelFormModal';
import LabelExportModal from './LabelExportModal';

const LabelEditor = (props) => {
    const intl = useIntl();
    const [searchParams, setSearchParams] = useState(null);
    const [pendingSearch, setPendingSearch] = useState(null);
    const [searchFormData, setSearchFormData] = useState({});
    const [showForm, setShowForm] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [objectId, setObjectId] = useState(0);
    const [locales, setLocales] = useState([]);
    const [selectedLocale, setSelectedLocale] = useState('');
    const [exportPreview, setExportPreview] = useState('');
    const [exportLoading, setExportLoading] = useState(false);
    const exportAbortRef = useRef(null);

    const fmt = (id, defaultMessage) => intl.formatMessage({ id, defaultMessage: defaultMessage || id });

    useEffect(() => {
        fetchLocales().then(setLocales).catch(err => console.error('Failed to fetch ENV_LOCALES', err));
    }, []);

    // When a subsequent search unmounts the grid (searchParams → null) and a pending
    // search is waiting, remount the grid with the new URL once the old one is gone.
    useEffect(() => {
        if (pendingSearch && !searchParams) {
            setSearchParams(pendingSearch);
            setPendingSearch(null);
        }
    }, [pendingSearch, searchParams]);

    // Auto-select the only locale when the export modal is open and locales have loaded.
    // Runs whenever showExport or locales change, covering the race where locales arrive
    // after the modal is already open.
    useEffect(() => {
        if (showExport && locales.length === 1 && !selectedLocale) {
            setSelectedLocale(locales[0].id);
            handleGenerateExport(locales[0].id);
        }
    }, [showExport, locales]);

    const handleSearch = (e) => {
        const { LABEL_CODE, LABEL_TEXT } = e.formData;
        const SEARCH_OPTION = LABEL_CODE ? 'LABEL_CODE' : 'LABEL_TEXT';
        const SEARCH_VALUES = LABEL_CODE || LABEL_TEXT || '';
        if (!SEARCH_VALUES) return;
        const newParams = { SEARCH_OPTION, SEARCH_VALUES };
        if (searchParams) {
            ComponentManager.cleanComponentReducerState(GRID_ID);
            setSearchParams(null);
            setPendingSearch(newParams);
        } else {
            setSearchParams(newParams);
        }
    };

    const openAdd = () => {
        setObjectId(0);
        setShowForm(true);
    };

    const openEdit = (_rowIdx, _id, row) => {
        setObjectId(row[`${TABLE_NAME}.OBJECT_ID`]);
        setShowForm(true);
    };

    const handleSave = (e) => {
        const { svSession } = props;
        const onConfirm = () => ComponentManager.setStateForComponent(FORM_ID, null, { saveExecuted: false });
        const url = `${window.server}/ReactElements/createTableRecordFormData/${svSession}/${TABLE_NAME}/0`;
        axios({
            method: 'post',
            data: encodeURIComponent(JSON.stringify(e.formData)),
            url,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).then((res) => {
            if (res?.data) {
                const resType = res.data?.type?.toLowerCase() || 'info';
                alertUserResponse({ type: resType, response: res, onConfirm });
                if (resType === 'success') {
                    if (searchParams) GridManager.reloadAllGrids();
                    setShowForm(false);
                }
            }
        }).catch(err => {
            console.error(err);
            alertUserResponse({ response: err, onConfirm });
        });
    };

    const handleDelete = (_id, _action, _session, params) => {
        const { svSession } = props;
        const onConfirm = () => ComponentManager.setStateForComponent(FORM_ID, null, { deleteExecuted: false });
        const jsonString = params[4]?.PARAM_VALUE;
        const url = `${window.server}/ReactElements/deleteObject/${svSession}`;
        axios({
            method: 'post',
            data: encodeURIComponent(jsonString),
            url,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).then((res) => {
            if (res?.data) {
                const resType = res.data?.type?.toLowerCase() || 'info';
                alertUserResponse({ type: resType, response: res, onConfirm });
                if (resType === 'success') {
                    if (searchParams) GridManager.reloadAllGrids();
                    setShowForm(false);
                }
            }
        }).catch(err => {
            console.error(err);
            alertUserResponse({ response: err, onConfirm });
        });
    };

    const handleGenerateExport = async (locale) => {
        if (exportAbortRef.current) exportAbortRef.current.abort();
        const { svSession } = props;
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExportPreview('');
        setExportLoading(true);
        try {
            const output = await generateExport(svSession, locale, controller.signal);
            if (!controller.signal.aborted) setExportPreview(output);
        } catch (err) {
            if (err.code === 'ERR_CANCELED') return;
            console.error(err);
            alertUserResponse({ response: err });
        } finally {
            setExportLoading(false);
            exportAbortRef.current = null;
        }
    };

    const selectLocale = (localeId) => {
        setSelectedLocale(localeId);
        handleGenerateExport(localeId);
    };

    const handleCloseExport = () => {
        if (exportAbortRef.current) exportAbortRef.current.abort();
        setExportPreview('');
        setSelectedLocale('');
        setShowExport(false);
    };

    const { svSession } = props;
    const { schema, uiSchema } = LabelSearchSchema(intl);

    return (
        <React.Fragment>
            <div className='admin-console-component-header'>
                <p>{fmt('perun.admin_console.label_editor')}</p>
                <AdminConsoleHelpButton title={{ id: 'perun.admin_console.label_editor', defaultMessage: 'perun.admin_console.label_editor' }} />
            </div>
            <LabelSearchForm
                schema={schema}
                uiSchema={uiSchema}
                searchFormData={searchFormData}
                searchParams={searchParams}
                svSession={svSession}
                fmt={fmt}
                onSearch={handleSearch}
                onFormChange={(e) => setSearchFormData(e.formData)}
                onOpenAdd={openAdd}
                onOpenExport={() => setShowExport(true)}
                onRowClick={openEdit}
            />
            <LabelFormModal
                show={showForm}
                objectId={objectId}
                svSession={svSession}
                fmt={fmt}
                onHide={() => setShowForm(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
            <LabelExportModal
                show={showExport}
                locales={locales}
                selectedLocale={selectedLocale}
                exportPreview={exportPreview}
                exportLoading={exportLoading}
                fmt={fmt}
                onHide={handleCloseExport}
                onSelectLocale={selectLocale}
            />
        </React.Fragment>
    );
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

export default connect(mapStateToProps)(LabelEditor);
