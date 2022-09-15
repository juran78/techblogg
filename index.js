if (process.env.Node_ENV !== "production") {
    require('dotenv').config()
}
var multer = require('multer')
const { storage } = require('./cloudinary')
var upload = multer({ storage })
const express = require('express')
const app = express();
const path = require('path');
const ejsMate = require('ejs-mate')
app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize({replaceWith: "_"}));
const db_Url = process.env.DB_URL;
const port = process.env.PORT;

const flash = require('connect-flash')
const AppError = require('./AppError')
const { v4: uuid } = require('uuid')

const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const baseJoi = require('joi')
const methodOverride = require('method-override')

const sanitizeHTML = require('sanitize-html');
const validator = require('express-joi-validation').createValidator({ passError: true })
const extension = (Joi) => ({
type: 'string',
base: Joi.string(),
messages: {
    'string.escapeHTML': '{{#label}} must not include HTML'
},
rules: { 
escapeHTML: {
    validate(value,helpers) {
        const clean = sanitizeHTML(value, {
            allowedTags: [],
            allowedAttributes: {},
        });
        if (clean !== value) return helpers.error('string.escapeHTML', {value})
        return clean;
    }

}}

})
const Joi = baseJoi.extend(extension)
const postSchema = Joi.object({

    subject: Joi.string().required().escapeHTML(),
    post: Joi.string().required().escapeHTML()

})
const commentSchema = Joi.object({
    rating: Joi.number().required(),
    comment: Joi.string().required().escapeHTML()
})

const catchAsync = function (fn) {
    return function (req, res, next) {
        fn(req, res, next).catch(e => next(e))
    }
}


const secret = process.env.SECRET;
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, '/public')))
const Mongostore = require('connect-mongo')(session)
const store = new Mongostore({url:db_Url,secret:"hello",touchAfter:24 * 60* 60})
store.on("error",function(e){
    console.log(e)
})
const sessionConfig = {
    store,
    name: "blah",
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
const User = require('./models/user')
const Post = require('./models/post');
const Comment = require('./models/comment');
const { allowedNodeEnvironmentFlags } = require('process');
const e = require('connect-flash');
const post = require('./models/post');
const user = require('./models/user');
const { date } = require('joi')
const { join } = require('path')

app.use(session(sessionConfig))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
passport.use(new LocalStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {

        req.flash('error', 'you need to be logged in for this')
        return res.redirect('/login')
    } else {
        next()
    }
}
const isCommentOwner = async (req, res, next) => {
    const comment = await Comment.findById(req.params.commentId)
    if (!comment.owner.equals(req.user._id)) {
        req.flash('error', 'you do not own this comment')
        return res.redirect(req.originalUrl)
    }
    next()
}


const isPostOwner = async (req, res, next) => {
    const post = await Post.findById(req.params.id)
    if (!post.user.equals(req.user._id)) {
        req.flash('error', 'you do not own this post')
        return res.redirect(req.originalUrl)
    }
    next()


}

const canUserDelete = async (req, res, next) => {
    const user = await User.findById(req.params.id)
    if (!user.equals(req.user._id)) {
        req.flash('error', 'you do not have permission to access this')
        console.log('canUserDelete prevented function from executing')
        return res.redirect('/posts')
    }
    next()
}

app.use((req, res, next) => {
    if (req.user) {
        console.log(req.path, req.method, req.user.username)
    } else {
        console.log(req.path, req.method)
    }
    next()
})
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error')

    next()
})

app.get('/', (req, res) => {
    res.render('home')
})

app.get('/register', (req, res) => {
    res.render('users/register')
})



app.post('/register', catchAsync(async (req, res, next) => {
    const { email, username, password } = req.body
    const user = new User({ email, username })

    const registeredUser = await User.register(user, password)

    req.logIn(registeredUser, function (err) {
        if (err) {
            next(err)
        }

        req.flash('success', 'Thank you for signing up!')
        res.redirect('/')

    })

}));

app.get('/login', (req, res) => {
    res.render('users/login')
});
app.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), async (req, res) => {
    req.flash('success', 'successfully logged in')
    res.redirect('/')
});
app.get('/logout', (req, res, next) => {
    req.logout()
    req.flash('success', 'successfully logged out')
    res.redirect('/')

});


app.get('/posts', async (req, res) => {
    let posts = await Post.find({}).populate('user')
    if (req.query.sort === 'newest') {
        posts = await Post.find({}).populate('user').sort({ jsDate: -1 })
        console.log(posts)
        return res.render('posts/index', { posts })
    }
    if (req.query.sort === 'oldest') {
        posts = await Post.find({}).populate('user').sort({jsDate: 1})
        return res.render('posts/index',{posts})
    }
    if (req.query.sort === 'likes') {
        posts = await Post.find({}).populate('user').sort({likeCount: -1})
    }

    res.render('posts/index', { posts })
})


app.get('/posts/new', isLoggedIn, (req, res) => {
    res.render('posts/new')
})

app.post('/posts', isLoggedIn, upload.single('image'), validator.body(postSchema), catchAsync(async (req, res, next) => {


    const user = await User.findById(req.user.id)

    const post = new Post(req.body)
    post.user = req.user
    post.date = new Date().toDateString().substring(4)
    post.jsDate = new Date()
    if (req.file) {
        post.image = { url: req.file.path, filename: req.file.filename }
    }
    user.posts.push(post)
    await post.save()
    await user.save()
    console.log(post)

    res.redirect('/posts')


}));

