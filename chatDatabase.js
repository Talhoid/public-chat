// const JSONFileAPI = require("edit-json-file");
const crypto = require("crypto");
const autoSave = require('save-on-change');
const path = require("path");
const {
    toHTML
} = require('discord-markdown');
const Filter = require('./bad-words-fixed'),
    filter = new Filter({
        placeHolder: "\\*"
    });
class Database {
    constructor(database, path) {
        this.database = database;
        this.path = path;
    }
    // thx nikki https://dev.to/nikkimk/converting-utf-including-emoji-to-html-x1f92f-4951
    utf2Html(str) {
        return [...str].map((char) => char.codePointAt() > 127 ? `&#${char.codePointAt()};` : char).join('');
    }


    addUser(userObj) {
        userObj.id = crypto.randomBytes(16).toString("hex");
        if (!!this.database.users) {
            this.database.users.push(userObj);
        } else {
            this.database.users = [];
            this.database.users.push(userObj);
        }
        this.database = autoSave(this.path);
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
        this.database = autoSave(this.path);
        if (!!!this.database.users) {
            this.database.users = [];
        }
        return this.database.users.find(user => user.username === username);
    }

    findMessage(id) {
        this.database = autoSave(this.path);
        return this.database.chat.find(message => message.id === id)
    }


    addMessage(message) {
        this.database = autoSave(this.path);
        message.admin = this.checkAdmin(message.username) && !this.checkDev(message.username);
        message.dev = this.checkDev(message.username);
        message.id = crypto.randomBytes(16).toString("hex");
        message.content = this.utf2Html(toHTML(filter.cleanHacked(message.content)));
        if (!!this.database.chat) {
            this.database.chat.push(message);
        } else {
            this.database.chat = [];
            this.database.chat.push(message);
        }
        return message;
    }

    getMessages() {
        this.database = autoSave(this.path);
        return this.database.chat;
    }

    purgeMessages() {
        this.database = autoSave(this.path);
        this.database.chat = [];
        return this.database.chat;
    }

    purgeUsers() {
        this.database = autoSave(this.path);
        this.database.users = this.database.users.filter(user => {
            return this.checkAdmin(user.username);
        });
        return this.database.users;
    }

    deleteMessage(id) {
        this.database = autoSave(this.path);
        var originalMessage = this.findMessage(id);
        this.database.chat = this.database.chat.filter(message => {
            return message.id != id;
        });
        return originalMessage;
    }

    checkAdmin(username) {
        this.database = autoSave(this.path);
        return this.database.admins.indexOf(username) > -1;
    }
    
    checkDev(username) {
        this.database = autoSave(this.path);
        return this.database.devs.indexOf(username) > -1;
    }
}

function connect(databasePath) {
    console.log(`[${path.basename(__filename)}] loading ${databasePath}`)
    var finalDatabase = new Database(autoSave(databasePath), databasePath);
    return finalDatabase;
}

module.exports = {
    connect: connect
};