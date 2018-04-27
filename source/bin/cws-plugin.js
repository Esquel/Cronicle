#!/usr/bin/env node

// URL Plugin for Cronicle
// Invoked via the 'HTTP Client' Plugin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

// Job Params: 
//		method, url, headers, data, timeout, follow, ssl_cert_bypass, success_match, error_match

var fs = require('fs');
var os = require('os');
var cp = require('child_process');
var path = require('path');
var JSONStream = require('pixl-json-stream');
var Tools = require('pixl-tools');
var Request = require('pixl-request');

// setup stdin / stdout streams 
process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

var stream = new JSONStream(process.stdin, process.stdout);
stream.on('json', function (job) {
	// got job from parent
	var params = job.params;
	var request = new Request();

	var print = function (text) {
		fs.appendFileSync(job.log_file, text);
	};

	// timeout
	request.setTimeout((params.timeout || 0) * 1100);

	// ssl cert bypass
	if (params.ssl_cert_bypass) {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
	}

	var servers = {
		'DEV': 'http://gateway.dev.k8s.esquel.cloud/ESB/',
		'SIT': 'http://gateway.sit.k8s.esquel.cloud/ESB/',
		'UAT': 'http://gateway.uat.k8s.esquel.cloud/ESB/',
		'PROD': 'https://gateway.esquel.cloud/ESB/'
	}

	var url = servers[params.server] + params.action;
	print("Sending request to " + url + "\n");

	if (!params.dest) {
		stream.write({ complete: 2, code: 2, description: "Destination is missing" })
	}else {
		print("\nDestination: " + params.dest)
		request.setHeader('Jms-Destination', params.dest)
	}
	if (!params.token) {
		stream.write({ complete: 3, code: 3, description: "User token is missing" })
	}else {
		print("\nSet Authorization with Bearer")
		//start request to ESB server
		request.setHeader('Authorization', 'Bearer ' + params.token)
	}

	request.setHeader('Cache-Control','no-cache')

	// follow redirects
	// request.setFollow(32);

	var opts = {
		method: 'POST'
	};


	// post data
	print("\nPOST Data:\n" + params.data.trim() + "\n");
	opts.data = Buffer.from(params.data.trim() || '');

	// matching
	var success_match = new RegExp(params.success_match || '.*');
	var error_match = new RegExp(params.error_match || '(?!)');

	// send request
	request.request(url, opts, function (err, resp, data, perf) {
		// HTTP code out of success range = error
		if (!err && ((resp.statusCode < 200) || (resp.statusCode >= 400))) {
			err = new Error("HTTP " + resp.statusCode + " " + resp.statusMessage);
			err.code = resp.statusCode;
		}

		// successmatch?  errormatch?
		var text = data ? data.toString() : '';
		if (!err) {
			if (text.match(error_match)) {
				err = new Error("Response contains error match: " + params.error_match);
			}
			else if (!text.match(success_match)) {
				err = new Error("Response missing success match: " + params.success_match);
			}
		}

		// start building cronicle JSON update
		var update = {
			complete: 1
		};
		if (err) {
			update.code = err.code || 1;
			update.description = err.message || err;
		}
		else {
			update.code = 0;
			update.description = "Success (HTTP " + resp.statusCode + " " + resp.statusMessage + ")";
		}

		print("\n" + update.description + "\n");

		// add raw response headers into table
		if (resp && resp.rawHeaders) {
			var rows = [];
			print("\nResponse Headers:\n");

			for (var idx = 0, len = resp.rawHeaders.length; idx < len; idx += 2) {
				rows.push([resp.rawHeaders[idx], resp.rawHeaders[idx + 1]]);
				print(resp.rawHeaders[idx] + ": " + resp.rawHeaders[idx + 1] + "\n");
			}

			update.table = {
				title: "HTTP Response Headers",
				header: ["Header Name", "Header Value"],
				rows: rows.sort(function (a, b) {
					return a[0].localeCompare(b[0]);
				})
			};
		}

		// add raw response content, if text (and not too long)
		if (text && resp.headers['content-type'] && resp.headers['content-type'].match(/(text|javascript|json|css|html)/i)) {
			print("\nRaw Response Content:\n" + text.trim() + "\n");

			if (text.length < 32768) {
				update.html = {
					title: "Raw Response Content",
					content: "<pre>" + text.replace(/</g, '&lt;').trim() + "</pre>"
				};
			}
		}

		if (perf) {
			// passthru perf to cronicle
			update.perf = perf.metrics();
			print("\nPerformance Metrics: " + perf.summarize() + "\n");
		}

		stream.write(update);
	});
});
