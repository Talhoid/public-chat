var chatBox = document.querySelector(".chat-box");
var socket = io();
var input = document.getElementById("send-messages").children[0];
var button = document.getElementById("send-messages").children[1];
var messageGroup = document.getElementById("send-messages");
getUsername();


function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        const typingTimer = (new Date()).getTime();
        const timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

function addMessage(message) {
    document.getElementById("nothing-to-see").style.display = "none";
    var htmlString = `<div class="w-100 float-start text-light" data-messageid="${message.id}"><div class="border rounded-3 border-${message.username == username ? "primary" : "secondary"} p-4 bg-opacity-50${message.username == username ? " float-end" : ""} my-2" style="width: fit-content;"><strong><small>${message.username}</small></strong><br /><p class="mb-0">${message.content}</p></div></div>`;
    var messageElement = new DOMParser().parseFromString(htmlString, "text/html").body.firstChild;
    console.log("Adding message: ", message)
    chatBox.appendChild(messageElement);
}

function addMessages(messages) {
    messages.forEach(addMessage)
}

async function getMessages() {
    var messages = await fetch("./chat/messages/");
    messages = await messages.json();
    document.getElementById("chat-loader").remove();
    if (!messages.length) {
        document.getElementById("nothing-to-see").style.display = "block";
    }
    addMessages(messages);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function getUsername() {
    var username = await fetch("./username/");
    username = await username.json();
    if (username.error == "logged_out") {
        input.setAttribute("disabled", "")
        button.setAttribute("disabled", "")
        button.classList.add("disabled");
        messageGroup.tooltip = new bootstrap.Tooltip(messageGroup.parentElement, {title: "You must be logged in to chat.",  container:"body"});
        window.username = "";
    } else {
        username = username.username;
        window.username = username;
        document.getElementById("login-register").remove();
    }
    return username;
}

function sendMessage(content) {
    if (content) {
        fetch("/chat/add", {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                content: content
            })
        });
    }
}

input.addEventListener("keydown", (event) => {
    if (event.code === "Enter" && event.target.value) {
        console.log("down");
        button.click();
    }
});

button.addEventListener("click", (event) => {
    if (input.value) {
        sendMessage(input.value);
        input.value = "";
    }
});


socket.on("message", addMessage);

setInterval(function () {
    var zoom = detectZoom.device().toFixed(2);
    // console.info("Zoom: " + detectZoom.device().toFixed(2).toString())
    setTimeout(function () {
        if (detectZoom.device().toFixed(2) != zoom) {
            var realBox = document.body.appendChild(chatBox.cloneNode(false));
            realBox.style.visibility = "hidden";
            realBox.style.maxHeight = "";
            chatBox.style.maxHeight = getComputedStyle(realBox).height;
            realBox.remove();
        }
    }, 1)
}, 2);

var realBox = document.body.appendChild(chatBox.cloneNode(false));
realBox.style.visibility = "hidden";
realBox.style.maxHeight = "";
chatBox.style.maxHeight = getComputedStyle(realBox).height;
realBox.remove();
setTimeout(getMessages, 1500);