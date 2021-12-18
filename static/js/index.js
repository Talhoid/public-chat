function main() {
	var chatBox = document.querySelector(".chat-box");
	var socket = io();
	var input = document.getElementById("send-messages").children[0];
	var button = document.getElementById("send-messages").children[3];
	var messageGroup = document.getElementById("send-messages");
	var isTyping = false;
	var typersElement = document.getElementById("username-list");
	var typersMessage = document.getElementById("typing-message");
	var typersLoader = document.querySelector(".loader");
	var typers = [];
	var purgeMessagesBtn = document.getElementById("button-purge-messages");
	var purgeUsersBtn = document.getElementById("button-purge-users");
	var areYouSureSubmit = document.getElementById("areYouSureSubmit");
	var areYouSureModal = document.getElementById("areYouSure");
	areYouSureModal.addEventListener('show.bs.modal', function(event) {
		// Button that triggered the modal
		var button = event.relatedTarget
		// Extract info from data-bs-* attributes
		var message = button.getAttribute('data-bs-message');
		var type = button.getAttribute('data-bs-type');
		// If necessary, you could initiate an AJAX request here
		// and then do the updating in a callback.
		//
		// Update the modal's content.
		var modalBody = areYouSureModal.querySelector('.modal-body');
		var modalButton = areYouSureModal.querySelector(".modal-footer button.btn-danger");
		modalButton.dataset.purgeType = type;
		modalBody.textContent = message;
	});
	areYouSureSubmit.addEventListener("click", event => {
		purge(event.target.dataset.purgeType);
	});
	window.messagesList = [];
	const TYPING_TIMER_LENGTH = 1400;
	getUsername();

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

	function changeTag(el, tag) {
		var parent = el.parentNode,
			newElem = document.createElement(tag);
		newElem.innerHTML = el.value || el.innerHTML
		parent.replaceChild(newElem, el);
		return newElem;
	}

	function addMessage(message) {
		messagesList.push(message);
		document.getElementById("nothing-to-see").style.display = "none";
		var htmlString = `<div class="w-100 float-start" data-username="${message.username}" data-message-id="${message.id}">
	<div class="border my-1 rounded-3 border-${message.username == username ? "primary" : "secondary" } bg-opacity-50${message.username==username ? " float-end" : "" }" style="width: fit-content; max-width: 400px;">
		${(message.username == username || window.admin) ? `<a href="#" data-delete-id="${message.id}" class="float-end mt-1 me-1"><i class="bi bi-trash"></i></a>` : ""}
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
		console.log("Adding message: ");
		console.log(messageElement);
		chatBox.appendChild(messageElement);
		if (message.username == username) {
			chatBox.scrollTop = chatBox.scrollHeight;
		}
		if (message.username == username || window.admin) {
			document.querySelector(`a[data-delete-id="${message.id}"]`).addEventListener('click', event => {
				deleteMessage(event.target.parentElement.getAttribute("data-delete-id"));
			});
		}
		hljs.highlightAll();
	}

	function deleteMessage(id) {
		console.log("delete", id);
		fetch("/chat/delete", {
			method: "DELETE",
			headers: {
				"content-type": "application/json"
			},
			body: JSON.stringify({
				id: id
			})
		});
	}

	function removeMessage(id) {
		messagesList = messagesList.filter(message => message.id !== id);
		document.querySelector(`div[data-message-id="${id}"]`) && document.querySelector(`div[data-message-id="${id}"]`).remove();
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
	async function getUsername() {
		var username = await fetch("./username/");
		username = await username.json();
		if (username.error == "logged_out") {
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
			username = username.username;
			window.username = username;
			document.getElementById("login-register").remove();
		}
		socket.emit("set username", username);
		return username;
	}
	async function checkAdmin() {
		var admin = await fetch("./admin/");
		admin = await admin.json();
		if (!admin.admin) {
			purgeMessagesBtn.remove();
			purgeUsersBtn.remove();
		}
		window.admin = admin.admin;
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
                document.getElementById("error").textContent = response.message;
                setTimeout(_ => {
                    document.getElementById("error").textContent = "";
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
	checkAdmin();
}
window.addEventListener("DOMContentLoaded", main);