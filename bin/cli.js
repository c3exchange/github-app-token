#! /usr/bin/env node

/**
 * Copyright (c) 2023, C3.io
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const crypto = require("crypto");
const https = require("https");
const process = require("process");
const fs = require("fs");

// -----------------------------------------------------------------------------

main().catch((err) => {
	console.error("Error:", (err.stack ? err.stack : err.message));
	process.exit(1);
});

async function main() {
	const opts = parseArguments();

	// load private key from file
	let privateKey;
	if (opts.privateKeyFile != 'stdin') {
		privateKey = fs.readFileSync(opts.privateKeyFile, "utf8");
	}
	else {
		privateKey = await readStdIn();
	}

	// create payload for JWT
	const header = toBase64Url(Buffer.from(JSON.stringify({
		"alg": "RS256",
		"typ": "JWT"
	}), "binary"));

	const currTime = Math.floor(Date.now() / 1000);
	const payload = toBase64Url(Buffer.from(JSON.stringify({
		"iat": currTime,
		"exp": currTime + 300, // the validity of the token is 5 minutes
		"iss": opts.applicationId.toString()
	}), "utf8"));

	// sign JWT
	const signer = crypto.createSign("RSA-SHA256");
	signer.update(header + "." + payload)
	const jwtToken = header + "." + payload + "." + toBase64Url(signer.sign(privateKey));

	// build header for requests
	let res;
	const reqHdrs = {
		"Accept": "application/vnd.github+json",
		"Authorization": "Bearer " + jwtToken,
		"User-Agent": (opts.userAgent ? opts.userAgent : "GitHubAppToken-Retriever/1.0"),
		"X-GitHub-Api-Version": "2022-11-28"
	};

	let installationId = 0;
	let accessTokensUrl = "";
	if (opts.installationId) {
		installationId = opts.installationId;
	}
	else {
		// retrieve application's installation id
		res = await webRequest("https://api.github.com/app/installations", {
			headers: reqHdrs
		});
		if (res.statusCode !== 200) {
			console.log(res.data);
			throw new Error("Retrieval of installed applications failed with status " + res.statusCode.toString());
		}

		for (const app of JSON.parse(res.data)) {
			if (opts.userOrg) {
				if (app.account?.login != opts.userOrg) {
					continue;
				}
			}

			if (app.app_id === opts.applicationId) {
				installationId = app.id;
				if (app.access_tokens_url) {
					accessTokensUrl = app.access_tokens_url;
				}
				break;
			}
		}
		if (installationId == 0) {
			throw new Error("Unable to locate installation ID");
		}
	}

	// request an access token for the application instance
	if (!accessTokensUrl) {
		accessTokensUrl = "https://api.github.com/app/installations/" + installationId.toString() + "/access_tokens";
	}
	res = await webRequest(accessTokensUrl, {
		headers: reqHdrs,
		method: "POST",
		body: JSON.stringify({
			permissions: opts.permissions
		})
	});
	if (res.statusCode !== 201) {
		throw new Error("Retrieval of application access token failed with status " + res.statusCode.toString());
	}
	//parse response
	res = JSON.parse(res.data);

	//print token
	process.stdout.write(res.token);
}

function parseArguments() {
	const permissionsRegex = /[a-z\-]+/u;
	const opts = {};

	const args = process.argv.slice(2);
	if (args.length == 0) {
		throw new Error(
			"Missing arguments. Use: npx github-app-token --pk {private-key-file} --app-id application-id " +
			"--perm {list-of-permissions} [--ua {user-agent}]"
		);
	}

	//parse command line arguments
	for (let idx = 0; idx < args.length; idx += 1) {
		if (args[idx] == "--pk") {
			if (opts.privateKeyFile) {
				throw new Error("Private key file already specified.");
			}
			idx += 1 
			if (idx >= args.length || args[idx].length == 0) {
				throw new Error("Missing argument for '" + args[idx - 1] + "' parameter.");
			}
			opts.privateKeyFile = args[idx];
		}
		else if (args[idx] == "--app-id") {
			if (opts.applicationId) {
				throw new Error("Application ID already specified.");
			}
			idx += 1;
			if (idx >= args.length || args[idx].length == 0) {
				throw new Error("Missing argument for '" + args[idx - 1] + "' parameter.");
			}
			opts.applicationId = parseInt(args[idx], 10);
			if (isNaN(opts.applicationId) || opts.applicationId < 1) {
				throw new Error("Invalid application ID.");
			}
		}
		else if (args[idx] == "--inst-id") {
			if (opts.installationId) {
				throw new Error("Installation ID already specified.");
			}
			idx += 1;
			if (idx >= args.length || args[idx].length == 0) {
				throw new Error("Missing argument for '" + args[idx - 1] + "' parameter.");
			}
			opts.installationId = parseInt(args[idx], 10);
			if (isNaN(opts.installationId) || opts.installationId < 1) {
				throw new Error("Invalid installation ID.");
			}
		}
		else if (args[idx] == "--org" || args[idx] == "--user") {
			if (opts.userOrg) {
				throw new Error("User/Organization name already specified.");
			}
			idx += 1;
			if (idx >= args.length || args[idx].length == 0) {
				throw new Error("Missing argument for '" + args[idx - 1] + "' parameter.");
			}
			opts.userOrg = args[idx];
		}
		else if (args[idx] == "--perm" || args[idx] == "--scope") {
			if (opts.permissions) {
				throw new Error("Access permissions already specified.");
			}
			idx += 1;
			if (idx >= args.length || args[idx].length == 0) {
				throw new Error("Missing argument for '" + args[idx - 1] + "' parameter.");
			}
			opts.permissions = {};
			for (let perm of args[idx].split(",")) {
				let access = "read";
				if (perm.startsWith("read:")) {
					perm = perm.substring(5);
				}
				else if (perm.startsWith("write:")) {
					access = "write";
					perm = perm.substring(6);
				}
				else if (perm.startsWith("admin:")) {
					access = "admin";
					perm = perm.substring(6);
				}
				if (!permissionsRegex.test(perm)) {
					throw new Error("Invalid permission name.");
				}
				opts.permissions[perm] = access;
			}
		}
		else if (args[idx] == "--ua") {
			if (opts.userAgent) {
				throw new Error("User Agent already specified.");
			}
			idx += 1;
			if (idx >= args.length || args[idx].length == 0) {
				throw new Error("Missing argument for '" + args[idx - 1] + "' parameter.");
			}
			opts.userAgent = args[idx];
		}
		else {
			throw new Error("Unsupported parameter.");
		}
	}

	if (!opts.privateKeyFile) {
		throw new Error("Private key file not specified.");
	}
	if (!opts.applicationId) {
		throw new Error("Application ID not specified.");
	}
	if (!opts.permissions) {
		throw new Error("No access permissions has been specified.");
	}
	return opts;
}

function toBase64Url(buf) {
	return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function webRequest(url, options) {
	return new Promise((resolve, reject) => {
		const opts = {
			method: (options && options.method) ? options.method : "GET",
			timeout: (options && options.timeout) ? options.timeout : 10000
		};
		if (options && options.headers) {
			opts.headers = options.headers;
		}

		const req = https.request(url, opts, (res) => {
			const ret = {
				statusCode: res.statusCode,
				headers: res.headers,
				data: ""
			}

			res.on("data", (chunk) => {
				ret.data += chunk;
			});

			res.on("end", () => {
				resolve(ret);
			});
		});

		req.on("error", (err) => {
			reject({ error: err });
		});

		if (options && options.body) {
			req.write(options.body);
		}
		req.end();
	});
}

async function readStdIn() {
	return new Promise((resolve, reject) => {
		let s = '';

		process.stdin.setEncoding("utf8");
		process.stdin.resume();
		process.stdin.on('data', function (data) {
			s += data;
		});
		process.stdin.on('end', function () {
			process.stdin.pause();
			resolve(s);
		});
	});
}
