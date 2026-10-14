import React, { useState, useEffect } from "react";
import { useIntl } from 'react-intl';
import Form from "@rjsf/core";
import axios from "axios";
import { connect } from "react-redux";
import validator from '@rjsf/validator-ajv8';
import Loading from "../../Loading/Loading";
import { ComponentManager, GenericGrid } from "../../../client";
import { orgSearchSchema } from "../utils/orgSearchSchema";
import { alertUserResponse } from "../../../elements";
let gridId = "USERS_CHOSE_ORG_GRID";

const OrgSearch = (props) => {
  const intl = useIntl();
  const [grid, setGrid] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [formDataHold, setformDataHold] = useState({});
  const { schema, uiSchema } = orgSearchSchema(intl)

  useEffect(() => {
    return () => {
      ComponentManager.cleanComponentReducerState(gridId);
    };
  }, []);

  const showTable = (e) => {
    setGrid(undefined);
    e.formData.type = "INTERNAL";
    setformDataHold(e.formData);
    getTableDataFromFilter(e.formData);
  };

  const getTableDataFromFilter = (postData) => {
    setLoading(true)
    ComponentManager.cleanComponentReducerState(gridId);
    const basicData = {
      OBJECT_TYPE: 57,
      ROW_NUM: 1000,
      SORT_ORDER: "DESC",
      SORT_BY_FIELD: "PKID",
    };
    const { svSession } = props;
    const url = `${window.server}/ReactElements/getTableWithMultipleFilters/${svSession}`;
    const data = new URLSearchParams();
    let multipleFilterData = [];
    if (postData["type"]) {
      multipleFilterData.push({
        fieldName: "USER_TYPE",
        fieldValue: "INTERNAL",
        dbOperand: "EQUAL",
        nextLogicOperand: "AND",
      });
    }
    if (postData["pin"]) {
      multipleFilterData.push({
        fieldName: "PIN",
        fieldValue: postData["pin"],
        dbOperand: "LIKE",
        nextLogicOperand: "AND",
      });
    }
    if (postData["username"]) {
      multipleFilterData.push({
        fieldName: "USER_NAME",
        fieldValue: postData["username"]?.toUpperCase(),
        dbOperand: "LIKE",
        nextLogicOperand: "AND",
      });
    }
    data.append("multipleFilterData", JSON.stringify(multipleFilterData));
    data.append("basicData", JSON.stringify(basicData));
    const reqConfig = { method: "post", data, url, headers: { "Content-Type": "application/x-www-form-urlencoded" } };
    axios(reqConfig).then((res) => {
      if (res?.data !== "empty") {
        let grid = (
          <GenericGrid
            gridType={"SEARCH_GRID_DATA"}
            key={gridId}
            id={gridId}
            configTableName={`/ReactElements/getTableFieldList/${svSession}/SVAROG_USERS`}
            dataTableName={res.data}
            defaultHeight={false}
            heightRatio={0.5}
            minHeight={400}
            refreshData={true}
            onRowClickFunct={props.handleRowClick}
          />
        );
        return setGrid(grid), setLoading(false)
      }
    }).catch((err) => {
      console.error(err)
      alertUserResponse({ response: err })
    });
  };

  const generateForm = () => {
    const form = (
      <Form
        validator={validator}
        className='admin-console-show-user-main-form'
        uiSchema={uiSchema}
        onSubmit={showTable}
        schema={schema}
        formData={formDataHold}
      >
        <div className='admin-console-show-user-btn-cont'>
          <button className='admin-console-show-user-form-btn' type="submit">
            {intl.formatMessage({ id: 'perun.admin_console.search', defaultMessage: 'perun.admin_console.search' })}
          </button>
        </div>
      </Form>
    );
    return form;
  };

  return (
    <React.Fragment>
      <div className='admin-console-show-user-container'>
        <div className='admin-console-show-user-customform'>
          <legend className='admin-console-show-user-legend admin-console-legend'>
            {intl.formatMessage({ id: 'perun.admin_console.search_user_legend', defaultMessage: 'perun.admin_console.search_user_legend' })}
          </legend>
          <div className='admin-console-show-user-inputholder'>{generateForm()}</div>
        </div>
        <div className='admin-console-show-user-gridcont'>{grid && grid}</div>
      </div>
      {loading && <Loading />}
    </React.Fragment>
  );
};

const mapStateToProps = (state) => ({
  svSession: state.security.svSession,
});

export default connect(mapStateToProps)(OrgSearch);
