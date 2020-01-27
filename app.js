require('dotenv').config()
// import express npm package
var express = require('express')
var Sequelize = require('sequelize')
var bodyParser = require('body-parser')
var models = require('./models')
var passwordHash = require('password-hash')
const uuidv1 = require('uuid/v1')
var session = require('express-session')
var markdown = require( "markdown" ).markdown
var verifySession = require( "./middleware" ).verifySession
var verifyTrainer = require( "./middleware" ).verifyTrainer
var verifyAdmin = require( "./middleware" ).verifyAdmin
var axios = require('axios')



// initialize express
var app = express()

// MIDDLEWARE
// use json parser
app.use(bodyParser.urlencoded({ extended: true })); 

// Ejs Setup
app.set('view-engine', 'ejs')

// use sessions for auth
app.use(session({
    secret: process.env.SECRET,
    saveUninitialized: false,
    resave: false,
}));

// serve stylesheets, media and js
app.use(express.static('public'))


// PAGES
app.get('/', verifySession, function(req, res){
	username = req.session.user
	user_id = req.session.user_id
	models.Course_User.findAll({attributes: ['course_id', 'user_id', 'course_title'], where: {user_id: user_id}}).then(response => {
		var courses = response.map(course => course.dataValues)
		res.render('home.ejs',{logged: true, username: username, courses: courses})
	}).catch(err => console.log('error ', err))
})

app.get('/login', (req, res) => {
    res.render('login.ejs', {logged: false});
  });

app.get('/help', function(req, res){
	res.render('help.ejs', {logged: false})
})

app.get('/trainer', verifySession, verifyTrainer, (req, res) => {
    res.render('trainer.ejs', {logged: true});
});

app.get('/admin', verifySession, verifyAdmin, (req, res) => {
	models.Course.findAll({attributes: ['id', 'title']}).then(response => {
		var courses = response.map(course => {
			return course.dataValues
		})
		res.render('admin.ejs', {logged: true, courses});
	}).catch(err => console.log('error ', err))
});

app.get('/create-lesson', verifyTrainer, (req, res) => {
    res.render('create_lesson.ejs', {logged: true});
});

app.get('/create-course', verifyTrainer, (req, res) => {
	models.Lesson.findAll({attributes: ['id','title']}).then(response => {
		var lessons = response.map(lesson => {
			return lesson.dataValues;
		})
    	res.render('create_course.ejs', {logged: true, lessons: lessons});
	}).catch(err => console.log('Error ', err))
});

app.get('/courses', verifyTrainer, (req, res) => {
	models.Course.findAll({attributes: ['id', 'title']}).then(response => {
		var courses = response.map(course => {
			return course.dataValues
		})
		res.render('courses.ejs', {logged: true, courses: courses});
	}).catch(err => console.log('error ', err))
});

app.get('/lessons', verifyTrainer, (req, res) => {
	models.Lesson.findAll({attributes: ['id', 'title']}).then(response => {
		var lessons = response.map(lesson => {
			return lesson.dataValues
		})
		res.render('lessons.ejs', {logged: true, lessons});
	}).catch(err => console.log('error ', err))
});

// app.get('/register', (req, res) => {
//     res.render('register.ejs', {logged: false});
//   });

app.get('/lesson/:id', verifySession, (req, res) => {
	models.Lesson.findOne({where: {id: req.params.id}}).then(response => {
		var lesson = response.dataValues
		var title = lesson.title
		var content = markdown.toHTML(lesson.content)
		res.render('lesson.ejs', {logged: true, title: title, content: content})
	}).catch(err => console.log('error ', err))
  });

app.get('/course/:id', verifySession, (req, res) => {
	var user_id = req.session.user_id
	var course_id = req.params.id
	// find course by course url
	models.Course.findOne({attributes: ['id', 'title'], where: {id: course_id}}).then(response => {
		var course = response.dataValues
		var title = course.title
		var course_id = course.id
		// find all lessons for the course
		models.Course_Lesson.findAll({attributes: ['lesson_id','course_id', 'lesson_title'], where: {course_id}}).then(response => {
			// break if no lessons for the course
			if(!response){
				res.render('course.ejs', {logged: true, title, lessons: [], course_id})
			}	
			// find finished lessons
			models.User_Lesson.findAll({attributes: ['lesson_id'], where: {course_id, user_id}}).then(d_response => {
				var ids = d_response.map(item => item.dataValues.lesson_id)
				var lessons = response.map(lesson => {
					var check = ids.indexOf(lesson.dataValues.lesson_id)
					//console.log('current check ', ids, lesson.dataValues, check)
					if(check >= 0) {
						lesson.dataValues.check = true
					}
					return lesson.dataValues;
				})
				//console.log(lessons)
				res.render('course.ejs', {logged: true, title, lessons, course_id})
			})
		}).catch(err => console.log('Error ', err))
	}).catch(err => console.log('error ', err))
  });


