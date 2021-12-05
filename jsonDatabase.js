// const JSONFileAPI = require("edit-json-file");
const crypto = require("crypto");
const autoSave = require('save-on-change');
const path = require("path");
class Database {
    constructor(database) {
        this.database = database;
    }
    // thx nikki https://dev.to/nikkimk/converting-utf-including-emoji-to-html-x1f92f-4951
    utf2Html(str) {
        return [...str].map((char) => char.codePointAt() > 127 || Array.from("<>&;#'\"").includes(char) ? `&#${char.codePointAt()};` : char).join('');
    }

    addUser(userObj) {
        userObj.id = crypto.randomBytes(16).toString("hex");
        if (!!this.database.users) {
            this.database.users.push(userObj);
        } else {
            this.database.users = [];
            this.database.users.push(userObj);
        }
        return userObj;
    }
    // Why do we do this? its a security risk 
    // setUserToken(username, token) {
    //     var userList = this.database.users;
    //     var user = userList.find(user => user.username === username);
    //     user.token = token;
    //     this.database.users[userList.indexOf(userList.find(user => user.username === username)).toString()] = user
    // }

    findUser(username) {
        return this.database.users.find(user => user.username === username);
    }

    addMessage(messageObj) {
        messageObj.id = crypto.randomBytes(16).toString("hex");
        messageObj.content = this.utf2Html(messageObj.content)
        if (!!this.database.chat) {
            this.database.chat.push(messageObj);
        } else {
            this.database.chat = [];
            this.database.chat.push(messageObj);
        }
        return messageObj;
    }

    getMessages() {
        return this.database.chat;
    }
}

async function connect(databasePath) {
    console.log(`[${path.basename(__dirname)}] loading ${databasePath}`)
    var finalDatabase = new Database(autoSave(databasePath));
    return finalDatabase;
}

module.exports = {
    connect: connect
};