app.get('/posts/:id', catchAsync(async (req, res) => {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new AppError({ msg: 'not a valid id', status: 400 })
    }
    const post = await Post.findById(req.params.id).populate('user').populate({ path: 'comments', populate: { path: 'owner' } })
    if (!post) {
        throw new AppError({ msg: 'cannot find this', status: 400 })
    }
    res.render('posts/show', { post })


}));

app.get('/posts/:id/edit', isLoggedIn, isPostOwner, catchAsync(async (req, res) => {
    const post = await Post.findById(req.params.id)
    res.render('posts/edit', { post })
}))
app.put('/posts/:id', isLoggedIn, isPostOwner, upload.single('image'), validator.body(postSchema), catchAsync(async (req, res) => {

    const post = await Post.findByIdAndUpdate(req.params.id, req.body)
    if (req.file) {
        post.image = { url: req.file.path, filename: req.file.filename }
        await post.save()
    }
    console.log(post)
    res.redirect(`/posts/${req.params.id}`);

}));

app.delete('/posts/:id', isLoggedIn, isPostOwner, async (req, res) => {
    const post = await Post.findByIdAndDelete(req.params.id)
    const deletedComments = await Comment.deleteMany({ id: { $in: post.comments } })
    const user = await User.findById(req.user.id)
    await user.updateOne({ $pull: { posts: req.params.id } })
    const users = await User.updateMany({ likes: { $eq: req.params.id } }, { $pull: { likes: req.params.id } })
    console.log(users)

    res.redirect('/posts')
})
app.post('/posts/:id/comments', isLoggedIn, validator.body(commentSchema), async (req, res) => {
    const comment = new Comment(req.body)
    const user = await User.findById(req.user.id)
    comment.owner = user
    const post = await Post.findById(req.params.id)
    const postOwner = await User.findOne({ posts: { $eq: req.params.id } })

    postOwner.notifications.push({ alert: `${user.username} commented on your post`, link: `/posts/${post.id}`, id: uuid() })
    await postOwner.save()
    console.log(postOwner)
    post.comments.push(comment)
    await comment.save()
    await post.save()
    res.redirect(`/posts/${req.params.id}`)



})






app.post('/posts/:id/like', isLoggedIn, catchAsync(async (req, res, next) => {
    const postCheck = await Post.findById(req.params.id)
    const userCheck = await User.findOne({ $and: [{ _id: { $eq: req.user._id } }, { likes: { $eq: req.params.id } }] })
    if (!userCheck || postCheck.likes.indexOf(userCheck.id) === -1) {


        let likedPost = await Post.findByIdAndUpdate(req.params.id, { $inc: { likeCount: 1 }, $push: { likes: req.user.id } })

        const user = await User.findById(req.user._id)
        user.likes.push(likedPost)
        await user.save()
        const postOwner = await User.findOne({ posts: { $eq: req.params.id } })
        postOwner.notifications.push({ alert: `${user.username} liked your post`, link: `/posts/${req.params.id}`, id: uuid() })
        await postOwner.save()
        console.log(likedPost)

        return res.redirect('/posts')
    } else {
        req.flash('error', 'cant like this')
        return res.redirect('/posts')
    }



}))







app.delete('/posts/:id/comments/:commentId', isLoggedIn, isCommentOwner, catchAsync(async (req, res) => {
    const comment = await Comment.findByIdAndDelete(req.params.commentId)
    const post = await Post.findById(req.params.id)
    post.updateOne({ $pull: { comments: req.params.commentId } })
    await post.save()
    console.log(post)
    res.redirect(`/posts/${post.id}`)

}))

app.get('/blogger/:id', async (req, res) => {
    const user = await User.findById(req.params.id).populate('posts')
    res.render('blogger/show', { user })


})
app.delete('/blogger/:id', isLoggedIn, canUserDelete, async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id)
    const deletedPosts = await Post.deleteMany({ user: { $eq: user.id } })
    const deletedComments = await Comment.deleteMany({ owner: { $eq: user.id } })
    console.log(`user deleted: ${user}\n deleted posts: ${deletedPosts}\n deleted comments: ${deletedComments}`)
    res.redirect('/posts')
})
app.delete('/blogger/:id/notifications/:notificationId', isLoggedIn, canUserDelete, catchAsync(async (req, res) => {
    const { id, notificationId } = req.params
    const user = await User.findByIdAndUpdate(id, { $pull: { notifications: { id: { $eq: notificationId } } } }, { new: true })


    console.log(user)
    res.redirect('/posts')
}))




app.listen(port, () => {
    console.log(`serving on port ${port} `)
})
mongoose.connect(db_Url, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('connected'))
    .catch(e => console.log(e))



app.all('*',(req,res) => {
    throw new AppError('cant find that',404)
})
app.use((err, req, res, next) => {
    if (err && err.error && err.error.isJoi) {
        // we had a joi error, let's return a custom 400 json response
        req.flash('error', 'You cannot leave this blank')
        res.redirect(req.originalUrl)
    }

    else {
        // pass on to another error handler
        next(err);
    }
});

app.use((err, req, res, next) => {

   
    if (!err.msg) {
        err.msg = 'something went wrong'

    }
    if (!err.status) {
        err.status = 404
    }
    res.render('posts/error', { err })

})






