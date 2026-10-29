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

/**
 * This class implements a simple bundle that uses the bundle context to
 * register a list of services with the OSGi framework. There two types of
 * services which you can register. A set of JAX.RS anotated services, which
 * shall be automatically picked up by the JAX RS publisher if available. A
 * Another type of services would be services implementing ISvExecutor interface
 * which provide internal communication means for svarog executor services.
 * 
 */
public class Activator implements BundleActivator {
	/**
	 * The context path on the http server under which the static content from the
	 * /www folder inside the bundle will be served
	 */
	static final String httpContextPath = "/perun";

	/**
	 * Directory inside the bundle which will be served at the context path
	 */
	static final String httpLocalDir = "/www";
	/**
	 * Logger instance from the Svarog classloader so we log our Svarog specific
	 * info outside of the OSGI container
	 */
	static final Logger log4j = SvConf.getLogger(Activator.class);

	/**
	 * List of service registrations which we use for unregistering when cleaning up
	 */
	private ServiceRegistration perunPluginRegistration = null;

	/**
	 * Member used to track the http services in order to register path for serving
	 * static JS/Other content
	 */
	private ServiceTracker httpTracker;

	/**
	 * Implements BundleActivator.start(). Registers all instances of the JAXRS
	 * services as well as all objects implementing ISvExecutor interfaces using the
	 * bundle context;
	 * 
	 * @param context the framework context for the bundle.
	 */
	@SuppressWarnings("unchecked")
	public void start(BundleContext context) {

		log4j.info("Starting Perun Core React OSGI bundle");

		/**
		 * NO MORE JAVA BACKEND SERVICES IN THIS PROJECT, Please user Perun Core
		 * Services for any back end
		 */
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
				// HTTP service is available, register our resources...
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
		// start tracking all HTTP services...
		httpTracker.open();

	}

	/**
	 * Implements BundleActivator.stop(). Unregistering all services which have been
	 * registered
	 * 
	 * @param context the framework context for the bundle.
	 */
	public void stop(BundleContext context) throws Exception {
		if (perunPluginRegistration != null) {
			perunPluginRegistration.unregister();
			perunPluginRegistration = null;
		}

	}

}
