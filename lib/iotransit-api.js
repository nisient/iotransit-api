#!/usr/bin/env node
/**
 * This is the API module to facilitate connection to the nisient IoTransit application suite.
 *
 * @module iotransit-api.js
 * @version 2.0.0
 * @file iotransitagent.js
 * @copyright nisient pty. ltd. 2019
 * @license
 * MIT License
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const EventEmitter = require('events');
const WebSocketClient = require('websocket').client;

const AUTH_USER = 'ext';
const AUTH_PASS = 'external';
const APPBRIDGE_URI = '127.0.0.1';
const APPBRIDGE_PORT = 10032;
const APPBRIDGE_SUBPROTOCOL = 'ab.iotransit.net';
const APPBRIDGE_ORIGIN = 'appBridge';
const CONTROLPLANE_URI = '127.0.0.1';
const CONTROLPLANE_PORT = 10022;
const CONTROLPLANE_SUBPROTOCOL = 'cp.iotransit.net';
const CONTROLPLANE_ORIGIN = 'control';
const AUTO_RECONNECT = true;
const RECONNECTION_TIMER = 5000;
const SECURE_WEBSOCKET = false;
const EMIT_EVENTS_AS_CP = false;

class IoTransit extends EventEmitter {

	constructor (options) {
		// the constructor accepts either a string ('appletId'), or an object that must include the appletId key, plus any
		// other of the options that require changing from default values.
		super();
		if (options === null || options === undefined) {
			throw new Error('mandatory appletId not passed to constructor');
		} else if (typeof options === 'object') {
			this.options = options;
			if (!this.options.hasOwnProperty('appletId')) throw new Error('mandatory appletId not provided in config');
		} else if (typeof options === 'string') {
			this.options = {};
			this.options.appletId = options;
		}
		if (!this.options.hasOwnProperty('accepts')) {
			this.options.acceptTags = [this.options.appletId];
		} else {
			if (!Array.isArray(this.options.accepts) && typeof this.options.accepts === 'string') {
				this.options.acceptTags = [this.options.accepts];
			} else if (Array.isArray(this.options.accepts)) {
				this.options.acceptTags = this.options.accepts;
			}
		}
		this.options.authUser = this.options && this.options.authUser || AUTH_USER;
		this.options.authPass = this.options && this.options.authPass || AUTH_PASS;
		this.options.appBridgeUri = this.options && this.options.appBridgeUri || APPBRIDGE_URI;
		this.options.appBridgePort = this.options && this.options.appBridgePort || APPBRIDGE_PORT;
		this.options.appBridgeSubProtocol = this.options && this.options.appBridgeSubProtocol || APPBRIDGE_SUBPROTOCOL;
		this.options.appBridgeOrigin = this.options && this.options.appBridgeOrigin || APPBRIDGE_ORIGIN;
		this.options.controlPlaneUri = this.options && this.options.controlPlaneUri || CONTROLPLANE_URI;
		this.options.controlPlanePort = this.options && this.options.controlPlanePort || CONTROLPLANE_PORT;
		this.options.controlPlaneSubProtocol = this.options && this.options.controlPlaneSubProtocol || CONTROLPLANE_SUBPROTOCOL;
		this.options.controlPlaneOrigin = this.options && this.options.controlPlaneOrigin || CONTROLPLANE_ORIGIN;
		this.options.autoReconnect = this.options && this.options.hasOwnProperty('autoReconnect') ? this.options.autoReconnect : AUTO_RECONNECT;
		this.options.reconnectionTimer = this.options && this.options.reconnectionTimer || RECONNECTION_TIMER;
		this.options.secureWebSocket = this.options && this.options.hasOwnProperty('secureWebSocket') ? this.options.secureWebSocket : SECURE_WEBSOCKET;
		this.options.emitEventsAsCP = this.options && this.options.hasOwnProperty('emitEventsAsCP') ? this.options.emitEventsAsCP : EMIT_EVENTS_AS_CP;
		this.controlPlaneConnected = false;
		this.appBridgeConnected = false;
		this.authDevice = '';
		this.authDomain = '';
		this.authenticated = false;
		this.sn = '';
		this.s2 = '';
	}
	
	connect () {
		// control plane connection
		var webSocketPrefix = 'ws://';
		if (this.options.secureWebSocket) {webSocketPrefix = 'wss://';}
		this.cp = new WebSocketClient();
		this.cp.connect(webSocketPrefix + this.options.controlPlaneUri + ':' + this.options.controlPlanePort + '/', this.options.controlPlaneSubProtocol, this.options.controlPlaneOrigin);
		this.cp.on('connectFailed', (err) => {
			this.controlPlaneConnected = false;
			this.emit('connectionFailed', err.toString());
			if (this.options.autoReconnect) {
				setTimeout(() => {
					this.cp.connect(webSocketPrefix + this.options.controlPlaneUri + ':' + this.options.controlPlanePort + '/', this.options.controlPlaneSubProtocol, this.options.controlPlaneOrigin);
				}, this.options.reconnectionTimer);
			}
		});
		this.cp.on('connect', (connection) => {
			connection.sendUTF(JSON.stringify({t: 'authapp', p: {user: this.options.authUser, pass: this.options.authPass, accept: this.options.acceptTags}}));
			connection.on('error', function (err) {
				this.emit('connectionError', err.toString());
			});
			connection.on('close', () => {
				this.controlPlaneConnected = false;
				this.emit('connectionClose', 'control plane connection closed');
				if (this.options.autoReconnect) {
					setTimeout(() => {
						this.cp.connect(webSocketPrefix + this.options.controlPlaneUri + ':' + this.options.controlPlanePort + '/', this.options.controlPlaneSubProtocol, this.options.controlPlaneOrigin);
					}, this.options.reconnectionTimer);
				}
			});
			this.cp.connection = connection;
			this.controlPlaneConnected = true;
			this.emit('connection', 'control plane connected');
			connection.on('message', (message) => {
				if (message.type === 'utf8') {
					var rcvMsg = JSON.parse(message.utf8Data);
					switch (rcvMsg.t) {
						case 'evt':
							if (this.options.emitEventsAsCP) {
								this.emit('cpMessage', rcvMsg);
							} else {
								this.emit(rcvMsg.p.cmd, {args: rcvMsg.p.args, dto: rcvMsg.p.dto});
							}
							break;
						default:
							if (this.options.acceptTags.indexOf(rcvMsg.t) !== -1 || rcvMsg.t === 'all') {
								switch (rcvMsg.p.cmd) {
									case 'loglevels':
										break;
									case 'setconfig':
										for (var o in rcvMsg.p) {
											if (rcvMsg.p.hasOwnProperty(o) && o !== 'cmd') {
												this[o] = rcvMsg.p[o];
											}
										}
										break;
									default:
										break;
								}
								this.emit('cpMessage', rcvMsg);
							}
							break;
					}
				} else if (message.type === 'binary') {
					// binary messages not currently enabled for the API
					console.log('control plane client received a binary of ' + message.binaryData.length + ' bytes');
				}
			});
		});
		// app bridge connection
		this.ab = new WebSocketClient();
		this.ab.connect(webSocketPrefix + this.options.appBridgeUri + ':' + this.options.appBridgePort + '/', this.options.appBridgeSubProtocol, this.options.appBridgeOrigin);
		this.ab.on('connectFailed', (err) => {
			this.appBridgeConnected = false;
			this.emit('connectionFailed', 'app bridge ' + err.toString());
			if (this.options.autoReconnect) {
				setTimeout(() => {
					this.ab.connect(webSocketPrefix + this.options.appBridgeUri + ':' + this.options.appBridgePort + '/', this.options.appBridgeSubProtocol, this.options.appBridgeOrigin);
				}, this.options.reconnectionTimer);
			}
		});
		this.ab.on('connect', (connection) => {
			connection.sendUTF(JSON.stringify({t: 'authapp', p: {user: this.options.authUser, pass: this.options.authPass, accept: this.options.acceptTags}}));
			connection.on('error', function (err) {
				this.emit('connectionError', 'app bridge ' + err.toString());
			});
			connection.on('close', () => {
				this.appBridgeConnected = false;
				this.emit('connectionClose', 'app bridge connection closed');
				if (this.options.autoReconnect) {
					setTimeout(() => {
						this.ab.connect(webSocketPrefix + this.options.appBridgeUri + ':' + this.options.appBridgePort + '/', this.options.appBridgeSubProtocol, this.options.appBridgeOrigin);
					}, this.options.reconnectionTimer);
				}
			});
			this.ab.connection = connection;
			this.appBridgeConnected = true;
			this.emit('connection', 'app bridge connected');
			connection.on('message', (message) => {
				if (message.type === 'utf8') {
					var rcvMsg = JSON.parse(message.utf8Data);
					switch (rcvMsg.t) {
						case 'authaccept':
							this.sn = rcvMsg.sn;
							this.s2 = rcvMsg.s2;
							this.authenticated = true;
							this.emit('authenticated', 'app bridge authenticated');
							break;
						default:
							this.emit('abMessage', rcvMsg);
							break;
					}
				} else if (message.type === 'binary') {
					// binary messages not currently enabled for the API
					console.log('app bridge client received a binary of ' + message.binaryData.length + ' bytes');
				}
			});
		});
	}
	
	disconnect () {
		// force disconnection of either of the control plane or app bridge connections.  If the autoReconnect option is set, they will
		// automatically reconnect.  If not, calling this ensures that all API connections are disconnected.
		if (this.controlPlaneConnected) {
			this.cp.connection.drop();
		}
		if (this.appBridgeConnected) {
			this.ab.connection.drop();
		}
	}
	
	sendCP (sendMsg) {
		// send to control plane
		if (this.cp.connection !== undefined && this.cp.connection.connected) {
			this.cp.connection.send(JSON.stringify(sendMsg));
		} else {
			this.emit('sendError', 'control plane not connected');
		}
	}
 
 	sendAB (sendMsg) {
 		// send to app bridge
		if (this.ab.connection !== undefined && this.ab.connection.connected) {
			this.ab.connection.send(JSON.stringify(sendMsg));
		} else {
			this.emit('sendError', 'app bridge not connected');
		}
	}
 
}

module.exports = IoTransit;