app.get('/course/edit/:id', verifySession, verifyTrainer, (req, res) => {
	models.Course.findOne({attributes: ['id', 'title'], where: {id: req.params.id}}).then(response => {
		var course = response.dataValues
		var title = course.title
		var course_id = course.id
		models.Lesson.findAll({attributes: ['id', 'title']}).then(l_response => {
			var all_lessons = l_response.map(lesson => {
				return lesson.dataValues;
			})
			models.Course_Lesson.findAll({attributes: ['course_id','lesson_id', 'lesson_title'], where: {course_id: course_id}}).then(response => {
				var matchs = response.map(match => {
					return match.dataValues;
				})
				console.log('Before ', all_lessons)
				matchs.forEach(function(match) {
					var id = match.lesson_id
					var index = all_lessons.findIndex(el => el.id === id)
					all_lessons[index].match = true
				})
				console.log('After ', all_lessons)
				res.render('edit_course.ejs', {logged: true, lessons: all_lessons, title: title, id: course_id});
			}).catch(err => console.log('Error ', err))	
		}).catch(err => console.log('error ', err))
	}).catch(err => console.log('error ', err))
  });

  app.get('/lesson/edit/:id', verifySession, verifyTrainer, (req, res) => {
	models.Lesson.findOne({attributes: ['id', 'title', 'content'], where: {id: req.params.id}}).then(response => {
		var lesson = response.dataValues
		res.render('edit_lesson.ejs', {logged: true, title: lesson.title, content: lesson.content, id: lesson.id})
	}).catch(err => console.log('error ', err))
  });

app.get('/course/students/:title/:id',verifySession, verifyTrainer, function(req,res){
	var course_title = req.params.title
	var course_id = req.params.id
	models.sequelize.query("SELECT * FROM course_users INNER JOIN users ON course_users.user_id = users.id WHERE course_users.course_title = ?", {replacements: [course_title]}).then(response => {
		var data = response[0]
		//console.log(data)
		res.render('course_user.ejs', {logged: true, data: data, course_title: course_title, course_id: course_id})
	}).catch(err => console.log("Error in retrieving Users: ", err))
})


// ENDPOINTS
app.post('/register', function(req, res){
	var username = req.body.username
	var password = req.body.password
	var course = req.body.course
	var course_id = course.split("-")[0]
	var course_title = course.split("-")[1]
	console.log('course user register', course)
	// admin registration
	if(!password){
		password = uuidv1().substr(0,8)
		var hashedPassword = passwordHash.generate(password);
	} else {
		var hashedPassword = passwordHash.generate(password);
	}
	var trainer = false
	//create user in database
	models.User.create({username: username, password: hashedPassword, trainer: trainer}).then(result => {
		models.Course_User.bulkCreate([{user_id: result.id, course_title, course_id}]).then(d_response => {
			console.log('Create User ', d_response)
			// send notification to user with email and password
			axios.post('https://hooks.zapier.com/hooks/catch/1872803/ohag7l8/', {username, password}).then(response => {
				res.redirect('/admin')
			}).catch(err => {
				console.log('Error in Zapier Call ', err)
				res.redirect('/admin')
			})
		}).catch(err => {
			console.log('Error in adding students to course ', err)
			res.render('error.ejs', {error: "Sorry, an Error occured. Please try again later", logged: true})
		})
	}).catch(err => {
	 	console.log('Error', err)
		 res.render('error.ejs', {error: "We think this user already exists...", logged: true})
	})
})


app.get('/all-students/:title', function(req, res) {
	var title = req.params.title
	models.sequelize.query("SELECT * FROM users").then(response => {
		var data = response[0]
		//console.log('Kurs ', title, data)
		res.json(data)
	}).catch(err => console.log('error in retrieving users', err))
})

