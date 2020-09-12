var express=  require('express');
var app = express();
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var expressSanitizer = require('express-sanitizer');
var flash       = require("connect-flash");
var passport = require('passport');
var localStrategy = require('passport-local');
var passportLocalMongoose = require("passport-local-mongoose");


app.set("view engine","ejs");
app.use(express.static("public"));
app.use(flash());
app.use(bodyParser.urlencoded({extended:true}));
app.use(flash());
app.use(expressSanitizer());
app.use(methodOverride("_method"));

// mongodb://localhost:27017/amisha

const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://devsprout:test@2098@cluster0.0eqnx.mongodb.net/<dbname>?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to DB!'))
.catch(error => console.log(error.message));





var userSchema = new mongoose.Schema({
	username:String,
	password:String
})
userSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", userSchema);




var commentSchema = new mongoose.Schema({
    text: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
	created:{type:Date,default:Date.now}
});
var Comment = mongoose.model("Comment",commentSchema);




var blogSchema = mongoose.Schema({
	title:String,
	image:String,
	body:String,
	comments:[
		 {
        	 type: mongoose.Schema.Types.ObjectId,
         	 ref: "Comment"
      	}
	],
	created:{type:Date,default:Date.now}
});

var Blog = mongoose.model("Blog",blogSchema);







// PASSPORT CONFIG
app.use(require("express-session")({
	secret: "Once again rusty wins cutest dog",
	resave:false,
	saveUninitialized:false
}));


app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



app.use(function(req, res, next){
   res.locals.currentUser = req.user;
	 
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});









// ===================================== ROUTES ============================================

// landing page
app.get("/",function(req,res){
	res.render("index");
})


// blogs home page (all blogs)
app.get("/blogs",function(req,res){
	Blog.find({},function(err,blogs){
		if(err)
			console.log("Cannot Fetch Blogs");
		else
			res.render("blogs",{blogs:blogs});
	})
});


// new blog form
app.get("/blogs/new",isAdminCheck,function(req,res){
	res.render("newBlog");
})

app.post("/blogs",isAdminCheck,function(req,res){
	req.body.blog.body = req.sanitize(req.body.blog.body);
	Blog.create(req.body.blog,function(err,blog){
		if(err)
			console.log("Blog Not Created");
		else 
			res.redirect("/blogs");
	})
})






// SHOW ROUTE
app.get("/blogs/:id", function(req, res){
    //find the campground with provided ID
    Blog.findById(req.params.id).populate("comments").exec(function(err, foundBlog){
        if(err){
            console.log(err);
        } else {
            //render show template with that campground
            res.render("show", {blog: foundBlog});
        }
    });
});














// EDIT FORM
app.get("/blogs/:id/edit",isAdminCheck,function(req,res){
	Blog.findById(req.params.id,function(err,result){
		// console.log(result);
		if(err){
			console.log("blog not found");
		}
		else{
			res.render("edit",{blog:result});
		}
	});
});


// UPDATE ROUTE
app.put("/blogs/:id",isAdminCheck,function(req,res){
	req.body.blog.body = req.sanitize(req.body.blog.body);
	Blog.findByIdAndUpdate(req.params.id,req.body.blog,function(err,updatedBlog){
		if(err)
			res.redirect("/blogs");
		else{
			res.redirect("/blogs/"+req.params.id);
		}
	});
});


// DELETE ROUTE
app.delete("/blogs/:id",isAdminCheck,function(req,res){
	// destroy and redirect
	Blog.findByIdAndRemove(req.params.id,function(err){
		if(err)
			res.redirect("/blogs");
		else
			res.redirect("/blogs");
	});
})



// signup route

app.get("/register",function(req,res){
	res.render("register");
});


app.post("/register", function(req, res){
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error",err.message);
            return res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function(){
		   req.flash("success","Welcome to my blogs "+user.username +" !!");
           res.redirect("/blogs");
        });
    });
});







//show login form
app.get("/login", function(req, res){
   res.render("login"); 
});

//handling login logic
app.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/blogs",
        failureRedirect: "/login"
    }), function(req, res){
});








// logout route
app.get("/logout", function(req, res){
   req.logout();
	req.flash("success","Logged out successfully");
   res.redirect("/blogs");
});




// ========================== COMMENTS SECTION ============================





//Comments New
app.get("/blogs/:id/newComment",isLoggedIn, function(req, res){
    // find campground by id
    // console.log(req.params.id);
    Blog.findById(req.params.id, function(err, blog){
        if(err){
			req.flash("error","Blog not found!");
            res.redirect("/blogs");
        } else {
             res.render("newComment", {blog:blog});
        }
    })
});

//Comments Create
app.post("/blogs/:id",isLoggedIn,function(req, res){
   //lookup campground using ID
   Blog.findById(req.params.id, function(err, blog){
       if(err){
           req.flash("error",err.message);
           res.redirect("/blogs");
       } else {
        Comment.create(req.body.comment, function(err, comment){
           if(err){
               req.flash("error", "Something went wrong");
               console.log(err);
           } else {
               //add username and id to comment
               comment.author.id = req.user._id;
               comment.author.username = req.user.username;
               //save comment
               comment.save();
               blog.comments.push(comment);
               blog.save();
               req.flash("success", "Successfully added comment");
               res.redirect('/blogs/'+req.params.id);
           }
        });
       }
   });
});






// COMMENT EDIT ROUTE
app.get("/blogs/:id/comments/:comment_id/edit",checkCommentOwnership,function(req, res){
   Comment.findById(req.params.comment_id, function(err, foundComment){
      if(err){
		  req.flash("error","Couldnt find  that comment!");
          res.redirect("back");
      } else {
          res.render("editComment", {blog_id: req.params.id, comment: foundComment});
      }
   });
});




// COMMENT UPDATE
app.put("/blogs/:id/comments/:comment_id", checkCommentOwnership, function(req, res){
   Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
      if(err){
		  req.put("error","Comment was not edited");
          res.redirect("back");
      } else {
		  req.flash("success","Your comment was edited successfully");
          res.redirect("/blogs/" + req.params.id );
      }
   });
});







// COMMENT DESTROY ROUTE
app.delete("/blogs/:id/comments/:comment_id",checkCommentOwnership, function(req, res){
    //findByIdAndRemove
    Comment.findByIdAndRemove(req.params.comment_id, function(err){
       if(err){
		   req.flash("error","ERROR ! Comment could not be deleted");
           res.redirect("back");
       } else {
		   req.flash("success","Comment deleted successfully !");
           res.redirect("/blogs/" + req.params.id);
       }
    });
});








//middleware
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
	req.flash("error","You need to be Logged in First !!")
    res.redirect("/login");
}

function isAdminCheck(req,res,next){
	if(req.isAuthenticated()){
		if(req.user.username === "amisha@ravi2007")
		{
			next();
		}
		else{
			req.flash("error","YOU NEED TO BE THE ADMINISTRATOR TO DO THAT !!");
			res.redirect("back");
		}
	}
	else{
		req.flash("error","You need to be logged in to do that !!");
		res.redirect("/login");
	}
}

function checkCommentOwnership(req, res, next){
	if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err, foundComment){
           if(err){
			   req.flash("error","Comment not found!");
               res.redirect("back");
           }  else {
               // does user own the comment?
            if(foundComment.author.id.equals(req.user._id)||req.user.username==="amisha@ravi2007") {
                next();
            } else {
				req.flash("error","You do not own the comment you want to EDIT!!");
                res.redirect("back");
            }
           }
        });
    } else {
		req.flash("error","You need to be logged in to do that !!");
        res.redirect("/login");
    }
}



var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Server Has Started!");
});