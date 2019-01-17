# iotransit-api
**iotransit-api** is a simple node.js wrapper for the IoTransit Client API for Core and Agent applications.  It extends node.js EventEmitter.

### Contents

# Install
	npm install --save iotransit-api

# Usage
## Constructor
### new IoTransit(options)
For the simplest of configuration using the default options, pass the appletId as a string to the constructor:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
```
where in this example, 'test' is the appletId and will be used to tag and route the messages throughout the IoTransit suite.
Default options:
```js
{
	authUser: 'ext',
	authPass: 'external',
	appBridgeUri: '127.0.0.1',
	appBridgePort: 10032,
	appBridgeSubProtocol: 'ab.iotransit.net',
	appBridgeOrigin: 'appBridge',
	controlPlaneUri: '127.0.0.1',
	controlPlanePort: 10022,
	controlPlaneSubProtocol: 'cp.iotransit.net',
	controlPlaneOrigin: 'control',
	autoReconnect: true,
	reconnectionTimer: 5000,
	secureWebSocket: false,
	emitEventsAsCP: false
}
```
If changes to any of these default options are required, then you can pass an object to the constructor.  If an object is passed, it must contain the appletId key otherwise an error will be thrown.  The constructor options object need only contain the specific options that require changing, plus the appletId:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit({appletId: 'test', reconnectionTimer: 6000, secureWebSocket: true);
```
where this example will use 'test' as the appletId for tagging and routing of the messages, but using secure WebSocket connections to the API and a reconnection timer of 6 seconds (6000 mS).

## Public API Methods

### connect
This function connects and authenticates to the app bridge and control plane of the IoTransit agent, and establishes the event emitters for both connection status and received messages.
```js
ioTransit.connect();
```

### disconnect
This function forces disconnection of either of the control plane or app bridge connections.  If the autoReconnect option is set, they will automatically reconnect.  If not, calling this ensures that all API connections are disconnected.
```js
ioTransit.disconnect();
```
### sendAB
This function sends messages to the app bridge (data plane).  It expects the IoTransit basic message structure of:
```js
{t: appletId, p: {payload}}
```
and passed as a JSON object to the function:
```js
ioTransit.sendAB({t: 'test', p: {cmd: 'dummy'}});
```

### sendCP
This function sends messages to the control pane.  It expects the IoTransit basic message structure of:
```js
{t: appletId, p: {payload}}
```
and passed as a JSON object to the function:
```js
ioTransit.sendCP({t: 'test', p: {cmd: 'dummy'}});
```

## Events
Listeners should be registered using:
```js
ioTransit.on(eventType, (event) => {...});
```
To list registered event listeners:
```js
console.log(ioTransit.eventNames());
```
The following events are emitted by the module:
* `'connection'`
* `'connectionFailed'`
* `'connectionError'`
* `'connectionClose'`
* `'sendError'`
* `'abMessage'`
* `'cpMessage'`
* `'error'`

### Event: `'connection'`
Emitted when either app bridge or control plane connections are established.
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('connection', (event) => {
	console.log('connection established: ' + JSON.stringify(event));
	// trigger post connection actions
});
ioTransit.connect();
```

### Event: `'connectionFailed'`
Emitted when either app bridge or control plane connections could not be established.
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('connectionFailed', (event) => {
	console.log('connection failed: ' + JSON.stringify(event));
	// typically autoReconnect will handle this
});
ioTransit.connect();
```

### Event: `'connectionError'`
Emitted when either app bridge or control plane connections receive errors.
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('connectionError', (event) => {
	console.log('connection error: ' + JSON.stringify(event));
	// handle error
});
ioTransit.connect();
```

### Event: `'connectionClose'`
Emitted when either app bridge or control plane connections are closed.
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('connectionClose', (event) => {
	console.log('connection closed: ' + JSON.stringify(event));
	// handle close
});
ioTransit.connect();
```

### Event: `'sendError'`
Emitted when there are errors in sending messages to either the app bridge or control plane, usually caused by the connection being unavailable (disconnected).
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('sendError', (event) => {
	console.log('message not sent: ' + JSON.stringify(event));
	// handle retransmission, possible reconnection (if not autoReconnect)
});
ioTransit.connect();
```

### Event: `'abMessage'`
Emitted when a message is received from the app bridge.
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('abMessage', (message) => {
	console.log(JSON.stringify(message));
	// process message
});
ioTransit.connect();
```

### Event: `'cpMessage'`
Emitted when a message is received from the control plane.
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('cpMessage', (message) => {
	console.log(JSON.stringify(message));
	// process message
});
ioTransit.connect();
```

### Event: `'error'`
> **Important:** You have to set `error` listener otherwise your app will throw an `Error` and exit if `error` event will occur (see: [Node.js Error events](https://nodejs.org/api/events.html#events_error_events))
Example:
```js
IoTransit = require('iotransitagent');
ioTransit = new IoTransit('test');
ioTransit.on('error', (event) => {
	console.log(JSON.stringify(event));
	// handle error
});
ioTransit.connect();
```

# License

[MIT](LICENSE)

