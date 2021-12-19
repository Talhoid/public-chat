function main() {
	var chatBox = document.querySelector(".chat-box");
	var socket = io();
	var input = document.getElementById("send-messages").children[0];
	var button = document.getElementById("send-messages").children[2];
	var messageGroup = document.getElementById("send-messages");
	var isTyping = false;
	var typersElement = document.getElementById("username-list");
	var typersMessage = document.getElementById("typing-message");
	var typersLoader = document.querySelector(".loader");
	var typers = [];
	var purgeBtn = document.getElementById("button-purge");
	var purgeSubmit = document.getElementById("purge-submit");
    var purgeModal = document.getElementById("purge-modal");
	purgeSubmit.addEventListener("click", event => {
		purge(purgeModal.querySelector('.modal-body').querySelector("select").value);
	});
	window.messagesList = [];
	const TYPING_TIMER_LENGTH = 1400;
	getInfo();

	function purge(type) {
		switch (type) {
			case "users":
				console.log("purge", type);
				fetch("/users/purge", {
					method: "DELETE",
					body: JSON.stringify({})
				});
				break;
			case "messages":
				console.log("purge", type);
				fetch("/chat/purge", {
					method: "DELETE",
					body: JSON.stringify({})
				});
				break;
            default:
                break;
		}
	}
	String.prototype.toDOM = function() {
		var d = document,
			i, a = d.createElement("div"),
			b = d.createDocumentFragment();
		a.innerHTML = this;
		while (i = a.firstChild) {
			b.appendChild(i);
		}
		return b;
	};

	function updateTyping() {
		if (!isTyping) {
			isTyping = true;
			socket.emit('typing');
		}
		lastTypingTime = (new Date()).getTime();
		setTimeout(() => {
			const typingTimer = (new Date()).getTime();
			const timeDiff = typingTimer - lastTypingTime;
			if (timeDiff >= TYPING_TIMER_LENGTH && isTyping) {
				socket.emit('stop typing');
				isTyping = false;
			}
		}, TYPING_TIMER_LENGTH);
	}

	function addMessage(message) {
		messagesList.push(message);
		document.getElementById("nothing-to-see").style.display = "none";
		var htmlString = `<div class="w-100 float-start" data-username="${message.username}" data-message-id="${message.id}">
	<div class="border my-1 rounded-3 border-${message.username == username ? "primary" : "secondary" } bg-opacity-50${message.username==username ? " float-end" : "" }" style="width: fit-content; max-width: 400px;">
		${(message.username == username || window.admin) ? `<a href="#delete-${message.id}" data-delete-id="${message.id}" class="float-end mt-1 me-1"><i class="bi bi-trash"></i></a>` : ""}
        <div class="my-2 mx-4">
            <strong>
                <small>${message.admin ? '<i class="bi bi-shield me-1"></i> ' : ""}${message.dev ? '<i class="bi bi-code-slash"></i> ' : ""}${message.username}</small>
            </strong>
            <br />
            <span style="overflow-wrap: break-word;" class="message-content">${message.content}</span>
        </div>
	</div>
</div>`;
		var messageElement = htmlString.toDOM();
        messageElement = chatBox.appendChild(messageElement.firstElementChild);
		console.log("%cAdded message: %o", "color: limegreen", messageElement);
        
		if (message.username == username) {
			chatBox.scrollTop = chatBox.scrollHeight;
		}
		if (message.username == username || window.admin) {
			messageElement.querySelector(`a[href^="#delete"]`).addEventListener('click', event => {
				deleteMessage(event.target.parentElement.getAttribute("data-delete-id"));
                setTimeout(_ => {
                    location.hash = "";
                }, 500);
			});
		}
		hljs.highlightAll();
	}

	async function deleteMessage(id) {
		var response = await fetch("/chat/delete", {
			method: "DELETE",
			headers: {
				"content-type": "application/json"
			},
			body: JSON.stringify({
				id: id
			})
		});
        if (response.status == 429) {
                response = await response.json();
                document.getElementById("message").innerHTML = response.message;
                if (response.color) {
                    document.getElementById("message").style.color = response.color;
                }
                clearTimeout(window.messageTimer || 0);
                window.messageTimer = setTimeout(_ => {
                    document.getElementById("message").innerHTML = "";
                }, 1200);
            }
	}

	function removeMessage(id) {
		messagesList = messagesList.filter(message => message.id !== id);
        var message = document.querySelector(`div[data-message-id="${id}"]`);
        console.log("%cRemoving message: %o", "color: red", message)
		message && message.remove();
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

	function addTyping(data) {
		console.log("%cadd: %o", "color: limegreen", data)
		typers.push(data.username);
	}

	function removeTyping(data) {
		console.log("%cremove: %o", "color: red", data)
		typers.splice(typers.indexOf(data.username));
	}
	setInterval(_ => {
		var sentence = typers.length > 2 ? typers.slice(0, typers.length - 1).join(', ') + ", and " + typers.slice(-1) : typers.length == 2 ? typers.join(' and ') : typers.length == 1 ? typers[0] : ""
		typersElement.textContent = sentence;
		typersLoader.style.display = !!typers.length ? "inline-block" : "none";
		typersMessage.textContent = typers.length > 1 ? " are typing..." : typers.length == 1 ? " is typing..." : "";
	}, 200);
	async function getInfo() {
		var info = await fetch("./info/");
		info = await info.json();
        var username = info.username;
        var admin = info.admin;
        window.info = info;
        if (!admin) {
			purgeBtn.remove();
		}
		if (!!username.error && username.error == "logged_out") {
			for (const child of messageGroup.children) {
				child.classList.add("disabled");
				child.setAttribute("disabled", "");
			}
			messageGroup.tooltip = new bootstrap.Tooltip(messageGroup.parentElement, {
				title: "You must be logged in to chat.",
				container: "body"
			});
			window.username = "";
		} else {
			window.username = username;
			document.getElementById("login-register").innerHTML = '<li class="nav-item m-2"><a class="btn btn-info btn-sm" href="/logout" role="button">Logout</a></li>';
		}
		socket.emit("set username", username);
	}

	async function sendMessage(content) {
		if (content) {
			var response = await fetch("/chat/add", {
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				body: JSON.stringify({
					content: content,
				})
			});
            if (response.status == 429) {
                response = await response.json();
                document.getElementById("message").innerHTML = response.message;
                if (response.color) {
                    document.getElementById("message").style.color = response.color;
                }
                clearTimeout(window.messageTimer || 0);
                window.messageTimer = setTimeout(_ => {
                    document.getElementById("message").innerHTML = "";
                }, 1200);
            }
		}
	}
	input.addEventListener("keydown", (event) => {
		if (event.code === "Enter" && !event.shiftKey) {
			event.preventDefault();
			console.log("down");
			button.click();
		}
	});
	input.addEventListener("input", updateTyping);
	button.addEventListener("click", (event) => {
		if (!!input.value) {
			sendMessage(input.value.replace(/^\s*$(?:\r\n?|\n)/gm, ""));
			setTimeout(_ => {
				input.value = "";
			}, 200);
		}
	});
	socket.on("message", addMessage);
	socket.on("message remove", removeMessage);
	socket.on("typing", addTyping);
	socket.on("stop typing", removeTyping);
	setInterval(function() {
		var zoom = detectZoom.device().toFixed(2);
		// console.info("Zoom: " + detectZoom.device().toFixed(2).toString())
		setTimeout(function() {
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
}
window.addEventListener("DOMContentLoaded", main);