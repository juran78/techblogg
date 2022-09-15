const mongoose = require('mongoose')
const passportLocalMongoose = require('passport-local-mongoose')
const { v4: uuid } = require('uuid')
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    posts: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }
    ],
    likes: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }
    ],
    notifications: [
        { alert: { type: String }, link: { type: String }, id: String }
    ]

})
userSchema.plugin(passportLocalMongoose)
module.exports = mongoose.model('User', userSchema)


