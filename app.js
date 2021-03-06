/* eslint-env browser */

/* global Webex */

/* eslint-disable camelcase */
/* eslint-disable max-nested-callbacks */
/* eslint-disable no-alert */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
/* eslint-disable arrow-body-style */

// Declare some globals that we'll need throughout
let webex;

// First, let's wire our form fields up to localStorage so we don't have to
// retype things everytime we reload the page.

["access-token", "invitee"].forEach((id) => {
  const el = document.getElementById(id);

  el.value = localStorage.getItem(id);
  el.addEventListener("change", (event) => {
    localStorage.setItem(id, event.target.value);
  });
});

// There's a few different events that'll let us know we should initialize
// Webex and start listening for incoming calls, so we'll wrap a few things
// up in a function.
function connect() {
  return new Promise((resolve) => {
    if (!webex) {
      // eslint-disable-next-line no-multi-assign
      webex = window.webex = Webex.init({
        config: {
          logger: {
            level: "debug",
          },
          meetings: {
            reconnection: {
              enabled: true,
            },
          },
          // Any other sdk config we need
        },
        credentials: {
          access_token: document.getElementById("access-token").value,
        },
      });
    }

    // Listen for added meetings
    webex.meetings.on("meeting:added", (addedMeetingEvent) => {
      if (addedMeetingEvent.type === "INCOMING") {
        const addedMeeting = addedMeetingEvent.meeting;

        // Acknowledge to the server that we received the call on our device
        addedMeeting.acknowledge(addedMeetingEvent.type).then(() => {
          if (confirm("Answer incoming call")) {
            joinMeeting(addedMeeting);
            bindMeetingEvents(addedMeeting);
          } else {
            addedMeeting.decline();
          }
        });
      }
    });

    // Register our device with Webex cloud
    if (!webex.meetings.registered) {
      webex.meetings
        .register()
        // Sync our meetings with existing meetings on the server
        .then(() => webex.meetings.syncMeetings())
        .then(() => {
          // This is just a little helper for our selenium tests and doesn't
          // really matter for the example
          document.body.classList.add("listening");
          document.getElementById("connection-status").innerText = "connected";
          // Our device is now connected
          resolve();
        })
        // This is a terrible way to handle errors, but anything more specific is
        // going to depend a lot on your app
        .catch((err) => {
          console.error(err);
          // we'll rethrow here since we didn't really *handle* the error, we just
          // reported it
          throw err;
        });
    } else {
      // Device was already connected
      resolve();
    }
  });
}

// Similarly, there are a few different ways we'll get a meeting Object, so let's
// put meeting handling inside its own function.
function bindMeetingEvents(meeting) {
  // call is a call instance, not a promise, so to know if things break,
  // we'll need to listen for the error event. Again, this is a rather naive
  // handler.
  meeting.on("error", (err) => {
    console.error(err);
  });

  // Handle media streams changes to ready state
  meeting.on("media:ready", (media) => {
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
  });

  // Handle media streams stopping
  meeting.on("media:stopped", (media) => {
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
  });

  // Update participant info
  meeting.members.on("members:update", (delta) => {
    const { full: membersData } = delta;
    const memberIDs = Object.keys(membersData);

    memberIDs.forEach((memberID) => {
      const memberObject = membersData[memberID];

      // Devices are listed in the memberships object.
      // We are not concerned with them in this demo
      if (memberObject.isUser) {
        if (memberObject.isSelf) {
          document.getElementById("call-status-local").innerText =
            memberObject.status;
        } else {
          document.getElementById("call-status-remote").innerText =
            memberObject.status;
        }
      }
    });
  });

  // Of course, we'd also like to be able to end the call:
  document.getElementById("hangup").addEventListener("click", () => {
    meeting.leave();
  });
}

// Join the meeting and add media
function joinMeeting(meeting) {
  // Get constraints
  const constraints = {
    audio: document.getElementById("constraints-audio").checked,
    video: document.getElementById("constraints-video").checked,
  };

  return meeting.join().then(() => {
    return meeting
      .getSupportedDevices({
        sendAudio: constraints.audio,
        sendVideo: constraints.video,
      })
      .then(({ sendAudio, sendVideo }) => {
        const mediaSettings = {
          receiveVideo: constraints.video,
          receiveAudio: constraints.audio,
          receiveShare: false,
          sendShare: false,
          // chauncy changes
          sendVideo: true,
          sendAudio: true,
        };

        return meeting.getMediaStreams(mediaSettings).then((mediaStreams) => {
          const [localStream, localShare] = mediaStreams;

          meeting.addMedia({
            localShare,
            localStream,
            mediaSettings,
          });
        });
      });
  });
}

// Now, let's set up incoming call handling
document.getElementById("credentials").addEventListener("submit", (event) => {
  // let's make sure we don't reload the page when we submit the form
  event.preventDefault();

  // The rest of the incoming call setup happens in connect();
  connect();
});

// And finally, let's wire up dialing
document.getElementById("dialer").addEventListener("submit", (event) => {
  // again, we don't want to reload when we try to dial
  event.preventDefault();

  const destination = document.getElementById("invitee").value;

  // we'll use `connect()` (even though we might already be connected or
  // connecting) to make sure we've got a functional webex instance.
  connect()
    .then(() => {
      // Create the meeting
      return webex.meetings.create(destination).then((meeting) => {
        // Call our helper function for binding events to meetings
        bindMeetingEvents(meeting);

        return joinMeeting(meeting);
      });
    })
    .catch((error) => {
      // Report the error
      console.error(error);

      // Implement error handling here
    });
});

// Use enumerateDevices API to check/uncheck and disable checkboxex (if necessary)
// for Audio and Video constraints
window.addEventListener("load", () => {
  // Get elements from the DOM
  const audio = document.getElementById("constraints-audio");
  const video = document.getElementById("constraints-video");

  // Get access to hardware source of media data
  // For more info about enumerateDevices: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
  if (
    navigator &&
    navigator.mediaDevices &&
    navigator.mediaDevices.enumerateDevices
  ) {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        // Check if navigator has audio
        const hasAudio =
          devices.filter((device) => device.kind === "audioinput").length > 0;

        // Check/uncheck and disable checkbox (if necessary) based on the results from the API
        audio.checked = hasAudio;
        audio.disabled = !hasAudio;

        // Check if navigator has video
        const hasVideo =
          devices.filter((device) => device.kind === "videoinput").length > 0;

        // Check/uncheck and disable checkbox (if necessary) based on the results from the API
        video.checked = hasVideo;
        video.disabled = !hasVideo;
      })
      .catch((error) => {
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
