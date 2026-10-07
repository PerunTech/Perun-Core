package com.prtech.perun_core;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

import org.apache.logging.log4j.Logger;

import com.prtech.svarog.SvConf;
import com.prtech.svarog.SvException;
import com.prtech.svarog.SvLink;
import com.prtech.svarog.SvParameter;
import com.prtech.svarog.SvReader;
import com.prtech.svarog.SvSecurity;
import com.prtech.svarog.SvWriter;
import com.prtech.svarog.svCONST;
import com.prtech.svarog_common.DbDataArray;
import com.prtech.svarog_common.DbDataObject;
import com.prtech.svarog_common.DbSearchCriterion;
import com.prtech.svarog_common.DbSearchExpression;
import com.prtech.svarog_common.DbSearchCriterion.DbCompareOperand;
import com.prtech.svarog_interfaces.ISvConfigurationMulti;
import com.prtech.svarog_interfaces.ISvCore;
import com.prtech.svarog_interfaces.ISvConfiguration.UpdateType;

public class Configurator implements ISvConfigurationMulti {

	static final Logger log4j = SvConf.getLogger(Configurator.class);

	@Override
	public int executionOrder(UpdateType updateType) {
		// TODO Auto-generated method stub
		return 0;
	}

	@Override
	public String beforeSchemaUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String beforeLabelsUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String beforeCodesUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String beforeTypesUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String beforeLinkTypesUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String beforeAclUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		SvReader svr = (SvReader) core;
		try (SvWriter svw = new SvWriter(svr);
				SvParameter svp = new SvParameter(svw);
				SvSecurity svc = new SvSecurity(svw);
				SvLink svl = new SvLink(svw);) {
			svw.setAutoCommit(true);
			createAclObject("PERUN_CORE_EXEC.LOGIN_USER", "PERUN_CORE_EXEC.LOGIN_USER", svCONST.OBJECT_TYPE_TABLE,
					"EXECUTE", true, svw, svr);
			createAclObject("PERUN_CORE_EXEC.LOGOFF_USER", "PERUN_CORE_EXEC.LOGOFF_USER", svCONST.OBJECT_TYPE_TABLE,
					"READ", true, svw, svr);
			svw.dbCommit();
		}
		return null;
	}

	@Override
	public String beforeSidAclUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public String afterUpdate(Connection conn, ISvCore core, String schema) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public int getVersion(int currentVersion) {
		// TODO Auto-generated method stub
		return 1;
	}

	@Override
	public List<UpdateType> getUpdateTypes() {
		List<UpdateType> types = new ArrayList<UpdateType>();
		types.add(UpdateType.ACL);
		types.add(UpdateType.FINAL);
		return types;
	}

	/**
	 * Method that creates SVAROG_ACL object if does not exist
	 * 
	 * @param labelCode
	 * @param aclConfigUnq
	 * @param aclObjectType
	 * @param accessType
	 * @param shouldCommit
	 * @param svw
	 * @param svr
	 * @throws SvException
	 */
	public void createAclObject(String labelCode, String aclConfigUnq, Long aclObjectType, String accessType,
			boolean shouldCommit, SvWriter svw, SvReader svr) throws SvException {
		DbDataObject searchedObject = checkIfACLexists(svCONST.OBJECT_TYPE_ACL, labelCode, accessType, svr);
		if (searchedObject == null) {
			DbDataObject aclObject = new DbDataObject();
			aclObject.setObjectType(svCONST.OBJECT_TYPE_ACL);
			aclObject.setVal("LABEL_CODE", labelCode);
			aclObject.setVal("ACL_CONFIG_UNQ", aclConfigUnq);
			aclObject.setVal("ACL_OBJECT_TYPE", aclObjectType);
			aclObject.setVal("ACCESS_TYPE", accessType);
			aclObject.setVal("ACL_OBJECT_ID", 0);
			svw.saveObject(aclObject, shouldCommit);
		} else {
			log4j.info("ACL object " + labelCode + " ,already exists.");
		}
	}

	/**
	 * Method that checks if an SVAROG_ACL object exists in DB
	 * 
	 * @param objToSearchIn
	 * @param labelCode
	 * @param accessType
	 * @param svr
	 * @return
	 * @throws SvException
	 */
	public DbDataObject checkIfACLexists(Long objToSearchIn, String labelCode, String accessType, SvReader svr)
			throws SvException {
		DbDataObject result = null;
		DbDataArray results = null;
		DbSearchCriterion cr1 = new DbSearchCriterion("LABEL_CODE", DbCompareOperand.EQUAL, labelCode);
		DbSearchCriterion cr2 = new DbSearchCriterion("ACCESS_TYPE", DbCompareOperand.EQUAL, accessType);
		results = svr.getObjects(new DbSearchExpression().addDbSearchItem(cr1).addDbSearchItem(cr2), objToSearchIn,
				null, 0, 0);
		if (!results.isEmpty()) {
			result = results.get(0);
		}
		return result;
	}

}