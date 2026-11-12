/*
 *   Copyright 2006 The Apache Software Foundation
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
package com.prtech.perun_core;

import org.apache.logging.log4j.Logger;
import org.osgi.framework.BundleActivator;
import org.osgi.framework.BundleContext;
import org.osgi.framework.ServiceReference;
import org.osgi.framework.ServiceRegistration;
import org.osgi.service.http.HttpService;
import org.osgi.util.tracker.ServiceTracker;

import com.prtech.svarog.SvConf;
import com.prtech.svarog_interfaces.IPerunPlugin;

/** Registers perun-core's plugin info and serves /www at /perun. */
public class Activator implements BundleActivator {
	static final String httpContextPath = "/perun";

	static final String httpLocalDir = "/www";
	// Svarog's logger, so the log goes outside the OSGi container
	static final Logger log4j = SvConf.getLogger(Activator.class);

	private ServiceRegistration perunPluginRegistration = null;

	private ServiceTracker httpTracker;

	@SuppressWarnings("unchecked")
	public void start(BundleContext context) {

		log4j.info("Starting Perun Core React OSGI bundle");

		// No backend services here: they belong in Perun Core Services
		IPerunPlugin plg = new PerunPluginInfo();
		log4j.info("Registering perunPlugin service class: " + plg.getClass().getName());
		perunPluginRegistration = context.registerService(IPerunPlugin.class.getName(), plg, null);

		httpTracker = new ServiceTracker(context, HttpService.class.getName(), null) {
			public void removedService(ServiceReference reference, Object service) {
				try {
					((HttpService) service).unregister(httpContextPath);
				} catch (IllegalArgumentException exception) {
					// Ignore; servlet registration probably failed earlier
				}
			}

			public Object addingService(ServiceReference reference) {
				HttpService httpService = (HttpService) this.context.getService(reference);
				try {
					// A servlet of our own rather than registerResources, which cannot set
					// Cache-Control
					httpService.registerServlet(httpContextPath, new StaticContentServlet(httpLocalDir), null,
							null);
				} catch (Exception exception) {
					exception.printStackTrace();
				}
				return httpService;
			}
		};
		httpTracker.open();

	}

	public void stop(BundleContext context) throws Exception {
		if (perunPluginRegistration != null) {
			perunPluginRegistration.unregister();
			perunPluginRegistration = null;
		}

	}

}
