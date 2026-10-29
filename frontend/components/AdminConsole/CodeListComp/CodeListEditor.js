import React, { useState, useEffect, useRef } from "react";
import { useIntl } from 'react-intl';
import { ComponentManager, GridManager, axios } from "../../../client";
import { connect } from "react-redux";
import { alertUserResponse } from "../../../elements";
import AdminConsoleHelpButton from '../Help/AdminConsoleHelpButton';
import CodeListSearchSchema from "./CodeListSearchSchema";
import { COMBINED_FORM_ID, GRID_ID, buildExportTree, getRowField } from './utils';
import CodeListSearchForm from './CodeListSearchForm';
import CodeListChildrenView from './CodeListChildrenView';
import CodeListFormModal from './CodeListFormModal';
import CodeListExportModal from './CodeListExportModal';

const CodeListEditor = (props) => {
    const intl = useIntl();
    const [searchFormData, setSearchFormData] = useState({});
    const [searchParams, setSearchParams] = useState(null);
    const [pendingSearch, setPendingSearch] = useState(null);
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [childrenGridId, setChildrenGridId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editObjectId, setEditObjectId] = useState(0);
    const [activeParentObjectId, setActiveParentObjectId] = useState(0);
    const [activeParentCodeValue, setActiveParentCodeValue] = useState(null);
    const [editingCurrentNode, setEditingCurrentNode] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [exportData, setExportData] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);
    const exportAbortRef = useRef(null);

    const fmt = (id) => intl.formatMessage({ id, defaultMessage: id });

    useEffect(() => {
        if (pendingSearch !== null && searchParams === null) {
            setSearchParams(pendingSearch);
            setPendingSearch(null);
        }
    }, [pendingSearch, searchParams]);

    useEffect(() => {
        return () => {
            if (childrenGridId) ComponentManager.cleanComponentReducerState(childrenGridId);
        };
    }, [childrenGridId]);

    useEffect(() => {
        return () => ComponentManager.cleanComponentReducerState(GRID_ID);
    }, []);

    const navigateTo = (newBreadcrumb) => {
        const newGridId = newBreadcrumb.length > 0
            ? 'CODES_CHILDREN_' + Math.random().toString(36).slice(2)
            : null;
        setBreadcrumb(newBreadcrumb);
        setChildrenGridId(newGridId);
    };

    const handleSearch = (e) => {
        const codeValue = (e.formData.CODE_VALUE || '').trim().toUpperCase();
        if (!codeValue) return;
        const newParams = { CODE_VALUE: codeValue };
        if (searchParams) {
            ComponentManager.cleanComponentReducerState(GRID_ID);
            setSearchParams(null);
            setPendingSearch(newParams);
        } else {
            setSearchParams(newParams);
        }
    };

    const handleSearchRowClick = (_id, _rowIdx, row) => {
        navigateTo([{
            objectId: getRowField(row, 'OBJECT_ID'),
            codeValue: getRowField(row, 'CODE_VALUE'),
            labelCode: getRowField(row, 'LABEL_CODE'),
        }]);
    };

    const handleChildRowClick = (_id, _rowIdx, row) => {
        navigateTo([...breadcrumb, {
            objectId: getRowField(row, 'OBJECT_ID'),
            codeValue: getRowField(row, 'CODE_VALUE'),
            labelCode: getRowField(row, 'LABEL_CODE'),
        }]);
    };

    const handleBreadcrumbNav = (idx) => {
        if (idx === -1) navigateTo([]);
        else navigateTo(breadcrumb.slice(0, idx + 1));
    };

    const openAdd = () => {
        setEditObjectId(0);
        setActiveParentObjectId(0);
        setActiveParentCodeValue(null);
        setEditingCurrentNode(false);
        setShowForm(true);
    };

    const openAddChild = () => {
        const parent = breadcrumb[breadcrumb.length - 1];
        setEditObjectId(0);
        setActiveParentObjectId(parent.objectId);
        setActiveParentCodeValue(parent.codeValue);
        setEditingCurrentNode(false);
        setShowForm(true);
    };

    const openEditCurrent = () => {
        const current = breadcrumb[breadcrumb.length - 1];
        const parent = breadcrumb[breadcrumb.length - 2];
        setEditObjectId(current.objectId);
        setActiveParentObjectId(parent?.objectId ?? 0);
        setActiveParentCodeValue(parent?.codeValue ?? null);
        setEditingCurrentNode(true);
        setShowForm(true);
    };

    const handleSave = (codesFormData, labelsFormData) => {
        const { svSession } = props;
        const onConfirm = () => ComponentManager.setStateForComponent(COMBINED_FORM_ID, null, { saveExecuted: false });

        axios({
            method: 'post',
            data: encodeURIComponent(JSON.stringify({
                SVAROG_CODES: codesFormData,
                SVAROG_LABELS: labelsFormData,
            })),
            url: `${window.server}/WsAdminConsole/save-code-list/sid/${svSession}/parent_id/${activeParentObjectId}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).then((res) => {
            const resType = res?.data?.type?.toLowerCase() || 'info';
            alertUserResponse({ type: resType, response: res, onConfirm });
            if (resType === 'success') {
                if (editingCurrentNode) {
                    GridManager.reloadAllGrids();
                    setBreadcrumb(prev => prev.map((crumb, idx) =>
                        idx === prev.length - 1
                            ? { ...crumb, codeValue: codesFormData.CODE_VALUE || crumb.codeValue, labelCode: codesFormData.LABEL_CODE || crumb.labelCode }
                            : crumb
                    ));
                } else if (editObjectId === 0 && activeParentObjectId === 0 && codesFormData.CODE_VALUE) {
                    const codeValue = codesFormData.CODE_VALUE.trim().toUpperCase();
                    const newParams = { CODE_VALUE: codeValue };
                    setSearchFormData({ CODE_VALUE: codeValue });
                    if (searchParams) {
                        ComponentManager.cleanComponentReducerState(GRID_ID);
                        setSearchParams(null);
                        setPendingSearch(newParams);
                    } else {
                        setSearchParams(newParams);
                    }
                } else {
                    GridManager.reloadAllGrids();
                }
                setShowForm(false);
            }
        }).catch(err => {
            console.error(err);
            alertUserResponse({ response: err, onConfirm });
        });
    };

    const handleDelete = (_id, _action, _session, params) => {
        const { svSession } = props;
        const onConfirm = () => ComponentManager.setStateForComponent(COMBINED_FORM_ID, null, { deleteExecuted: false });
        const raw = params[4]?.PARAM_VALUE;
        const parsed = raw ? JSON.parse(raw) : {};
        const codesData = parsed.codes || parsed;
        axios({
            method: 'post',
            data: encodeURIComponent(JSON.stringify(codesData)),
            url: `${window.server}/ReactElements/deleteObject/${svSession}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).then((res) => {
            if (res?.data) {
                const resType = res.data?.type?.toLowerCase() || 'info';
                alertUserResponse({ type: resType, response: res, onConfirm });
                if (resType === 'success') {
                    setShowForm(false);
                    const newBreadcrumb = breadcrumb.slice(0, -1);
                    navigateTo(newBreadcrumb);
                    if (newBreadcrumb.length === 0) GridManager.reloadAllGrids();
                }
            }
        }).catch(err => {
            console.error(err);
            alertUserResponse({ response: err, onConfirm });
        });
    };

    const handleOpenExport = async () => {
        if (!breadcrumb.length) return;
        if (exportAbortRef.current) exportAbortRef.current.abort();
        const { svSession } = props;
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExportData(null);
        setExportLoading(true);
        setShowExport(true);
        try {
            const root = breadcrumb[0];
            const tree = await buildExportTree(svSession, root.objectId, root.codeValue, root.labelCode, controller.signal);
            if (!controller.signal.aborted) setExportData({ children: [tree] });
        } catch (err) {
            if (err.code === 'ERR_CANCELED') return;
            console.error(err);
            alertUserResponse({ response: err });
        } finally {
            setExportLoading(false);
            exportAbortRef.current = null;
        }
    };

    const handleCloseExport = () => {
        if (exportAbortRef.current) exportAbortRef.current.abort();
        setExportData(null);
        setShowExport(false);
    };

    const { svSession } = props;
    const { schema, uiSchema } = CodeListSearchSchema(intl);

    return (
        <React.Fragment>
            <div className='admin-console-component-header'>
                <p>{fmt('perun.admin_console.code_list_editor')}</p>
                <AdminConsoleHelpButton title={{ id: 'perun.admin_console.code_list_editor', defaultMessage: 'perun.admin_console.code_list_editor' }} />
            </div>
            {breadcrumb.length === 0 ? (
                <CodeListSearchForm
                    schema={schema}
                    uiSchema={uiSchema}
                    searchFormData={searchFormData}
                    searchParams={searchParams}
                    svSession={svSession}
                    fmt={fmt}
                    onSearch={handleSearch}
                    onFormChange={(e) => setSearchFormData(e.formData)}
                    onOpenAdd={openAdd}
                    onRowClick={handleSearchRowClick}
                />
            ) : (
                <CodeListChildrenView
                    breadcrumb={breadcrumb}
                    childrenGridId={childrenGridId}
                    svSession={svSession}
                    fmt={fmt}
                    onNavigate={handleBreadcrumbNav}
                    onEditCurrent={openEditCurrent}
                    onAddChild={openAddChild}
                    onExport={handleOpenExport}
                    onRowClick={handleChildRowClick}
                />
            )}
            <CodeListFormModal
                show={showForm}
                objectId={editObjectId}
                parentCodeValue={activeParentCodeValue}
                svSession={svSession}
                fmt={fmt}
                onHide={() => setShowForm(false)}
                onSave={handleSave}
                onDelete={handleDelete}
                breadcrumb={breadcrumb}
            />
            <CodeListExportModal
                show={showExport}
                exportData={exportData}
                exportLoading={exportLoading}
                fmt={fmt}
                onHide={handleCloseExport}
            />
        </React.Fragment>
    );
};

const mapStateToProps = (state) => ({
    svSession: state.security.svSession,
});

export default connect(mapStateToProps)(CodeListEditor);
