var username, socket = io();

function getMessages() {
    fetch('./api/chat')
        .then(response => response.json())
        .then(data => {
            addMessages(data)
        })
}

function addMessage(message) {
    var messageNodeList = document.createDocumentFragment();
    var messageElement = document.createElement('div')
    messageElement.className = "message"
    var usernameElement = document.createElement('p')
    usernameElement.className = "username"
    usernameElement.textContent = message.username
    var contentElement = document.createElement('p')
    contentElement.textContent = message.message
    contentElement.className = "content";
    messageNodeList.appendChild(usernameElement)
    messageNodeList.appendChild(contentElement)
    messageElement.appendChild(messageNodeList)
    document.querySelector('div#chat').appendChild(messageElement);
}

function addMessages(messages) {
    messages.forEach(addMessage)
}

socket.on('message', addMessage)

function sendMessage(username, content) {
    fetch('./api/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            message: content
        })
    })
}



getMessages();

function setUsernameEventHandler(event) {
    if (!!event.target.previousElementSibling.value) {
        localStorage.setItem('username', event.target.previousElementSibling.value)
        event.target.parentElement.remove()
        username = localStorage.getItem('username');
        document.querySelector('.username').style.display = '';
        document.querySelector('.username').querySelector('#username-box').textContent = username;
    } else {
        document.getElementById('error').textContent = 'Put something inside of that box, idiot.'
        setTimeout(function() {
            document.getElementById('error').textContent = ''
        }, 3000);
    }
}

function usernameInputEventHandler(event) {
    if (event.keyCode === 13) {
        document.getElementById('username-btn').click();
    }
}

function messageInputEventHandler(event) {
    if (event.keyCode === 13 && !!document.getElementById('message-input').value) {
        document.getElementById('message-btn').click();
    }
}

function sendMessageEventHandler(event) {
    if (!!username && !!document.getElementById('message-input').value) {
        sendMessage(username, document.getElementById('message-input').value)    
        document.getElementById('message-input').value = '';
    } else {
        document.getElementById('error').textContent = 'Set your username. -_-'
        setTimeout(function() {
            document.getElementById('error').textContent = ''
        }, 3000);
    }
}


document.getElementById('username-btn').addEventListener('click', setUsernameEventHandler)
document.getElementById('username-input').addEventListener('keydown', usernameInputEventHandler)
document.getElementById('message-input').addEventListener('keydown', messageInputEventHandler)
document.getElementById('message-btn').addEventListener('click', sendMessageEventHandler)


function checkUsername() {
    if (!!localStorage.getItem('username')) {
        username = localStorage.getItem('username');
        document.querySelector('.username-input-wrapper').remove();
        document.querySelector('.username').style.display = '';
        document.querySelector('.username').querySelector('#username-box').textContent = username;
    } else {
        document.querySelector('.username').style.display = 'none';
    }
}

checkUsername()