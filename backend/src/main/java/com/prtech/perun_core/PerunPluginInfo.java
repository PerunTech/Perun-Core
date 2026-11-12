package com.prtech.perun_core;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import com.google.gson.JsonObject;
import com.prtech.svarog_interfaces.IPerunPlugin;
import com.prtech.svarog_interfaces.ISvCore;

public class PerunPluginInfo implements IPerunPlugin {

	static final String context = "perun-core";

	@Override
	public int getVersion() {
		return 8;
	}

	@Override
	public String getContextName() {
		return context;
	}

	@Override
	public String getJsPluginUrl() {
		return "perun-core.js";
	}

	@Override
	public String getIconPath() {
		return "/perun-assets/img/access_cards/system.svg";
	}

	@Override
	public String getLabelCode() {
		return "perun.plugin.system_settings";
	}

	@Override
	public String getPermissionCode() {
		return "card.perun_core_access";
	}

	@Override
	public int getSortOrder() {
		return 1;
	}

	@Override
	public boolean replaceContextMenuOnNew() {
		return false;
	}

	@Override
	public JsonObject getMenu(JsonObject existingMenu, ISvCore core) {
		return null;
	}

	@Override
	public JsonObject getContextMenu(HashMap<String, String> contextMap, JsonObject existingMenu, ISvCore core) {
		return null;
	}

	@Override
	public boolean replaceMenuOnNew() {
		return false;
	}

	@Override
	public List<String> dependencies() {
		List<String> deps = new ArrayList<String>();

		return deps;
	}

}
