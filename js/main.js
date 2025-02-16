const localRef = document.querySelector("#local-video");
const localRefPreview = document.querySelector("#local-video-preview");
const remoteRef = document.querySelector("#remote-video");

const remoteMuteVideo = document.querySelector("#remoteMuteVideo");
const remoteMuteAudio = document.querySelector("#remoteMuteAudio");

const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-button");

let peer, remoteUsers;

// Получаем call_id из URL
const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get("call_id");

const socket = io("https://ifinduway-server-a38a.twc1.net", {
  query: {
    call_id: callId,
  },
});

let stream, devices;

let isVideoStart = true;
let isAudioStart = true;
let isShowChat = false;

if (isVideoStart) {
  document
    .getElementById("toggle-camera")
    .classList.remove("disable-settings-button");
} else {
  document
    .getElementById("toggle-camera")
    .classList.add("disable-settings-button");
}

if (isAudioStart) {
  document
    .getElementById("toggle-mic")
    .classList.remove("disable-settings-button");
} else {
  document
    .getElementById("toggle-mic")
    .classList.add("disable-settings-button");
}

const previewInit = async () => {
  devices = await navigator.mediaDevices?.enumerateDevices();

  const hasVideoInput = devices?.some((device) => device.kind === "videoinput");
  const hasAudioInput = devices?.some((device) => device.kind === "audioinput");

  if (!hasVideoInput) {
    console.log("lel hasVideoInput:", hasVideoInput);
    const cams = document.querySelectorAll("#toggle-camera");

    cams.forEach((item) => {
      item.classList.add("disable-settings-button");
      item.disabled = true;
    });
    document.querySelector("#local-video").style.display = "none";

    socket.emit("toggle-camera", false);
    console.log("CAMERA IS NOT AVAILABLE");
  }

  if (!hasAudioInput) {
    console.log("kek hasVideoInput:", hasAudioInput);
    const cams = document.querySelectorAll("#toggle-mic");

    cams.forEach((item) => {
      item.classList.add("disable-settings-button");
      item.disabled = true;
    });
    document.querySelector("#local-video").style.display = "none";

    // Отправка сообщения на сервер о состоянии микрофона
    socket.emit("toggle-mic", false);

    console.log("MICROPHONE IS NOT AVAILABLE");
  }

  stream = await navigator.mediaDevices?.getUserMedia({
    video: hasVideoInput,
    audio: hasAudioInput,
  });

  localRefPreview.srcObject = stream;
  localRef.srcObject = stream;
};

const initializeConnection = () => {
  socket.on("signal", (data) => {
    peer.signal(data);
  });

  socket.on("end-call", () => {
    // убираем иконки
    remoteMuteAudio.style.display = "none";

    remoteMuteVideo.style.display = "none";
    // Останавливаем текущее соединение
    peer.destroy();

    remoteRef.srcObject.getTracks().forEach((track) => track.stop());

    // Инициализируем новое соединение
    startVideoChat();
  });

  // Добавляем обработчик события beforeunload
  window.addEventListener("beforeunload", function (event) {
    // Вызываем функцию endCall(), чтобы завершить вызов перед перезагрузкой/закрытием страницы
    endCall();
  });
};

const startVideoChat = async () => {
  localRefPreview.srcObject = null;
  try {
    peer = new SimplePeer({
      initiator: true,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // Google STUN сервер
        ],
      },
    });

    peer.on("signal", (data) => {
      socket.emit("signal", data);
    });

    peer.on("stream", (stream) => {
      remoteRef.srcObject = stream;
    });

    // localRef.srcObject = stream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
};

async function callUser() {
  try {
    initializeConnection();
    startVideoChat();
    document.getElementById("live").style.display = "block";
  } catch (e) {
    if (e.name === "NotFoundError") {
      alert(
        "Невозможно запустить консультацию, т.к микрофон/камера не найдены или доступ к ним запрещен"
      );
    }
  }
}