// login functionality
app.post('/login', function(req, res){
	models.User.findOne({where: {username: req.body.username}}).then(user => {
		if(!user) res.redirect('/login')
		var user = user.dataValues
		var username = user.username
		var user_id = user.id
		var hashedPassword = user.password
		var trainer = user.trainer
		if(passwordHash.verify(req.body.password, hashedPassword)){
			req.session.user = username
			req.session.user_id = user_id
			req.session.trainer = trainer
			res.redirect('/')
		} else {
			res.redirect('/login')
		}
	}).catch(err => console.log('Error: ', err))
})

app.post('/create-lesson',verifyTrainer, function(req, res){
	var title = req.body.title
	var content = req.body.content
	models.Lesson.create({title: title, content: content}).then(response => {
		res.render('trainer.ejs', {logged: true})
	}).catch(err => {
		console.log('Error creating a lesson: ', err)
		res.render('create_lesson.ejs', {logged: true, error: "An Error occured. Most likely the Lesson Name already exists..."})
	})
})

app.post('/edit-lesson/:id',verifyTrainer, function(req, res){
	var id = req.params.id
	var { title,content } = req.body
	models.Lesson.update({ title, content },{where: {id}}).then(response => {
		res.render('trainer.ejs', {logged: true})
	}).catch(err => {
		console.log('Error edit a lesson: ', err)
		res.render('edit_lesson.ejs', {logged: true, error: "An Error occured. Most likely the Lesson Name already exists..."})
	})
})

app.post('/create-course',verifyTrainer, function(req, res){
	//console.log('Request ',req.body.title)
	var title = req.body.title
	var selected = req.body.selected
	// console.log('New Course:', title, selected)
	models.Course.create({title: title}).then(response => {
		var course_id = response.dataValues.id
		var records = []
		selected.forEach(lesson => {
			var record = {lesson_id: lesson.id,course_id: course_id, lesson_title: lesson.title}
			records.push(record)
		})
		models.Course_Lesson.bulkCreate(records).then(db_response => {
			// console.log('response', db_response)
			res.render('trainer.ejs', {logged: true})
		}).catch(err => console.log('error ', err))
	}).catch(err => console.log('error ', err))
})

// TODO: do not destroy Course!
app.post('/edit-course/:id',verifyTrainer, function(req, res){
	var course_id = req.params.id
	//console.log('Change course ' + course_id, req.body)
	var title = req.body.title
	var selected = req.body.selected
	//res.render('trainer.ejs', {logged: true})
	models.Course_Lesson.destroy({where: {course_id: course_id}}).then(response => {
		// delete complete - now create
			var records = []
			selected.forEach(lesson => {
				var record = {lesson_id: lesson.id,course_id: course_id, lesson_title: lesson.title}
				records.push(record)
			})
			models.Course_Lesson.bulkCreate(records).then(db_response => {
				res.render('trainer.ejs', {logged: true})
			}).catch(err => console.log('error ', err))
	}).catch(err => console.log('error ', err))
})

app.get('/logout', function(req, res) {
	req.session.destroy()
	res.redirect('/login')
})

app.post('/check-lesson', function(req, res){
	var user_id = req.session.user_id
	var { course_id, lesson_id } = req.body
	models.User_Lesson.findAll({where: {course_id, user_id, lesson_id}}).then(d_response => {
		var result = d_response[0]
		if(result){
			// remove
			models.User_Lesson.destroy({where: {course_id, user_id, lesson_id}}).then(response => {
				res.status(200).json({result: 'removed'})
			})
		} else {
			// add
			models.User_Lesson.create({course_id, user_id, lesson_id}).then(response => {
				res.status(200).json({result: 'added'})
			})
		}
	})
})

app.post('/add-students',verifySession, verifyTrainer, function(req, res) {
	//console.log('Change students ', req.body)
	models.Course_User.bulkCreate(req.body.selected).then(d_response => {
		console.log('Create User ', d_response)
		res.status(200).json({result: 'success'})
	}).catch(err => console.log('Error in adding students to course ', err))
})

app.get('/remove/:course_id/:user_id', function(req, res) {
	var { course_id, user_id } = req.params
	models.Course_User.destroy({where: {course_id: course_id, user_id: user_id}}).then(d_response => {
		res.status(200).json({result: 'success'})
	}).catch(err => console.log('Error in removing student ', err))
})

// start web server
app.listen(process.env.PORT, function(){
	console.log('Web Server started', process.env.PORT)
})