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
 * Serves /www as registerResources did, with no-cache on every file: without a Cache-Control the
 * browser guesses from Last-Modified and can run a stale bundle for days after a deploy. A module
 * whose ?v= matches its contents is kept for a year; one asked for by an old bundle is not.
 */
public class StaticContentServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	static final String REVALIDATE = "no-cache";

	static final String IMMUTABLE = "public, max-age=31536000, immutable";

	/** Hex digits of the SHA-256, as build/modules.mjs takes them */
	static final int VERSION_LENGTH = 12;

	private final String prefix;

	/** By path and last modified time, so a module is hashed once */
	private final ConcurrentHashMap<String, String> versions = new ConcurrentHashMap<>();

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

	/** As build/modules.mjs makes it, or null when the file can't be read */
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