function endCall() {
  // Отправляем событие на сервер о завершении вызова
  socket.emit("end-call");

  // Останавливаем видео и аудио на локальном и удалённом видеопотоках
  localRef.srcObject?.getTracks().forEach((track) => track.stop());
  remoteRef.srcObject?.getTracks().forEach((track) => track.stop());

  // Сбрасываем источники локального и удалённого видеопотоков
  localRef.srcObject = null;
  remoteRef.srcObject = null;

  // Скрываем элементы интерфейса для видеовызова
  document.querySelector("#live").style.display = "none";

  // Удаляем обработчики событий
  socket.off("signal");
  socket.off("mute-audio");
  socket.off("mute-video");
  socket.off("init-states");
  socket.off("end-call");

  peer.destroy();

  // Очищаем список удалённых пользователей
  remoteUsers = [];
  window.location.reload();
}

function toggleCamera() {
  tracks = localRef.srcObject.getTracks();

  tracks.forEach((track) => {
    if (track.readyState === "live" && track.kind === "video") {
      if (isVideoStart) {
        track.enabled = false;
      } else {
        track.enabled = true;
      }
    }
  });

  isVideoStart = !isVideoStart;

  const cams = document.querySelectorAll("#toggle-camera");
  if (isVideoStart) {
    cams.forEach((item) => item.classList.remove("disable-settings-button"));
    document.querySelector("#local-video").style.display = "block";
  } else {
    cams.forEach((item) => item.classList.add("disable-settings-button"));
    document.querySelector("#local-video").style.display = "none";
  }

  // Отправка сообщения на сервер о состоянии камеры
  socket.emit("toggle-camera", isVideoStart);
}

function toggleMic() {
  tracks = localRef.srcObject.getTracks();

  tracks.forEach((track) => {
    if (track.readyState === "live" && track.kind === "audio") {
      if (isAudioStart) {
        track.enabled = false;
      } else {
        track.enabled = true;
      }
    }
  });
  isAudioStart = !isAudioStart;

  const mics = document.querySelectorAll("#toggle-mic");
  console.log(mics);
  if (isAudioStart) {
    mics.forEach((item) => item.classList.remove("disable-settings-button"));
  } else {
    mics.forEach((item) => item.classList.add("disable-settings-button"));
  }

  // Отправка сообщения на сервер о состоянии микрофона
  socket.emit("toggle-mic", isAudioStart);

  console.log("TOGGLE MIC: ", isAudioStart);
}

function toggleChat() {
  isShowChat = !isShowChat;

  const chat = document.querySelector("#chat-container");
  if (!isShowChat) {
    chat.classList.remove("chat-showed");
  } else {
    chat.classList.add("chat-showed");
  }
}

previewInit();

// Обработчик события приема состояния микрофона от сервера
socket.on("toggle-mic", (isAudioStart) => {
  console.log("isAudioStart: ", isAudioStart);
  // Обновление интерфейса на основе полученного состояния микрофона
  if (!isAudioStart) {
    remoteMuteAudio.style.display = "block";
  } else {
    remoteMuteAudio.style.display = "none";
  }
});
// Обработчик события приема состояния камеры от сервера
socket.on("toggle-camera", (isVideoStart) => {
  console.log("isVideoStart: ", isVideoStart);
  // Обновление интерфейса на основе полученного состояния микрофона
  if (!isVideoStart) {
    remoteMuteVideo.style.display = "block";
  } else {
    remoteMuteVideo.style.display = "none";
  }
});

// чат

sendButton.addEventListener("click", sendMessage);

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const messageText = chatInput.value.trim();
  if (messageText === "") return;

  const message = {
    text: messageText,
  };

  // Отправляем сообщение на сервер
  socket.emit("send-message", message);

  chatInput.value = "";
}

// Получение истории чата от сервера
socket.on("chat-history", (messages) => {
  chatMessages.innerHTML = ""; // Очищаем окно чата
  messages.forEach((message) => addMessageToChat(message));
});

