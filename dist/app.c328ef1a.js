// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"app.js":[function(require,module,exports) {
/* eslint-env browser */

/* global Webex */

/* eslint-disable camelcase */

/* eslint-disable max-nested-callbacks */

/* eslint-disable no-alert */

/* eslint-disable no-console */

/* eslint-disable require-jsdoc */

/* eslint-disable arrow-body-style */
// Declare some globals that we'll need throughout
let webex; // First, let's wire our form fields up to localStorage so we don't have to
// retype things everytime we reload the page.

["access-token", "invitee"].forEach(id => {
  const el = document.getElementById(id);
  el.value = localStorage.getItem(id);
  el.addEventListener("change", event => {
    localStorage.setItem(id, event.target.value);
  });
}); // There's a few different events that'll let us know we should initialize
// Webex and start listening for incoming calls, so we'll wrap a few things
// up in a function.

function connect() {
  return new Promise(resolve => {
    if (!webex) {
      // eslint-disable-next-line no-multi-assign
      webex = window.webex = Webex.init({
        config: {
          logger: {
            level: "debug"
          },
          meetings: {
            reconnection: {
              enabled: true
            }
          } // Any other sdk config we need

        },
        credentials: {
          access_token: document.getElementById("access-token").value
        }
      });
    } // Listen for added meetings


    webex.meetings.on("meeting:added", addedMeetingEvent => {
      if (addedMeetingEvent.type === "INCOMING") {
        const addedMeeting = addedMeetingEvent.meeting; // Acknowledge to the server that we received the call on our device

        addedMeeting.acknowledge(addedMeetingEvent.type).then(() => {
          if (confirm("Answer incoming call")) {
            joinMeeting(addedMeeting);
            bindMeetingEvents(addedMeeting);
          } else {
            addedMeeting.decline();
          }
        });
      }
    }); // Register our device with Webex cloud

    if (!webex.meetings.registered) {
      webex.meetings.register() // Sync our meetings with existing meetings on the server
      .then(() => webex.meetings.syncMeetings()).then(() => {
        // This is just a little helper for our selenium tests and doesn't
        // really matter for the example
        document.body.classList.add("listening");
        document.getElementById("connection-status").innerText = "connected"; // Our device is now connected

        resolve();
      }) // This is a terrible way to handle errors, but anything more specific is
      // going to depend a lot on your app
      .catch(err => {
        console.error(err); // we'll rethrow here since we didn't really *handle* the error, we just
        // reported it

        throw err;
      });
    } else {
      // Device was already connected
      resolve();
    }
  });
} // Similarly, there are a few different ways we'll get a meeting Object, so let's
// put meeting handling inside its own function.


function bindMeetingEvents(meeting) {
  // call is a call instance, not a promise, so to know if things break,
  // we'll need to listen for the error event. Again, this is a rather naive
  // handler.
  meeting.on("error", err => {
    console.error(err);
  }); // Handle media streams changes to ready state

  meeting.on("media:ready", media => {
    if (!media) {
      return;
    }

    if (media.type === "local") {
      document.getElementById("self-view").srcObject = media.stream;
    }

    if (media.type === "remoteVideo") {
      document.getElementById("remote-view-video").srcObject = media.stream;
    }

    if (media.type === "remoteAudio") {
      document.getElementById("remote-view-audio").srcObject = media.stream;
    }
  }); // Handle media streams stopping

  meeting.on("media:stopped", media => {
    // Remove media streams
    if (media.type === "local") {
      document.getElementById("self-view").srcObject = null;
    }

    if (media.type === "remoteVideo") {
      document.getElementById("remote-view-video").srcObject = null;
    }

    if (media.type === "remoteAudio") {
      document.getElementById("remote-view-audio").srcObject = null;
    }
  }); // Update participant info

  meeting.members.on("members:update", delta => {
    const {
      full: membersData
    } = delta;
    const memberIDs = Object.keys(membersData);
    memberIDs.forEach(memberID => {
      const memberObject = membersData[memberID]; // Devices are listed in the memberships object.
      // We are not concerned with them in this demo

      if (memberObject.isUser) {
        if (memberObject.isSelf) {
          document.getElementById("call-status-local").innerText = memberObject.status;
        } else {
          document.getElementById("call-status-remote").innerText = memberObject.status;
        }
      }
    });
  }); // Of course, we'd also like to be able to end the call:

  document.getElementById("hangup").addEventListener("click", () => {
    meeting.leave();
  });
} // Join the meeting and add media


function joinMeeting(meeting) {
  // Get constraints
  const constraints = {
    audio: document.getElementById("constraints-audio").checked,
    video: document.getElementById("constraints-video").checked
  };
  return meeting.join().then(() => {
    return meeting.getSupportedDevices({
      sendAudio: constraints.audio,
      sendVideo: constraints.video
    }).then(({
      sendAudio,
      sendVideo
    }) => {
      const mediaSettings = {
        receiveVideo: constraints.video,
        receiveAudio: constraints.audio,
        receiveShare: false,
        sendShare: false,
        // chauncy changes
        sendVideo: true,
        sendAudio: true
      };
      return meeting.getMediaStreams(mediaSettings).then(mediaStreams => {
        const [localStream, localShare] = mediaStreams;
        meeting.addMedia({
          localShare,
          localStream,
          mediaSettings
        });
      });
    });
  });
} // Now, let's set up incoming call handling


document.getElementById("credentials").addEventListener("submit", event => {
  // let's make sure we don't reload the page when we submit the form
  event.preventDefault(); // The rest of the incoming call setup happens in connect();

  connect();
}); // And finally, let's wire up dialing

document.getElementById("dialer").addEventListener("submit", event => {
  // again, we don't want to reload when we try to dial
  event.preventDefault();
  const destination = document.getElementById("invitee").value; // we'll use `connect()` (even though we might already be connected or
  // connecting) to make sure we've got a functional webex instance.

  connect().then(() => {
    // Create the meeting
    return webex.meetings.create(destination).then(meeting => {
      // Call our helper function for binding events to meetings
      bindMeetingEvents(meeting);
      return joinMeeting(meeting);
    });
  }).catch(error => {
    // Report the error
    console.error(error); // Implement error handling here
  });
}); // Use enumerateDevices API to check/uncheck and disable checkboxex (if necessary)
// for Audio and Video constraints

window.addEventListener("load", () => {
  // Get elements from the DOM
  const audio = document.getElementById("constraints-audio");
  const video = document.getElementById("constraints-video"); // Get access to hardware source of media data
  // For more info about enumerateDevices: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices

  if (navigator && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      // Check if navigator has audio
      const hasAudio = devices.filter(device => device.kind === "audioinput").length > 0; // Check/uncheck and disable checkbox (if necessary) based on the results from the API

      audio.checked = hasAudio;
      audio.disabled = !hasAudio; // Check if navigator has video

      const hasVideo = devices.filter(device => device.kind === "videoinput").length > 0; // Check/uncheck and disable checkbox (if necessary) based on the results from the API

      video.checked = hasVideo;
      video.disabled = !hasVideo;
    }).catch(error => {
      // Report the error
      console.error(error);
    });
  } else {
    // If there is no media data, automatically uncheck and disable checkboxes
    // for audio and video
    audio.checked = false;
    audio.disabled = true;
    video.checked = false;
    video.disabled = true;
  }
});
},{}],"../../Users/xun/AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "59442" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else if (location.reload) {
        // `location` global exists in a web worker context but lacks `.reload()` function.
        location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["../../Users/xun/AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js","app.js"], null)
//# sourceMappingURL=/app.c328ef1a.js.map