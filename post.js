const mongoose = require('mongoose')

const postSchema = new mongoose.Schema({
    subject: {
        type: 'String',
        required: true,

    },
    post: {
        type: 'String',
        required: true
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comments: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }
    ],

    likes: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
    likeCount: {
        type: Number,

    },
    date:String,
    jsDate: Number,
    image: [{ url: String, filename: String }]
})


module.exports = mongoose.model('Post', postSchema)

let d = new Date().toDateString().substring(4)
