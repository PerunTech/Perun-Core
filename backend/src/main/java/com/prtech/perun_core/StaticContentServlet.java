package com.prtech.perun_core;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLConnection;
import java.security.MessageDigest;
import java.util.concurrent.ConcurrentHashMap;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Serves the static content of the bundle's /www folder the way
 * HttpService.registerResources did (Felix's ResourceServlet, which this
 * follows), and tells the browser how long it may keep each file.
 *
 * Without a Cache-Control header the browser guesses from Last-Modified, and
 * the usual guess is a tenth of the file's age: a perun-core.js fetched a month
 * after it was built is run from the cache for about three days without the
 * server being asked, so a deploy in those days goes unseen until they pass. So
 * every file goes out with no-cache, which lets the browser keep it but has it
 * ask first, and an unchanged file costs a 304.
 *
 * The modules perun-core.js loads on demand are the exception. The bundle asks
 * for each with a version in the URL (?v=, the first 12 hex digits of the
 * file's SHA-256, see build/modules.mjs), so a module that matches the version
 * it was asked for can be kept for a year: the next build asks for another URL.
 * The match is checked because the query plays no part in finding the file. A
 * page still running the old bundle during a deploy asks for the old version
 * and gets the new file, and that answer must not be kept under the old URL.
 */
public class StaticContentServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	/** For every file: keep it, but ask the server before each use */
	static final String REVALIDATE = "no-cache";

	/** For a module that matches the version in its URL: keep it for a year */
	static final String IMMUTABLE = "public, max-age=31536000, immutable";

	/** Number of hex digits of the SHA-256 that make a module's version */
	static final int VERSION_LENGTH = 12;

	/** The folder inside the bundle that is served */
	private final String prefix;

	/**
	 * Version of each file asked for with one, by path and last modified time, so
	 * a module is hashed once rather than on each request
	 */
	private final ConcurrentHashMap<String, String> versions = new ConcurrentHashMap<>();

	/**
	 * @param prefix the folder inside the bundle to serve, such as /www
	 */
	public StaticContentServlet(String prefix) {
		this.prefix = prefix;
	}

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse res) throws ServletException, IOException {
		String target = req.getPathInfo();
		String resName = target == null ? prefix : prefix + target;
		URL url = getServletContext().getResource(resName);
		if (url == null) {
			res.sendError(HttpServletResponse.SC_NOT_FOUND);
			return;
		}

		String contentType = getServletContext().getMimeType(resName);
		if (contentType != null) {
			res.setContentType(contentType);
		}
		long lastModified = getLastModified(url);
		if (lastModified != 0) {
			res.setDateHeader("Last-Modified", lastModified);
		}
		String version = req.getParameter("v");
		boolean current = version != null && version.equals(versionOf(url, resName, lastModified));
		res.setHeader("Cache-Control", current ? IMMUTABLE : REVALIDATE);

		if (modifiedSince(lastModified, req.getDateHeader("If-Modified-Since"))) {
			copy(url, res);
		} else {
			res.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
		}
	}

	/**
	 * The version build/modules.mjs gives a file, or null when it cannot be read.
	 *
	 * @param url          the file
	 * @param resName      its path inside the bundle
	 * @param lastModified its last modified time, so a replaced file is hashed
	 *                     again
	 * @return the first 12 hex digits of the file's SHA-256
	 */
	private String versionOf(URL url, String resName, long lastModified) {
		String key = resName + "@" + lastModified;
		String version = versions.get(key);
		if (version == null) {
			try (InputStream is = url.openStream()) {
				MessageDigest sha = MessageDigest.getInstance("SHA-256");
				byte[] buf = new byte[8192];
				int n;
				while ((n = is.read(buf)) >= 0) {
					sha.update(buf, 0, n);
				}
				StringBuilder hex = new StringBuilder();
				for (byte b : sha.digest()) {
					hex.append(String.format("%02x", b & 0xff));
				}
				version = hex.substring(0, VERSION_LENGTH);
			} catch (Exception e) {
				return null;
			}
			versions.put(key, version);
		}
		return version;
	}

	private long getLastModified(URL url) {
		long lastModified = 0;
		try {
			lastModified = url.openConnection().getLastModified();
		} catch (Exception e) {
			// Fall back to the file below
		}
		if (lastModified == 0 && url.getPath() != null) {
			File f = new File(url.getPath());
			if (f.exists()) {
				lastModified = f.lastModified();
			}
		}
		return lastModified;
	}

	/** Compared in whole seconds, the precision of an HTTP date */
	private boolean modifiedSince(long lastModified, long since) {
		return lastModified == 0 || since == -1 || lastModified / 1000 > since / 1000;
	}

	private void copy(URL url, HttpServletResponse res) throws IOException {
		URLConnection conn = url.openConnection();
		try (InputStream is = conn.getInputStream(); OutputStream os = res.getOutputStream()) {
			// The length goes out with the headers, so before anything is written
			int length = getContentLength(conn);
			if (length >= 0) {
				res.setContentLength(length);
			}
			byte[] buf = new byte[8192];
			int n;
			while ((n = is.read(buf)) >= 0) {
				os.write(buf, 0, n);
			}
		}
	}

	private int getContentLength(URLConnection conn) {
		int length = conn.getContentLength();
		if (length < 0 && conn.getURL().getPath() != null) {
			File f = new File(conn.getURL().getPath());
			if (f.exists() && f.length() < Integer.MAX_VALUE) {
				length = (int) f.length();
			}
		}
		return length;
	}
}
