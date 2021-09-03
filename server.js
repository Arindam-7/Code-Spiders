require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const session = require("express-session")
const bcrypt = require("bcrypt")
const passport = require("passport")
const LocalStrategy = require("passport-local")
const FacebookStrategy = require("passport-facebook")
const validUrl = require("valid-url")
const findOrCreate= require("mongoose-findorcreate")
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy
const app = express()


//basic middlewares

const URI = "mongodb+srv://ciao:ciao@cluster0.ogg8o.mongodb.net/mydb?retryWrites=true&w=majority" ;
mongoose.connect(URI, {useNewUrlParser:true, useUnifiedTopology:true})
app.set("view engine", "ejs")
app.use(express.json())
app.use(express.static("public"))
app.use(express.urlencoded({extended:false}))
app.use(session({
    secret:"s3cr3t",
    resave:true,
    saveUninitialized:true
}))
app.use(passport.initialize())
app.use(passport.session())
passport.serializeUser(((user,done) => {
    done(null,user.id)
}))
passport.deserializeUser((id, done) => {
    User.findById(id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        console.log(`Error: ${error}`);
      })
    });






//models


let noteSchema = new mongoose.Schema({
    title:String,
    date:{type:Date,default:new Date().toLocaleDateString()},
    links: String,
    description: String,
    author:String
})
let Note = mongoose.model("Note", noteSchema)

let userSchema = new mongoose.Schema({
    username:String,
    password:String
})
userSchema.plugin(findOrCreate)
let User = mongoose.model("User", userSchema)
function ensureAuthenticated(req,res,next){
    if(req.isAuthenticated()) {
       next()
    }
    else{
       res.redirect("/")
    }
}

//passport authentication

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "http://localhost:8080/auth/facebook/callback",
    profileFields: ["id", "displayName"]
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id}, function (err, user) {
        user.username = profile.displayName
        user.save()
        return cb(err,user)
    });
  }
  ));

  //facebook authentication 


app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/sign-up' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });


  //local authentication


  passport.use(new LocalStrategy(
    function (username, password, done) {
     User.findOne({ username: username }, function (err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false); }
        if (!bcrypt.compareSync(password, user.password)) { 
          return done(null, false);
        }
        return done(null, user);
      });
    }
  ));

app.post("/auth", (req,res,next) => {
    const hash = bcrypt.hashSync(req.body.password,12)
    let new_User = new User({
        username: req.body.username,
        password:hash
    })

    User.findOne({username:req.body.username}, (err,user) => {
        if(err){
            next(err)
        }
        else if(user) {
            res.redirect("/login")
        }
        else {
            new_User.save((err,doc) => {
                if(err) throw err
                console.log(doc)
                res.redirect("/login")
            })
        }
    })
 })
 app.post("/login/auth",passport.authenticate("local", {failureRedirect:"/sign-up"}), (req,res) => {
    res.redirect("/")
})

//google authentication

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_ID,
    clientSecret:process.env.GOOGLE_SECRET,
    callbackURL: "http://localhost:8080/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(profile)
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      user.username = profile.displayName
      user.save()
      return done(err, user);
    });
}
));
app.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/sign-up' }),
  function(req, res) {
    res.redirect('/logged');
  });





app.get("/", async (req,res) => {
    let logged = true
    if(!req.isAuthenticated()) {
        logged = false
    }
    let username;
    if(req.user){
        username = req.user.username
    }
    let notes = await Note.find({})
    res.render("home.ejs", {logged:logged, notes:notes, author:username})
})

app.get("/login", (req,res) => {
    res.render("login.ejs")
})

app.get("/logged",(req,res) => {
    res.render("logged.ejs")
})
app.get("/sign-up", (req,res) => {
    res.render("signUp.ejs")
})
app.get("/description", (req,res) => {
    res.render("description.ejs")
})
app.get("/logout", (req,res) => {
    req.logout();
    res.redirect("/")
})
app.get("/create",ensureAuthenticated, (req,res) => {
    let date = new Date().toLocaleDateString()
 
    res.render("create.ejs", {date:date, author:username})
} )
app.post("/create/save", (req,res) => {
    var url = req.body.link
if (validUrl.isUri(url)){
    let new_note = new Note({
        title:req.body.title,
        date:req.body.date,
        links:req.body.link,
        description:req.body.description,
        author:req.body.author
    })
    new_note.save((err,result) => {
        if(err) throw err
        console.log(result)
    })
    res.redirect("/")
} 
else {
    res.send("Invalid Url");
}
   
})
app.get("/edit",async (req,res) => {
    console.log(req)
    let note = await Note.findById(req.query.id)
    res.render("edit.ejs", {note:note})
})
app.post("/edit/save", (req,res) => {
    Note.findByIdAndUpdate(req.body.id,{
        title:req.body.title,
        date:req.body.date,
        links:req.body.links,
        description:req.body.description,
    },(err,data) => {
        if(err) throw err
        res.redirect("/")
    })
})
app.post("/edit/delete", (req,res) => {
    Note.findByIdAndRemove(req.body.id, (err,result) => {
        if(err) throw err
        res.redirect("/")
    })
})

app.listen(8080)