// Получение новых сообщений от других пользователей
socket.on("receive-message", (message) => {
  addMessageToChat(message);
});

function addMessageToChat(message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("chat-message");

  // Создаем отдельный div для времени
  const timeElement = document.createElement("div");
  timeElement.classList.add("chat-time");
  timeElement.textContent = `[${new Date(message.timestamp).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  )}]`;

  // Создаем отдельный div для текста сообщения
  const textElement = document.createElement("div");
  textElement.classList.add("chat-text");
  textElement.textContent = `${message.senderId === socket.id ? "Вы" : "Другой"
    }: ${message.text}`;

  // Добавляем элементы в основной элемент сообщения
  messageElement.appendChild(timeElement);
  messageElement.appendChild(textElement);

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}



// ДЕМКА ЭКРАНА

let isSharingScreen = false; // Флаг для отслеживания состояния демонстрации
let screenStream = null; // Поток экрана

// Включение демонстрации экрана
function startScreenShare() {
  navigator.mediaDevices
    .getDisplayMedia({ video: true, audio: false }) // Захватываем только видео с экрана
    .then((screenStream) => {
      // Сохраняем аудиодорожку из исходного потока (микрофон)
      const audioTracks = stream.getAudioTracks();

      // Создаем новый поток, объединяющий видео с экрана и аудио из микрофона
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(), // Видео с экрана
        ...audioTracks, // Аудио из микрофона
      ]);

      // Останавливаем старый поток
      // stream.getTracks().forEach(track => track.stop());

      // Устанавливаем новый объединенный поток
      localRef.srcObject = combinedStream;

      // Заменяем поток в WebRTC соединении
      peer.removeStream(stream); // Удаляем старый поток
      peer.addStream(combinedStream); // Добавляем новый поток

      // Сохраняем текущий поток
      stream = combinedStream;

      // Уведомляем второго пользователя о начале демонстрации экрана
      socket.emit("start-screen-share", { peerId: peer.id });

      // Управление состоянием кнопок
      document.getElementById("start-screen-share").disabled = true; // Отключаем кнопку "Начать демонстрацию экрана"
      document.getElementById("stop-screen-share").disabled = false; // Включаем кнопку "Остановить демонстрацию экрана"

      // Добавляем обработчик остановки демонстрации экрана
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    })
    .catch((error) => {
      console.error("Error accessing screen share:", error);
    });
}

function stopScreenShare() {
  if (stream) {
    // Останавливаем текущий поток экрана
    stream.getTracks().forEach(track => track.stop());

    // Возвращаемся к видеокамере и микрофону
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((cameraStream) => {
        // Устанавливаем новый поток (камера + микрофон)
        localRef.srcObject = cameraStream;

        // Заменяем поток в WebRTC соединении
        peer.removeStream(stream); // Удаляем старый поток
        peer.addStream(cameraStream); // Добавляем новый поток

        // Сохраняем текущий поток
        stream = cameraStream;

        // Уведомляем второго пользователя о завершении демонстрации экрана
        socket.emit("stop-screen-share", { peerId: peer.id });

        // Управление состоянием кнопок
        document.getElementById("start-screen-share").disabled = false; // Включаем кнопку "Начать демонстрацию экрана"
        document.getElementById("stop-screen-share").disabled = true; // Отключаем кнопку "Остановить демонстрацию экрана"
      })
      .catch((error) => {
        console.error("Error accessing media devices:", error);
      });
  }
}

socket.on("stop-screen-share", (data) => {
  console.log("Screen sharing stopped by peer:", data.peerId);

  // // Подключаемся обратно к видеокамере через PeerJS
  // const connection = peer.connect(data.peerId);

  // connection.on("stream", (cameraStream) => {
  //   const remoteVideo = document.getElementById("remote-video");
  //   remoteVideo.srcObject = cameraStream;
  // });
});
