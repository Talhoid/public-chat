// const JSONFileAPI = require("edit-json-file");
const crypto = require("crypto");
const path = require("path");
const {
    toHTML
} = require('discord-markdown');

const { join } = require("path");

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


    async addUser(userObj) {
        
        userObj.id = crypto.randomBytes(16).toString("hex");
        if (!!this.database.data.users) {
            this.database.data.users.push(userObj);
        } else {
            this.database.data.users = [];
            this.database.data.users.push(userObj);
        }
        await this.database.write();
        return userObj;
    }
    // Why do we do this? its a security risk 
    // setUserToken(username, token) {
    //     var userList = this.database.data.users;
    //     var user = userList.find(user => user.username === username);
    //     user.token = token;
    //     this.database.data.users[userList.indexOf(userList.find(user => user.username === username)).toString()] = user
    // }

    async findUser(username) {
        
        if (!!!this.database.data.users) {
            this.database.data.users = [];
            await this.database.write();
        }
        return this.database.data.users.find(user => user.username === username);
    }

    findMessage(id) {
        
        return this.database.data.chat.find(message => message.id === id)
    }


    async addMessage(message) {
        
        message.admin = this.checkAdmin(message.username) && !this.checkDev(message.username);
        message.dev = this.checkDev(message.username);
        message.id = crypto.randomBytes(16).toString("hex");
        message.content = this.utf2Html(toHTML(filter.cleanHacked(message.content)));
        if (!!this.database.data.chat) {
            this.database.data.chat.push(message);
        } else {
            this.database.data.chat = [];
            this.database.data.chat.push(message);
        }
        await this.database.write();
        return message;
    }

    getMessages() {
        
        return this.database.data.chat;
    }

    async purgeMessages() {
        
        this.database.data.chat = [];
        await this.database.write();
        return this.database.data.chat;
    }

    async purgeUsers() {
        
        this.database.data.users = this.database.data.users.filter(user => {
            return this.checkAdmin(user.username);
        });
        await this.database.write();
        return this.database.data.users;
    }

    async deleteMessage(id) {
        var originalMessage = this.findMessage(id);
        this.database.data.chat = this.database.data.chat.filter(message => {
            return message.id != id;
        });
        await this.database.write();
        return originalMessage;
    }

    checkAdmin(username) {
        return this.database.data.admins.indexOf(username) > -1;
    }
    
    checkDev(username) {
        
        return this.database.data.devs.indexOf(username) > -1;
    }
}

async function connect(databasePath) {
    const lowdb = await import('lowdb');
    console.log(`[${path.basename(__filename)}] loading ${databasePath}`)
    const adapter = new lowdb.JSONFile(join(__dirname, databasePath));
    const db = new lowdb.Low(adapter);
    await db.read();
    var finalDatabase = new Database(db, databasePath);
    return finalDatabase;
}

function save() {
    
}

module.exports = {
    connect: connect,
    save: save
};