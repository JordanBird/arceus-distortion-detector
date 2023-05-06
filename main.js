const video = document.querySelector('video');
const canvas = document.querySelector("canvas");

let stream;
let recorder;

let isWatching = false;

function initEvents() {
  $('.detect-toggle').on('click', async function (e) {
    e.preventDefault();

    if (!isWatching) {
      // Prompt the user to share their screen.
      stream = await navigator.mediaDevices.getDisplayMedia();
      recorder = new MediaRecorder(stream);
      // Preview the screen locally.
      video.srcObject = stream;
    
      startWatching();

      $(this).html("Stop Detecting");
    }
    else {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      
      stopWatching();

      $(this).html("Start Detecting");
    }
  });

  $('.dimiss-alert').on('click', function (e) {
    e.preventDefault();

    $('.detector-alert').hide();
  });
}

function doTesStream() {
  if (!isWatching) {
    return;
  }

  Tesseract
    .recognize(canvas, 'eng', { logger: m => console.log(m) })
    .then(({ data: { text } }) => {
      console.log(text);

      if (isSpaceTime(text)) {
        $('.detector-alert').show();
      }

      if (isWatching) {
        watchTick();
      }
  })
}

function startWatching() {
  isWatching = true;
  watchTick();
}

function stopWatching() {
  isWatching = false;
}

function watchTick() {
  new ImageCapture(stream.getVideoTracks()[0]).grabFrame()
    .then((imageBitmap) => {
      console.log("Grabbed frame:", imageBitmap);
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      canvas.getContext("2d").drawImage(imageBitmap, 0, 0);
      canvas.classList.remove("hidden");

      doTesStream();
    })
    .catch((error) => {
      console.error("grabFrame() error: ", error);
    });
}

function isSpaceTime(match) {
  return match.toUpperCase().indexOf("SPACE") > -1 && match.toUpperCase().indexOf("TIME") > -1;
}

function init() {
  initEvents();
}

$(document).ready(init);